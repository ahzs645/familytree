/**
 * saveWithChangeLog — wrap a record save so every field-level change becomes
 * one ChangeLogEntry + one ChangeLogSubEntry per modified field. Mirrors the
 * shape MFT11 uses so the Change Log viewer can display native + new edits
 * side by side.
 */
import { getLocalDatabase } from './LocalDatabase.js';

let _seq = 0;

function uuid(prefix) {
  _seq++;
  return `${prefix}-${Date.now().toString(36)}-${_seq.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function diffFields(prevFields = {}, nextFields = {}) {
  const changes = [];
  const keys = new Set([...Object.keys(prevFields), ...Object.keys(nextFields)]);
  for (const k of keys) {
    const a = prevFields[k]?.value;
    const b = nextFields[k]?.value;
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changes.push({ field: k, before: a, after: b });
    }
  }
  return changes;
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * Save a record and append change-log entries for every field that changed.
 * Returns the saved record. If no changes, the record is still saved (touch)
 * but no log entries are written.
 */
export async function saveWithChangeLog(updatedRecord, { author = 'You', changeKind = 'Change' } = {}) {
  const db = getLocalDatabase();
  const prev = await db.getRecord(updatedRecord.recordName);
  const changes = diffFields(prev?.fields, updatedRecord.fields);

  await db.saveRecord(updatedRecord);

  if (changes.length === 0) return updatedRecord;

  const entryName = uuid('cle');
  const subEntries = [];
  for (const c of changes) {
    const subName = uuid('cls');
    const sub = {
      recordName: subName,
      recordType: 'ChangeLogSubEntry',
      fields: {
        changeLogEntry: { value: { recordName: entryName } },
        fieldName: { value: c.field },
        oldValue: { value: stringifyValue(c.before) },
        newValue: { value: stringifyValue(c.after) },
      },
    };
    subEntries.push(sub);
  }

  const entry = {
    recordName: entryName,
    recordType: 'ChangeLogEntry',
    fields: {
      target: { value: { recordName: updatedRecord.recordName } },
      targetType: { value: updatedRecord.recordType },
      timestamp: { value: nowIso() },
      author: { value: author },
      changeType: { value: changeKind },
      changeCount: { value: changes.length },
      summary: { value: summarize(changes) },
    },
  };

  await db.saveRecord(entry);
  for (const sub of subEntries) await db.saveRecord(sub);
  return updatedRecord;
}

function stringifyValue(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.recordName) return `→ ${v.recordName}`;
    return JSON.stringify(v);
  }
  return String(v);
}

function summarize(changes) {
  const parts = changes.slice(0, 3).map((c) => c.field);
  const more = changes.length > 3 ? ` (+${changes.length - 3} more)` : '';
  return `${parts.join(', ')}${more}`;
}

/**
 * Append a creation or deletion entry without diffing fields.
 */
export async function logRecordCreated(record, { author = 'You' } = {}) {
  const db = getLocalDatabase();
  const entry = {
    recordName: uuid('cle'),
    recordType: 'ChangeLogEntry',
    fields: {
      target: { value: { recordName: record.recordName } },
      targetType: { value: record.recordType },
      timestamp: { value: nowIso() },
      author: { value: author },
      changeType: { value: 'Add' },
      changeCount: { value: Object.keys(record.fields || {}).length },
      summary: { value: 'Created' },
    },
  };
  await db.saveRecord(entry);
}

export async function logRecordDeleted(recordName, recordType, { author = 'You' } = {}) {
  const db = getLocalDatabase();
  const entry = {
    recordName: uuid('cle'),
    recordType: 'ChangeLogEntry',
    fields: {
      target: { value: { recordName } },
      targetType: { value: recordType },
      timestamp: { value: nowIso() },
      author: { value: author },
      changeType: { value: 'Delete' },
      changeCount: { value: 0 },
      summary: { value: 'Deleted' },
    },
  };
  await db.saveRecord(entry);
}
