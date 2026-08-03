import { getAppDataClient } from './data/AppDataClient.js';
import { generateId } from './ids.js';
import { refToRecordName, refValue } from './recordRef.js';
import { Gender } from '../models/index.js';
import { createWithChangeLog } from './recordWrite.js';
import { saveWithChangeLog } from './changeLog.js';

const CSV_NAME_KEYS = ['name', 'full name', 'fullname', 'display name', 'fn'];
const CSV_FIRST_KEYS = ['first', 'first name', 'firstname', 'given', 'given name'];
const CSV_MIDDLE_KEYS = ['middle', 'middle name', 'middlename', 'additional name'];
const CSV_LAST_KEYS = ['last', 'last name', 'lastname', 'surname', 'family name'];
const CSV_EMAIL_KEYS = ['email', 'e-mail', 'email address'];
const CSV_PHONE_KEYS = ['phone', 'telephone', 'mobile', 'cell'];
const CSV_BIRTH_KEYS = ['birth', 'birthday', 'birth date', 'birthdate', 'bday'];
const CSV_DEATH_KEYS = ['death', 'death date', 'deathdate'];
const CSV_NOTE_KEYS = ['note', 'notes', 'memo'];
const CSV_SPOUSE_KEYS = ['spouse', 'wife', 'husband', 'partner'];
const CSV_FATHER_KEYS = ['father', 'dad'];
const CSV_MOTHER_KEYS = ['mother', 'mom', 'mum'];
const CSV_CHILD_KEYS = ['child', 'children', 'son', 'daughter'];

export async function importContactsFile(file) {
  const entries = await readContactsFile(file);
  return importContactEntries(entries);
}

/** Parse a file without writing so the UI can show the relationship step. */
export async function readContactsFile(file) {
  const text = await file.text();
  const lowerName = String(file.name || '').toLowerCase();
  const entries = lowerName.endsWith('.vcf') || lowerName.endsWith('.vcard') || text.includes('BEGIN:VCARD')
    ? buildVCardEntries(text)
    : buildCSVEntries(text);
  if (!entries.length) throw new Error('No contacts found in that file.');
  return entries;
}

/** Contact Picker API availability (Chromium on Android + desktop behind flag). */
export function contactPickerSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.contacts?.select === 'function';
}

/**
 * Open the browser's native Contact Picker and import the picked contacts as
 * Person records — the browser bridge for MacFamilyTree's Address Book import.
 */
export async function importContactsViaPicker() {
  return importContactEntries(await pickContactsViaPicker());
}

/** Pick contacts without writing so relationship choices can be reviewed. */
export async function pickContactsViaPicker() {
  if (!contactPickerSupported()) throw new Error('The Contact Picker is not supported in this browser.');
  const picked = await navigator.contacts.select(['name', 'email', 'tel'], { multiple: true });
  const entries = (picked || [])
    .map((contact) => contactToEntry({
      fullName: contact.name?.[0] || '',
      email: contact.email?.[0] || '',
      phone: contact.tel?.[0] || '',
    }))
    .filter(Boolean);
  if (!entries.length) throw new Error('No contacts selected.');
  return entries;
}

export async function importContactEntries(entries, { anchorPersonId = '', relationshipByContact = {} } = {}) {
  return saveContactEntries(entries, { anchorPersonId, relationshipByContact });
}

/**
 * Persist the parsed person records, then reconstruct family structure (#34)
 * from any relationship hints (vCard RELATED / Apple X-ABRELATEDNAMES, or CSV
 * spouse/father/mother/child columns) by matching related names to the people
 * we just imported plus those already in the tree.
 */
async function saveContactEntries(entries, { anchorPersonId = '', relationshipByContact = {} } = {}) {
  const db = getAppDataClient().records;
  const records = entries.map((entry) => entry.record);
  for (const record of records) await createWithChangeLog(record);
  const hasGuidedChoices = anchorPersonId && Object.values(relationshipByContact).some((value) => value && value !== 'unrelated');
  const plan = hasGuidedChoices
    ? await planGuidedContactRelationships(entries, { anchorPersonId, relationshipByContact }, db)
    : { creates: await linkContactRelations(entries, db), updates: [] };
  for (const record of plan.creates) await createWithChangeLog(record);
  for (const record of plan.updates) await saveWithChangeLog(record);
  return { created: records.length, relationships: plan.creates.length + plan.updates.length, records };
}

