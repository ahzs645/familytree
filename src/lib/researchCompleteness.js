import { getLocalDatabase } from './LocalDatabase.js';
import { readConclusionType, readField, readRef } from './schema.js';
import { personSummary } from '../models/index.js';
import { normalizeSearchText } from './i18n.js';

export const COMPLETENESS_COLOR_MODES = [
  { id: 'gender', label: 'Gender' },
  { id: 'missing-birth', label: 'Missing birth' },
  { id: 'missing-death', label: 'Missing death' },
  { id: 'source-state', label: 'Sources' },
  { id: 'has-place', label: 'Places' },
  { id: 'privacy', label: 'Privacy / living' },
  { id: 'duplicate-risk', label: 'Duplicate risk' },
  { id: 'research-priority', label: 'Research priority' },
];

export const COMPLETENESS_LEGEND = {
  'missing-birth': [
    ['#b42318', 'Missing birth'],
    ['#1f8a5b', 'Birth recorded'],
  ],
  'missing-death': [
    ['#b45309', 'Missing death'],
    ['#1f8a5b', 'Death recorded'],
  ],
  'source-state': [
    ['#b42318', 'Unsourced'],
    ['#b7791f', 'Weak'],
    ['#1f8a5b', 'Supported'],
  ],
  'has-place': [
    ['#2563eb', 'Has placed events'],
    ['#8a8f98', 'No placed events'],
  ],
  privacy: [
    ['#7c3aed', 'Private'],
    ['#0f766e', 'Likely living'],
    ['#64748b', 'Public/deceased'],
  ],
  'duplicate-risk': [
    ['#b42318', 'High'],
    ['#b7791f', 'Medium'],
    ['#64748b', 'Low'],
  ],
  'research-priority': [
    ['#b42318', 'High'],
    ['#b7791f', 'Medium'],
    ['#1f8a5b', 'Low'],
  ],
};

export async function loadResearchCompleteness() {
  const db = getLocalDatabase();
  const [
    personsResult,
    familiesResult,
    childRelationsResult,
    personEventsResult,
    familyEventsResult,
    factsResult,
    sourceRelationsResult,
  ] = await Promise.all([
    db.query('Person', { limit: 100000 }),
    db.query('Family', { limit: 100000 }),
    db.query('ChildRelation', { limit: 100000 }),
    db.query('PersonEvent', { limit: 100000 }),
    db.query('FamilyEvent', { limit: 100000 }),
    db.query('PersonFact', { limit: 100000 }),
    db.query('SourceRelation', { limit: 100000 }),
  ]);

  const persons = personsResult.records;
  const families = familiesResult.records;
  const childRelations = childRelationsResult.records;
  const personEvents = personEventsResult.records;
  const familyEvents = familyEventsResult.records;
  const facts = factsResult.records;
  const sourceRelations = sourceRelationsResult.records;

  const personById = new Map(persons.map((person) => [person.recordName, person]));
  const familyById = new Map(families.map((family) => [family.recordName, family]));
  const eventsByPerson = groupByOwner(personEvents, 'person');
  const factsByPerson = groupByOwner(facts, 'person');
  const childRelationsByChild = groupByOwner(childRelations, 'child');
  const childRelationsByFamily = groupByOwner(childRelations, 'family');
  const sourceCounts = buildSourceCounts(sourceRelations);
  const duplicateSets = buildDuplicateSets(persons);
  const relationIssues = buildRelationIssues({ families, childRelations, personById, familyById });
  const familyEventsByFamily = groupByOwner(familyEvents, 'family');

  const rows = persons.map((person) => {
    const summary = personSummary(person);
    const personEventsForRow = eventsByPerson.get(person.recordName) || [];
    const factsForRow = factsByPerson.get(person.recordName) || [];
    const parentLinks = childRelationsByChild.get(person.recordName) || [];
    const directSources = sourceCounts.get(person.recordName) || 0;
    const eventSources = sumSourceCounts(sourceCounts, personEventsForRow);
    const factSources = sumSourceCounts(sourceCounts, factsForRow);
    const sourceCount = directSources + eventSources + factSources;
    const birthYear = yearOf(summary?.birthDate);
    const deathYear = yearOf(summary?.deathDate);
    const currentYear = new Date().getFullYear();
    const isPrivate = Boolean(person.fields?.isPrivate?.value);
    const likelyLiving = !summary?.deathDate && (!birthYear || currentYear - birthYear < 110);
    const missingDates = [];
    if (!summary?.birthDate) missingDates.push('Birth');
    if (!summary?.deathDate && !likelyLiving) missingDates.push('Death');
    const unplacedEvents = personEventsForRow.filter((event) => !readRef(event.fields?.place) && !readRef(event.fields?.assignedPlace));
    const placedEvents = personEventsForRow.length - unplacedEvents.length;
    const duplicateRisk = duplicateSets.high.has(person.recordName) ? 'High' : duplicateSets.medium.has(person.recordName) ? 'Medium' : 'Low';
    const sourceState = sourceCount === 0 ? 'Unsourced' : sourceCount < 2 ? 'Weak' : 'Supported';
    const parentCount = countKnownParents(parentLinks, familyById);
    const issues = [
      ...(relationIssues.get(person.recordName) || []),
      ...impossibleAgeIssues(person, personEventsForRow),
    ];
    const attentionScore =
      missingDates.length +
      (sourceState === 'Unsourced' ? 2 : sourceState === 'Weak' ? 1 : 0) +
      (unplacedEvents.length ? 1 : 0) +
      (parentCount === 0 ? 1 : 0) +
      issues.length +
      (duplicateRisk === 'High' ? 2 : duplicateRisk === 'Medium' ? 1 : 0);

    return {
      id: person.recordName,
      personId: person.recordName,
      record: person,
      personName: summary?.fullName || person.recordName,
      birthDate: summary?.birthDate || '',
      deathDate: summary?.deathDate || '',
      birthYear,
      deathYear,
      age: birthYear ? (deathYear || currentYear) - birthYear : null,
      ageLabel: birthYear ? String((deathYear || currentYear) - birthYear) : 'Unknown',
      isPrivate,
      likelyLiving,
      missingBirth: !summary?.birthDate,
      missingDeath: !summary?.deathDate,
      missingDates,
      missingDateLabel: missingDates.length ? missingDates.join(', ') : 'None',
      parentCount,
      directSources,
      eventSources,
      factSources,
      sourceCount,
      sourceState,
      eventCount: personEventsForRow.length,
      factCount: factsForRow.length,
      placedEvents,
      unplacedEvents: unplacedEvents.length,
      hasPlace: placedEvents > 0,
      duplicateRisk,
      orphanedRelationships: (relationIssues.get(person.recordName) || []).length,
      relationshipIssues: relationIssues.get(person.recordName) || [],
      impossibleAgeIssues: issues.filter((issue) => !String(issue).startsWith('Family ')),
      attentionScore,
      researchPriority: attentionScore >= 5 ? 'High' : attentionScore >= 2 ? 'Medium' : 'Low',
    };
  });

  const rowsByPerson = new Map(rows.map((row) => [row.personId, row]));
  return {
    rows: rows.sort((a, b) => b.attentionScore - a.attentionScore || a.personName.localeCompare(b.personName)),
    rowsByPerson,
    sourceCounts,
    childRelationsByFamily,
    familyEventsByFamily,
  };
}

