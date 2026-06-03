import { Gender } from '../../models/index.js';
import { compactFields, field, refValue } from './gwShared.js';

let sequence = 0;

function id(prefix) {
  sequence += 1;
  return `${prefix}-gw-${sequence.toString(36)}`;
}

export function looksLikeGeneWebText(text = '') {
  return /(^|\n)\s*(gwplus|gw|fam\s+\S+\s+\S+|pevt\s+\S+\s+\S+)\b/i.test(String(text));
}

export function parseGeneWeb(text, options = {}) {
  return parseGeneWebParts(text, options).records;
}

export function parseGeneWebParts(text, { sourceName = '' } = {}) {
  sequence = 0;
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const state = {
    records: [],
    persons: new Map(),
    families: [],
    meta: { format: 'geneweb-gw', sourceName },
  };

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('encoding:')) {
      state.meta.encoding = line.slice('encoding:'.length).trim();
      continue;
    }
    if (line === 'gwplus' || line === 'gw') {
      state.meta.variant = line;
      continue;
    }
    if (line.startsWith('fam ')) {
      index = parseFamilyBlock(lines, index, state);
      continue;
    }
    if (line.startsWith('pevt ')) {
      index = parsePersonEventsBlock(lines, index, state);
      continue;
    }
    if (line.startsWith('notes ')) {
      index = parseNotesBlock(lines, index, state);
    }
  }

  return { records: state.records, meta: state.meta };
}

function parseFamilyBlock(lines, startIndex, state) {
  const header = lines[startIndex].trim();
  const family = parseFamilyHeader(header);
  const manId = family.man ? ensurePerson(state, family.man).recordName : null;
  const womanId = family.woman ? ensurePerson(state, family.woman).recordName : null;
  mergePersonVitalHints(state, family.man, family.manVitals);
  mergePersonVitalHints(state, family.woman, family.womanVitals);

  const familyId = id('family');
  const familyRecord = {
    recordName: familyId,
    recordType: 'Family',
    fields: compactFields({
      man: manId ? field(refValue(manId, 'Person'), 'REFERENCE') : undefined,
      woman: womanId ? field(refValue(womanId, 'Person'), 'REFERENCE') : undefined,
      cached_marriageDate: field(family.marriageDate),
      genewebHeader: field(header),
    }),
  };
  state.records.push(familyRecord);
  state.families.push(familyRecord);

  let inFamilyEvents = false;
  let inChildren = false;
  let order = 0;
  let index = startIndex + 1;
  for (; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (isTopLevelStart(line)) {
      index -= 1;
      break;
    }
    if (line === 'fevt') {
      inFamilyEvents = true;
      continue;
    }
    if (line === 'end fevt') {
      inFamilyEvents = false;
      continue;
    }
    if (line === 'beg') {
      inChildren = true;
      continue;
    }
    if (line === 'end') {
      if (inChildren) {
        inChildren = false;
        continue;
      }
      break;
    }
    if (inFamilyEvents && line.startsWith('#')) {
      addFamilyEvent(state, familyId, line);
      continue;
    }
    if (inChildren && line.startsWith('-')) {
      const child = parseChildLine(line, family.man?.surname || family.woman?.surname || '');
      if (!child) continue;
      const childRecord = ensurePerson(state, child.person);
      mergePersonVitalHints(state, child.person, child.vitals);
      state.records.push({
        recordName: id('childrel'),
        recordType: 'ChildRelation',
        fields: {
          family: field(refValue(familyId, 'Family'), 'REFERENCE'),
          child: field(refValue(childRecord.recordName, 'Person'), 'REFERENCE'),
          order: field(order, 'NUMBER'),
        },
      });
      order += 1;
    }
  }
  return index;
}

function parsePersonEventsBlock(lines, startIndex, state) {
  const person = parsePersonRefFromTail(lines[startIndex].trim().slice(5).trim());
  const personRecord = ensurePerson(state, person);
  let index = startIndex + 1;
  for (; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === 'end pevt') break;
    if (!line || !line.startsWith('#')) continue;
    addPersonEvent(state, personRecord.recordName, line);
  }
  return index;
}

