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
import { refToRecordName } from './recordRef.js';

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

/**
 * Path steps for multi-hop traversal from a Person. Each step returns an
 * array of records reachable from the input record so the evaluator can OR
 * the operator across all reachable values.
 *
 * Mac reference: ScopesEditSheet lets users chain "father → birth place",
 * "partner → last name", etc. Our set mirrors the most common hops.
 */
const PERSON_PATH_STEPS = {
  father: async (person, db) => {
    const parents = await db.getPersonsParents(person.recordName);
    return parents.map((fam) => fam.man).filter(Boolean);
  },
  mother: async (person, db) => {
    const parents = await db.getPersonsParents(person.recordName);
    return parents.map((fam) => fam.woman).filter(Boolean);
  },
  partner: async (person, db) => {
    const families = await db.getPersonsChildrenInformation(person.recordName);
    return families.map((fam) => fam.partner).filter(Boolean);
  },
  child: async (person, db) => {
    const families = await db.getPersonsChildrenInformation(person.recordName);
    const children = [];
    for (const fam of families) for (const c of fam.children || []) children.push(c);
    return children;
  },
  sibling: async (person, db) => {
    const parents = await db.getPersonsParents(person.recordName);
    const siblings = [];
    for (const fam of parents) {
      if (!fam.family) continue;
      const { records } = await db.query('ChildRelation', {
        referenceField: 'family',
        referenceValue: fam.family.recordName,
      });
      for (const cr of records) {
        const childRef = cr.fields?.child?.value;
        const childId = refToRecordName(childRef);
        if (!childId || childId === person.recordName) continue;
        const child = await db.getRecord(childId);
        if (child) siblings.push(child);
      }
    }
    return siblings;
  },
  birthPlace: async (person, db) => {
    const ref = person.fields?.birthPlace?.value;
    const id = refToRecordName(ref);
    return id ? [await db.getRecord(id)].filter(Boolean) : [];
  },
  deathPlace: async (person, db) => {
    const ref = person.fields?.deathPlace?.value;
    const id = refToRecordName(ref);
    return id ? [await db.getRecord(id)].filter(Boolean) : [];
  },
};

const FAMILY_PATH_STEPS = {
  man: async (family, db) => {
    const id = refToRecordName(family.fields?.man?.value);
    return id ? [await db.getRecord(id)].filter(Boolean) : [];
  },
  woman: async (family, db) => {
    const id = refToRecordName(family.fields?.woman?.value);
    return id ? [await db.getRecord(id)].filter(Boolean) : [];
  },
};

const PATH_STEPS_BY_ENTITY = {
  Person: PERSON_PATH_STEPS,
  Family: FAMILY_PATH_STEPS,
};

/**
 * List traversal step ids available for a given entity type. Used by the UI
 * to populate a path picker.
 */
export function availablePathSteps(entityType) {
  return Object.keys(PATH_STEPS_BY_ENTITY[entityType] || {});
}

async function followPath(record, path, db, entityType) {
  if (!Array.isArray(path) || path.length === 0) return [record];
  let current = [record];
  let currentType = entityType;
  for (const step of path) {
    const steps = PATH_STEPS_BY_ENTITY[currentType] || {};
    const fn = steps[step];
    if (!fn) return [];
    const next = [];
    for (const node of current) {
      if (!node) continue;
      const reached = await fn(node, db);
      for (const r of reached) if (r) next.push(r);
    }
    current = next;
    // After following a step, the type switches: father/mother/child/partner/sibling → Person;
    // birthPlace/deathPlace → Place; man/woman → Person.
    if (step === 'birthPlace' || step === 'deathPlace') currentType = 'Place';
    else currentType = 'Person';
  }
  return current;
}

function applyOperator(op, value, target) {
  if (op === 'exists') return value !== undefined && value !== null && value !== '';
  if (op === 'missing') return value === undefined || value === null || value === '';
  if (op === 'equals') return String(value ?? '').toLowerCase() === String(target ?? '').toLowerCase();
  if (op === 'notEquals') return String(value ?? '').toLowerCase() !== String(target ?? '').toLowerCase();
  if (op === 'contains') return String(value ?? '').toLowerCase().includes(String(target ?? '').toLowerCase());
  if (op === 'gt' || op === 'lt') {
    const a = Number(value);
    const b = Number(target);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return op === 'gt' ? a > b : a < b;
  }
  return false;
}

function ruleMatchesRecord(rule, record) {
  const value = fieldValue(record, rule.field);
  return applyOperator(rule.operator, value, rule.value);
}

/**
 * Evaluate a single rule, following its optional path (array of step ids)
 * from the input record. A rule matches if ANY record reachable via the
 * path satisfies the operator on the rule's field.
 *
 * For `missing`/`notEquals`, the semantics switch to "no reached record has
 * a matching value" — otherwise a hop that returns zero records would
 * always satisfy `missing` vacuously.
 */
async function ruleMatchesWithPath(rule, record, db, entityType) {
  const path = Array.isArray(rule.path) ? rule.path.filter(Boolean) : [];
  if (path.length === 0) return ruleMatchesRecord(rule, record);
  const reached = await followPath(record, path, db, entityType);
  if (rule.operator === 'missing') {
    if (reached.length === 0) return true;
    return reached.every((r) => {
      const value = fieldValue(r, rule.field);
      return value === undefined || value === null || value === '';
    });
  }
  if (rule.operator === 'notEquals') {
    if (reached.length === 0) return true;
    return reached.every((r) => {
      const value = fieldValue(r, rule.field);
      return String(value ?? '').toLowerCase() !== String(rule.value ?? '').toLowerCase();
    });
  }
  return reached.some((r) => ruleMatchesRecord(rule, r));
}

/**
 * Synchronous evaluator — only works for rules without a path. Kept for
 * callers that already have a record in hand and don't need hop traversal.
 */
export function evaluateFilter(filter, record) {
  const rules = Array.isArray(filter?.rules) ? filter.rules.filter((r) => r?.field) : [];
  if (rules.length === 0) return true;
  const check = (rule) => ruleMatchesRecord(rule, record);
  return filter.match === 'any' ? rules.some(check) : rules.every(check);
}

/**
 * Async evaluator with multi-hop support. Used by runCustomFilter when any
 * rule has a path. Mirrors Mac's `ScopesEditSheet` path-navigating filters.
 */
export async function evaluateFilterAsync(filter, record, db) {
  const rules = Array.isArray(filter?.rules) ? filter.rules.filter((r) => r?.field) : [];
  if (rules.length === 0) return true;
  if (filter.match === 'any') {
    for (const rule of rules) {
      if (await ruleMatchesWithPath(rule, record, db, filter.entityType)) return true;
    }
    return false;
  }
  for (const rule of rules) {
    if (!(await ruleMatchesWithPath(rule, record, db, filter.entityType))) return false;
  }
  return true;
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
  const hasPathRule = (filter.rules || []).some((rule) => Array.isArray(rule.path) && rule.path.length > 0);
  if (!hasPathRule) {
    const matched = records.filter((record) => evaluateFilter(filter, record));
    return { entityType: filter.entityType, filter, records: matched, total: matched.length };
  }
  const matched = [];
  for (const record of records) {
    if (await evaluateFilterAsync(filter, record, db)) matched.push(record);
  }
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
