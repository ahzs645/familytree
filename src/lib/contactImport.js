import { getLocalDatabase } from './LocalDatabase.js';

const CSV_NAME_KEYS = ['name', 'full name', 'fullname', 'display name', 'fn'];
const CSV_FIRST_KEYS = ['first', 'first name', 'firstname', 'given', 'given name'];
const CSV_MIDDLE_KEYS = ['middle', 'middle name', 'middlename', 'additional name'];
const CSV_LAST_KEYS = ['last', 'last name', 'lastname', 'surname', 'family name'];
const CSV_EMAIL_KEYS = ['email', 'e-mail', 'email address'];
const CSV_PHONE_KEYS = ['phone', 'telephone', 'mobile', 'cell'];
const CSV_BIRTH_KEYS = ['birth', 'birthday', 'birth date', 'birthdate', 'bday'];
const CSV_DEATH_KEYS = ['death', 'death date', 'deathdate'];
const CSV_NOTE_KEYS = ['note', 'notes', 'memo'];

export async function importContactsFile(file) {
  const text = await file.text();
  const lowerName = String(file.name || '').toLowerCase();
  const records = lowerName.endsWith('.vcf') || lowerName.endsWith('.vcard') || text.includes('BEGIN:VCARD')
    ? parseVCardContacts(text)
    : parseCSVContacts(text);
  if (!records.length) throw new Error('No contacts found in that file.');
  const db = getLocalDatabase();
  await db.saveRecords(records);
  return { created: records.length, records };
}

export function parseCSVContacts(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => normalizeKey(header));
  return rows.slice(1).map((row) => {
    const data = {};
    headers.forEach((header, index) => { data[header] = row[index] || ''; });
    return contactToPersonRecord({
      fullName: pick(data, CSV_NAME_KEYS),
      firstName: pick(data, CSV_FIRST_KEYS),
      middleName: pick(data, CSV_MIDDLE_KEYS),
      lastName: pick(data, CSV_LAST_KEYS),
      email: pick(data, CSV_EMAIL_KEYS),
      phone: pick(data, CSV_PHONE_KEYS),
      birthDate: pick(data, CSV_BIRTH_KEYS),
      deathDate: pick(data, CSV_DEATH_KEYS),
      note: pick(data, CSV_NOTE_KEYS),
    });
  }).filter(Boolean);
}

export function parseVCardContacts(text) {
  const cards = String(text || '').split(/BEGIN:VCARD/i).slice(1);
  return cards.map((card) => parseVCard(card)).filter(Boolean).map(contactToPersonRecord).filter(Boolean);
}

function parseVCard(card) {
  const contact = {};
  for (const rawLine of unfoldVCardLines(card)) {
    const line = rawLine.trim();
    if (!line || /^END:VCARD/i.test(line)) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).split(';')[0].toUpperCase();
    const value = unescapeVCard(line.slice(colon + 1));
    if (key === 'FN') contact.fullName = value;
    if (key === 'N') {
      const [lastName, firstName, middleName, prefix, suffix] = value.split(';');
      Object.assign(contact, { firstName, middleName, lastName, prefix, suffix });
    }
    if (key === 'EMAIL' && !contact.email) contact.email = value;
    if (key === 'TEL' && !contact.phone) contact.phone = value;
    if (key === 'BDAY') contact.birthDate = value;
    if (key === 'NOTE') contact.note = value;
    if (key === 'ADR' && !contact.address) contact.address = value.split(';').filter(Boolean).join(', ');
  }
  return contact.fullName || contact.firstName || contact.lastName || contact.email ? contact : null;
}

function contactToPersonRecord(contact) {
  const parsed = splitName(contact.fullName || '', contact);
  const firstName = clean(contact.firstName || parsed.firstName);
  const middleName = clean(contact.middleName || parsed.middleName);
  const lastName = clean(contact.lastName || parsed.lastName);
  const fullName = clean(contact.fullName || [firstName, middleName, lastName].filter(Boolean).join(' '));
  if (!firstName && !lastName && !fullName) return null;
  const record = {
    recordName: `person-contact-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    recordType: 'Person',
    fields: {
      cached_fullName: { value: fullName || [firstName, lastName].filter(Boolean).join(' '), type: 'STRING' },
    },
  };
  if (firstName) record.fields.firstName = { value: firstName, type: 'STRING' };
  if (middleName) record.fields.nameMiddle = { value: middleName, type: 'STRING' };
  if (lastName) record.fields.lastName = { value: lastName, type: 'STRING' };
  if (clean(contact.prefix)) record.fields.namePrefix = { value: clean(contact.prefix), type: 'STRING' };
  if (clean(contact.suffix)) record.fields.nameSuffix = { value: clean(contact.suffix), type: 'STRING' };
  if (clean(contact.email)) record.fields.email = { value: clean(contact.email), type: 'STRING' };
  if (clean(contact.phone)) record.fields.phone = { value: clean(contact.phone), type: 'STRING' };
  if (clean(contact.address)) record.fields.address = { value: clean(contact.address), type: 'STRING' };
  if (clean(contact.birthDate)) record.fields.cached_birthDate = { value: clean(contact.birthDate), type: 'STRING' };
  if (clean(contact.deathDate)) record.fields.cached_deathDate = { value: clean(contact.deathDate), type: 'STRING' };
  if (clean(contact.note)) record.fields.contactImportNote = { value: clean(contact.note), type: 'STRING' };
  return record;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  const input = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function unfoldVCardLines(card) {
  return String(card || '').replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
}

function unescapeVCard(value) {
  return String(value || '').replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function pick(data, keys) {
  for (const key of keys) {
    const value = data[normalizeKey(key)];
    if (value) return value;
  }
  return '';
}

function splitName(fullName, contact = {}) {
  const parts = clean(fullName).split(/\s+/).filter(Boolean);
  if (contact.firstName || contact.lastName) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  if (parts.length === 2) return { firstName: parts[0], lastName: parts[1] };
  if (parts.length > 2) return { firstName: parts[0], middleName: parts.slice(1, -1).join(' '), lastName: parts.at(-1) };
  return {};
}

function clean(value) {
  return String(value || '').trim();
}

function normalizeKey(value) {
  return clean(value).toLowerCase().replace(/[_-]+/g, ' ');
}
