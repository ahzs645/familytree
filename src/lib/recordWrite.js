/**
 * recordWrite — the write-side helpers for record envelopes.
 *
 * Every UI mutation should go through these (or saveWithChangeLog directly)
 * instead of hand-building `{ value, type: 'STRING' }` literals and calling
 * db.saveRecord — raw saves silently skip the change log.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { logRecordCreated, logRecordDeleted } from './changeLog.js';
import { writeRef } from './schema.js';
import { generateId } from './ids.js';

/** Build a STRING field envelope, or undefined for empty values. */
export function stringField(value) {
  return value === undefined || value === null || value === '' ? undefined : { value, type: 'STRING' };
}

/**
 * Return a copy of `record` with `values` applied: `fields` names become
 * STRING fields (removed when empty), `refFields` maps field name →
 * referenced recordType and writes/removes REFERENCE fields.
 */
export function applyValuesToRecord(record, values, { fields = [], refFields = {} } = {}) {
  const next = { ...record, fields: { ...record.fields } };
  for (const name of fields) {
    const field = stringField(values[name]);
    if (field) next.fields[name] = field;
    else delete next.fields[name];
  }
  for (const [name, refType] of Object.entries(refFields)) {
    const target = values[name];
    if (target) next.fields[name] = writeRef(target, refType);
    else delete next.fields[name];
  }
  return next;
}

/** Build a fresh record envelope from plain string values. */
export function createRecordEnvelope(recordType, idPrefix, values = {}) {
  const fields = {};
  for (const [name, value] of Object.entries(values)) {
    const field = stringField(value);
    if (field) fields[name] = field;
  }
  return { recordName: generateId(idPrefix), recordType, fields };
}

/** Persist a brand-new record and write its change-log entry. */
export async function createWithChangeLog(record) {
  await getLocalDatabase().saveRecord(record);
  await logRecordCreated(record);
  return record;
}

/** Delete a record and write its change-log entry. */
export async function deleteWithChangeLog(recordName, recordType) {
  await getLocalDatabase().deleteRecord(recordName);
  await logRecordDeleted(recordName, recordType);
}
