/**
 * Smart scopes — predefined queries that filter the main views.
 *
 * Each scope returns { entityType, predicate(record, db), label, description }.
 * Scopes can be applied via runScope() which evaluates the predicate against
 * all records of the entity type. Some scopes need cross-record context
 * (e.g. "childless" needs to know about ChildRelations) — those receive a
 * `ctx` cache built once per run.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { refToRecordName } from './recordRef.js';
import { FIELD_ALIASES, readField, readRef } from './schema.js';

export const BUILTIN_SCOPES = [
  {
    id: 'persons-with-photo',
    entityType: 'Person',
    label: 'Persons with a photo',
    description: 'All persons that have a thumbnail image attached.',
    predicate: (r) => !!r.fields?.thumbnailFileIdentifier?.value,
  },
  {
    id: 'persons-without-photo',
    entityType: 'Person',
    label: 'Persons without a photo',
    description: 'Persons missing any thumbnail image.',
    predicate: (r) => !r.fields?.thumbnailFileIdentifier?.value,
  },
  {
    id: 'persons-no-birth',
    entityType: 'Person',
    label: 'Persons with no birth date',
    predicate: (r) => !r.fields?.cached_birthDate?.value,
  },
  {
    id: 'persons-no-death',
    entityType: 'Person',
    label: 'Persons with no death date',
    predicate: (r) => !r.fields?.cached_deathDate?.value,
  },
  {
    id: 'living-persons',
    entityType: 'Person',
    label: 'Possibly living persons',
    description: 'No death date and birth date < 110 years ago.',
    predicate: (r) => {
      if (r.fields?.cached_deathDate?.value) return false;
      const b = parseYear(r.fields?.cached_birthDate?.value);
      if (b == null) return false;
      return new Date().getFullYear() - b < 110;
    },
  },
  {
    id: 'persons-19c',
    entityType: 'Person',
    label: 'Persons born in the 19th century',
    predicate: (r) => {
      const y = parseYear(r.fields?.cached_birthDate?.value);
      return y != null && y >= 1800 && y <= 1899;
    },
  },
  {
    id: 'persons-20c',
    entityType: 'Person',
    label: 'Persons born in the 20th century',
    predicate: (r) => {
      const y = parseYear(r.fields?.cached_birthDate?.value);
      return y != null && y >= 1900 && y <= 1999;
    },
  },
  {
    id: 'childless-persons',
    entityType: 'Person',
    label: 'Childless persons',
    description: 'Persons not listed as a parent in any family.',
    needsCtx: ['parentIds'],
    predicate: (r, ctx) => !ctx.parentIds.has(r.recordName),
  },
  {
    id: 'orphan-persons',
    entityType: 'Person',
    label: 'Persons without parents',
    description: 'Persons not listed as a child in any ChildRelation.',
    needsCtx: ['childIds'],
    predicate: (r, ctx) => !ctx.childIds.has(r.recordName),
  },
  {
    id: 'unmarried-persons',
    entityType: 'Person',
    label: 'Unmarried persons',
    description: 'Persons not listed in any Family.',
    needsCtx: ['marriedIds'],
    predicate: (r, ctx) => !ctx.marriedIds.has(r.recordName),
  },
  {
    id: 'places-no-coordinates',
    entityType: 'Place',
    label: 'Places without coordinates',
    needsCtx: ['placeCoordinateIds'],
    predicate: (r, ctx) => {
      const coordinateRef = refToRecordName(r.fields?.coordinate?.value);
      return (
        !hasDirectCoordinates(r) &&
        !(coordinateRef && ctx.coordinateValueIds.has(coordinateRef)) &&
        !ctx.placeCoordinateIds.has(r.recordName)
      );
    },
  },
  {
    id: 'places-no-geoname',
    entityType: 'Place',
    label: 'Places without GeoName ID',
    predicate: (r) => !readField(r, FIELD_ALIASES.geonameID),
  },
];

function parseYear(s) {
  if (s == null) return null;
  const m = String(s).match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

async function buildCtx(needs) {
  const db = getLocalDatabase();
  const ctx = {};
  if (needs.includes('parentIds') || needs.includes('marriedIds')) {
    const { records: families } = await db.query('Family', { limit: 100000 });
    if (needs.includes('parentIds') || needs.includes('marriedIds')) {
      const set = new Set();
      for (const f of families) {
        const m = readRef(f.fields?.man);
        const w = readRef(f.fields?.woman);
        if (m) set.add(m);
        if (w) set.add(w);
      }
      ctx.parentIds = set;
      ctx.marriedIds = set; // same source — both rely on Family
    }
  }
  if (needs.includes('childIds')) {
    const { records: rels } = await db.query('ChildRelation', { limit: 100000 });
    const set = new Set();
    for (const r of rels) {
      const c = readRef(r.fields?.child);
      if (c) set.add(c);
    }
    ctx.childIds = set;
  }
  if (needs.includes('placeCoordinateIds')) {
    const { records: coords } = await db.query('Coordinate', { limit: 100000 });
    const set = new Set();
    const coordinateValueIds = new Set();
    for (const coord of coords) {
      if (hasCoordinateValues(coord)) coordinateValueIds.add(coord.recordName);
      const placeId = refToRecordName(coord.fields?.place?.value);
      if (placeId && hasCoordinateValues(coord)) set.add(placeId);
    }
    ctx.placeCoordinateIds = set;
    ctx.coordinateValueIds = coordinateValueIds;
  }
  return ctx;
}

function hasDirectCoordinates(record) {
  return hasCoordValue(record.fields?.latitude?.value) && hasCoordValue(record.fields?.longitude?.value);
}

function hasCoordinateValues(record) {
  return hasCoordValue(record.fields?.latitude?.value) && hasCoordValue(record.fields?.longitude?.value);
}

function hasCoordValue(value) {
  if (value == null || value === '') return false;
  if (typeof value === 'number') return Number.isFinite(value);
  return Number.isFinite(parseFloat(value));
}

export async function runScope(scopeId) {
  const scope = BUILTIN_SCOPES.find((s) => s.id === scopeId);
  const db = getLocalDatabase();
  if (!scope) return runImportedScope(scopeId, db);
  const { records } = await db.query(scope.entityType, { limit: 100000 });
  const ctx = scope.needsCtx ? await buildCtx(scope.needsCtx) : null;
  const matched = records.filter((r) => scope.predicate(r, ctx));
  return { entityType: scope.entityType, scope, records: matched, total: matched.length };
}

export function listScopes(entityType) {
  if (!entityType) return BUILTIN_SCOPES;
  return BUILTIN_SCOPES.filter((s) => s.entityType === entityType);
}

export async function listAllScopes(entityType) {
  const imported = await listImportedScopes(entityType);
  return [...listScopes(entityType), ...imported];
}

export async function listImportedScopes(entityType) {
  const db = getLocalDatabase();
  const { records } = await db.query('Scope', { limit: 100000 });
  return records
    .map(importedScopeDescriptor)
    .filter(Boolean)
    .filter((scope) => !entityType || scope.entityType === entityType);
}

function importedScopeDescriptor(record) {
  const decoded = parseDecoded(record.fields?.archivedFiltersDecoded?.value);
  const summary = decoded?.summary || {};
  const entityType = record.fields?.scopeEntity?.value || summary.entityName;
  if (!entityType) return null;
  const label = record.fields?.scopeName?.value || record.fields?.name?.value || summary.identifier || record.recordName;
  return {
    id: `imported:${record.recordName}`,
    recordName: record.recordName,
    entityType,
    label,
    description: `Imported MacFamilyTree scope${summary.identifier ? ` (${summary.identifier})` : ''}.`,
    imported: true,
    executable: Boolean(importedPredicateFactory(summary.identifier || label)),
    decodedSummary: summary,
  };
}

function parseDecoded(value) {
  if (!value) return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

async function runImportedScope(scopeId, db) {
  const recordName = String(scopeId || '').replace(/^imported:/, '');
  const record = await db.getRecord(recordName);
  if (!record || record.recordType !== 'Scope') throw new Error('Unknown scope: ' + scopeId);
  const scope = importedScopeDescriptor(record);
  const predicateFactory = importedPredicateFactory(scope?.decodedSummary?.identifier || scope?.label);
  if (!scope || !predicateFactory) throw new Error('Imported scope is preserved but not executable yet.');
  const { records } = await db.query(scope.entityType, { limit: 100000 });
  const ctx = await buildImportedCtx(db, scope);
  const matched = records.filter((r) => predicateFactory(r, ctx, scope));
  return { entityType: scope.entityType, scope, records: matched, total: matched.length };
}

function importedPredicateFactory(identifier) {
  const id = String(identifier || '');
  const map = {
    StandardScope_Sources_AtLeastOneMedia: (r, ctx) => ctx.mediaTargetIds.has(r.recordName),
    StandardScope_ToDos_AtLeastOneAssignedEntry: (r, ctx) => ctx.todoAssignedIds.has(r.recordName),
    StandardScope_Families_NumberOfChildren: (r, ctx, scope) => compareNumber(ctx.childrenByFamily.get(r.recordName) || 0, selectedNumber(scope, 1), selectedOperator(scope, 'equalKey')),
    StandardScope_ToDos_FurtherResearch: (r) => hasToken(r, ['type', 'title', 'description', 'text'], 'research'),
    StandardScope_Places_WithoutCoordinates: (r, ctx) => !hasAnyCoordinates(r, ctx),
    StandardScope_ToDos_FurtherResearchAndPriorityHigh: (r) => hasToken(r, ['type', 'title', 'description', 'text'], 'research') && hasToken(r, ['priority', 'title', 'description', 'text'], 'high'),
    StandardScope_Persons_HasPictures: (r, ctx) => Boolean(r.fields?.thumbnailFileIdentifier?.value) || ctx.mediaTargetIds.has(r.recordName),
    StandardScope_Families_Label: (r, ctx, scope) => labelMatch(r, ctx, scope),
    StandardScope_Sources_AtLeastOneAssignedEntry: (r, ctx) => ctx.sourceAssignedIds.has(r.recordName),
    StandardScope_Sources_Label: (r, ctx, scope) => labelMatch(r, ctx, scope),
    StandardScope_Places_AtLeastOneEvent: (r, ctx) => ctx.eventPlaceIds.has(r.recordName),
    StandardScope_Persons_Labels: (r, ctx, scope) => labelMatch(r, ctx, scope),
    StandardScope_Persons_FamilySearch: (r) => Boolean(readField(r, ['familySearchID', 'familySearchId'])),
    StandardScope_Places_Label: (r, ctx, scope) => labelMatch(r, ctx, scope),
    StandardScope_Families_MarriageDate: (r, _ctx, scope) => compareDate(readField(r, ['cached_marriageDate', 'marriageDate']), selectedValue(scope), selectedOperator(scope, 'beforeKey')),
    StandardScope_Persons_Ancestors: (r, ctx) => ctx.ancestorIds.has(r.recordName),
    StandardScope_Persons_IsLiving: (r) => !readField(r, ['cached_deathDate', 'deathDate']),
  };
  return map[id] || null;
}

async function buildImportedCtx(db, scope) {
  const ctx = {
    mediaTargetIds: new Set(),
    todoAssignedIds: new Set(),
    childrenByFamily: new Map(),
    labelTargetsByUniqueID: new Map(),
    labelTargetsByName: new Map(),
    sourceAssignedIds: new Set(),
    eventPlaceIds: new Set(),
    coordinateValueIds: new Set(),
    placeCoordinateIds: new Set(),
    ancestorIds: new Set(),
  };

  const [
    mediaRelations,
    todoRelations,
    childRelations,
    labels,
    labelRelations,
    sourceRelations,
    personEvents,
    familyEvents,
    coordinates,
  ] = await Promise.all([
    db.query('MediaRelation', { limit: 100000 }),
    db.query('ToDoRelation', { limit: 100000 }),
    db.query('ChildRelation', { limit: 100000 }),
    db.query('Label', { limit: 100000 }),
    db.query('LabelRelation', { limit: 100000 }),
    db.query('SourceRelation', { limit: 100000 }),
    db.query('PersonEvent', { limit: 100000 }),
    db.query('FamilyEvent', { limit: 100000 }),
    db.query('Coordinate', { limit: 100000 }),
  ]);

  for (const rel of mediaRelations.records) {
    const target = readRef(rel.fields?.target) || readRef(rel.fields?.baseObject);
    if (target) ctx.mediaTargetIds.add(target);
  }
  for (const rel of todoRelations.records) {
    const todo = readRef(rel.fields?.todo);
    if (todo) ctx.todoAssignedIds.add(todo);
  }
  for (const rel of childRelations.records) {
    const family = readRef(rel.fields?.family);
    if (family) ctx.childrenByFamily.set(family, (ctx.childrenByFamily.get(family) || 0) + 1);
  }
  for (const rel of sourceRelations.records) {
    const source = readRef(rel.fields?.source);
    if (source) ctx.sourceAssignedIds.add(source);
  }
  for (const ev of [...personEvents.records, ...familyEvents.records]) {
    const place = readRef(ev.fields?.place) || readRef(ev.fields?.assignedPlace);
    if (place) ctx.eventPlaceIds.add(place);
  }
  for (const coord of coordinates.records) {
    if (hasCoordinateValues(coord)) ctx.coordinateValueIds.add(coord.recordName);
    const place = readRef(coord.fields?.place);
    if (place && hasCoordinateValues(coord)) ctx.placeCoordinateIds.add(place);
  }

  const labelsByRecordName = new Map(labels.records.map((label) => [label.recordName, label]));
  for (const rel of labelRelations.records) {
    const labelId = readRef(rel.fields?.label);
    const target = readRef(rel.fields?.target) || readRef(rel.fields?.baseObject);
    if (!labelId || !target) continue;
    const label = labelsByRecordName.get(labelId);
    const uniqueID = readField(label, ['uniqueID']);
    const name = readField(label, ['name', 'title']);
    addToSetMap(ctx.labelTargetsByUniqueID, uniqueID, target);
    addToSetMap(ctx.labelTargetsByName, String(name || '').toLowerCase(), target);
  }

  const ancestorRootUniqueID = selectedValue(scope, 'P1');
  if (ancestorRootUniqueID) {
    await collectAncestorsByUniqueID(db, ancestorRootUniqueID, ctx.ancestorIds);
  }

  return ctx;
}

function addToSetMap(map, key, value) {
  if (!key || !value) return;
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

async function collectAncestorsByUniqueID(db, uniqueID, out) {
  const { records } = await db.query('Person', { limit: 100000 });
  const root = records.find((person) => readField(person, ['uniqueID']) === uniqueID);
  if (!root) return;
  async function visit(recordName) {
    const parents = await db.getPersonsParents(recordName);
    for (const family of parents) {
      for (const parent of [family.man, family.woman]) {
        if (!parent || out.has(parent.recordName)) continue;
        out.add(parent.recordName);
        await visit(parent.recordName);
      }
    }
  }
  await visit(root.recordName);
}

function selectedFilter(scope) {
  return scope?.decodedSummary?.filters?.find((filter) => filter.selectionDictionary && filter.kind !== 'compound') || null;
}

function selectedValue(scope, key = 'A1') {
  return selectedFilter(scope)?.selectionDictionary?.[key] ?? null;
}

function selectedNumber(scope, fallback) {
  const value = Number(selectedValue(scope));
  return Number.isFinite(value) ? value : fallback;
}

function selectedOperator(scope, fallback) {
  const dict = selectedFilter(scope)?.selectionDictionary || {};
  return dict.NUMBERCOMPARISONOPERATOR || dict.DATECOMPARISONOPERATOR || dict.HASORHASNOTLABELCOMPARISONOPERATOR || fallback;
}

function compareNumber(value, target, op) {
  if (op === 'greaterThanKey') return value > target;
  if (op === 'lessThanKey') return value < target;
  if (op === 'notEqualKey') return value !== target;
  return value === target;
}

function compareDate(raw, target, op) {
  const valueYear = parseYear(raw);
  const targetYear = parseYear(target);
  if (valueYear == null || targetYear == null) return false;
  if (op === 'beforeKey') return valueYear < targetYear;
  if (op === 'afterKey') return valueYear > targetYear;
  if (op === 'notEqualKey') return valueYear !== targetYear;
  return valueYear === targetYear;
}

function labelMatch(record, ctx, scope) {
  const targetLabel = selectedValue(scope);
  if (targetLabel && ctx.labelTargetsByUniqueID.get(targetLabel)?.has(record.recordName)) return true;
  return ctx.labelTargetsByName.get('incomplete')?.has(record.recordName) || false;
}

function hasAnyCoordinates(record, ctx) {
  const coordinateRef = refToRecordName(record.fields?.coordinate?.value);
  return (
    hasDirectCoordinates(record) ||
    (coordinateRef && ctx.coordinateValueIds.has(coordinateRef)) ||
    ctx.placeCoordinateIds.has(record.recordName)
  );
}

function hasToken(record, fields, token) {
  const needle = String(token).toLowerCase();
  return fields.some((field) => String(readField(record, [field], '')).toLowerCase().includes(needle));
}