/**
 * Build the family changes for the guided mapping step. Existing family
 * records are returned as updates; all new families/child links are creates.
 */
export async function planGuidedContactRelationships(entries, { anchorPersonId, relationshipByContact }, db = getAppDataClient().records) {
  if (!anchorPersonId) return { creates: [], updates: [] };
  const [familyResult, childResult] = await Promise.all([
    db.query('Family', { limit: 100000 }),
    db.query('ChildRelation', { limit: 100000 }),
  ]);
  const families = familyResult.records.map((record) => ({ ...record, fields: { ...record.fields } }));
  const childRelations = [...childResult.records];
  const creates = [];
  const updatedIds = new Set();
  const newFamilyIds = new Set();
  const childKeys = new Set(childRelations.map((relation) => `${refName(relation.fields?.family?.value)}|${refName(relation.fields?.child?.value)}`));

  const makeFamily = () => {
    const family = { recordName: generateId('family-contact'), recordType: 'Family', fields: {} };
    families.push(family);
    creates.push(family);
    newFamilyIds.add(family.recordName);
    return family;
  };
  const markFamily = (family) => { if (!newFamilyIds.has(family.recordName)) updatedIds.add(family.recordName); };
  const partners = (family) => [refName(family.fields?.man?.value), refName(family.fields?.woman?.value)].filter(Boolean);
  const familyForPerson = (personId) => families.find((family) => partners(family).includes(personId));
  const parentFamilyFor = (personId) => {
    const relation = childRelations.find((item) => refName(item.fields?.child?.value) === personId);
    return families.find((family) => family.recordName === refName(relation?.fields?.family?.value));
  };
  const setPartner = (family, personId, preferredSlot = '') => {
    if (!personId || partners(family).includes(personId)) return;
    const slots = preferredSlot ? [preferredSlot, preferredSlot === 'man' ? 'woman' : 'man'] : ['man', 'woman'];
    const slot = slots.find((name) => !family.fields[name]);
    if (!slot) return;
    family.fields[slot] = { value: refValue(personId, 'Person'), type: 'REFERENCE' };
    markFamily(family);
  };
  const addChild = (family, personId) => {
    const key = `${family.recordName}|${personId}`;
    if (!personId || childKeys.has(key)) return;
    childKeys.add(key);
    const relation = {
      recordName: generateId('cr-contact'),
      recordType: 'ChildRelation',
      fields: { family: { value: refValue(family.recordName, 'Family'), type: 'REFERENCE' }, child: { value: refValue(personId, 'Person'), type: 'REFERENCE' } },
    };
    childRelations.push(relation);
    creates.push(relation);
  };
  const ensureCouple = (first, second) => {
    let family = families.find((item) => partners(item).includes(first) && partners(item).includes(second));
    if (!family) {
      family = families.find((item) => partners(item).includes(first) && partners(item).length < 2) || makeFamily();
    }
    setPartner(family, first);
    setPartner(family, second);
    return family;
  };
  const ensureParentFamily = (personId) => {
    const family = parentFamilyFor(personId) || makeFamily();
    addChild(family, personId);
    return family;
  };

  for (const entry of entries) {
    const importedId = entry.record.recordName;
    const relation = relationshipByContact[importedId] || 'unrelated';
    if (relation === 'spouse') ensureCouple(anchorPersonId, importedId);
    else if (relation === 'child') {
      const family = familyForPerson(anchorPersonId) || makeFamily();
      setPartner(family, anchorPersonId);
      addChild(family, importedId);
    } else if (relation === 'parent' || relation === 'father' || relation === 'mother') {
      const family = ensureParentFamily(anchorPersonId);
      setPartner(family, importedId, relation === 'father' ? 'man' : relation === 'mother' ? 'woman' : '');
    } else if (relation === 'sibling') {
      addChild(ensureParentFamily(anchorPersonId), importedId);
    } else if (relation === 'in-law') {
      const parentFamily = parentFamilyFor(anchorPersonId);
      const siblingId = parentFamily
        ? childRelations.map((item) => refName(item.fields?.family?.value) === parentFamily.recordName ? refName(item.fields?.child?.value) : '').find((id) => id && id !== anchorPersonId)
        : '';
      const spouseFamily = familyForPerson(anchorPersonId);
      const spouseId = spouseFamily ? partners(spouseFamily).find((id) => id !== anchorPersonId) : '';
      if (siblingId) ensureCouple(siblingId, importedId);
      else if (spouseId) addChild(ensureParentFamily(spouseId), importedId);
      else creates.push({
        recordName: generateId('associate-contact'),
        recordType: 'AssociateRelation',
        fields: {
          person: { value: refValue(anchorPersonId, 'Person'), type: 'REFERENCE' },
          associate: { value: refValue(importedId, 'Person'), type: 'REFERENCE' },
          relationType: { value: 'in-law', type: 'STRING' },
        },
      });
    }
  }

  const updates = families.filter((family) => updatedIds.has(family.recordName));
  return { creates, updates };
}

