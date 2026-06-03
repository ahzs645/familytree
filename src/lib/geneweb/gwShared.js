export function field(value, type = 'STRING') {
  if (value === undefined || value === null || value === '') return undefined;
  return { value, type };
}

export function refValue(recordName, recordType) {
  if (!recordName) return null;
  return recordType ? `${recordName}---${recordType}` : recordName;
}

export function refToRecordName(ref) {
  if (!ref) return null;
  if (typeof ref === 'string') return ref.split('---')[0] || null;
  if (typeof ref === 'object') {
    if (ref.recordName) return ref.recordName;
    if (Object.prototype.hasOwnProperty.call(ref, 'value')) return refToRecordName(ref.value);
  }
  return null;
}

export function textValue(record, name, fallback = '') {
  const value = record?.fields?.[name]?.value;
  return value === undefined || value === null ? fallback : String(value);
}

export function compactFields(fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