function parseNotesBlock(lines, startIndex, state) {
  const person = parsePersonRefFromTail(lines[startIndex].trim().slice(6).trim());
  const personRecord = ensurePerson(state, person);
  const body = [];
  let inBody = false;
  let index = startIndex + 1;
  for (; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    if (line === 'beg') {
      inBody = true;
      continue;
    }
    if (line === 'end notes') break;
    if (inBody) body.push(raw);
  }
  const text = body.join('\n').trim();
  if (text) {
    state.records.push({
      recordName: id('note'),
      recordType: 'Note',
      fields: {
        person: field(refValue(personRecord.recordName, 'Person'), 'REFERENCE'),
        text: field(text),
      },
    });
  }
  return index;
}

function isTopLevelStart(line) {
  return /^(fam|pevt|notes|notes-db|page-ext)\b/.test(line);
}

function parseFamilyHeader(line) {
  const tokens = tokenize(line).slice(1);
  const plusIndex = tokens.findIndex((token) => token.startsWith('+'));
  const left = plusIndex >= 0 ? tokens.slice(0, plusIndex) : tokens;
  const right = plusIndex >= 0 ? tokens.slice(plusIndex + 1) : [];
  const plusToken = plusIndex >= 0 ? tokens[plusIndex] : '';
  const marriageDate = plusToken.length > 1 ? plusToken.slice(1) : valueAfterTag(tokens, '#marr');
  const manParsed = parsePersonSide(left);
  const womanParsed = parsePersonSide(right);
  return {
    man: manParsed.person,
    woman: womanParsed.person,
    manVitals: manParsed.vitals,
    womanVitals: womanParsed.vitals,
    marriageDate,
  };
}

function parsePersonSide(tokens) {
  const visible = withoutTaggedValues(tokens).filter((token) => token !== 'od');
  if (visible.length < 2) return { person: null, vitals: {} };
  const person = personRef(visible[0], visible[1]);
  let cursor = 2;
  if (visible[cursor] && isOccurrence(visible[cursor])) {
    person.occurrence = visible[cursor];
    cursor += 1;
  }
  return {
    person,
    vitals: {
      birthDate: normalizeDate(visible[cursor]),
      deathDate: normalizeDate(visible[cursor + 1]),
    },
  };
}

function parseChildLine(line, inheritedSurname) {
  const tokens = tokenize(line);
  const genderToken = tokens[1];
  const nameToken = tokens[2];
  if (!nameToken) return null;
  const person = personRef(inheritedSurname, nameToken);
  person.gender = genderToken === 'm' ? Gender.Male : genderToken === 'f' ? Gender.Female : Gender.UnknownGender;
  const visible = withoutTaggedValues(tokens.slice(3)).filter((token) => token !== 'od');
  return {
    person,
    vitals: {
      birthDate: normalizeDate(visible[0]),
      deathDate: normalizeDate(visible[1]),
    },
  };
}

function parsePersonRefFromTail(value) {
  const tokens = withoutTaggedValues(tokenize(value));
  return personRef(tokens[0] || '', tokens[1] || '');
}

function ensurePerson(state, person) {
  const normalized = normalizePersonRef(person);
  const key = personKey(normalized);
  if (state.persons.has(key)) return state.persons.get(key);

  const fullName = [normalized.given, normalized.surname].filter(Boolean).join(' ').trim() || key;
  const record = {
    recordName: id('person'),
    recordType: 'Person',
    fields: compactFields({
      firstName: field(normalized.given),
      lastName: field(normalized.surname),
      cached_fullName: field(fullName),
      gender: field(normalized.gender ?? Gender.UnknownGender, 'NUMBER'),
      genewebKey: field(key),
      genewebOccurrence: field(normalized.occurrence),
    }),
  };
  state.persons.set(key, record);
  state.records.push(record);
  return record;
}

function mergePersonVitalHints(state, person, vitals = {}) {
  if (!person) return;
  const record = ensurePerson(state, person);
  if (vitals.birthDate && !record.fields.cached_birthDate) record.fields.cached_birthDate = field(vitals.birthDate);
  if (vitals.deathDate && !record.fields.cached_deathDate) record.fields.cached_deathDate = field(vitals.deathDate);
}

