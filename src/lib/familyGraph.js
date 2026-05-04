import { getLocalDatabase } from './LocalDatabase.js';
import { readField } from './schema.js';
import { refToRecordName } from './recordRef.js';
import { isPublicRecord } from './privacy.js';
import { personSummary } from '../models/index.js';

export async function loadFamilyGraph({ includePrivate = false } = {}) {
  const db = getLocalDatabase();
  const [{ records: people }, { records: families }, { records: childRelations }, { records: groupRelations }, { records: groups }] = await Promise.all([
    db.query('Person', { limit: 100000 }),
    db.query('Family', { limit: 100000 }),
    db.query('ChildRelation', { limit: 100000 }),
    db.query('PersonGroupRelation', { limit: 100000 }),
    db.query('PersonGroup', { limit: 100000 }),
  ]);

  const persons = people.filter((record) => includePrivate || isPublicRecord(record));
  const personById = new Map(persons.map((person) => [person.recordName, person]));
  const familyById = new Map(families.filter((family) => includePrivate || isPublicRecord(family)).map((family) => [family.recordName, family]));
  const childrenByFamily = new Map();
  const parentFamilyByChild = new Map();
  const childIdsByParent = new Map();
  const spouseIdsByPerson = new Map();

  const addToMapSet = (map, key, value) => {
    if (!key || !value) return;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(value);
  };

  for (const rel of childRelations) {
    const familyId = refToRecordName(rel.fields?.family?.value);
    const childId = refToRecordName(rel.fields?.child?.value);
    if (!familyId || !childId || !familyById.has(familyId) || !personById.has(childId)) continue;
    addToMapSet(childrenByFamily, familyId, childId);
    addToMapSet(parentFamilyByChild, childId, familyId);
  }

  for (const family of familyById.values()) {
    const manId = refToRecordName(family.fields?.man?.value);
    const womanId = refToRecordName(family.fields?.woman?.value);
    const children = [...(childrenByFamily.get(family.recordName) || [])];
    if (manId && womanId && personById.has(manId) && personById.has(womanId)) {
      addToMapSet(spouseIdsByPerson, manId, womanId);
      addToMapSet(spouseIdsByPerson, womanId, manId);
    }
    for (const childId of children) {
      if (manId && personById.has(manId)) addToMapSet(childIdsByParent, manId, childId);
      if (womanId && personById.has(womanId)) addToMapSet(childIdsByParent, womanId, childId);
    }
  }

  const groupsByPerson = new Map();
  const groupNameById = new Map(groups.map((group) => [
    group.recordName,
    readField(group, ['name', 'title'], group.recordName),
  ]));
  for (const rel of groupRelations) {
    const personId = refToRecordName(rel.fields?.person?.value);
    const groupId = refToRecordName(rel.fields?.personGroup?.value);
    if (personId && groupId) addToMapSet(groupsByPerson, personId, groupNameById.get(groupId) || groupId);
  }

  const getPerson = (id) => personById.get(id) || null;
  const getSummary = (id) => personSummary(getPerson(id));
  const getParents = (id) => {
    const out = [];
    for (const familyId of parentFamilyByChild.get(id) || []) {
      const family = familyById.get(familyId);
      const fatherId = refToRecordName(family?.fields?.man?.value);
      const motherId = refToRecordName(family?.fields?.woman?.value);
      if (fatherId || motherId) out.push({ familyId, fatherId, motherId });
    }
    return out;
  };

  return {
    persons,
    families: [...familyById.values()],
    childRelations,
    personById,
    familyById,
    childrenByFamily,
    parentFamilyByChild,
    childIdsByParent,
    spouseIdsByPerson,
    groupsByPerson,
    getPerson,
    getSummary,
    getParents,
    getChildren: (id) => [...(childIdsByParent.get(id) || [])],
    getSpouses: (id) => [...(spouseIdsByPerson.get(id) || [])],
    getGroups: (id) => [...(groupsByPerson.get(id) || [])],
  };
}

export function yearOf(value) {
  const match = String(value || '').match(/\b([12]\d{3}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

export function birthYearOf(record) {
  return yearOf(readField(record, ['cached_birthDate', 'birthDate', 'born', 'dateOfBirth'], ''));
}

export function personDisplayName(record) {
  return personSummary(record)?.fullName || readField(record, ['cached_fullName', 'firstName', 'name'], record?.recordName || '');
}

export function surnameOf(record) {
  const explicit = readField(record, ['lastName', 'surname', 'maidenName'], '');
  if (explicit) return String(explicit).trim();
  const name = personDisplayName(record);
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export function comparePeopleByBirthThenName(graph, aId, bId) {
  const a = graph.getPerson(aId);
  const b = graph.getPerson(bId);
  const ay = birthYearOf(a);
  const by = birthYearOf(b);
  if (ay != null && by != null && ay !== by) return ay - by;
  if (ay != null && by == null) return -1;
  if (ay == null && by != null) return 1;
  return personDisplayName(a).localeCompare(personDisplayName(b));
}
