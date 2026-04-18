import { getLocalDatabase } from './LocalDatabase.js';
import { runPlausibilityChecks } from './plausibility.js';
import { readConclusionType, readField, readRef } from './schema.js';
import { personSummary, familySummary, placeSummary, sourceSummary, Gender } from '../models/index.js';
import { parseEventDate, formatEventDate } from '../utils/formatDate.js';
import { compareStrings, getCurrentLocalization, localeWithExtensions, normalizeSearchText } from './i18n.js';

export const MEDIA_RECORD_TYPES = ['MediaPicture', 'MediaPDF', 'MediaURL', 'MediaAudio', 'MediaVideo'];

export function genderLabel(gender) {
  switch (gender) {
    case Gender.Male:
      return 'Male';
    case Gender.Female:
      return 'Female';
    case Gender.Intersex:
      return 'Intersex';
    default:
      return 'Unknown';
  }
}

export function yearOf(raw) {
  const match = String(raw || '').match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

export function formatYear(raw) {
  const year = yearOf(raw);
  return year == null ? 'Year unknown' : String(year);
}

export function formatMonthDay(month, day) {
  if (!month || !day) return '';
  const date = new Date(2000, month - 1, day);
  if (Number.isNaN(date.getTime())) return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return new Intl.DateTimeFormat(localeWithExtensions(getCurrentLocalization()), { month: 'short', day: 'numeric' }).format(date);
}

export function anniversaryParts(raw) {
  const parsed = parseEventDate(raw);
  if (!parsed?.month || !parsed?.day) return null;
  return {
    year: parsed.year || null,
    month: parsed.month,
    day: parsed.day,
    monthDay: `${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}`,
    monthDayLabel: formatMonthDay(parsed.month, parsed.day),
  };
}

export async function loadPersonRows() {
  const db = getLocalDatabase();
  const { records } = await db.query('Person', { limit: 100000 });
  return records
    .map((record) => {
      const summary = personSummary(record);
      if (!summary) return null;
      return {
        id: record.recordName,
        record,
        ...summary,
        genderLabel: genderLabel(summary.gender),
        birthYear: yearOf(summary.birthDate),
        deathYear: yearOf(summary.deathDate),
        bookmarked: !!record.fields?.isBookmarked?.value,
        private: !!record.fields?.isPrivate?.value,
        startPerson: !!record.fields?.isStartPerson?.value,
        hasPhoto: !!(record.fields?.thumbnailFileIdentifier?.value || record.fields?.picture?.value),
      };
    })
    .filter(Boolean)
    .sort((a, b) => compareStrings(a.fullName, b.fullName));
}

export async function loadMarriageRows() {
  const db = getLocalDatabase();
  const [{ records: families }, { records: persons }] = await Promise.all([
    db.query('Family', { limit: 100000 }),
    db.query('Person', { limit: 100000 }),
  ]);
  const personById = new Map(persons.map((person) => [person.recordName, person]));
  return families
    .map((family) => {
      const partner1Id = readRef(family.fields?.man);
      const partner2Id = readRef(family.fields?.woman);
      const partner1 = partner1Id ? personById.get(partner1Id) : null;
      const partner2 = partner2Id ? personById.get(partner2Id) : null;
      const marriageDate = readField(family, ['cached_marriageDate', 'marriageDate', 'date'], '');
      return {
        id: family.recordName,
        family,
        partner1Id,
        partner2Id,
        partner1Name: personSummary(partner1)?.fullName || partner1Id || '',
        partner2Name: personSummary(partner2)?.fullName || partner2Id || '',
        marriageDate,
        formattedMarriageDate: formatEventDate(marriageDate),
      };
    })
    .sort((a, b) => compareStrings(a.marriageDate, b.marriageDate));
}

export async function loadFactRows() {
  const db = getLocalDatabase();
  const [{ records: facts }, { records: persons }, { records: factTypes }] = await Promise.all([
    db.query('PersonFact', { limit: 100000 }),
    db.query('Person', { limit: 100000 }),
    db.query('ConclusionPersonFactType', { limit: 10000 }),
  ]);
  const personById = new Map(persons.map((person) => [person.recordName, person]));
  return facts
    .map((fact) => {
      const personId = readRef(fact.fields?.person);
      const person = personId ? personById.get(personId) : null;
      const factType = readConclusionType(fact, factTypes) || readField(fact, ['factType', 'type'], 'Fact');
      const date = readField(fact, ['date'], '');
      return {
        id: fact.recordName,
        fact,
        personId,
        personName: personSummary(person)?.fullName || personId || '',
        factType,
        value: readField(fact, ['value', 'description', 'text'], ''),
        date,
        formattedDate: formatEventDate(date),
      };
    })
    .sort((a, b) => compareStrings(a.personName, b.personName) || compareStrings(a.factType, b.factType));
}

export async function loadAnniversaryRows() {
  const people = await loadPersonRows();
  const rows = [];
  for (const person of people) {
    addAnniversary(rows, person, 'Birth', person.birthDate);
    addAnniversary(rows, person, 'Death', person.deathDate);
  }
  return rows.sort((a, b) => compareStrings(a.monthDay, b.monthDay) || compareStrings(a.personName, b.personName));
}

function addAnniversary(rows, person, type, rawDate) {
  const parts = anniversaryParts(rawDate);
  if (!parts) return;
  rows.push({
    id: `${person.id}-${type.toLowerCase()}`,
    personId: person.id,
    personName: person.fullName,
    type,
    rawDate,
    year: parts.year,
    yearLabel: parts.year == null ? 'Year unknown' : String(parts.year),
    month: parts.month,
    day: parts.day,
    monthDay: parts.monthDay,
    monthDayLabel: parts.monthDayLabel,
  });
}

export async function loadListCounts() {
  const db = getLocalDatabase();
  const [summary, anniversaries, warnings] = await Promise.all([
    db.getSummary(),
    loadAnniversaryRows(),
    runPlausibilityChecks(),
  ]);
  const types = summary?.types || {};
  return {
    persons: types.Person || 0,
    places: types.Place || 0,
    sources: types.Source || 0,
    events: (types.PersonEvent || 0) + (types.FamilyEvent || 0),
    media: MEDIA_RECORD_TYPES.reduce((count, type) => count + (types[type] || 0), 0),
    todos: types.ToDo || 0,
    changes: types.ChangeLogEntry || 0,
    plausibility: warnings.length,
    anniversary: anniversaries.length,
    facts: types.PersonFact || 0,
    marriage: types.Family || 0,
  };
}

export function distinctiveMarkerFor(record) {
  for (const [key, field] of Object.entries(record?.fields || {})) {
    if (!/distinctive|distinguish/i.test(key)) continue;
    const value = field?.value ?? field;
    if (value === true || value === 1) return key;
    if (typeof value === 'string' && value.trim() && !/^(0|false|no)$/i.test(value.trim())) return key;
  }
  return '';
}

export function distinctiveTags(row) {
  const tags = [];
  if (row.markerField) tags.push(`Marked: ${row.markerField}`);
  if (row.startPerson) tags.push('Start person');
  if (row.bookmarked) tags.push('Bookmarked');
  if (!row.birthDate) tags.push('Missing birth date');
  if (!row.deathDate) tags.push('Missing death date');
  if (!row.lastName) tags.push('Missing surname');
  if (row.birthYear && row.deathYear && row.deathYear - row.birthYear >= 90) tags.push('Long lifespan');
  if (row.hasPhoto) tags.push('Has photo');
  return tags;
}

export async function loadDistinctivePersonRows() {
  const rows = await loadPersonRows();
  return rows.map((row) => {
    const markerField = distinctiveMarkerFor(row.record);
    return {
      ...row,
      markerField,
      tags: distinctiveTags({ ...row, markerField }),
    };
  });
}

export async function loadPersonAnalysisRows() {
  const db = getLocalDatabase();
  const [{ records: persons }, { records: families }, { records: childRelations }] = await Promise.all([
    db.query('Person', { limit: 100000 }),
    db.query('Family', { limit: 100000 }),
    db.query('ChildRelation', { limit: 100000 }),
  ]);
  const personById = new Map(persons.map((person) => [person.recordName, person]));
  const familyById = new Map(families.map((family) => [family.recordName, family]));
  const relationIssues = new Map();

  const addIssue = (personId, message) => {
    if (!personId) return;
    if (!relationIssues.has(personId)) relationIssues.set(personId, []);
    relationIssues.get(personId).push(message);
  };

  for (const family of families) {
    const manId = readRef(family.fields?.man);
    const womanId = readRef(family.fields?.woman);
    if (manId && !personById.has(manId)) addIssue(womanId, `Family ${family.recordName} references a missing partner`);
    if (womanId && !personById.has(womanId)) addIssue(manId, `Family ${family.recordName} references a missing partner`);
  }

  for (const relation of childRelations) {
    const childId = readRef(relation.fields?.child);
    const familyId = readRef(relation.fields?.family);
    const family = familyId ? familyById.get(familyId) : null;
    if (childId && !personById.has(childId) && family) {
      addIssue(readRef(family.fields?.man), `Child relation ${relation.recordName} references a missing child`);
      addIssue(readRef(family.fields?.woman), `Child relation ${relation.recordName} references a missing child`);
    }
    if (familyId && !familyById.has(familyId)) addIssue(childId, `Child relation ${relation.recordName} references a missing family`);
  }

  const nameGroups = new Map();
  const nameBirthGroups = new Map();
  for (const person of persons) {
    const summary = personSummary(person);
    const name = normalizeName(summary?.fullName);
    if (!name) continue;
    if (!nameGroups.has(name)) nameGroups.set(name, []);
    nameGroups.get(name).push(person.recordName);
    const birthYear = yearOf(summary?.birthDate);
    if (birthYear) {
      const key = `${name}|${birthYear}`;
      if (!nameBirthGroups.has(key)) nameBirthGroups.set(key, []);
      nameBirthGroups.get(key).push(person.recordName);
    }
  }
  const highDuplicateIds = new Set();
  const mediumDuplicateIds = new Set();
  for (const ids of nameBirthGroups.values()) {
    if (ids.length > 1) ids.forEach((id) => highDuplicateIds.add(id));
  }
  for (const ids of nameGroups.values()) {
    if (ids.length > 1) ids.forEach((id) => mediumDuplicateIds.add(id));
  }

  const currentYear = new Date().getFullYear();
  return persons
    .map((record) => {
      const summary = personSummary(record);
      const birthYear = yearOf(summary?.birthDate);
      const deathYear = yearOf(summary?.deathDate);
      const age = birthYear ? (deathYear || currentYear) - birthYear : null;
      const missingDates = [];
      if (!summary?.birthDate) missingDates.push('Birth');
      if (!summary?.deathDate) missingDates.push('Death');
      const duplicateRisk = highDuplicateIds.has(record.recordName)
        ? 'High'
        : mediumDuplicateIds.has(record.recordName)
          ? 'Medium'
          : 'Low';
      const issues = relationIssues.get(record.recordName) || [];
      return {
        id: record.recordName,
        personId: record.recordName,
        personName: summary?.fullName || record.recordName,
        birthDate: summary?.birthDate || '',
        deathDate: summary?.deathDate || '',
        age,
        ageLabel: age == null ? 'Unknown' : String(age),
        missingDates,
        missingDateLabel: missingDates.length ? missingDates.join(', ') : 'None',
        orphanedRelationships: issues.length,
        relationshipIssues: issues,
        duplicateRisk,
        attentionScore: missingDates.length + issues.length + (duplicateRisk === 'High' ? 2 : duplicateRisk === 'Medium' ? 1 : 0),
      };
    })
    .sort((a, b) => b.attentionScore - a.attentionScore || compareStrings(a.personName, b.personName));
}

function normalizeName(value) {
  return normalizeSearchText(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const LDS_SCHEMA_RE = /lds|ordinance|temple|endowment|sealing|sealed|confirmation/i;

export async function loadLdsOrdinanceRows() {
  const db = getLocalDatabase();
  const records = await db.getAllRecords();
  const persons = records.filter((record) => record.recordType === 'Person');
  const families = records.filter((record) => record.recordType === 'Family');
  const personsById = new Map(persons.map((person) => [person.recordName, person]));
  const familiesById = new Map(families.map((family) => [family.recordName, family]));
  const detectedSchema = new Set();
  const rows = [];

  for (const record of records) {
    const matchedFields = Object.entries(record.fields || {}).filter(([key, field]) => {
      const value = field?.value ?? field;
      return LDS_SCHEMA_RE.test(key) || (typeof value === 'string' && LDS_SCHEMA_RE.test(value));
    });
    const matchedType = LDS_SCHEMA_RE.test(record.recordType);
    if (!matchedType && matchedFields.length === 0) continue;
    detectedSchema.add(record.recordType);
    matchedFields.forEach(([key]) => detectedSchema.add(`${record.recordType}.${key}`));

    const owner = ownerForLdsRow(record, personsById, familiesById);
    const ordinance = readConclusionType(record) || readField(record, ['ordinanceType', 'ordinance', 'type', 'name', 'title'], record.recordType);
    rows.push({
      id: record.recordName,
      recordType: record.recordType,
      ownerId: owner.id,
      ownerType: owner.type,
      ownerName: owner.name,
      ordinance,
      date: readField(record, ['date', 'ordinanceDate', 'completedDate', 'templeDate', 'confirmationDate', 'endowmentDate', 'sealingDate'], ''),
      status: readField(record, ['status', 'ordinanceStatus', 'completed', 'isCompleted'], ''),
      temple: readField(record, ['temple', 'templeName', 'place'], ''),
    });
  }

  return {
    schemaPresent: detectedSchema.size > 0,
    detectedSchema: [...detectedSchema].sort(),
    rows: rows.sort((a, b) => compareStrings(a.ownerName, b.ownerName) || compareStrings(a.ordinance, b.ordinance)),
  };
}

function ownerForLdsRow(record, personsById, familiesById) {
  if (record.recordType === 'Person') {
    return { id: record.recordName, type: 'Person', name: personSummary(record)?.fullName || record.recordName };
  }
  if (record.recordType === 'Family') {
    return { id: record.recordName, type: 'Family', name: familyLabel(record, personsById) };
  }
  const personId = readRef(record.fields?.person) || readRef(record.fields?.targetPerson) || readRef(record.fields?.individual);
  if (personId) {
    return { id: personId, type: 'Person', name: personSummary(personsById.get(personId))?.fullName || personId };
  }
  const familyId = readRef(record.fields?.family) || readRef(record.fields?.targetFamily);
  if (familyId) {
    return { id: familyId, type: 'Family', name: familyLabel(familiesById.get(familyId), personsById) || familyId };
  }
  return { id: '', type: record.recordType, name: record.recordName };
}

function familyLabel(family, personsById) {
  const direct = familySummary(family)?.familyName;
  if (direct && direct !== 'Family') return direct;
  const man = personSummary(personsById.get(readRef(family?.fields?.man)))?.fullName;
  const woman = personSummary(personsById.get(readRef(family?.fields?.woman)))?.fullName;
  return [man, woman].filter(Boolean).join(' & ') || family?.recordName || '';
}

export function recordDisplayLabel(record) {
  if (!record) return '';
  if (record.recordType === 'Person') return personSummary(record)?.fullName || record.recordName;
  if (record.recordType === 'Family') return familySummary(record)?.familyName || record.recordName;
  if (record.recordType === 'Place') return placeSummary(record)?.displayName || placeSummary(record)?.name || record.recordName;
  if (record.recordType === 'Source') return sourceSummary(record)?.title || record.recordName;
  return readField(record, ['title', 'name', 'caption', 'cached_familyName'], record.recordName);
}
