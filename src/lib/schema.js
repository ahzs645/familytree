/**
 * Schema compatibility helpers for records imported from MacFamilyTree,
 * legacy CloudTreeWeb records, and records created by the local editors.
 */

export const FIELD_ALIASES = {
  placeName: ['placeName', 'cached_standardizedLocationString', 'cached_normallocationString', 'cached_normalLocationString', 'cached_displayName', 'place', 'name'],
  placeShortName: ['cached_shortLocationString', 'cached_veryShortLocationString', 'cached_standardizedLocationString', 'placeName', 'place'],
  geonameID: ['geonameID', 'geoNameID'],
  sourceTitle: ['title', 'cached_title', 'name'],
  sourceDate: ['cached_date', 'date'],
  labelName: ['name', 'title'],
  labelColor: ['color', 'colorComponentsString'],
  eventType: ['eventType', 'factType', 'type', 'conclusionType'],
  bookmark: ['isBookmarked', 'bookmarked', 'isBookmarked1', 'isBookmarked2', 'isBookmarked3', 'isBookmarked4'],
};

export function readRef(input) {
  if (input == null) return null;
  if (typeof input === 'string') {
    const idx = input.indexOf('---');
    return idx >= 0 ? input.slice(0, idx) : input;
  }
  if (typeof input === 'object') {
    if (input.recordName) return input.recordName;
    if (Object.prototype.hasOwnProperty.call(input, 'value')) return readRef(input.value);
  }
  return null;
}

export function refType(input) {
  if (input == null) return null;
  if (typeof input === 'object' && Object.prototype.hasOwnProperty.call(input, 'value')) {
    return refType(input.value);
  }
  if (typeof input === 'string') {
    const idx = input.indexOf('---');
    return idx >= 0 ? input.slice(idx + 3) : null;
  }
  return null;
}

export function refValue(recordName, recordType) {
  if (!recordName) return null;
  return recordType ? `${recordName}---${recordType}` : recordName;
}

export function writeRef(recordName, recordType) {
  if (!recordName) return undefined;
  return { value: refValue(recordName, recordType), type: 'REFERENCE' };
}

export function replaceRefValue(input, fromRecordName, toRecordName, toRecordType) {
  if (!fromRecordName || !toRecordName) return input;
  if (readRef(input) !== fromRecordName) return input;

  const nextValue = refValue(toRecordName, toRecordType || refType(input));
  if (input && typeof input === 'object' && Object.prototype.hasOwnProperty.call(input, 'value')) {
    return { ...input, value: nextValue, type: 'REFERENCE' };
  }
  if (input && typeof input === 'object' && input.recordName) {
    return { ...input, recordName: toRecordName };
  }
  return nextValue;
}

export function readField(record, aliases, fallback = undefined) {
  const fields = record?.fields || {};
  const names = Array.isArray(aliases) ? aliases : [aliases];
  for (const name of names) {
    if (!name) continue;
    const field = fields[name];
    if (!field) continue;
    const value = Object.prototype.hasOwnProperty.call(field, 'value') ? field.value : field;
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

export function writeField(record, fieldName, value, type = 'STRING') {
  if (!record.fields) record.fields = {};
  if (value === undefined || value === null || value === '') delete record.fields[fieldName];
  else record.fields[fieldName] = { value, type };
  return record;
}

export function readBoolean(record, aliases, fallback = false) {
  const value = readField(record, aliases, undefined);
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
  return !!value;
}

function splitIdentifier(id) {
  if (!id) return '';
  const plain = String(id).split('---')[0];
  return plain
    .replace(/^UniqueID_/, '')
    .replace(/^Conclusion(?:Person|Family)?(?:Event|Fact|AdditionalName)?Type_?/, '')
    .replace(/^(?:PersonEvent|FamilyEvent|PersonFact|AdditionalName)_/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

function resolveConclusionRecord(id, family) {
  if (!id || !family) return null;
  if (family instanceof Map) return family.get(id) || null;
  if (Array.isArray(family)) {
    return family.find((r) => {
      if (!r) return false;
      return (
        r.recordName === id ||
        readField(r, ['uniqueID', 'identifier', 'typeName', 'name', 'title']) === id
      );
    }) || null;
  }
  if (typeof family === 'object') return family[id] || null;
  return null;
}

export function readConclusionType(record, family = null) {
  const direct = readField(record, ['eventType', 'factType', 'typeName', 'name', 'title', 'identifier', 'type'], '');
  if (direct && direct !== readField(record, 'conclusionType', '')) return direct;

  const ref = readRef(record?.fields?.conclusionType);
  const resolved = resolveConclusionRecord(ref, family);
  if (resolved) {
    return readField(resolved, ['typeName', 'name', 'title', 'identifier', 'uniqueID'], splitIdentifier(ref));
  }

  const raw = readField(record, 'conclusionType', '');
  return direct || splitIdentifier(ref || raw) || raw || '';
}

export function writeConclusionTypeRef(id, familyRecordType) {
  if (!id) return undefined;
  return writeRef(id, familyRecordType);
}

export function normalizeColor(color) {
  if (!color) return '';
  const raw = String(color).trim();
  if (raw.startsWith('#') || raw.startsWith('rgb') || raw.startsWith('hsl') || /^[a-z]+$/i.test(raw)) return raw;
  const parts = raw.split(/[;,\s]+/).map((p) => Number(p)).filter((n) => Number.isFinite(n));
  if (parts.length >= 3) {
    const [r, g, b] = parts.map((n) => Math.max(0, Math.min(255, n <= 1 ? Math.round(n * 255) : Math.round(n))));
    return `rgb(${r} ${g} ${b})`;
  }
  return raw;
}

export function readLabel(record) {
  const name = readField(record, FIELD_ALIASES.labelName, record?.recordName || '');
  const rawColor = readField(record, FIELD_ALIASES.labelColor, '');
  return {
    recordName: record?.recordName,
    name,
    color: normalizeColor(rawColor),
    rawColor,
  };
}

export function collectRecordReferences(record) {
  const refs = [];
  for (const [fieldName, field] of Object.entries(record?.fields || {})) {
    if (!field) continue;
    if (field.type === 'REFERENCE' || readRef(field)) {
      const recordName = readRef(field);
      if (recordName) refs.push({ recordName, fieldName, field });
    }
  }
  return refs;
}
