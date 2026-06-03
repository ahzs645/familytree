import { getLocalDatabase } from './LocalDatabase.js';
import { logRecordCreated, saveWithChangeLog } from './changeLog.js';
import { refToRecordName, refValue } from './recordRef.js';
import { Gender } from '../models/index.js';
import { generateId } from './ids.js';

function uuid(prefix) {
  return generateId(prefix);
}

export async function linkExistingRelative(personId, relativeId, relationType) {
  if (!personId || !relativeId || personId === relativeId) throw new Error('Pick two different people.');
  const db = getLocalDatabase();
  const [person, relative] = await Promise.all([db.getRecord(personId), db.getRecord(relativeId)]);
  if (!person || !relative) throw new Error('Person not found.');

  if (relationType === 'spouse') return linkSpouse(db, person, relative);
  if (relationType === 'child') return linkChild(db, person, relative);
  if (relationType === 'parent') return linkParent(db, person, relative);
  if (relationType === 'sibling') return linkSibling(db, person, relative);
  throw new Error(`Unsupported relation type: ${relationType}`);
}

async function linkSpouse(db, person, spouse) {
  const existing = await findCoupleFamily(db, person.recordName, spouse.recordName);
  if (existing) return { family: existing, created: false, relation: 'spouse' };
  const fields = parentFieldsForCouple(person, spouse);
  const family = { recordName: uuid('family'), recordType: 'Family', fields };
  await db.saveRecord(family);
  await logRecordCreated(family);
  return { family, created: true, relation: 'spouse' };
}

async function linkChild(db, parent, child) {
  let family = await findFamilyWithParent(db, parent.recordName);
  if (!family) {
    family = {
      recordName: uuid('family'),
      recordType: 'Family',
      fields: parentFieldFor(parent),
    };
    await db.saveRecord(family);
    await logRecordCreated(family);
  }
  await ensureChildRelation(db, family.recordName, child.recordName);
  return { family, created: true, relation: 'child' };
}

async function linkParent(db, child, parent) {
  let family = await findFamilyForChild(db, child.recordName);
  if (!family) {
    family = {
      recordName: uuid('family'),
      recordType: 'Family',
      fields: parentFieldFor(parent),
    };
    await db.saveRecord(family);
    await logRecordCreated(family);
  } else {
    const fields = { ...(family.fields || {}) };
    assignParent(fields, parent);
    await saveWithChangeLog({ ...family, fields });
    family = { ...family, fields };
  }
  await ensureChildRelation(db, family.recordName, child.recordName);
  return { family, created: true, relation: 'parent' };
}

async function linkSibling(db, person, sibling) {
  let family = await findFamilyForChild(db, person.recordName);
  if (!family) {
    family = { recordName: uuid('family'), recordType: 'Family', fields: {} };
    await db.saveRecord(family);
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
  return familyId ? db.getRecord(familyId) : null;
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
  await db.saveRecord(rec);
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

function assignParent(fields, person) {
  const gender = person.fields?.gender?.value;
  const ref = { value: refValue(person.recordName, 'Person'), type: 'REFERENCE' };
  if (gender === Gender.Male && !fields.man) fields.man = ref;
  else if (gender === Gender.Female && !fields.woman) fields.woman = ref;
  else if (!fields.man) fields.man = ref;
  else if (!fields.woman) fields.woman = ref;
}
