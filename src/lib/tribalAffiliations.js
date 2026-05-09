import { normalizeConclusionTypeId } from './catalogs.js';
import { readField, readRef, writeRef } from './schema.js';
import { personSummary } from '../models/index.js';

export const TRIBAL_AFFILIATION_LEVELS = [
  { id: 'confederation', label: 'Confederation' },
  { id: 'tribe', label: 'Tribe' },
  { id: 'clan', label: 'Clan' },
  { id: 'branch', label: 'Branch' },
  { id: 'house', label: 'House / family' },
];

export const TRIBAL_CONFIDENCE = [
  { id: 'unknown', label: 'Unknown' },
  { id: 'claimed', label: 'Claimed' },
  { id: 'family-tradition', label: 'Family tradition' },
  { id: 'documented', label: 'Documented' },
  { id: 'conflicting', label: 'Conflicting' },
];

const FACT_TYPE_LEVEL = new Map([
  ['Clan', 'clan'],
  ['TribeName', 'tribe'],
  ['NationalOrTribalOrigin', 'tribe'],
  ['CasteName', 'clan'],
]);

export function affiliationName(record) {
  return readField(record, ['name', 'title'], record?.recordName || 'Affiliation');
}

export function affiliationLevel(record) {
  return readField(record, ['level'], 'clan');
}

export function affiliationLevelLabel(level) {
  return TRIBAL_AFFILIATION_LEVELS.find((item) => item.id === level)?.label || level || 'Clan';
}

export function affiliationConfidenceLabel(confidence) {
  return TRIBAL_CONFIDENCE.find((item) => item.id === confidence)?.label || confidence || 'Unknown';
}

export function factAffiliationInfo(fact) {
  const type = normalizeConclusionTypeId(readRef(fact?.fields?.conclusionType) || fact?.fields?.type?.value || '');
  const level = FACT_TYPE_LEVEL.get(type);
  const name = String(readField(fact, ['description', 'value', 'text'], '') || '').trim();
  if (!level || !name) return null;
  return { name, level, factType: type };
}

export function makeAffiliationKey(name, level) {
  return `${level || 'clan'}:${String(name || '').trim().toLocaleLowerCase()}`;
}

export function createAffiliationRecord({ name, level = 'clan', parentId = '', confidence = 'unknown', notes = '' }) {
  const fields = {
    name: { value: name, type: 'STRING' },
    level: { value: level, type: 'STRING' },
    confidence: { value: confidence, type: 'STRING' },
  };
  if (parentId) fields.parentAffiliation = writeRef(parentId, 'TribalAffiliation');
  if (notes) fields.notes = { value: notes, type: 'STRING' };
  return {
    recordName: `tribe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    recordType: 'TribalAffiliation',
    fields,
  };
}

export function createAffiliationRelation({ affiliationId, personId, personName = '', role = '', confidence = 'unknown', fromDate = '', toDate = '', notes = '' }) {
  const fields = {
    affiliation: writeRef(affiliationId, 'TribalAffiliation'),
    person: writeRef(personId, 'Person'),
    confidence: { value: confidence, type: 'STRING' },
  };
  if (personName) fields.cached_personName = { value: personName, type: 'STRING' };
  if (role) fields.role = { value: role, type: 'STRING' };
  if (fromDate) fields.fromDate = { value: fromDate, type: 'STRING' };
  if (toDate) fields.toDate = { value: toDate, type: 'STRING' };
  if (notes) fields.notes = { value: notes, type: 'STRING' };
  return {
    recordName: `tar-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    recordType: 'TribalAffiliationRelation',
    fields,
  };
}

export async function loadTribalAffiliationModel(db) {
  const [affiliationRows, relationRows, factRows, personRows] = await Promise.all([
    db.query('TribalAffiliation', { limit: 100000 }),
    db.query('TribalAffiliationRelation', { limit: 100000 }),
    db.query('PersonFact', { limit: 100000 }),
    db.query('Person', { limit: 100000 }),
  ]);

  const peopleById = new Map(personRows.records.map((person) => [person.recordName, {
    record: person,
    label: personSummary(person)?.fullName || readField(person, ['cached_fullName', 'firstName', 'lastName'], person.recordName),
  }]));

  const realAffiliations = affiliationRows.records.map((record) => ({
    record,
    recordName: record.recordName,
    name: affiliationName(record),
    level: affiliationLevel(record),
    confidence: readField(record, ['confidence'], 'unknown'),
    parentId: readRef(record.fields?.parentAffiliation),
    notes: readField(record, ['notes', 'description'], ''),
    source: 'record',
    virtual: false,
  }));

  const affiliationByKey = new Map(realAffiliations.map((item) => [makeAffiliationKey(item.name, item.level), item]));
  const derivedByKey = new Map();
  const derivedMemberships = [];

  for (const fact of factRows.records) {
    const info = factAffiliationInfo(fact);
    if (!info) continue;
    const personId = readRef(fact.fields?.person);
    const person = peopleById.get(personId);
    if (!person) continue;
    const key = makeAffiliationKey(info.name, info.level);
    if (!affiliationByKey.has(key) && !derivedByKey.has(key)) {
      derivedByKey.set(key, {
        record: {
          recordName: `derived-${key}`,
          recordType: 'TribalAffiliation',
          fields: {
            name: { value: info.name, type: 'STRING' },
            level: { value: info.level, type: 'STRING' },
            confidence: { value: 'family-tradition', type: 'STRING' },
          },
        },
        recordName: `derived-${key}`,
        name: info.name,
        level: info.level,
        confidence: 'family-tradition',
        parentId: '',
        notes: 'Derived from imported person facts.',
        source: 'personFact',
        virtual: true,
      });
    }
    const affiliation = affiliationByKey.get(key) || derivedByKey.get(key);
    derivedMemberships.push({
      relation: fact,
      relationType: 'PersonFact',
      affiliationId: affiliation.recordName,
      personId,
      person,
      confidence: 'family-tradition',
      notes: readField(fact, ['note', 'notes'], ''),
      source: 'personFact',
      virtual: true,
    });
  }

  const realMemberships = relationRows.records.map((relation) => {
    const personId = readRef(relation.fields?.person);
    return {
      relation,
      relationType: 'TribalAffiliationRelation',
      affiliationId: readRef(relation.fields?.affiliation),
      personId,
      person: peopleById.get(personId),
      role: readField(relation, ['role'], ''),
      confidence: readField(relation, ['confidence'], 'unknown'),
      fromDate: readField(relation, ['fromDate'], ''),
      toDate: readField(relation, ['toDate'], ''),
      notes: readField(relation, ['notes'], ''),
      source: 'record',
      virtual: false,
    };
  });

  return {
    affiliations: [...realAffiliations, ...derivedByKey.values()].sort(compareAffiliations),
    memberships: [...realMemberships, ...derivedMemberships],
    people: [...peopleById.values()].sort((a, b) => a.label.localeCompare(b.label)),
  };
}

function compareAffiliations(a, b) {
  return affiliationLevelLabel(a.level).localeCompare(affiliationLevelLabel(b.level)) || a.name.localeCompare(b.name);
}
