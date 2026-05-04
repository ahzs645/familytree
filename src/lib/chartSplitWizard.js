import { loadFamilyGraph, surnameOf, personDisplayName } from './familyGraph.js';
import { collectAncestorIds, collectDescendantIds } from './subtree.js';
import { newChartDocumentId, saveChartDocument } from './chartDocuments.js';

export const SPLIT_METHODS = [
  { id: 'generation', label: 'By Generation' },
  { id: 'branch', label: 'By Branch' },
  { id: 'lineage', label: 'Single Lineage' },
  { id: 'surname', label: 'By Surname' },
  { id: 'ancestor-descendant', label: 'Ancestor + Descendant Pair' },
];

export async function previewChartSplit(options = {}) {
  const graph = await loadFamilyGraph();
  const rootId = options.rootPersonId;
  if (!rootId || !graph.getPerson(rootId)) return [];
  const maxGenerations = clampNumber(options.generations, 1, 12, 5);
  const method = options.method || 'generation';

  if (method === 'branch') {
    return [
      makePreview('paternal', `${personDisplayName(graph.getPerson(rootId))} - paternal ancestors`, 'ancestor', rootId, maxGenerations, { branch: 'paternal' }),
      makePreview('maternal', `${personDisplayName(graph.getPerson(rootId))} - maternal ancestors`, 'ancestor', rootId, maxGenerations, { branch: 'maternal' }),
    ];
  }

  if (method === 'lineage') {
    const ids = await lineageBetween(options.startPersonId || rootId, options.endPersonId, graph);
    return ids.length ? [makePreview('lineage', 'Single lineage chart', 'tree', ids[0], maxGenerations, { focusPersonIds: ids })] : [];
  }

  if (method === 'surname') {
    const surnames = new Set(String(options.surnames || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
    const groups = new Map();
    for (const person of graph.persons) {
      const surname = surnameOf(person);
      if (!surname) continue;
      if (surnames.size && !surnames.has(surname.toLowerCase())) continue;
      if (!groups.has(surname)) groups.set(surname, []);
      groups.get(surname).push(person.recordName);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([surname, ids]) => makePreview(`surname-${surname}`, `${surname} surname study`, 'tree', ids[0], maxGenerations, { focusPersonIds: ids }));
  }

  if (method === 'ancestor-descendant') {
    return [
      makePreview('ancestors', `${personDisplayName(graph.getPerson(rootId))} - ancestors`, 'ancestor', rootId, maxGenerations),
      makePreview('descendants', `${personDisplayName(graph.getPerson(rootId))} - descendants`, 'descendant', rootId, maxGenerations),
    ];
  }

  const chunks = [];
  const per = clampNumber(options.generationsPerChart, 1, 6, 3);
  for (let start = 0; start < maxGenerations; start += per) {
    const end = Math.min(maxGenerations, start + per - 1);
    chunks.push(makePreview(`gen-${start}-${end}`, `Generations ${start}-${end}`, start === 0 ? 'hourglass' : 'ancestor', rootId, end + 1, { generationRange: [start, end] }));
  }
  return chunks;
}

export async function createSplitChartDocuments(options = {}) {
  const previews = await previewChartSplit(options);
  const saved = [];
  for (const item of previews) {
    saved.push(await saveChartDocument({
      id: newChartDocumentId(),
      name: options.namePrefix ? `${options.namePrefix} - ${item.name}` : item.name,
      chartType: item.chartType,
      rootId: item.rootPersonId,
      generations: item.generations,
      page: { title: options.namePrefix ? `${options.namePrefix} - ${item.name}` : item.name },
      builderConfig: {
        common: { generations: item.generations, privacyMode: 'public' },
        activeChart: item.chartType,
        ancestor: item.options?.branch ? { branch: item.options.branch } : {},
        splitWizard: item.options || {},
      },
      metadata: {
        source: 'chart-split-wizard',
        splitMethod: options.method || 'generation',
        focusPersonIds: item.options?.focusPersonIds || [],
        generationRange: item.options?.generationRange || null,
      },
    }));
  }
  return saved;
}

function makePreview(id, name, chartType, rootPersonId, generations, options = {}) {
  return { id, name, chartType, rootPersonId, generations, options };
}

async function lineageBetween(startId, endId, graph) {
  if (!startId || !endId || !graph.getPerson(startId) || !graph.getPerson(endId)) return [];
  const descendantIds = new Set([startId, ...(await collectDescendantIds(startId, 30))]);
  if (!descendantIds.has(endId)) return [];
  const path = [];
  const found = walkDescendants(graph, startId, endId, path, new Set());
  return found ? path : [];
}

function walkDescendants(graph, currentId, targetId, path, visited) {
  if (!currentId || visited.has(currentId)) return false;
  visited.add(currentId);
  path.push(currentId);
  if (currentId === targetId) return true;
  for (const childId of graph.getChildren(currentId)) {
    if (walkDescendants(graph, childId, targetId, path, visited)) return true;
  }
  path.pop();
  return false;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}
