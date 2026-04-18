/**
 * Record references in the database can take several shapes depending on
 * how they were created:
 *
 *   - Extracted from .mftpkg:  "person-799---Person"   (string with type suffix)
 *   - Created by my editors:   { recordName: "person-799" }   (object form)
 *   - Plain string from API:   "person-799"
 *
 * `refToRecordName` collapses all three to a plain recordName.
 * `refValue` is the canonical write shape used by new editor saves
 * (matches the extractor's output so old + new records interoperate).
 */

export function refToRecordName(ref) {
  if (ref == null) return null;
  if (typeof ref === 'string') {
    const idx = ref.indexOf('---');
    return idx >= 0 ? ref.slice(0, idx) : ref;
  }
  if (typeof ref === 'object') {
    if (ref.recordName) return ref.recordName;
    if (ref.value !== undefined) return refToRecordName(ref.value);
  }
  return null;
}

export function refType(ref) {
  if (typeof ref === 'string') {
    const idx = ref.indexOf('---');
    return idx >= 0 ? ref.slice(idx + 3) : null;
  }
  return null;
}

/**
 * Build the canonical reference value: "<recordName>---<RecordType>".
 * Use this when writing references back to the database from editor saves.
 */
export function refValue(recordName, recordType) {
  if (!recordName) return null;
  if (recordType) return `${recordName}---${recordType}`;
  return recordName;
}

export {
  readRef,
  writeRef,
  replaceRefValue,
  readField,
  readConclusionType,
  readLabel,
} from './schema.js';