async function linkContactRelations(entries, db) {
  const hasRelations = entries.some((entry) => entry.relations.length);
  if (!hasRelations) return [];

  // Name → recordName lookup, biased to this import batch but falling back to
  // people already in the tree so a contact can link to an existing ancestor.
  const nameToId = new Map();
  const genderById = new Map();
  const register = (recordName, fullName, gender) => {
    const key = nameKey(fullName);
    if (key && !nameToId.has(key)) nameToId.set(key, recordName);
    if (gender != null) genderById.set(recordName, gender);
  };
  try {
    const existing = await db.query('Person', { limit: 100000 });
    for (const person of existing.records || []) {
      const full = person.fields?.cached_fullName?.value
        || [person.fields?.firstName?.value, person.fields?.lastName?.value].filter(Boolean).join(' ');
      register(person.recordName, full, person.fields?.gender?.value);
    }
  } catch { /* best-effort: fall back to in-batch matching only */ }
  for (const entry of entries) {
    register(entry.record.recordName, entry.nameKey, entry.record.fields?.gender?.value);
  }

  const out = [];
  const familyByKey = new Map();
  const coupleFamilyByPerson = new Map();
  const childRelKeys = new Set();

  const ensureFamily = (key) => {
    let family = familyByKey.get(key);
    if (!family) {
      family = { recordName: generateId('family-contact'), recordType: 'Family', fields: {} };
      familyByKey.set(key, family);
      out.push(family);
    }
    return family;
  };
  const setPartner = (family, personId) => {
    if (!personId) return;
    const gender = genderById.get(personId);
    const manRef = refValue(personId, 'Person');
    if (gender === Gender.Female) {
      if (!family.fields.woman) family.fields.woman = { value: manRef, type: 'REFERENCE' };
      else if (!family.fields.man) family.fields.man = { value: manRef, type: 'REFERENCE' };
    } else if (gender === Gender.Male) {
      if (!family.fields.man) family.fields.man = { value: manRef, type: 'REFERENCE' };
      else if (!family.fields.woman) family.fields.woman = { value: manRef, type: 'REFERENCE' };
    } else if (!family.fields.man) {
      family.fields.man = { value: manRef, type: 'REFERENCE' };
    } else if (!family.fields.woman) {
      family.fields.woman = { value: manRef, type: 'REFERENCE' };
    }
  };
  const addChild = (family, childId) => {
    if (!childId) return;
    const key = `${family.recordName}|${childId}`;
    if (childRelKeys.has(key)) return;
    childRelKeys.add(key);
    out.push({
      recordName: generateId('cr-contact'),
      recordType: 'ChildRelation',
      fields: {
        family: { value: refValue(family.recordName, 'Family'), type: 'REFERENCE' },
        child: { value: refValue(childId, 'Person'), type: 'REFERENCE' },
      },
    });
  };

  const resolve = (name) => nameToId.get(nameKey(name)) || null;

  // Pass 1 — couples (so children can be attached to the shared family later).
  for (const entry of entries) {
    const self = entry.record.recordName;
    for (const rel of entry.relations) {
      if (rel.type !== 'spouse') continue;
      const other = resolve(rel.name);
      if (!other || other === self) continue;
      const key = `couple:${[self, other].sort().join('|')}`;
      const family = ensureFamily(key);
      setPartner(family, self);
      setPartner(family, other);
      coupleFamilyByPerson.set(self, family);
      coupleFamilyByPerson.set(other, family);
    }
  }

  // Pass 2 — parents of self, and self's own children.
  for (const entry of entries) {
    const self = entry.record.recordName;
    const parents = [];
    const childIds = [];
    for (const rel of entry.relations) {
      const other = resolve(rel.name);
      if (!other || other === self) continue;
      if (rel.type === 'father' || rel.type === 'mother' || rel.type === 'parent') parents.push(other);
      else if (rel.type === 'child') childIds.push(other);
    }
    if (parents.length) {
      const parentFamily = coupleFamilyByPerson.get(parents[0])
        || ensureFamily(`parents:${[...parents].sort().join('|')}`);
      for (const parent of parents) setPartner(parentFamily, parent);
      addChild(parentFamily, self);
    }
    if (childIds.length) {
      const family = coupleFamilyByPerson.get(self) || ensureFamily(`parent-of:${self}`);
      setPartner(family, self);
      for (const childId of childIds) addChild(family, childId);
    }
  }

  return out;
}

