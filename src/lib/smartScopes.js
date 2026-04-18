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
  if (!scope) throw new Error('Unknown scope: ' + scopeId);
  const db = getLocalDatabase();
  const { records } = await db.query(scope.entityType, { limit: 100000 });
  const ctx = scope.needsCtx ? await buildCtx(scope.needsCtx) : null;
  const matched = records.filter((r) => scope.predicate(r, ctx));
  return { entityType: scope.entityType, scope, records: matched, total: matched.length };
}

export function listScopes(entityType) {
  if (!entityType) return BUILTIN_SCOPES;
  return BUILTIN_SCOPES.filter((s) => s.entityType === entityType);
}
