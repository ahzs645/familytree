// @ts-check
/**
 * recordWrite — the write-side helpers for record envelopes.
 *
 * Every UI mutation should go through these (or saveWithChangeLog directly)
 * instead of hand-building `{ value, type: 'STRING' }` literals and calling
 * db.saveRecord — raw saves silently skip the change log.
 */
import { getAppDataClient } from './data/AppDataClient.js';
import { logRecordCreated, logRecordDeleted } from './changeLog.js';
import { writeRef } from './schema.js';
import { generateId } from './ids.js';

/**
 * @typedef {{ value: unknown, type: string }} FieldEnvelope
 * @typedef {{ recordName: string, recordType: string, fields: Record<string, FieldEnvelope> }} RecordEnvelope
 */

/**
 * Build a STRING field envelope, or undefined for empty values.
 * @param {unknown} value
 * @returns {FieldEnvelope | undefined}
 */
export function stringField(value) {
  return value === undefined || value === null || value === '' ? undefined : { value, type: 'STRING' };
}

/**
 * Return a copy of `record` with `values` applied: `fields` names become
 * STRING fields (removed when empty), `refFields` maps field name →
 * referenced recordType and writes/removes REFERENCE fields.
 * @param {RecordEnvelope} record
 * @param {Record<string, unknown>} values
 * @param {{ fields?: string[], refFields?: Record<string, string> }} [shape]
 * @returns {RecordEnvelope}
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
    if (target) next.fields[name] = /** @type {FieldEnvelope} */ (writeRef(target, refType));
    else delete next.fields[name];
  }
  return next;
}

/**
 * Build a fresh record envelope from plain string values.
 * @param {string} recordType
 * @param {string} idPrefix
 * @param {Record<string, unknown>} [values]
 * @returns {RecordEnvelope}
 */
export function createRecordEnvelope(recordType, idPrefix, values = {}) {
  /** @type {Record<string, FieldEnvelope>} */
  const fields = {};
  for (const [name, value] of Object.entries(values)) {
    const field = stringField(value);
    if (field) fields[name] = field;
  }
  return { recordName: generateId(idPrefix), recordType, fields };
}

/**
 * Persist a brand-new record and write its change-log entry.
 * @param {RecordEnvelope} record
 */
export async function createWithChangeLog(record) {
  await getAppDataClient().records.save(record);
  await logRecordCreated(record);
  return record;
}

/**
 * Delete a record and write its change-log entry.
 * @param {string} recordName
 * @param {string} recordType
 */
export async function deleteWithChangeLog(recordName, recordType) {
  await getAppDataClient().records.delete(recordName);
  await logRecordDeleted(recordName, recordType);
}
