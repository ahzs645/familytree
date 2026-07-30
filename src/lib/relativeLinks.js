import { getAppDataClient } from './data/AppDataClient.js';
import { logRecordCreated, saveWithChangeLog } from './changeLog.js';
import { refToRecordName, refValue } from './recordRef.js';
import { Gender } from '../models/index.js';
import { generateId } from './ids.js';

function uuid(prefix) {
  return generateId(prefix);
}

export async function linkExistingRelative(personId, relativeId, relationType, options = {}) {
  if (!personId || !relativeId || personId === relativeId) throw new Error('Pick two different people.');
  const db = getAppDataClient().records;
  const [person, relative] = await Promise.all([db.get(personId), db.get(relativeId)]);
  if (!person || !relative) throw new Error('Person not found.');

  if (relationType === 'spouse') return linkSpouse(db, person, relative);
  if (relationType === 'child') return linkChild(db, person, relative, options);
  if (relationType === 'parent') return linkParent(db, person, relative);
  if (relationType === 'sibling') return linkSibling(db, person, relative);
  throw new Error(`Unsupported relation type: ${relationType}`);
}

async function linkSpouse(db, person, spouse) {
  const existing = await findCoupleFamily(db, person.recordName, spouse.recordName);
  if (existing) return { family: existing, created: false, relation: 'spouse' };
  const fields = parentFieldsForCouple(person, spouse);
  const family = { recordName: uuid('family'), recordType: 'Family', fields };
  await db.save(family);
  await logRecordCreated(family);
  return { family, created: true, relation: 'spouse' };
}

async function linkChild(db, parent, child, options = {}) {
  // "Add son with <partner>" names the union to attach to. Without this the
  // child landed in whichever family happened to be found first, which is the
  // wrong one for anybody with more than one partner.
  let family = options.partnerId
    ? await findCoupleFamily(db, parent.recordName, options.partnerId)
    : null;
  if (!family) family = await findFamilyWithParent(db, parent.recordName);
  if (!family) {
    family = {
      recordName: uuid('family'),
      recordType: 'Family',
      fields: parentFieldFor(parent),
    };
    await db.save(family);
    await logRecordCreated(family);
  }
  await ensureChildRelation(db, family.recordName, child.recordName);
  return { family, created: true, relation: 'child' };
}

async function linkParent(db, child, parent) {
  const families = await findFamiliesForChild(db, child.recordName);
  // Already a parent in one of the child's families — nothing to do.
  const already = families.find((family) => (
    refToRecordName(family.fields?.man?.value) === parent.recordName
    || refToRecordName(family.fields?.woman?.value) === parent.recordName
  ));
  if (already) return { family: already, created: false, relation: 'parent' };

  // Slot the parent into an existing family if one has room. `assignParent`
  // used to be called unconditionally and silently did nothing when both the
  // man and woman slots were taken — the caller then reported success and the
  // new person was left floating with no relationship at all.
  for (const family of families) {
    const fields = { ...(family.fields || {}) };
    if (!assignParent(fields, parent)) continue;
    await saveWithChangeLog({ ...family, fields });
    await ensureChildRelation(db, family.recordName, child.recordName);
    return { family: { ...family, fields }, created: false, relation: 'parent' };
  }

  // No room (or no parent family yet): give the child another parent family.
  // The schema models parentage as ChildRelation rows, so a child can belong
  // to more than one — which is also how step/adoptive parents are recorded.
  const family = {
    recordName: uuid('family'),
    recordType: 'Family',
    fields: parentFieldFor(parent),
  };
  await db.save(family);
  await logRecordCreated(family);
  await ensureChildRelation(db, family.recordName, child.recordName);
  return { family, created: true, relation: 'parent' };
}

async function linkSibling(db, person, sibling) {
  let family = await findFamilyForChild(db, person.recordName);
  if (!family) {
    family = { recordName: uuid('family'), recordType: 'Family', fields: {} };
    await db.save(family);
    await logRecordCreated(family);
    await ensureChildRelation(db, family.recordName, person.recordName);
  }
  await ensureChildRelation(db, family.recordName, sibling.recordName);
  return { family, created: true, relation: 'sibling' };
}

async function findCoupleFamily(db, aId, bId) {
  const { records } = await db.query('Family', { limit: 100000 });
  return records.find((family) => {
    const man = refToRecordName(family.fields?.man?.value);
    const woman = refToRecordName(family.fields?.woman?.value);
    return (man === aId && woman === bId) || (man === bId && woman === aId);
  }) || null;
}

async function findFamilyWithParent(db, parentId) {
  const { records } = await db.query('Family', { limit: 100000 });
  return records.find((family) => (
    refToRecordName(family.fields?.man?.value) === parentId ||
    refToRecordName(family.fields?.woman?.value) === parentId
  )) || null;
}

async function findFamilyForChild(db, childId) {
  const { records } = await db.query('ChildRelation', { referenceField: 'child', referenceValue: childId, limit: 100000 });
  const familyId = refToRecordName(records[0]?.fields?.family?.value);
  return familyId ? db.get(familyId) : null;
}

/** Every family this person is a child in, in ChildRelation order. */
async function findFamiliesForChild(db, childId) {
  const { records } = await db.query('ChildRelation', { referenceField: 'child', referenceValue: childId, limit: 100000 });
  const families = [];
  for (const relation of records) {
    const familyId = refToRecordName(relation.fields?.family?.value);
    if (!familyId) continue;
    const family = await db.get(familyId);
    if (family) families.push(family);
  }
  return families;
}

async function ensureChildRelation(db, familyId, childId) {
  const existing = await db.query('ChildRelation', { referenceField: 'family', referenceValue: familyId, limit: 100000 });
  if (existing.records.some((rel) => refToRecordName(rel.fields?.child?.value) === childId)) return null;
  const rec = {
    recordName: uuid('cr'),
    recordType: 'ChildRelation',
    fields: {
      family: { value: refValue(familyId, 'Family'), type: 'REFERENCE' },
      child: { value: refValue(childId, 'Person'), type: 'REFERENCE' },
      order: { value: existing.records.length, type: 'NUMBER' },
    },
  };
  await db.save(rec);
  await logRecordCreated(rec);
  return rec;
}

function parentFieldsForCouple(person, spouse) {
  const fields = {};
  assignParent(fields, person);
  assignParent(fields, spouse);
  return fields;
}

function parentFieldFor(person) {
  const fields = {};
  assignParent(fields, person);
  return fields;
}

/**
 * Put `person` into a free parent slot, preferring the one matching their
 * gender. Returns false when both slots are already taken so callers can
 * create another family instead of dropping the link on the floor.
 */
function assignParent(fields, person) {
  const gender = person.fields?.gender?.value;
  const ref = { value: refValue(person.recordName, 'Person'), type: 'REFERENCE' };
  if (gender === Gender.Male && !fields.man) fields.man = ref;
  else if (gender === Gender.Female && !fields.woman) fields.woman = ref;
  else if (!fields.man) fields.man = ref;
  else if (!fields.woman) fields.woman = ref;
  else return false;
  return true;
}
