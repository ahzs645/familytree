/**
 * Persistence helpers used by the PersonEditor's onSave path.
 *
 * - reconcileSubRecords: generic add/update/delete for child records
 *   (additional names, events, facts, ...) that all reference the parent
 *   person via a single `parentField`.
 * - reconcileMilkKinships: same idea but the "current person" can appear
 *   in any of three role fields (child, nursingMother, milkFather), so it
 *   needs its own query that unions the three.
 * - writeOptionalStringField: utility that keeps record.fields clean of
 *   blank string values.
 */
import { saveWithChangeLog, logRecordCreated, logRecordDeleted } from '../../lib/changeLog.js';
import { refValue } from '../../lib/recordRef.js';
import { MILK_KINSHIP_RECORD_TYPE } from '../../lib/milkKinship.js';

function uuid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function writeOptionalStringField(record, fieldName, value) {
  const clean = String(value || '').trim();
  if (clean) record.fields[fieldName] = { value: clean, type: 'STRING' };
  else delete record.fields[fieldName];
}

export async function queryMilkKinshipsForPerson(db, personId) {
  const rows = await Promise.all([
    db.query(MILK_KINSHIP_RECORD_TYPE, { referenceField: 'child', referenceValue: personId, limit: 1000 }),
    db.query(MILK_KINSHIP_RECORD_TYPE, { referenceField: 'nursingMother', referenceValue: personId, limit: 1000 }),
    db.query(MILK_KINSHIP_RECORD_TYPE, { referenceField: 'milkFather', referenceValue: personId, limit: 1000 }),
  ]);
  const byId = new Map();
  for (const row of rows) {
    for (const record of row.records) byId.set(record.recordName, record);
  }
  return [...byId.values()];
}

export function milkKinshipFields(item, currentPersonId) {
  const role = item.role || 'child';
  const childId = role === 'child' ? currentPersonId : item.childId;
  const nursingMotherId = role === 'nursingMother' ? currentPersonId : item.nursingMotherId;
  const milkFatherId = role === 'milkFather' ? currentPersonId : item.milkFatherId;
  const fields = {};
  if (childId) fields.child = { value: refValue(childId, 'Person'), type: 'REFERENCE' };
  if (nursingMotherId) fields.nursingMother = { value: refValue(nursingMotherId, 'Person'), type: 'REFERENCE' };
  if (milkFatherId) fields.milkFather = { value: refValue(milkFatherId, 'Person'), type: 'REFERENCE' };
  fields.isActive = { value: item.isActive !== false, type: 'BOOLEAN' };
  if (item.startDate) fields.startDate = { value: item.startDate, type: 'STRING' };
  if (item.endDate) fields.endDate = { value: item.endDate, type: 'STRING' };
  if (item.notes) fields.notes = { value: item.notes, type: 'STRING' };
  return fields;
}

export async function reconcileMilkKinships(db, currentPersonId, items) {
  const existing = await queryMilkKinshipsForPerson(db, currentPersonId);
  const keep = new Set();
  for (const item of items) {
    const fields = milkKinshipFields(item, currentPersonId);
    if (!fields.child || !fields.nursingMother) continue;
    if (item.recordName) {
      keep.add(item.recordName);
      const prev = existing.find((record) => record.recordName === item.recordName);
      if (prev) await saveWithChangeLog({ ...prev, fields });
    } else {
      const rec = { recordName: uuid('milk'), recordType: MILK_KINSHIP_RECORD_TYPE, fields };
      await db.saveRecord(rec);
      await logRecordCreated(rec);
      keep.add(rec.recordName);
    }
  }
  for (const prev of existing) {
    if (!keep.has(prev.recordName)) {
      await db.deleteRecord(prev.recordName);
      await logRecordDeleted(prev.recordName, MILK_KINSHIP_RECORD_TYPE);
    }
  }
}

/**
 * Reconcile a list of UI items against existing sub-records of `subType` whose
 * `parentField` references the parent. Adds, updates, deletes accordingly.
 */
export async function reconcileSubRecords(db, parentId, subType, parentField, items, fieldsBuilder, isValid) {
  const existing = (await db.query(subType, { referenceField: parentField, referenceValue: parentId, limit: 500 })).records;
  const keep = new Set();
  for (const item of items) {
    if (!isValid(item)) continue;
    if (item.recordName) {
      keep.add(item.recordName);
      const prev = existing.find((r) => r.recordName === item.recordName);
      if (prev) {
        await saveWithChangeLog({
          ...prev,
          fields: { ...prev.fields, ...fieldsBuilder(item), [parentField]: { value: refValue(parentId, 'Person'), type: 'REFERENCE' } },
        });
      }
    } else {
      const rec = {
        recordName: uuid(subType.toLowerCase().slice(0, 3)),
        recordType: subType,
        fields: { ...fieldsBuilder(item), [parentField]: { value: refValue(parentId, 'Person'), type: 'REFERENCE' } },
      };
      await db.saveRecord(rec);
      await logRecordCreated(rec);
      keep.add(rec.recordName);
    }
  }
  for (const prev of existing) {
    if (!keep.has(prev.recordName)) {
      await db.deleteRecord(prev.recordName);
      await logRecordDeleted(prev.recordName, subType);
    }
  }
}
