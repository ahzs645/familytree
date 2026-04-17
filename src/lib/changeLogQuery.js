/**
 * Read-side helpers for ChangeLogEntry + ChangeLogSubEntry records.
 */
import { getLocalDatabase } from './LocalDatabase.js';

function tsOf(entry) {
  return (
    entry.fields?.timestamp?.value ||
    entry.fields?.mft_changeDate?.value ||
    entry.fields?.date?.value ||
    entry.modified?.timestamp ||
    0
  );
}

export async function listChangeLogEntries({ entityType, limit = 500 } = {}) {
  const db = getLocalDatabase();
  const { records } = await db.query('ChangeLogEntry', { limit: 100000 });
  let filtered = records;
  if (entityType) {
    filtered = filtered.filter((r) => r.fields?.targetType?.value === entityType);
  }
  filtered.sort((a, b) => {
    const ta = new Date(tsOf(a)).getTime() || 0;
    const tb = new Date(tsOf(b)).getTime() || 0;
    return tb - ta;
  });
  return filtered.slice(0, limit);
}

export async function getSubEntriesForEntry(entryRecordName) {
  const db = getLocalDatabase();
  const { records } = await db.query('ChangeLogSubEntry', {
    referenceField: 'changeLogEntry',
    referenceValue: entryRecordName,
    limit: 500,
  });
  return records;
}

export async function getTargetRecord(entry) {
  const db = getLocalDatabase();
  const ref = entry.fields?.target?.value?.recordName;
  if (!ref) return null;
  return db.getRecord(ref);
}
