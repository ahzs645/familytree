/**
 * Multi-criteria search engine over LocalDatabase.
 *
 * A query is { entityType, filters: [...], textQuery, limit }.
 * Filters are { field, op, value } where op is one of:
 *   "contains" | "equals" | "startsWith" | "exists" | "missing"
 *   "before" | "after" | "between"   (date ops; values are 'YYYY' or 'YYYY-MM-DD')
 *
 * Each entity type exposes its own searchable fields via `SEARCH_FIELDS`.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { Gender } from '../models/index.js';

export const ENTITY_TYPES = [
  { id: 'Person', label: 'Persons' },
  { id: 'Family', label: 'Families' },
  { id: 'Place', label: 'Places' },
  { id: 'Source', label: 'Sources' },
  { id: 'PersonEvent', label: 'Person Events' },
  { id: 'FamilyEvent', label: 'Family Events' },
];

export const SEARCH_FIELDS = {
  Person: [
    { id: 'firstName', label: 'First Name', type: 'text' },
    { id: 'lastName', label: 'Last Name', type: 'text' },
    { id: 'cached_fullName', label: 'Full Name', type: 'text' },
    {
      id: 'gender',
      label: 'Gender',
      type: 'enum',
      options: [
        { value: Gender.Male, label: 'Male' },
        { value: Gender.Female, label: 'Female' },
        { value: Gender.UnknownGender, label: 'Unknown' },
        { value: Gender.Intersex, label: 'Intersex' },
      ],
    },
    { id: 'cached_birthDate', label: 'Birth Date', type: 'date' },
    { id: 'cached_deathDate', label: 'Death Date', type: 'date' },
    { id: 'thumbnailFileIdentifier', label: 'Has Photo', type: 'presence' },
  ],
  Family: [
    { id: 'cached_familyName', label: 'Family Name', type: 'text' },
    { id: 'cached_marriageDate', label: 'Marriage Date', type: 'date' },
  ],
  Place: [
    { id: 'name', label: 'Name', type: 'text' },
    { id: 'cached_displayName', label: 'Display Name', type: 'text' },
    { id: 'geoNameID', label: 'GeoName ID', type: 'text' },
  ],
  Source: [
    { id: 'title', label: 'Title', type: 'text' },
    { id: 'author', label: 'Author', type: 'text' },
  ],
  PersonEvent: [
    { id: 'eventType', label: 'Event Type', type: 'text' },
    { id: 'conclusionType', label: 'Conclusion Type', type: 'text' },
    { id: 'date', label: 'Date', type: 'date' },
    { id: 'description', label: 'Description', type: 'text' },
  ],
  FamilyEvent: [
    { id: 'eventType', label: 'Event Type', type: 'text' },
    { id: 'date', label: 'Date', type: 'date' },
    { id: 'description', label: 'Description', type: 'text' },
  ],
};

export const FILTER_OPS = {
  text: ['contains', 'equals', 'startsWith'],
  enum: ['equals'],
  date: ['equals', 'before', 'after', 'between'],
  presence: ['exists', 'missing'],
};

function fieldValue(record, fieldId) {
  return record.fields?.[fieldId]?.value;
}

function matchesText(rawValue, op, target) {
  if (rawValue == null) return false;
  const v = String(rawValue).toLowerCase();
  const t = String(target).toLowerCase();
  if (op === 'contains') return v.includes(t);
  if (op === 'equals') return v === t;
  if (op === 'startsWith') return v.startsWith(t);
  return false;
}

function parseYear(s) {
  if (s == null) return null;
  const m = String(s).match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

function matchesDate(rawValue, op, target, target2) {
  const y = parseYear(rawValue);
  const ty = parseYear(target);
  if (y == null) return false;
  if (op === 'equals') return ty != null && y === ty;
  if (op === 'before') return ty != null && y < ty;
  if (op === 'after') return ty != null && y > ty;
  if (op === 'between') {
    const ty2 = parseYear(target2);
    return ty != null && ty2 != null && y >= Math.min(ty, ty2) && y <= Math.max(ty, ty2);
  }
  return false;
}

function matchesFilter(record, filter) {
  const v = fieldValue(record, filter.field);
  switch (filter.op) {
    case 'contains':
    case 'equals':
    case 'startsWith':
      if (filter.fieldType === 'enum') return v === filter.value;
      return matchesText(v, filter.op, filter.value);
    case 'before':
    case 'after':
    case 'between':
      return matchesDate(v, filter.op, filter.value, filter.value2);
    case 'exists':
      return v != null && v !== '';
    case 'missing':
      return v == null || v === '';
    default:
      return true;
  }
}

function matchesText_anywhere(record, q) {
  const fields = record.fields || {};
  const lq = q.toLowerCase();
  for (const k of Object.keys(fields)) {
    const val = fields[k]?.value;
    if (typeof val === 'string' && val.toLowerCase().includes(lq)) return true;
  }
  return false;
}

export async function runSearch(query) {
  const db = getLocalDatabase();
  const { records } = await db.query(query.entityType, { limit: 100000 });
  let matched = records;
  if (query.filters && query.filters.length > 0) {
    matched = matched.filter((r) => query.filters.every((f) => matchesFilter(r, f)));
  }
  if (query.textQuery && query.textQuery.trim()) {
    matched = matched.filter((r) => matchesText_anywhere(r, query.textQuery.trim()));
  }
  const limit = query.limit || 500;
  const total = matched.length;
  return { records: matched.slice(0, limit), total, hasMore: total > limit };
}
