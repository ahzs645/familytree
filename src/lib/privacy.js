import { readBoolean } from './schema.js';

export function isPrivateRecord(record) {
  return readBoolean(record, ['isPrivate', 'private', 'markedPrivate'], false);
}

export function isPublicRecord(record) {
  return !!record && !isPrivateRecord(record);
}

export function filterPublicRecords(records) {
  return (records || []).filter(isPublicRecord);
}
