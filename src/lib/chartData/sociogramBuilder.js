/**
 * Sociogram chart data builder.
 *
 * Mac reference: SociogramChartBuilder, SociogramChartBuilderConfiguration,
 * SociogramAssociatedPersonChartBuilderItem. Produces a social neighborhood
 * around a start person: parents, grandparents, partners, children, and
 * associate relations gated by independent toggles.
 */

import {
  getAssociateRelationsForPerson,
  loadPersonIndex,
} from './recordQueries.js';
import { readField, readRef } from '../schema.js';
import { getLocalDatabase } from '../LocalDatabase.js';
import { isPublicRecord } from '../privacy.js';

export function normalizeSociogramConfig(raw = {}) {
  return {
    rootPersonId: raw.rootPersonId || null,
    showParents: raw.showParents !== false,
    showGrandparents: Boolean(raw.showGrandparents),
    showPartners: raw.showPartners !== false,
    showChildren: raw.showChildren !== false,
    showAssociateRelationsOfStartPerson: raw.showAssociateRelationsOfStartPerson !== false,
    showAssociateRelationsOfPartners: Boolean(raw.showAssociateRelationsOfPartners),
    showAssociateRelationsOfChildren: Boolean(raw.showAssociateRelationsOfChildren),
    associatedPersonsSpacing: Number.isFinite(raw.associatedPersonsSpacing)
      ? Math.max(10, Math.min(400, raw.associatedPersonsSpacing))
      : 80,
  };
}

function personLabel(person) {
  if (!person) return 'Unknown';
  const first = readField(person, ['firstName']) || '';
  const last = readField(person, ['lastName']) || '';
  return `${first} ${last}`.trim() || 'Unknown';
}

function makeNode(person, role) {
  if (!person) return null;
  return {
    id: person.recordName,
    name: personLabel(person),
    gender: person.fields?.gender?.value ?? null,
    role,
  };
}

function makeEdge(fromId, toId, kind, extra = {}) {
  if (!fromId || !toId) return null;
  return { fromId, toId, kind, ...extra };
}

async function collectAssociateEdges(personId, personIndex) {
  const relations = await getAssociateRelationsForPerson(personId);
  const nodes = [];
  const edges = [];
  for (const rel of relations) {
    const relatedId = readRef(rel.fields?.associate?.value ?? rel.fields?.associate);
    if (!relatedId || !personIndex.has(relatedId)) continue;
    const related = personIndex.get(relatedId);
    if (!isPublicRecord(related)) continue;
    nodes.push(makeNode(related, 'associate'));
    edges.push(makeEdge(personId, relatedId, 'associate', {
      relationType: readField(rel, ['relationType', 'type']) || 'associate',
    }));
  }
  return { nodes, edges };
}

export async function buildSociogramData(config = {}) {
  const normalized = normalizeSociogramConfig(config);
  const db = getLocalDatabase();
  const personIndex = await loadPersonIndex();
  const rootId = normalized.rootPersonId;

  if (!rootId || !personIndex.has(rootId)) {
    return {
      config: normalized,
      rootPersonId: rootId,
      nodes: [],
      edges: [],
      warning: rootId ? 'Root person not found' : 'No root person selected',
    };
  }

  const nodes = new Map();
  const edges = [];
  const addNode = (person, role) => {
    if (!person) return;
    if (!isPublicRecord(person)) return;
    if (!nodes.has(person.recordName)) {
      nodes.set(person.recordName, makeNode(person, role));
    }
  };

  addNode(personIndex.get(rootId), 'root');

  const partnerIds = new Set();
  const childIds = new Set();
  const parentIds = new Set();

  if (normalized.showParents) {
    const parents = await db.getPersonsParents(rootId);
    for (const fam of parents) {
      if (fam.man) { addNode(fam.man, 'parent'); parentIds.add(fam.man.recordName); edges.push(makeEdge(fam.man.recordName, rootId, 'parent-of')); }
      if (fam.woman) { addNode(fam.woman, 'parent'); parentIds.add(fam.woman.recordName); edges.push(makeEdge(fam.woman.recordName, rootId, 'parent-of')); }
    }
  }

  if (normalized.showGrandparents && parentIds.size > 0) {
    for (const parentId of parentIds) {
      const grandparents = await db.getPersonsParents(parentId);
      for (const fam of grandparents) {
        if (fam.man) { addNode(fam.man, 'grandparent'); edges.push(makeEdge(fam.man.recordName, parentId, 'parent-of')); }
        if (fam.woman) { addNode(fam.woman, 'grandparent'); edges.push(makeEdge(fam.woman.recordName, parentId, 'parent-of')); }
      }
    }
  }

  if (normalized.showPartners || normalized.showChildren) {
    const families = await db.getPersonsChildrenInformation(rootId);
    for (const fam of families) {
      if (normalized.showPartners && fam.partner) {
        addNode(fam.partner, 'partner');
        partnerIds.add(fam.partner.recordName);
        edges.push(makeEdge(rootId, fam.partner.recordName, 'partner'));
      }
      if (normalized.showChildren) {
        for (const child of fam.children || []) {
          addNode(child, 'child');
          childIds.add(child.recordName);
          edges.push(makeEdge(rootId, child.recordName, 'parent-of'));
          if (normalized.showPartners && fam.partner) {
            edges.push(makeEdge(fam.partner.recordName, child.recordName, 'parent-of'));
          }
        }
      }
    }
  }

  if (normalized.showAssociateRelationsOfStartPerson) {
    const { nodes: extraNodes, edges: extraEdges } = await collectAssociateEdges(rootId, personIndex);
    for (const node of extraNodes) if (node) addNode(personIndex.get(node.id), node.role);
    for (const edge of extraEdges) if (edge) edges.push(edge);
  }

  if (normalized.showAssociateRelationsOfPartners) {
    for (const partnerId of partnerIds) {
      const { nodes: extraNodes, edges: extraEdges } = await collectAssociateEdges(partnerId, personIndex);
      for (const node of extraNodes) if (node) addNode(personIndex.get(node.id), node.role);
      for (const edge of extraEdges) if (edge) edges.push(edge);
    }
  }

  if (normalized.showAssociateRelationsOfChildren) {
    for (const childId of childIds) {
      const { nodes: extraNodes, edges: extraEdges } = await collectAssociateEdges(childId, personIndex);
      for (const node of extraNodes) if (node) addNode(personIndex.get(node.id), node.role);
      for (const edge of extraEdges) if (edge) edges.push(edge);
    }
  }

  return {
    config: normalized,
    rootPersonId: rootId,
    nodes: [...nodes.values()],
    edges: edges.filter(Boolean),
  };
}