export async function loadCompletenessRowsByPerson() {
  const analysis = await loadResearchCompleteness();
  return analysis.rowsByPerson;
}

export function colorForCompleteness(row, mode) {
  if (!row || mode === 'gender') return null;
  if (mode === 'missing-birth') return row.missingBirth ? badgeColor('#b42318') : badgeColor('#1f8a5b');
  if (mode === 'missing-death') return row.missingDeath && !row.likelyLiving ? badgeColor('#b45309') : badgeColor('#1f8a5b');
  if (mode === 'source-state') {
    if (row.sourceState === 'Supported') return badgeColor('#1f8a5b');
    if (row.sourceState === 'Weak') return badgeColor('#b7791f');
    return badgeColor('#b42318');
  }
  if (mode === 'has-place') return row.hasPlace ? badgeColor('#2563eb') : badgeColor('#8a8f98');
  if (mode === 'privacy') {
    if (row.isPrivate) return badgeColor('#7c3aed');
    if (row.likelyLiving) return badgeColor('#0f766e');
    return badgeColor('#64748b');
  }
  if (mode === 'duplicate-risk') {
    if (row.duplicateRisk === 'High') return badgeColor('#b42318');
    if (row.duplicateRisk === 'Medium') return badgeColor('#b7791f');
    return badgeColor('#64748b');
  }
  if (mode === 'research-priority') {
    if (row.researchPriority === 'High') return badgeColor('#b42318');
    if (row.researchPriority === 'Medium') return badgeColor('#b7791f');
    return badgeColor('#1f8a5b');
  }
  return null;
}

export function evidenceStateForRecord(recordName, analysis) {
  const count = analysis?.sourceCounts?.get(recordName) || 0;
  if (count >= 2) return { state: 'Supported', count };
  if (count === 1) return { state: 'Weak', count };
  return { state: 'Unsourced', count: 0 };
}

