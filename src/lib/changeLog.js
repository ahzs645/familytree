/**
 * saveWithChangeLog — wrap a record save so every field-level change becomes
 * one ChangeLogEntry + one ChangeLogSubEntry per modified field. Mirrors the
 * shape MFT11 uses so the Change Log viewer can display native + new edits
 * side by side.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { refValue } from './recordRef.js';

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
        changeLogEntry: { value: refValue(entryName, 'ChangeLogEntry'), type: 'REFERENCE' },
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
      target: { value: refValue(updatedRecord.recordName, updatedRecord.recordType), type: 'REFERENCE' },
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
      target: { value: refValue(record.recordName, record.recordType), type: 'REFERENCE' },
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
      target: { value: refValue(recordName, recordType), type: 'REFERENCE' },
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

/**
 * Purge change-log entries older than a cutoff, mirroring Mac's
 * `_ChangeLogPurgeButton_PurgeOlderThanLast{Hour,Day,Week,Month,Year}` buttons.
 * Also supports "purge entries whose target record no longer exists".
 *
 * Returns { removedEntries, removedSubEntries } so callers can surface a
 * confirmation message.
 */
export const PURGE_WINDOWS = [
  { id: 'hour', label: 'Purge older than last hour', ms: 60 * 60 * 1000 },
  { id: 'day', label: 'Purge older than last day', ms: 24 * 60 * 60 * 1000 },
  { id: 'week', label: 'Purge older than last week', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: 'month', label: 'Purge older than last month', ms: 30 * 24 * 60 * 60 * 1000 },
  { id: 'year', label: 'Purge older than last year', ms: 365 * 24 * 60 * 60 * 1000 },
];

export async function purgeChangeLogOlderThan(windowMs) {
  const db = getLocalDatabase();
  const cutoff = Date.now() - Number(windowMs || 0);
  const { records: entries } = await db.query('ChangeLogEntry', { limit: 1000000 });
  const doomed = entries.filter((record) => {
    const ts = Date.parse(record?.fields?.timestamp?.value || '');
    return Number.isFinite(ts) && ts < cutoff;
  });
  return deleteChangeLogEntries(db, doomed);
}

export async function purgeChangeLogForDeletedRecords() {
  const db = getLocalDatabase();
  const { records: entries } = await db.query('ChangeLogEntry', { limit: 1000000 });
  const checks = await Promise.all(entries.map(async (entry) => {
    const targetRef = entry?.fields?.target?.value;
    if (!targetRef || typeof targetRef !== 'string') return null;
    const targetName = targetRef.split('---')[0];
    const target = targetName ? await db.getRecord(targetName) : null;
    return target ? null : entry;
  }));
  const doomed = checks.filter(Boolean);
  return deleteChangeLogEntries(db, doomed);
}

async function deleteChangeLogEntries(db, entries) {
  if (!entries.length) return { removedEntries: 0, removedSubEntries: 0 };
  const entryNames = new Set(entries.map((entry) => entry.recordName));
  const { records: allSubs } = await db.query('ChangeLogSubEntry', { limit: 1000000 });
  const doomedSubs = allSubs.filter((sub) => {
    const ref = sub?.fields?.changeLogEntry?.value;
    if (!ref || typeof ref !== 'string') return false;
    return entryNames.has(ref.split('---')[0]);
  });
  for (const sub of doomedSubs) await db.deleteRecord(sub.recordName);
  for (const entry of entries) await db.deleteRecord(entry.recordName);
  return { removedEntries: entries.length, removedSubEntries: doomedSubs.length };
}
