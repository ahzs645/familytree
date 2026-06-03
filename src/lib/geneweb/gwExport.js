import { Gender } from '../../models/index.js';
import { refToRecordName, textValue } from './gwShared.js';

export function buildGeneWeb(recordsOrDataset = []) {
  const records = Array.isArray(recordsOrDataset)
    ? recordsOrDataset
    : Object.values(recordsOrDataset?.records || recordsOrDataset || {});
  const byType = groupByType(records);
  return exportGeneWebRecords({
    persons: byType.Person || [],
    families: byType.Family || [],
    childRelations: byType.ChildRelation || [],
    personEvents: byType.PersonEvent || [],
    familyEvents: byType.FamilyEvent || [],
    notes: byType.Note || [],
  });
}

export function exportGeneWebRecords({
  persons = [],
  families = [],
  childRelations = [],
  personEvents = [],
  familyEvents = [],
  notes = [],
} = {}) {
  const personById = new Map(persons.map((person) => [person.recordName, person]));
  const childrenByFamily = groupByRef(childRelations, 'family');
  const personEventsByPerson = groupByRef(personEvents, 'person');
  const familyEventsByFamily = groupByRef(familyEvents, 'family');
  const notesByPerson = groupByRef(notes, 'person');
  const lines = ['encoding: utf-8', 'gwplus', ''];

  for (const family of families) {
    const man = personById.get(refToRecordName(family.fields?.man));
    const woman = personById.get(refToRecordName(family.fields?.woman));
    const marriage = familyMarriageDate(family, familyEventsByFamily.get(family.recordName) || []);
    lines.push(`fam ${formatPersonRef(man)} +${encodeToken(marriage)} ${formatPersonRef(woman)}`.trim());

    const events = familyEventsByFamily.get(family.recordName) || [];
    if (events.length || marriage) {
      lines.push('fevt');
      if (events.length) {
        for (const event of events) lines.push(formatEventLine(event, 'marr'));
      } else {
        lines.push(`#marr ${encodeToken(marriage)}`.trim());
      }
      lines.push('end fevt');
    }

    const children = (childrenByFamily.get(family.recordName) || [])
      .slice()
      .sort((a, b) => Number(a.fields?.order?.value || 0) - Number(b.fields?.order?.value || 0));
    if (children.length) {
      lines.push('beg');
      for (const relation of children) {
        const child = personById.get(refToRecordName(relation.fields?.child));
        if (child) lines.push(formatChildLine(child));
      }
      lines.push('end');
    }
    lines.push('');
  }

  for (const person of persons) {
    const events = personEventsByPerson.get(person.recordName) || [];
    if (events.length) {
      lines.push(`pevt ${formatPersonRef(person)}`);
      for (const event of events) lines.push(formatEventLine(event));
      lines.push('end pevt', '');
    }
    for (const note of notesByPerson.get(person.recordName) || []) {
      const text = textValue(note, 'text');
      if (!text) continue;
      lines.push(`notes ${formatPersonRef(person)}`, 'beg', text, 'end notes', '');
    }
  }

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function groupByType(records) {
  const grouped = {};
  for (const record of records || []) {
    if (!record?.recordType) continue;
    if (!grouped[record.recordType]) grouped[record.recordType] = [];
    grouped[record.recordType].push(record);
  }
  return grouped;
}

function groupByRef(records, fieldName) {
  const grouped = new Map();
  for (const record of records || []) {
    const key = refToRecordName(record.fields?.[fieldName]);
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(record);
  }
  return grouped;
}

function familyMarriageDate(family, events) {
  return textValue(family, 'cached_marriageDate') || textValue(events.find((event) => textValue(event, 'conclusionType') === 'Marriage'), 'date');
}

function formatChildLine(person) {
  const gender = person.fields?.gender?.value;
  const marker = gender === Gender.Male ? 'm' : gender === Gender.Female ? 'f' : 'x';
  const birth = textValue(person, 'cached_birthDate');
  const death = textValue(person, 'cached_deathDate');
  return ['-', marker, encodeToken(givenName(person) || '?'), encodeToken(birth), encodeToken(death)].filter(Boolean).join(' ');
}

function formatPersonRef(person) {
  if (!person) return '? ?';
  return `${encodeToken(surname(person) || '?')} ${encodeToken(givenName(person) || '?')}`;
}

function formatEventLine(event, fallbackTag = 'even') {
  const tag = eventTag(textValue(event, 'conclusionType'), fallbackTag);
  const parts = [`#${tag}`];
  const date = textValue(event, 'date');
  const place = textValue(event, 'placeName');
  const source = textValue(event, 'sourceText');
  if (date) parts.push(encodeToken(date));
  if (place) parts.push('#p', encodeToken(place));
  if (source) parts.push('#s', encodeToken(source));
  return parts.join(' ');
}

function eventTag(type, fallback) {
  const map = {
    Birth: 'birt',
    Death: 'deat',
    Baptism: 'bapt',
    Burial: 'buri',
    Marriage: 'marr',
    Divorced: 'div',
    Engagement: 'enga',
  };
  return map[type] || fallback;
}

function givenName(person) {
  return textValue(person, 'firstName') || textValue(person, 'givenName') || textValue(person, 'cached_fullName').split(/\s+/)[0] || '';
}

function surname(person) {
  return textValue(person, 'lastName') || textValue(person, 'surname') || textValue(person, 'cached_fullName').split(/\s+/).slice(1).join(' ') || '';
}

function encodeToken(value) {
  return String(value || '').trim().replace(/_/g, '\\_').replace(/\s+/g, '_');
}