function buildCSVEntries(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => normalizeKey(header));
  return rows.slice(1).map((row) => {
    const data = {};
    headers.forEach((header, index) => { data[header] = row[index] || ''; });
    const relations = [];
    pushRelations(relations, 'spouse', pick(data, CSV_SPOUSE_KEYS));
    pushRelations(relations, 'father', pick(data, CSV_FATHER_KEYS));
    pushRelations(relations, 'mother', pick(data, CSV_MOTHER_KEYS));
    pushRelations(relations, 'child', pick(data, CSV_CHILD_KEYS));
    return contactToEntry({
      fullName: pick(data, CSV_NAME_KEYS),
      firstName: pick(data, CSV_FIRST_KEYS),
      middleName: pick(data, CSV_MIDDLE_KEYS),
      lastName: pick(data, CSV_LAST_KEYS),
      email: pick(data, CSV_EMAIL_KEYS),
      phone: pick(data, CSV_PHONE_KEYS),
      birthDate: pick(data, CSV_BIRTH_KEYS),
      deathDate: pick(data, CSV_DEATH_KEYS),
      note: pick(data, CSV_NOTE_KEYS),
      relations,
    });
  }).filter(Boolean);
}

function buildVCardEntries(text) {
  const cards = String(text || '').split(/BEGIN:VCARD/i).slice(1);
  return cards.map((card) => parseVCard(card)).filter(Boolean).map(contactToEntry).filter(Boolean);
}

function parseVCard(card) {
  const contact = { relations: [] };
  // Apple Contacts groups related names with an item label, e.g.
  //   item1.X-ABRELATEDNAMES:Jane Doe
  //   item1.X-ABLABEL:_$!<Spouse>!$_
  const groupNames = new Map();
  const groupLabels = new Map();
  for (const rawLine of unfoldVCardLines(card)) {
    const line = rawLine.trim();
    if (!line || /^END:VCARD/i.test(line)) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const rawKey = line.slice(0, colon);
    const params = rawKey.split(';');
    const groupAndName = params[0].split('.');
    const group = groupAndName.length > 1 ? groupAndName[0] : '';
    const key = (groupAndName.at(-1) || '').toUpperCase();
    const value = unescapeVCard(line.slice(colon + 1));
    if (key === 'FN') contact.fullName = value;
    else if (key === 'N') {
      const [lastName, firstName, middleName, prefix, suffix] = value.split(';');
      Object.assign(contact, { firstName, middleName, lastName, prefix, suffix });
    } else if (key === 'EMAIL' && !contact.email) contact.email = value;
    else if (key === 'TEL' && !contact.phone) contact.phone = value;
    else if (key === 'BDAY') contact.birthDate = value;
    else if (key === 'NOTE') contact.note = value;
    else if (key === 'GENDER') contact.gender = value;
    else if (key === 'ADR' && !contact.address) contact.address = value.split(';').filter(Boolean).join(', ');
    else if (key === 'RELATED') {
      const typeParam = params.find((p) => /^TYPE=/i.test(p));
      const type = typeParam ? typeParam.slice(5) : '';
      pushRelations(contact.relations, normalizeRelationType(type), relatedNameFromValue(value));
    } else if (key === 'X-ABRELATEDNAMES') {
      if (group) groupNames.set(group, value);
      else pushRelations(contact.relations, 'spouse', value);
    } else if (key === 'X-ABLABEL') {
      if (group) groupLabels.set(group, value);
    }
  }
  for (const [group, name] of groupNames) {
    pushRelations(contact.relations, normalizeRelationType(groupLabels.get(group)), name);
  }
  return contact.fullName || contact.firstName || contact.lastName || contact.email ? contact : null;
}

