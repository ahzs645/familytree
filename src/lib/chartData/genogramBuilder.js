/**
 * Genogram chart data builder.
 *
 * Mac reference: GenogramChartBuilder, GenogramChartBuilderConfiguration,
 * GenogramPersonBuilderItemGeneratorChartCompositorObjectConfiguration.
 * Produces a person-centric tree (descendant by default) with per-person
 * events, facts, and optional associate relations so the renderer can place
 * event annotations around each person box.
 */

import {
  getPersonEventsForPerson,
  getPersonFactsForPerson,
  getAssociateRelationsForPerson,
  loadPersonIndex,
  loadPlaceIndex,
  readEventYear,
  readEventType,
  readEventPlaceRef,
  readPlaceName,
} from './recordQueries.js';
import { readField, readRef } from '../schema.js';
import { getLocalDatabase } from '../LocalDatabase.js';
import { isPublicRecord } from '../privacy.js';

const EVENT_POSITIONS = new Set(['right', 'below', 'left', 'above']);
const EVENT_BACKGROUNDS = new Set(['none', 'filled']);

export function normalizeGenogramConfig(raw = {}) {
  return {
    rootPersonId: raw.rootPersonId || null,
    showEvents: raw.showEvents !== false,
    showFacts: raw.showFacts !== false,
    showAssociateRelations: Boolean(raw.showAssociateRelations),
    eventPosition: EVENT_POSITIONS.has(raw.eventPosition) ? raw.eventPosition : 'right',
    eventBackground: EVENT_BACKGROUNDS.has(raw.eventBackground) ? raw.eventBackground : 'none',
    generations: Number.isFinite(raw.generations) ? Math.max(1, Math.min(12, raw.generations)) : 3,
  };
}

async function collectDescendantIds(rootId, generations, db) {
  const ids = new Set();
  if (!rootId) return ids;
  ids.add(rootId);
  const queue = [{ id: rootId, depth: 0 }];
  while (queue.length) {
    const { id, depth } = queue.shift();
    if (depth >= generations) continue;
    const children = await db.getPersonsChildrenInformation(id);
    for (const fam of children) {
      for (const child of fam.children || []) {
        if (!child?.recordName || ids.has(child.recordName)) continue;
        if (!isPublicRecord(child)) continue;
        ids.add(child.recordName);
        queue.push({ id: child.recordName, depth: depth + 1 });
      }
    }
  }
  return ids;
}

export async function buildGenogramData(config = {}) {
  const normalized = normalizeGenogramConfig(config);
  const db = getLocalDatabase();
  const [personIndex, placeIndex] = await Promise.all([
    loadPersonIndex(),
    loadPlaceIndex(),
  ]);

  let personIds;
  if (normalized.rootPersonId && personIndex.has(normalized.rootPersonId)) {
    personIds = await collectDescendantIds(normalized.rootPersonId, normalized.generations, db);
  } else {
    personIds = new Set(personIndex.keys());
  }

  const nodes = [];
  for (const id of personIds) {
    const person = personIndex.get(id);
    if (!person) continue;
    const [events, facts, associates] = await Promise.all([
      normalized.showEvents ? getPersonEventsForPerson(id) : Promise.resolve([]),
      normalized.showFacts ? getPersonFactsForPerson(id) : Promise.resolve([]),
      normalized.showAssociateRelations ? getAssociateRelationsForPerson(id) : Promise.resolve([]),
    ]);

    nodes.push({
      id,
      name: `${readField(person, ['firstName']) || ''} ${readField(person, ['lastName']) || ''}`.trim() || 'Unknown',
      gender: person.fields?.gender?.value ?? null,
      events: events.map((event) => ({
        id: event.recordName,
        type: readEventType(event) || 'event',
        year: readEventYear(event),
        placeName: readPlaceName(placeIndex.get(readEventPlaceRef(event))) || null,
      })),
      facts: facts.map((fact) => ({
        id: fact.recordName,
        type: readField(fact, ['factType', 'type']) || 'fact',
        value: readField(fact, ['value', 'text', 'name']) || '',
      })),
      associateRelations: associates.map((rel) => ({
        id: rel.recordName,
        relatedPersonId: readRef(rel.fields?.associate?.value ?? rel.fields?.associate),
        relationType: readField(rel, ['relationType', 'type']) || 'related',
        note: readField(rel, ['note', 'description']) || '',
      })).filter((rel) => rel.relatedPersonId),
    });
  }

  return {
    config: normalized,
    rootPersonId: normalized.rootPersonId,
    nodes,
  };
}
