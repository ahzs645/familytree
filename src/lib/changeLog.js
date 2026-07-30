/**
 * saveWithChangeLog — wrap a record save so every field-level change becomes
 * one ChangeLogEntry + one ChangeLogSubEntry per modified field. Mirrors the
 * shape MFT11 uses so the Change Log viewer can display native + new edits
 * side by side.
 */
import { getAppDataClient } from './data/AppDataClient.js';
import { refToRecordName, refValue } from './recordRef.js';

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
export async function saveWithChangeLog(updatedRecord, { author = 'You', changeKind = 'Change', lineage = null } = {}) {
  const db = getAppDataClient().records;
  const prev = await db.get(updatedRecord.recordName);
  const changes = diffFields(prev?.fields, updatedRecord.fields);

  await db.save(updatedRecord);

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
      ...lineageFields(lineage),
    },
  };

  await db.save(entry);
  for (const sub of subEntries) await db.save(sub);
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
export async function logRecordCreated(record, { author = 'You', lineage = null } = {}) {
  const db = getAppDataClient().records;
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
      ...lineageFields(lineage),
    },
  };
  await db.save(entry);
  return entry;
}

export async function logRecordDeleted(recordName, recordType, { author = 'You', lineage = null } = {}) {
  const db = getAppDataClient().records;
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
      ...lineageFields(lineage),
    },
  };
  await db.save(entry);
  return entry;
}

/**
 * Change-log entries for a batch of deletions, returned rather than saved so a
 * caller can put them in the same transaction as the deletes themselves.
 *
 * Bulk deletes (deletePerson, deleteFamily, removeSubtree) used to bypass the
 * change log entirely, which left the log incomplete and — because a returned
 * package carries its change log — meant a reviewer's deletions could not be
 * told apart from records their file simply never contained.
 */
export function buildDeletionLogEntries(records, { author = 'You', lineage = null } = {}) {
  const timestamp = nowIso();
  return (records || [])
    .filter((record) => record?.recordName)
    .map((record) => ({
      recordName: uuid('cle'),
      recordType: 'ChangeLogEntry',
      fields: {
        target: { value: refValue(record.recordName, record.recordType || 'Record'), type: 'REFERENCE' },
        targetType: { value: record.recordType || 'Record' },
        timestamp: { value: timestamp },
        author: { value: author },
        changeType: { value: 'Delete' },
        changeCount: { value: 0 },
        summary: { value: 'Deleted' },
        ...lineageFields(lineage),
      },
    }));
}

/** recordName → recordType for a Delete entry, or null for anything else. */
export function deletionFromLogEntry(entry) {
  if (entry?.recordType !== 'ChangeLogEntry') return null;
  if (entry.fields?.changeType?.value !== 'Delete') return null;
  const recordName = refToRecordName(entry.fields?.target?.value);
  if (!recordName) return null;
  return {
    recordName,
    recordType: entry.fields?.targetType?.value || '',
    timestamp: entry.fields?.timestamp?.value || '',
  };
}

function lineageFields(lineage) {
  if (!lineage) return {};
  const out = {};
  if (lineage.lineageBatch) out.lineageBatch = { value: refValue(lineage.lineageBatch, 'LineageBatch'), type: 'REFERENCE' };
  if (lineage.operation) out.operation = { value: lineage.operation };
  if (lineage.sourceRecord) out.sourceRecord = { value: lineage.sourceRecord };
  if (lineage.mergeSurvivor) out.mergeSurvivor = { value: lineage.mergeSurvivor };
  if (lineage.mergeDiscarded) out.mergeDiscarded = { value: lineage.mergeDiscarded };
  if (lineage.renamedFrom) out.renamedFrom = { value: lineage.renamedFrom };
  if (lineage.lineageEvent) out.lineageEvent = { value: refValue(lineage.lineageEvent, 'LineageEvent'), type: 'REFERENCE' };
  return out;
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
  const db = getAppDataClient().records;
  const cutoff = Date.now() - Number(windowMs || 0);
  const { records: entries } = await db.query('ChangeLogEntry', { limit: 1000000 });
  const doomed = entries.filter((record) => {
    const ts = Date.parse(record?.fields?.timestamp?.value || '');
    return Number.isFinite(ts) && ts < cutoff;
  });
  return deleteChangeLogEntries(db, doomed);
}

export async function purgeChangeLogForDeletedRecords() {
  const db = getAppDataClient().records;
  const { records: entries } = await db.query('ChangeLogEntry', { limit: 1000000 });
  const checks = await Promise.all(entries.map(async (entry) => {
    const targetRef = entry?.fields?.target?.value;
    if (!targetRef || typeof targetRef !== 'string') return null;
    const targetName = targetRef.split('---')[0];
    const target = targetName ? await db.get(targetName) : null;
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
  for (const sub of doomedSubs) await db.delete(sub.recordName);
  for (const entry of entries) await db.delete(entry.recordName);
  return { removedEntries: entries.length, removedSubEntries: doomedSubs.length };
}