function contactToEntry(contact) {
  const record = contactToPersonRecord(contact);
  if (!record) return null;
  return {
    record,
    nameKey: record.fields?.cached_fullName?.value || '',
    relations: (contact.relations || []).filter((rel) => rel && rel.type && rel.name),
  };
}

function contactToPersonRecord(contact) {
  const parsed = splitName(contact.fullName || '', contact);
  const firstName = clean(contact.firstName || parsed.firstName);
  const middleName = clean(contact.middleName || parsed.middleName);
  const lastName = clean(contact.lastName || parsed.lastName);
  const fullName = clean(contact.fullName || [firstName, middleName, lastName].filter(Boolean).join(' '));
  if (!firstName && !lastName && !fullName) return null;
  const record = {
    recordName: generateId('person-contact'),
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
  const gender = genderFromString(contact.gender);
  if (gender != null) record.fields.gender = { value: gender, type: 'NUMBER' };
  if (clean(contact.email)) record.fields.email = { value: clean(contact.email), type: 'STRING' };
  if (clean(contact.phone)) record.fields.phone = { value: clean(contact.phone), type: 'STRING' };
  if (clean(contact.address)) record.fields.address = { value: clean(contact.address), type: 'STRING' };
  if (clean(contact.birthDate)) record.fields.cached_birthDate = { value: clean(contact.birthDate), type: 'STRING' };
  if (clean(contact.deathDate)) record.fields.cached_deathDate = { value: clean(contact.deathDate), type: 'STRING' };
  if (clean(contact.note)) record.fields.contactImportNote = { value: clean(contact.note), type: 'STRING' };
  return record;
}

function pushRelations(list, type, value) {
  if (!type || !value) return;
  // CSV columns may pack several names with ; or , separators.
  for (const name of String(value).split(/[;,]/)) {
    const trimmed = clean(name);
    if (trimmed) list.push({ type, name: trimmed });
  }
}

function normalizeRelationType(raw) {
  const t = clean(raw).toLowerCase().replace(/[_$!<>]/g, '').trim();
  if (!t) return null;
  if (/spouse|wife|husband|partner|married/.test(t)) return 'spouse';
  if (/father|dad/.test(t)) return 'father';
  if (/mother|mom|mum/.test(t)) return 'mother';
  if (/parent/.test(t)) return 'parent';
  if (/son|daughter|child/.test(t)) return 'child';
  return null;
}

function relatedNameFromValue(value) {
  // RELATED values may be a plain name or a URI (urn:uuid:…, mailto:…). We can
  // only link plain names, so drop URIs.
  const text = clean(value);
  if (/^[a-z]+:/i.test(text)) return '';
  return text;
}

function genderFromString(value) {
  const t = clean(value).toLowerCase()[0];
  if (t === 'm') return Gender.Male;
  if (t === 'f') return Gender.Female;
  return null;
}

function nameKey(value) {
  return clean(value).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
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

function refName(value) {
  if (!value) return '';
  if (typeof value === 'string') return refToRecordName(value) || value;
  return value.recordName || value.id || value.identifier || '';
}
