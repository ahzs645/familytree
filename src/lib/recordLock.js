/**
 * Per-record lock flag — mirrors MacFamilyTree's object-level `setReadOnly:`
 * state so individual records can be frozen (preventing edits) without
 * putting the whole tree into read-only mode.
 *
 * The flag is stored in the record's `fields.isLocked` slot so it
 * round-trips via backup / mftpkg / GEDCOM (unsupported GEDCOM tags are
 * preserved in our JSON round-trip path).
 */

import { readBoolean } from './schema.js';

export function isRecordLocked(record) {
  return readBoolean(record, ['isLocked', 'locked', 'readOnly'], false);
}

export function setRecordLocked(record, locked) {
  const fields = { ...(record?.fields || {}) };
  if (locked) fields.isLocked = { value: true, type: 'BOOLEAN' };
  else delete fields.isLocked;
  return { ...record, fields };
}
