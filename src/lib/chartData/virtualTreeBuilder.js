/**
 * Virtual tree chart data builder.
 *
 * Mac reference: VirtualTreeBuilder, VirtualTreeConfiguration,
 * VirtualTreePersonObject, VirtualTreeFamilyObject, VirtualTreeConnectionObject.
 * The web renderer is `layoutVirtualTree` plus the SVG chart canvas; this
 * builder produces the serializable nodes + connections that feed into it.
 *
 * The existing web layout works from an ancestor/descendant tree traversal;
 * this builder exposes the same data in a compositor-friendly shape so saved
 * chart documents can persist node/connection metadata.
 */

import { loadPersonIndex } from './recordQueries.js';
import { readField } from '../schema.js';
import { getLocalDatabase } from '../LocalDatabase.js';
import { isPublicRecord } from '../privacy.js';

const COLLECT_MODES = new Set(['ancestor', 'descendant', 'hourglass']);
const SYMBOL_MODES = new Set(['square', 'rounded', 'circle', 'photo']);
const COLOR_MODES = new Set(['gender', 'generation', 'lastName', 'uniform']);

export function normalizeVirtualTreeConfig(raw = {}) {
  return {
    rootPersonId: raw.rootPersonId || null,
    collectMode: COLLECT_MODES.has(raw.collectMode) ? raw.collectMode : 'descendant',
    symbolMode: SYMBOL_MODES.has(raw.symbolMode) ? raw.symbolMode : 'rounded',
    colorMode: COLOR_MODES.has(raw.colorMode) ? raw.colorMode : 'gender',
    generations: Number.isFinite(raw.generations) ? Math.max(1, Math.min(12, raw.generations)) : 5,
    hSpacing: Number.isFinite(raw.hSpacing) ? Math.max(8, Math.min(200, raw.hSpacing)) : 24,
    vSpacing: Number.isFinite(raw.vSpacing) ? Math.max(50, Math.min(260, raw.vSpacing)) : 110,
    orientation: raw.orientation === 'horizontal' ? 'horizontal' : 'vertical',
    showRelationshipPath: Boolean(raw.showRelationshipPath),
    relationshipPathTargetId: raw.relationshipPathTargetId || null,
  };
}

function nodeForPerson(person, depth, role) {
  return {
    id: person.recordName,
    name: `${readField(person, ['firstName']) || ''} ${readField(person, ['lastName']) || ''}`.trim() || 'Unknown',
    gender: person.fields?.gender?.value ?? null,
    depth,
    role,
  };
}

async function walkDescendants(rootId, generations, personIndex, db) {
  const nodes = new Map();
  const connections = [];
  const root = personIndex.get(rootId);
  if (!root) return { nodes, connections };
  nodes.set(rootId, nodeForPerson(root, 0, 'root'));
  const queue = [{ id: rootId, depth: 0 }];
  while (queue.length) {
    const { id, depth } = queue.shift();
    if (depth >= generations) continue;
    const families = await db.getPersonsChildrenInformation(id);
    for (const fam of families) {
      if (fam.partner && isPublicRecord(fam.partner) && !nodes.has(fam.partner.recordName)) {
        nodes.set(fam.partner.recordName, nodeForPerson(fam.partner, depth, 'partner'));
        connections.push({ fromId: id, toId: fam.partner.recordName, kind: 'partner' });
      }
      for (const child of fam.children || []) {
        if (!child?.recordName || !isPublicRecord(child)) continue;
        if (!nodes.has(child.recordName)) {
          nodes.set(child.recordName, nodeForPerson(child, depth + 1, 'descendant'));
        }
        connections.push({ fromId: id, toId: child.recordName, kind: 'parent-of' });
        if (fam.partner) connections.push({ fromId: fam.partner.recordName, toId: child.recordName, kind: 'parent-of' });
        queue.push({ id: child.recordName, depth: depth + 1 });
      }
    }
  }
  return { nodes, connections };
}

async function walkAncestors(rootId, generations, personIndex, db) {
  const nodes = new Map();
  const connections = [];
  const root = personIndex.get(rootId);
  if (!root) return { nodes, connections };
  nodes.set(rootId, nodeForPerson(root, 0, 'root'));
  const queue = [{ id: rootId, depth: 0 }];
  while (queue.length) {
    const { id, depth } = queue.shift();
    if (depth >= generations) continue;
    const parents = await db.getPersonsParents(id);
    for (const fam of parents) {
      for (const parent of [fam.man, fam.woman]) {
        if (!parent || !isPublicRecord(parent)) continue;
        if (!nodes.has(parent.recordName)) {
          nodes.set(parent.recordName, nodeForPerson(parent, depth + 1, 'ancestor'));
        }
        connections.push({ fromId: parent.recordName, toId: id, kind: 'parent-of' });
        queue.push({ id: parent.recordName, depth: depth + 1 });
      }
    }
  }
  return { nodes, connections };
}

export async function buildVirtualTreeData(config = {}) {
  const normalized = normalizeVirtualTreeConfig(config);
  const db = getLocalDatabase();
  const personIndex = await loadPersonIndex();

  if (!normalized.rootPersonId || !personIndex.has(normalized.rootPersonId)) {
    return {
      config: normalized,
      rootPersonId: normalized.rootPersonId,
      nodes: [],
      connections: [],
      warning: normalized.rootPersonId ? 'Root person not found' : 'No root person selected',
    };
  }

  let result;
  if (normalized.collectMode === 'ancestor') {
    result = await walkAncestors(normalized.rootPersonId, normalized.generations, personIndex, db);
  } else if (normalized.collectMode === 'hourglass') {
    const [asc, desc] = await Promise.all([
      walkAncestors(normalized.rootPersonId, normalized.generations, personIndex, db),
      walkDescendants(normalized.rootPersonId, normalized.generations, personIndex, db),
    ]);
    const merged = new Map(asc.nodes);
    for (const [id, node] of desc.nodes) if (!merged.has(id)) merged.set(id, node);
    result = { nodes: merged, connections: [...asc.connections, ...desc.connections] };
  } else {
    result = await walkDescendants(normalized.rootPersonId, normalized.generations, personIndex, db);
  }

  return {
    config: normalized,
    rootPersonId: normalized.rootPersonId,
    nodes: [...result.nodes.values()],
    connections: result.connections,
  };
}