function addPersonEvent(state, personId, line) {
  const event = parseEventLine(line);
  if (!event.type) return;
  state.records.push({
    recordName: id('pevent'),
    recordType: 'PersonEvent',
    fields: compactFields({
      person: field(refValue(personId, 'Person'), 'REFERENCE'),
      conclusionType: field(personEventType(event.type)),
      date: field(event.date),
      placeName: field(event.place),
      sourceText: field(event.source),
      genewebTag: field(event.type),
    }),
  });
  const person = state.records.find((record) => record.recordName === personId);
  if (person && event.type === 'birt' && event.date) person.fields.cached_birthDate = field(event.date);
  if (person && event.type === 'deat' && event.date) person.fields.cached_deathDate = field(event.date);
}

function addFamilyEvent(state, familyId, line) {
  const event = parseEventLine(line);
  if (!event.type) return;
  state.records.push({
    recordName: id('fevent'),
    recordType: 'FamilyEvent',
    fields: compactFields({
      family: field(refValue(familyId, 'Family'), 'REFERENCE'),
      conclusionType: field(familyEventType(event.type)),
      date: field(event.date),
      placeName: field(event.place),
      sourceText: field(event.source),
      genewebTag: field(event.type),
    }),
  });
}

function parseEventLine(line) {
  const tokens = tokenize(line);
  const type = tokens[0]?.replace(/^#/, '') || '';
  const bare = [];
  const data = {};
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '#p' || token === '#bp' || token === '#dp' || token === '#mp' || token === '#pp') {
      data.place = decodeToken(tokens[index + 1] || '');
      index += 1;
    } else if (token === '#s' || token === '#src' || token === '#bs' || token === '#ds' || token === '#ms') {
      data.source = decodeToken(tokens[index + 1] || '');
      index += 1;
    } else if (token.startsWith('#')) {
      if (tokens[index + 1] && !tokens[index + 1].startsWith('#')) index += 1;
    } else {
      bare.push(token);
    }
  }
  return { type, date: normalizeDate(bare[0]), ...data };
}

function withoutTaggedValues(tokens) {
  const out = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.startsWith('#')) {
      if (tokens[index + 1] && !tokens[index + 1].startsWith('#')) index += 1;
      continue;
    }
    out.push(token);
  }
  return out;
}

function valueAfterTag(tokens, tag) {
  const index = tokens.indexOf(tag);
  return index >= 0 ? normalizeDate(tokens[index + 1]) : '';
}

function tokenize(line) {
  return String(line || '').match(/\{[^}]*\}|\S+/g) || [];
}

function personRef(surname, given) {
  const person = { surname: decodeToken(surname), given: decodeToken(given) };
  const match = person.given.match(/^(.*)\.(\d+)$/);
  if (match) {
    person.given = match[1];
    person.occurrence = match[2];
  }
  return person;
}

function normalizePersonRef(person = {}) {
  return {
    surname: decodeToken(person.surname || ''),
    given: decodeToken(person.given || ''),
    occurrence: person.occurrence || '',
    gender: person.gender,
  };
}

function personKey(person) {
  return [person.surname.toLowerCase(), person.given.toLowerCase(), person.occurrence || '0'].join('|');
}

function isOccurrence(value) {
  return /^\d+$/.test(String(value || ''));
}

function normalizeDate(value) {
  const text = decodeToken(value || '');
  if (!text || text === '0' || text === 'od') return '';
  return text;
}

function decodeToken(value) {
  return String(value || '')
    .replace(/^\{|\}$/g, '')
    .replace(/\\_/g, '\u0000')
    .replace(/_/g, ' ')
    .replace(/\u0000/g, '_')
    .trim();
}

function personEventType(tag) {
  const map = {
    birt: 'Birth',
    deat: 'Death',
    bapt: 'Baptism',
    buri: 'Burial',
  };
  return map[tag] || tag;
}

function familyEventType(tag) {
  const map = {
    marr: 'Marriage',
    div: 'Divorced',
    enga: 'Engagement',
  };
  return map[tag] || tag;
}