function badgeColor(hex) {
  return { fill: mix(hex, '#ffffff', 0.82), stroke: hex };
}

function mix(hex, other, amount) {
  const a = parseHex(hex);
  const b = parseHex(other);
  const parts = a.map((value, index) => Math.round(value * (1 - amount) + b[index] * amount));
  return `rgb(${parts[0]} ${parts[1]} ${parts[2]})`;
}

function parseHex(hex) {
  const raw = String(hex).replace('#', '');
  return [0, 2, 4].map((offset) => parseInt(raw.slice(offset, offset + 2), 16));
}

function groupByOwner(records, fieldName) {
  const map = new Map();
  for (const record of records) {
    const owner = readRef(record.fields?.[fieldName]);
    if (!owner) continue;
    if (!map.has(owner)) map.set(owner, []);
    map.get(owner).push(record);
  }
  return map;
}

function buildSourceCounts(sourceRelations) {
  const counts = new Map();
  for (const relation of sourceRelations) {
    const target = readRef(relation.fields?.target) || readRef(relation.fields?.person) || readRef(relation.fields?.event) || readRef(relation.fields?.fact);
    if (!target) continue;
    counts.set(target, (counts.get(target) || 0) + 1);
  }
  return counts;
}

function sumSourceCounts(sourceCounts, records) {
  return records.reduce((sum, record) => sum + (sourceCounts.get(record.recordName) || 0), 0);
}

function buildDuplicateSets(persons) {
  const byName = new Map();
  const byNameBirth = new Map();
  for (const person of persons) {
    const summary = personSummary(person);
    const name = normalizeName(summary?.fullName);
    if (!name) continue;
    pushGroup(byName, name, person.recordName);
    const birthYear = yearOf(summary?.birthDate);
    if (birthYear) pushGroup(byNameBirth, `${name}|${birthYear}`, person.recordName);
  }
  const high = idsFromDuplicateGroups(byNameBirth);
  const medium = idsFromDuplicateGroups(byName);
  return { high, medium };
}

function pushGroup(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function idsFromDuplicateGroups(groups) {
  const ids = new Set();
  for (const group of groups.values()) {
    if (group.length > 1) group.forEach((id) => ids.add(id));
  }
  return ids;
}

function normalizeName(value) {
  return normalizeSearchText(value).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function yearOf(raw) {
  const match = String(raw || '').match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

function buildRelationIssues({ families, childRelations, personById, familyById }) {
  const issues = new Map();
  const add = (personId, message) => {
    if (!personId) return;
    if (!issues.has(personId)) issues.set(personId, []);
    issues.get(personId).push(message);
  };
  for (const family of families) {
    const manId = readRef(family.fields?.man);
    const womanId = readRef(family.fields?.woman);
    if (manId && !personById.has(manId)) add(womanId, `Family ${family.recordName} references a missing partner`);
    if (womanId && !personById.has(womanId)) add(manId, `Family ${family.recordName} references a missing partner`);
  }
  for (const relation of childRelations) {
    const childId = readRef(relation.fields?.child);
    const familyId = readRef(relation.fields?.family);
    const family = familyId ? familyById.get(familyId) : null;
    if (childId && !personById.has(childId) && family) {
      add(readRef(family.fields?.man), `Child relation ${relation.recordName} references a missing child`);
      add(readRef(family.fields?.woman), `Child relation ${relation.recordName} references a missing child`);
    }
    if (familyId && !familyById.has(familyId)) add(childId, `Child relation ${relation.recordName} references a missing family`);
  }
  return issues;
}

function countKnownParents(parentLinks, familyById) {
  const parentIds = new Set();
  for (const link of parentLinks) {
    const family = familyById.get(readRef(link.fields?.family));
    const man = readRef(family?.fields?.man);
    const woman = readRef(family?.fields?.woman);
    if (man) parentIds.add(man);
    if (woman) parentIds.add(woman);
  }
  return parentIds.size;
}

function impossibleAgeIssues(person, events) {
  const summary = personSummary(person);
  const birthYear = yearOf(summary?.birthDate);
  const deathYear = yearOf(summary?.deathDate);
  const issues = [];
  if (birthYear && deathYear && deathYear < birthYear) issues.push('Death before birth');
  if (birthYear && deathYear && deathYear - birthYear > 120) issues.push('Lifespan over 120 years');
  for (const event of events) {
    const eventYear = yearOf(readField(event, ['date'], ''));
    if (!eventYear || !birthYear) continue;
    const label = readConclusionType(event) || 'Event';
    if (eventYear < birthYear - 1) issues.push(`${label} before birth`);
    if (deathYear && eventYear > deathYear + 1) issues.push(`${label} after death`);
  }
  return issues;
}
