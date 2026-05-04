import { loadFamilyGraph, comparePeopleByBirthThenName, personDisplayName } from './familyGraph.js';

export const NUMBERING_SYSTEMS = [
  { id: 'ahnentafel', label: 'Ahnentafel' },
  { id: 'daboville', label: "d'Aboville" },
  { id: 'henry', label: 'Henry' },
  { id: 'generation', label: 'Generation' },
];

export async function calculateReferenceNumbers(rootPersonId, system = 'ahnentafel', options = {}) {
  const graph = await loadFamilyGraph(options);
  return calculateReferenceNumbersFromGraph(graph, rootPersonId, system);
}

export function calculateReferenceNumbersFromGraph(graph, rootPersonId, system = 'ahnentafel') {
  if (!graph.getPerson(rootPersonId)) return [];
  if (system === 'daboville') return descendantsWithDottedNumbers(graph, rootPersonId);
  if (system === 'henry') return descendantsWithHenryNumbers(graph, rootPersonId);
  if (system === 'generation') return generationNumbers(graph, rootPersonId);
  return ahnentafelNumbers(graph, rootPersonId);
}

function result(graph, personId, number, generation, path = []) {
  const person = graph.getPerson(personId);
  return {
    personId,
    number,
    generation,
    path,
    name: personDisplayName(person),
    person,
  };
}

function ahnentafelNumbers(graph, rootPersonId) {
  const out = [];
  const queue = [{ id: rootPersonId, number: 1, generation: 0 }];
  const visited = new Set();
  while (queue.length) {
    const item = queue.shift();
    if (!item?.id || visited.has(item.id)) continue;
    visited.add(item.id);
    out.push(result(graph, item.id, item.number, item.generation));
    for (const parents of graph.getParents(item.id)) {
      if (parents.fatherId) queue.push({ id: parents.fatherId, number: item.number * 2, generation: item.generation - 1 });
      if (parents.motherId) queue.push({ id: parents.motherId, number: item.number * 2 + 1, generation: item.generation - 1 });
    }
  }
  return out.sort((a, b) => Number(a.number) - Number(b.number));
}

function sortedChildren(graph, personId) {
  return graph.getChildren(personId).sort((a, b) => comparePeopleByBirthThenName(graph, a, b));
}

function descendantsWithDottedNumbers(graph, rootPersonId) {
  const out = [];
  const visited = new Set();
  const visit = (personId, number, generation, path) => {
    if (!personId || visited.has(personId)) return;
    visited.add(personId);
    out.push(result(graph, personId, number, generation, path));
    sortedChildren(graph, personId).forEach((childId, index) => {
      visit(childId, `${number}.${index + 1}`, generation + 1, [...path, personId]);
    });
  };
  visit(rootPersonId, '1', 0, []);
  return out;
}

function descendantsWithHenryNumbers(graph, rootPersonId) {
  const out = [];
  const visited = new Set();
  const digit = (index) => (index < 10 ? String(index) : String.fromCharCode(65 + index - 10));
  const visit = (personId, number, generation, path) => {
    if (!personId || visited.has(personId)) return;
    visited.add(personId);
    out.push(result(graph, personId, number, generation, path));
    sortedChildren(graph, personId).forEach((childId, index) => {
      visit(childId, `${number}${digit(index + 1)}`, generation + 1, [...path, personId]);
    });
  };
  visit(rootPersonId, '1', 0, []);
  return out;
}

function generationNumbers(graph, rootPersonId) {
  const out = [];
  const best = new Map();
  const queue = [{ id: rootPersonId, generation: 0, path: [] }];
  while (queue.length) {
    const current = queue.shift();
    if (!current?.id) continue;
    const existing = best.get(current.id);
    if (existing && Math.abs(existing.generation) <= Math.abs(current.generation)) continue;
    best.set(current.id, current);

    for (const parents of graph.getParents(current.id)) {
      if (parents.fatherId) queue.push({ id: parents.fatherId, generation: current.generation - 1, path: [...current.path, current.id] });
      if (parents.motherId) queue.push({ id: parents.motherId, generation: current.generation - 1, path: [...current.path, current.id] });
    }
    for (const childId of graph.getChildren(current.id)) {
      queue.push({ id: childId, generation: current.generation + 1, path: [...current.path, current.id] });
    }
  }
  for (const item of best.values()) out.push(result(graph, item.id, item.generation, item.generation, item.path));
  return out.sort((a, b) => a.generation - b.generation || a.name.localeCompare(b.name));
}
