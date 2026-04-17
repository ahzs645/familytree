/**
 * Read-side helpers for ChangeLogEntry + ChangeLogSubEntry records.
 *
 * Handles two field-name conventions:
 *  - Legacy MFT format: objectEntityName, objectUniqueID, objectNameKeyValuesForFormatString,
 *    earliestChangeDate / latestChangeDate / changeDate (numeric ms),
 *    sub-entries linked via `superEntry`.
 *  - Records written by our editor (saveWithChangeLog): targetType, target,
 *    summary, timestamp (ISO string), sub-entries linked via `changeLogEntry`.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { refToRecordName } from './recordRef.js';

function timestampOf(entry) {
  const f = entry.fields || {};
  return (
    f.changeDate?.value ||
    f.latestChangeDate?.value ||
    f.earliestChangeDate?.value ||
    f.timestamp?.value ||
    f.mft_changeDate?.value ||
    entry.modified?.timestamp ||
    entry.created?.timestamp ||
    0
  );
}

export function entityTypeOf(entry) {
  return entry.fields?.objectEntityName?.value || entry.fields?.targetType?.value || '';
}

export function targetLabelOf(entry) {
  const f = entry.fields || {};
  return f.objectNameKeyValuesForFormatString?.value || f.summary?.value || '';
}

export function targetIdOf(entry) {
  const f = entry.fields || {};
  return f.objectUniqueID?.value || refToRecordName(f.target?.value) || '';
}

export function changeKindOf(entry) {
  const f = entry.fields || {};
  if (f.changeType?.value !== undefined) {
    const t = f.changeType.value;
    if (typeof t === 'number') return ['Change', 'Add', 'Delete', 'ResolvedConflict'][t] || 'Change';
    return t;
  }
  return '';
}

export function authorOf(entry) {
  return entry.fields?.author?.value || entry.fields?.userName?.value || '';
}

export async function listChangeLogEntries({ entityType, limit = 500 } = {}) {
  const db = getLocalDatabase();
  const { records } = await db.query('ChangeLogEntry', { limit: 100000 });
  let filtered = records;
  if (entityType) {
    filtered = filtered.filter((r) => entityTypeOf(r) === entityType);
  }
  filtered.sort((a, b) => {
    const ta = numericTimestamp(timestampOf(a));
    const tb = numericTimestamp(timestampOf(b));
    return tb - ta;
  });
  return filtered.slice(0, limit);
}

function numericTimestamp(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

export async function getSubEntriesForEntry(entryRecordName) {
  const db = getLocalDatabase();
  // Legacy uses `superEntry`, our writer uses `changeLogEntry`. Try both.
  const [legacy, modern] = await Promise.all([
    db.query('ChangeLogSubEntry', { referenceField: 'superEntry', referenceValue: entryRecordName, limit: 500 }),
    db.query('ChangeLogSubEntry', { referenceField: 'changeLogEntry', referenceValue: entryRecordName, limit: 500 }),
  ]);
  return [...legacy.records, ...modern.records];
}

/**
 * Pull the field name + before/after pair out of a sub-entry that may follow
 * either the legacy MFT shape (changeKey + changeKeyValuesForFormatString
 * packed as "old#####new") or our writer's shape (oldValue / newValue).
 */
export function subEntrySummary(sub) {
  const f = sub.fields || {};
  const split = f.changeKeyValuesForFormatString?.value;
  const fieldName = humanizePropertyKey(
    f.changeKey?.value || f.changedKeyInChangeObject?.value || f.fieldName?.value
  );
  let oldValue = f.oldValue?.value ?? '';
  let newValue = f.newValue?.value ?? '';
  if (split && typeof split === 'string' && split.includes('#####')) {
    const parts = split.split('#####');
    oldValue = parts[0] || '';
    newValue = parts[1] || '';
  } else if (split && !oldValue && !newValue) {
    newValue = split;
  }
  return { fieldName, oldValue, newValue };
}

/**
 * Convert a sub-entry's changeType (numeric in legacy, string in our writer)
 * into a canonical kind.
 */
function subEntryKind(sub) {
  const v = sub.fields?.changeType?.value;
  if (typeof v === 'number') return ['Change', 'Add', 'Delete', 'ResolvedConflict'][v] || 'Change';
  return v || 'Change';
}

/**
 * One-line natural-language description of a sub-entry, e.g.
 *   "Last name changed from 'مراد' to 'مهدي'"
 *   "First name added: 'غالب'"
 *   "Person added"
 */
export function subEntryDescription(sub, fallbackEntityName) {
  const kind = subEntryKind(sub);
  const f = sub.fields || {};
  const { fieldName, oldValue, newValue } = subEntrySummary(sub);
  const entity = f.changeObjectEntityName?.value || fallbackEntityName || 'Record';
  const key = f.changeKey?.value || '';
  const isEntityLevel = !key || /_ChangeLogKey$/.test(key);

  if (kind === 'Add') {
    if (isEntityLevel) return `${entity} added`;
    if (newValue) return `${fieldName} added: ${quote(newValue)}`;
    return `${fieldName} added`;
  }
  if (kind === 'Delete') {
    if (isEntityLevel) return `${entity} deleted`;
    if (oldValue) return `${fieldName} deleted (was ${quote(oldValue)})`;
    return `${fieldName} deleted`;
  }
  if (kind === 'ResolvedConflict') return `${fieldName} conflict resolved`;
  // Change
  return `${fieldName} changed from ${quote(oldValue)} to ${quote(newValue)}`;
}

function quote(v) {
  if (v == null || v === '') return "'No Value'";
  return `'${v}'`;
}

function humanizePropertyKey(raw) {
  if (!raw) return 'Field';
  // _Person_ChangeLogPropertyKey_FirstName  →  "First Name"
  // _Family_ChangeLogPropertyKey_MarriageDate → "Marriage Date"
  const cleaned = String(raw)
    .replace(/^_/, '')
    .replace(/^[A-Za-z]+_ChangeLogPropertyKey_/, '')
    .replace(/^[A-Za-z]+_ChangeLogKey$/, 'Record')
    .replace(/_/g, ' ');
  return cleaned.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

export function timestampMillis(entry) {
  return numericTimestamp(timestampOf(entry));
}

export async function getTargetRecord(entry) {
  const db = getLocalDatabase();
  const ref = targetIdOf(entry);
  if (!ref) return null;
  return db.getRecord(ref);
}
