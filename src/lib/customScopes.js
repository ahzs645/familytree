/**
 * Custom smart filters — user-authored scopes persisted in IndexedDB meta.
 *
 * Mac reference: `ScopesEditSheet.nib` + `_Scopes_EditScopes_HeaderTitle`
 * "Edit Smart Filters" across ~13 entity types. Mac filters are rule lists
 * combined with ANY/ALL. This module mirrors that shape with a minimal,
 * serializable schema so the runtime in `smartScopes.js` can evaluate them.
 *
 * Filter shape:
 *   {
 *     id: string,
 *     name: string,
 *     entityType: 'Person' | 'Family' | 'PersonEvent' | 'FamilyEvent' |
 *                 'Place' | 'Source' | 'Repository' | 'Story' | 'ToDo' |
 *                 'Media' | 'Label' | 'PersonGroup' | 'Research',
 *     match: 'all' | 'any',
 *     rules: [
 *       { field: string, operator: 'equals' | 'contains' | 'exists' |
 *                                  'notEquals' | 'missing' | 'gt' | 'lt',
 *         value: string|number }
 *     ],
 *     createdAt: ms, updatedAt: ms,
 *   }
 */

import { getLocalDatabase } from './LocalDatabase.js';

const META_KEY = 'customSmartFilters';

export const CUSTOM_FILTER_ENTITY_TYPES = [
  'Person', 'Family', 'PersonEvent', 'FamilyEvent',
  'Place', 'Source', 'Repository', 'Story',
  'ToDo', 'Media', 'Label', 'PersonGroup', 'Research',
];

export const FILTER_OPERATORS = [
  { id: 'exists', label: 'has any value', takesValue: false },
  { id: 'missing', label: 'is missing', takesValue: false },
  { id: 'equals', label: 'equals', takesValue: true },
  { id: 'notEquals', label: 'does not equal', takesValue: true },
  { id: 'contains', label: 'contains', takesValue: true },
  { id: 'gt', label: 'greater than (number)', takesValue: true },
  { id: 'lt', label: 'less than (number)', takesValue: true },
];

function newId() {
  return `sf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function fieldValue(record, field) {
  if (!record?.fields || !field) return undefined;
  const raw = record.fields[field];
  if (raw == null) return undefined;
  return typeof raw === 'object' && 'value' in raw ? raw.value : raw;
}

function ruleMatches(rule, record) {
  const value = fieldValue(record, rule.field);
  const op = rule.operator;
  if (op === 'exists') return value !== undefined && value !== null && value !== '';
  if (op === 'missing') return value === undefined || value === null || value === '';
  if (op === 'equals') return String(value ?? '').toLowerCase() === String(rule.value ?? '').toLowerCase();
  if (op === 'notEquals') return String(value ?? '').toLowerCase() !== String(rule.value ?? '').toLowerCase();
  if (op === 'contains') return String(value ?? '').toLowerCase().includes(String(rule.value ?? '').toLowerCase());
  if (op === 'gt' || op === 'lt') {
    const a = Number(value);
    const b = Number(rule.value);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return op === 'gt' ? a > b : a < b;
  }
  return false;
}

export function evaluateFilter(filter, record) {
  const rules = Array.isArray(filter?.rules) ? filter.rules.filter((r) => r?.field) : [];
  if (rules.length === 0) return true;
  if (filter.match === 'any') return rules.some((rule) => ruleMatches(rule, record));
  return rules.every((rule) => ruleMatches(rule, record));
}

export async function listCustomFilters(entityType) {
  const list = await getLocalDatabase().getMeta(META_KEY);
  const all = Array.isArray(list) ? list : [];
  if (!entityType) return all;
  return all.filter((filter) => filter.entityType === entityType);
}

export async function saveCustomFilter(filter) {
  if (!filter?.name || !filter?.entityType) throw new Error('Filter requires a name and entityType.');
  const db = getLocalDatabase();
  const all = await listCustomFilters();
  const now = Date.now();
  const stamped = {
    ...filter,
    id: filter.id || newId(),
    match: filter.match === 'any' ? 'any' : 'all',
    rules: Array.isArray(filter.rules) ? filter.rules : [],
    createdAt: filter.createdAt || now,
    updatedAt: now,
  };
  const idx = all.findIndex((item) => item.id === stamped.id);
  if (idx >= 0) all[idx] = stamped;
  else all.push(stamped);
  await db.setMeta(META_KEY, all);
  return stamped;
}

export async function deleteCustomFilter(id) {
  const db = getLocalDatabase();
  const all = await listCustomFilters();
  await db.setMeta(META_KEY, all.filter((filter) => filter.id !== id));
}

export async function runCustomFilter(filter) {
  if (!filter?.entityType) return { records: [], total: 0 };
  const db = getLocalDatabase();
  const { records } = await db.query(filter.entityType, { limit: 100000 });
  const matched = records.filter((record) => evaluateFilter(filter, record));
  return { entityType: filter.entityType, filter, records: matched, total: matched.length };
}

export function newBlankFilter(entityType = 'Person') {
  return {
    id: newId(),
    name: 'New smart filter',
    entityType,
    match: 'all',
    rules: [{ field: '', operator: 'exists', value: '' }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
