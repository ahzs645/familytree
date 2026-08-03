/**
 * Complete-tree model and layout. Unlike root-based pedigree builders, this
 * builder deliberately retains every public Person record, including isolated
 * people and disconnected family components.
 */
import { getAllChildRelations, getAllFamilies, getAllPersons } from './recordQueries.js';
import { readField, readRef } from '../schema.js';

function personSummary(record) {
  const firstName = String(readField(record, ['firstName']) || '');
  const lastName = String(readField(record, ['lastName']) || '');
  return {
    recordName: record.recordName,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim() || String(readField(record, ['displayName', 'fullName']) || ''),
    gender: record.fields?.gender?.value ?? null,
    birthDate: readField(record, ['cached_birthDate', 'birthDate']) || null,
    deathDate: readField(record, ['cached_deathDate', 'deathDate']) || null,
  };
}

export function buildCompleteTreeModel({ persons = [], families = [], childRelations = [] } = {}) {
  const nodes = persons.filter((person) => person?.recordName).map((person) => ({
    id: person.recordName,
    person: personSummary(person),
    generation: 0,
  }));
  const ids = new Set(nodes.map((node) => node.id));
  const familyParents = new Map();
  const edges = [];

  for (const family of families) {
    const manId = readRef(family?.fields?.man?.value ?? family?.fields?.man);
    const womanId = readRef(family?.fields?.woman?.value ?? family?.fields?.woman);
    const parents = [manId, womanId].filter((id) => id && ids.has(id));
    familyParents.set(family.recordName, parents);
    if (parents.length === 2) edges.push({ id: `partner:${family.recordName}`, kind: 'partner', fromId: parents[0], toId: parents[1] });
  }

  for (const relation of childRelations) {
    const familyId = readRef(relation?.fields?.family?.value ?? relation?.fields?.family);
    const childId = readRef(relation?.fields?.child?.value ?? relation?.fields?.child);
    if (!childId || !ids.has(childId)) continue;
    for (const parentId of familyParents.get(familyId) || []) {
      edges.push({ id: `child:${relation.recordName}:${parentId}`, kind: 'child', fromId: parentId, toId: childId });
    }
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  // Relax generations so a child is always below every known parent. Partner
  // nodes share the deeper partner generation, which keeps couples aligned.
  for (let pass = 0; pass < nodes.length; pass += 1) {
    let changed = false;
    for (const edge of edges) {
      const from = byId.get(edge.fromId);
      const to = byId.get(edge.toId);
      if (!from || !to) continue;
      if (edge.kind === 'child' && to.generation < from.generation + 1) {
        to.generation = from.generation + 1;
        changed = true;
      } else if (edge.kind === 'partner') {
        const generation = Math.max(from.generation, to.generation);
        if (from.generation !== generation || to.generation !== generation) changed = true;
        from.generation = generation;
        to.generation = generation;
      }
    }
    if (!changed) break;
  }

  const adjacency = new Map(nodes.map((node) => [node.id, new Set()]));
  for (const edge of edges) {
    adjacency.get(edge.fromId)?.add(edge.toId);
    adjacency.get(edge.toId)?.add(edge.fromId);
  }
  const components = [];
  const seen = new Set();
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    const componentIds = [];
    const queue = [node.id];
    seen.add(node.id);
    while (queue.length) {
      const id = queue.shift();
      componentIds.push(id);
      for (const otherId of adjacency.get(id) || []) {
        if (!seen.has(otherId)) { seen.add(otherId); queue.push(otherId); }
      }
    }
    const componentSet = new Set(componentIds);
    components.push({
      id: `component:${components.length}`,
      nodeIds: componentIds,
      edgeIds: edges.filter((edge) => componentSet.has(edge.fromId) && componentSet.has(edge.toId)).map((edge) => edge.id),
    });
  }

  return { nodes, edges, components };
}

export async function buildCompleteTreeData(options = {}) {
  const [persons, families, childRelations] = await Promise.all([
    getAllPersons(options), getAllFamilies(options), getAllChildRelations(options),
  ]);
  return buildCompleteTreeModel({ persons, families, childRelations });
}

export function layoutCompleteTree(model, theme, { alignment = 'top' } = {}) {
  const columnGap = 90;
  const rowGap = 28;
  const blockGap = 90;
  const nodeById = new Map((model?.nodes || []).map((node) => [node.id, node]));
  const edgeById = new Map((model?.edges || []).map((edge) => [edge.id, edge]));
  const blocks = (model?.components || []).map((component) => {
    const members = component.nodeIds.map((id) => nodeById.get(id)).filter(Boolean);
    const minGeneration = Math.min(0, ...members.map((node) => node.generation));
    const groups = new Map();
    for (const node of members) {
      const generation = node.generation - minGeneration;
      if (!groups.has(generation)) groups.set(generation, []);
      groups.get(generation).push(node);
    }
    const maxGeneration = Math.max(0, ...groups.keys());
    const maxRows = Math.max(1, ...[...groups.values()].map((group) => group.length));
    const height = maxRows * theme.nodeHeight + Math.max(0, maxRows - 1) * rowGap;
    const width = (maxGeneration + 1) * theme.nodeWidth + maxGeneration * columnGap;
    return { component, groups, width, height };
  });
  const maxHeight = Math.max(0, ...blocks.map((block) => block.height));
  const nodes = [];
  let cursorX = 0;
  for (const block of blocks) {
    const offsetY = alignment === 'center' ? (maxHeight - block.height) / 2 : 0;
    for (const [generation, group] of block.groups) {
      group.sort((a, b) => a.id.localeCompare(b.id));
      group.forEach((node, row) => nodes.push({
        ...node,
        componentId: block.component.id,
        x: cursorX + generation * (theme.nodeWidth + columnGap),
        y: offsetY + row * (theme.nodeHeight + rowGap),
      }));
    }
    cursorX += block.width + blockGap;
  }
  const positioned = new Map(nodes.map((node) => [node.id, node]));
  const edges = (model?.edges || []).map((edge) => {
    const from = positioned.get(edge.fromId);
    const to = positioned.get(edge.toId);
    if (!from || !to) return null;
    const x1 = from.x + theme.nodeWidth / 2;
    const y1 = from.y + theme.nodeHeight / 2;
    const x2 = to.x + theme.nodeWidth / 2;
    const y2 = to.y + theme.nodeHeight / 2;
    const midX = (x1 + x2) / 2;
    return { ...edge, d: edge.kind === 'partner' ? `M ${x1} ${y1} L ${x2} ${y2}` : `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}` };
  }).filter(Boolean);
  return { nodes, edges, width: Math.max(0, cursorX - blockGap), height: maxHeight };
}
