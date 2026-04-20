/**
 * Find kinship paths between two persons over the Family graph.
 * Each step is either "parent" (up), "child" (down), or "spouse" (sideways).
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { isPublicRecord } from './privacy.js';
import { personSummary } from '../models/index.js';

export async function findRelationshipPath(startRecordName, endRecordName) {
  const result = await findRelationshipPaths(startRecordName, endRecordName, { maxPaths: 1 });
  return result.paths[0] || null;
}

export async function findRelationshipPaths(startRecordName, endRecordName, options = {}) {
  const {
    bloodlineOnly = false,
    includeSpouses = !bloodlineOnly,
    maxDepth = 12,
    maxPaths = 12,
    maxQueue = 5000,
    excludeNonBiological = false,
  } = options;
  const db = getLocalDatabase();
  const [start, end] = await Promise.all([db.getRecord(startRecordName), db.getRecord(endRecordName)]);
  if (!isPublicRecord(start) || !isPublicRecord(end)) return { paths: [], selectedPathId: null };
  if (startRecordName === endRecordName) {
    const path = hydratePath([{ recordName: startRecordName, edgeFromPrev: 'self' }], new Map([[startRecordName, start]]));
    return { paths: [path], selectedPathId: path.id };
  }

  const queue = [[{ recordName: startRecordName, edgeFromPrev: null }]];
  const found = [];
  const seenPathIds = new Set();
  const recordCache = new Map([
    [startRecordName, start],
    [endRecordName, end],
  ]);
  let cursor = 0;

  while (cursor < queue.length && found.length < maxPaths && cursor < maxQueue) {
    const path = queue[cursor++];
    const current = path[path.length - 1]?.recordName;
    const traversedEdges = path.length - 1;
    if (!current || traversedEdges >= maxDepth) continue;

    const visitedInPath = new Set(path.map((step) => step.recordName));
    const neighbors = await getNeighbors(db, current, { includeSpouses, excludeNonBiological });
    for (const { neighbor, edge, record } of neighbors) {
      if (!neighbor || visitedInPath.has(neighbor)) continue;
      if (record) recordCache.set(neighbor, record);
      const nextPath = [...path, { recordName: neighbor, edgeFromPrev: edge }];
      if (neighbor === endRecordName) {
        const hydrated = hydratePath(nextPath, recordCache);
        if (!seenPathIds.has(hydrated.id)) {
          seenPathIds.add(hydrated.id);
          found.push(hydrated);
          if (found.length >= maxPaths) break;
        }
        continue;
      }
      if (nextPath.length - 1 < maxDepth && queue.length < maxQueue) queue.push(nextPath);
    }
  }

  const paths = found.sort(comparePaths);
  return { paths, selectedPathId: paths[0]?.id || null };
}

async function getNeighbors(db, recordName, options = {}) {
  const { includeSpouses = true, excludeNonBiological = false } = options;
  const out = [];
  const seen = new Set();
  const push = (record, edge) => {
    if (!isPublicRecord(record) || seen.has(record.recordName)) return;
    seen.add(record.recordName);
    out.push({ neighbor: record.recordName, edge, record });
  };

  // Parents (up)
  const parents = await db.getPersonsParents(recordName);
  for (const fam of parents) {
    if (!isPublicRecord(fam.family)) continue;
    if (excludeNonBiological && !isBiologicalChildLink(fam)) continue;
    push(fam.man, 'parent');
    push(fam.woman, 'parent');
  }
  // Children + spouses (down + sideways)
  const families = await db.getPersonsChildrenInformation(recordName);
  for (const fam of families) {
    if (!isPublicRecord(fam.family)) continue;
    if (includeSpouses) push(fam.partner, 'spouse');
    for (const child of fam.children) {
      push(child, 'child');
    }
  }
  return out;
}

// Treat a parent relation as biological unless it explicitly marks itself as
// adopted/step/foster. Real-world ChildRelation records frequently omit the
// type for simple biological cases, so absence ≈ biological.
function isBiologicalChildLink(fam) {
  const marker = fam?.family?.fields?.childRelationType?.value || fam?.relationType || null;
  if (!marker) return true;
  return !/adopt|step|foster|guardian/i.test(String(marker));
}

function hydratePath(steps, recordCache) {
  const hydratedSteps = steps.map((step) => {
    const record = recordCache.get(step.recordName);
    return {
      ...step,
      person: record ? personSummary(record) : null,
    };
  });
  const edgeCounts = countEdges(hydratedSteps);
  const id = hydratedSteps.map((step) => `${step.edgeFromPrev || 'start'}:${step.recordName}`).join('|');
  return {
    id,
    steps: hydratedSteps,
    label: relationshipLabel(hydratedSteps),
    edgeCounts,
    bloodlineOnly: edgeCounts.spouse === 0,
  };
}

function countEdges(steps) {
  const counts = { parent: 0, child: 0, spouse: 0 };
  for (const step of steps || []) {
    if (step.edgeFromPrev in counts) counts[step.edgeFromPrev]++;
  }
  return counts;
}

function comparePaths(a, b) {
  const lengthDiff = a.steps.length - b.steps.length;
  if (lengthDiff) return lengthDiff;
  const spouseDiff = (a.edgeCounts?.spouse || 0) - (b.edgeCounts?.spouse || 0);
  if (spouseDiff) return spouseDiff;
  return String(a.id).localeCompare(String(b.id));
}

/**
 * Heuristic relationship label. Counts ups (parents) and downs (children) and
 * names common cases; falls back to "Nth cousin" or generic descriptor.
 */
function relationshipLabel(steps) {
  if (!steps || steps.length === 0) return '';
  if (steps.length === 1) return 'Same person';
  let ups = 0;
  let downs = 0;
  let spouses = 0;
  for (let i = 1; i < steps.length; i++) {
    const e = steps[i].edgeFromPrev;
    if (e === 'parent') ups++;
    else if (e === 'child') downs++;
    else if (e === 'spouse') spouses++;
  }
  if (spouses === 1 && ups === 0 && downs === 0) return 'Spouse';
  if (ups === 1 && downs === 0) return 'Parent';
  if (ups === 0 && downs === 1) return 'Child';
  if (ups === 1 && downs === 1) return 'Sibling';
  if (ups === 2 && downs === 0) return 'Grandparent';
  if (ups === 0 && downs === 2) return 'Grandchild';
  if (ups === 2 && downs === 1) return 'Aunt/Uncle';
  if (ups === 1 && downs === 2) return 'Niece/Nephew';
  if (ups === 2 && downs === 2) return '1st Cousin';
  if (ups >= 3 && downs >= 3 && ups === downs) return `${ordinal(ups - 1)} Cousin`;
  return `Relative (${ups}↑ / ${downs}↓${spouses ? ` / ${spouses} spouse` : ''})`;
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
