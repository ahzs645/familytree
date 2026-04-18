/**
 * GEDCOM 5.5 / 5.5.1 importer (subset). Parses INDI / FAM / SOUR / NOTE
 * records and the most common event tags into our IndexedDB record shape.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { refValue } from './recordRef.js';
import { Gender } from '../models/index.js';

function tokenizeLine(line) {
  // "level [@xref@] tag [value]"
  const m = line.match(/^\s*(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?:\s+(.*))?$/);
  if (!m) return null;
  return { level: +m[1], xref: m[2] || null, tag: m[3], value: m[4] || '' };
}

function parseGedcomTree(text) {
  const lines = text.split(/\r?\n/);
  const root = { children: [] };
  const stack = [root];
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const t = tokenizeLine(raw);
    if (!t) continue;
    while (stack.length > t.level + 1) stack.pop();
    const node = { ...t, children: [] };
    const parent = stack[stack.length - 1] || root;
    parent.children.push(node);
    stack.push(node);
  }
  return root.children;
}

function child(node, tag) { return node.children.find((c) => c.tag === tag); }
function children(node, tag) { return node.children.filter((c) => c.tag === tag); }

const EVENT_TAG_TO_NAME = {
  BIRT: 'Birth', DEAT: 'Death', BURI: 'Burial', BAPM: 'Baptism', CHR: 'Christening',
  MARR: 'Marriage', DIV: 'Divorced', ENGA: 'Engagement', ANUL: 'Annuled',
  NATU: 'Naturalization', EMIG: 'Emigration', IMMI: 'Immigration', CENS: 'Census',
  GRAD: 'Graduation', OCCU: 'Occupation', RESI: 'Residence', RELI: 'Religion',
  WILL: 'Will', PROB: 'Probate', ADOP: 'Adoption', EVEN: 'GenericEvent',
};

let _seq = 0;
function uuid(prefix) {
  _seq++;
  return `${prefix}-${Date.now().toString(36)}-${_seq.toString(36)}`;
}

export function parseGedcom(text) {
  const tree = parseGedcomTree(text);
  const records = [];
  const personByXref = new Map();
  const familyByXref = new Map();
  const sourceByXref = new Map();

  // First pass: stub records for every top-level entity
  for (const top of tree) {
    if (top.tag === 'INDI' && top.xref) {
      const id = uuid('person-imp');
      personByXref.set(top.xref, id);
      records.push(stubPerson(id, top));
    } else if (top.tag === 'FAM' && top.xref) {
      const id = uuid('family-imp');
      familyByXref.set(top.xref, id);
      records.push(stubFamily(id, top));
    } else if (top.tag === 'SOUR' && top.xref) {
      const id = uuid('source-imp');
      sourceByXref.set(top.xref, id);
      records.push(stubSource(id, top));
    }
  }

  // Second pass: events + relationships
  const families = new Map(records.filter((r) => r.recordType === 'Family').map((r) => [r.recordName, r]));
  for (const top of tree) {
    if (top.tag === 'INDI') {
      const personId = personByXref.get(top.xref);
      if (!personId) continue;
      const person = records.find((r) => r.recordName === personId);
      // Events
      for (const ev of top.children) {
        const name = EVENT_TAG_TO_NAME[ev.tag];
        if (!name) continue;
        const eventRec = {
          recordName: uuid('pe-imp'),
          recordType: 'PersonEvent',
          fields: {
            person: { value: refValue(personId, 'Person'), type: 'REFERENCE' },
            conclusionType: { value: name, type: 'STRING' },
          },
        };
        const date = child(ev, 'DATE')?.value;
        const place = child(ev, 'PLAC')?.value;
        const note = child(ev, 'NOTE')?.value;
        if (date) eventRec.fields.date = { value: date, type: 'STRING' };
        if (place) eventRec.fields.placeName = { value: place, type: 'STRING' };
        if (note) eventRec.fields.description = { value: note, type: 'STRING' };
        records.push(eventRec);
        // Cache shortcuts on the person record
        if (name === 'Birth' && date) person.fields.cached_birthDate = { value: date, type: 'STRING' };
        if (name === 'Death' && date) person.fields.cached_deathDate = { value: date, type: 'STRING' };
      }
      // Notes
      for (const n of children(top, 'NOTE')) {
        if (n.value) records.push({
          recordName: uuid('note-imp'),
          recordType: 'Note',
          fields: {
            person: { value: refValue(personId, 'Person'), type: 'REFERENCE' },
            text: { value: n.value, type: 'STRING' },
          },
        });
      }
    } else if (top.tag === 'FAM') {
      const familyId = familyByXref.get(top.xref);
      if (!familyId) continue;
      const fam = families.get(familyId);
      const husb = child(top, 'HUSB')?.value;
      const wife = child(top, 'WIFE')?.value;
      const husbRecord = husb && personByXref.get(husb);
      const wifeRecord = wife && personByXref.get(wife);
      if (husbRecord) fam.fields.man = { value: refValue(husbRecord, 'Person'), type: 'REFERENCE' };
      if (wifeRecord) fam.fields.woman = { value: refValue(wifeRecord, 'Person'), type: 'REFERENCE' };

      const marr = child(top, 'MARR');
      if (marr) {
        const date = child(marr, 'DATE')?.value;
        if (date) fam.fields.cached_marriageDate = { value: date, type: 'STRING' };
        records.push({
          recordName: uuid('fe-imp'),
          recordType: 'FamilyEvent',
          fields: {
            family: { value: refValue(familyId, 'Family'), type: 'REFERENCE' },
            conclusionType: { value: 'Marriage', type: 'STRING' },
            ...(date ? { date: { value: date, type: 'STRING' } } : {}),
          },
        });
      }

      let order = 0;
      for (const c of children(top, 'CHIL')) {
        const childId = personByXref.get(c.value);
        if (!childId) continue;
        records.push({
          recordName: uuid('cr-imp'),
          recordType: 'ChildRelation',
          fields: {
            family: { value: refValue(familyId, 'Family'), type: 'REFERENCE' },
            child: { value: refValue(childId, 'Person'), type: 'REFERENCE' },
            order: { value: order++, type: 'NUMBER' },
          },
        });
      }
    }
  }

  return records;
}

export function analyzeGedcomText(text) {
  const lines = String(text || '').split(/\r?\n/);
  const issues = [];
  const counts = { INDI: 0, FAM: 0, SOUR: 0, NOTE: 0, OBJE: 0, unsupportedEvents: 0 };
  let hasHead = false;
  let hasTrailer = false;
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    const token = tokenizeLine(line);
    if (!token) {
      issues.push(issue('error', index + 1, 'Line does not match GEDCOM level/tag syntax.'));
      continue;
    }
    if (token.level === 0 && token.tag === 'HEAD') hasHead = true;
    if (token.level === 0 && token.tag === 'TRLR') hasTrailer = true;
    if (token.level === 0 && counts[token.tag] !== undefined) counts[token.tag] += 1;
    if (token.tag === 'OBJE') counts.OBJE += 1;
    if (token.level > 0 && /^[A-Z0-9_]+$/.test(token.tag) && token.tag.length >= 3 && !EVENT_TAG_TO_NAME[token.tag] && eventLikeTag(token.tag)) {
      counts.unsupportedEvents += 1;
      issues.push(issue('warning', index + 1, `Event-like tag ${token.tag} is not mapped by the importer.`));
    }
  }
  if (!hasHead) issues.push(issue('warning', 0, 'Missing HEAD record.'));
  if (!hasTrailer) issues.push(issue('warning', 0, 'Missing TRLR record.'));
  if (counts.OBJE > 0) issues.push(issue('warning', 0, `${counts.OBJE} media object reference(s) found; media files are not imported by the GEDCOM subset importer.`));
  return {
    counts,
    issues,
    canImport: !issues.some((item) => item.severity === 'error'),
  };
}

function stubPerson(id, indi) {
  const fields = {};
  const name = child(indi, 'NAME')?.value || '';
  // GEDCOM name format: "Given /Surname/"
  const m = name.match(/^([^/]*?)\s*\/([^/]*)\//);
  const given = m ? m[1].trim() : name.trim();
  const surname = m ? m[2].trim() : '';
  if (given) fields.firstName = { value: given.split(' ')[0], type: 'STRING' };
  const middle = given.split(' ').slice(1).join(' ');
  if (middle) fields.nameMiddle = { value: middle, type: 'STRING' };
  if (surname) fields.lastName = { value: surname, type: 'STRING' };
  if (given || surname) fields.cached_fullName = { value: `${given} ${surname}`.trim(), type: 'STRING' };
  const sex = child(indi, 'SEX')?.value;
  if (sex === 'M') fields.gender = { value: Gender.Male, type: 'NUMBER' };
  else if (sex === 'F') fields.gender = { value: Gender.Female, type: 'NUMBER' };
  return { recordName: id, recordType: 'Person', fields };
}
function stubFamily(id) { return { recordName: id, recordType: 'Family', fields: {} }; }
function stubSource(id, sour) {
  const fields = {};
  const title = child(sour, 'TITL')?.value;
  const author = child(sour, 'AUTH')?.value;
  const text = child(sour, 'TEXT')?.value;
  if (title) {
    fields.title = { value: title, type: 'STRING' };
    fields.cached_title = { value: title, type: 'STRING' };
  }
  if (author) fields.author = { value: author, type: 'STRING' };
  if (text) fields.text = { value: text, type: 'STRING' };
  return { recordName: id, recordType: 'Source', fields };
}

export async function importGedcomText(text) {
  const records = parseGedcom(text);
  const db = getLocalDatabase();
  for (const r of records) await db.saveRecord(r);
  return records.length;
}

function eventLikeTag(tag) {
  return ['BIRT', 'DEAT', 'MARR', 'DIV', 'EVEN', 'FACT', 'ADOP', 'BURI', 'RESI', 'OCCU', 'CENS', 'IMMI', 'EMIG', 'NATU'].includes(tag);
}

function issue(severity, line, message) {
  return { severity, line, message };
}
