/**
 * Find the shortest kinship path between two persons by BFS over the
 * Family graph. Each step is either "parent" (up) or "child" (down) or
 * "spouse" (sideways). Returns a list of nodes with edge labels.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { personSummary } from '../models/index.js';

export async function findRelationshipPath(startRecordName, endRecordName) {
  if (startRecordName === endRecordName) return { steps: [{ from: startRecordName, edge: 'self' }] };
  const db = getLocalDatabase();
  const visited = new Map(); // recordName → { prev, edge }
  visited.set(startRecordName, { prev: null, edge: null });
  const queue = [startRecordName];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === endRecordName) break;

    const neighbors = await getNeighbors(db, current);
    for (const { neighbor, edge } of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.set(neighbor, { prev: current, edge });
      queue.push(neighbor);
    }
  }

  if (!visited.has(endRecordName)) return null;

  // Reconstruct path
  const path = [];
  let cursor = endRecordName;
  while (cursor) {
    const entry = visited.get(cursor);
    path.unshift({ recordName: cursor, edgeFromPrev: entry.edge });
    cursor = entry.prev;
  }

  // Hydrate person summaries
  const hydrated = [];
  for (const step of path) {
    const r = await db.getRecord(step.recordName);
    hydrated.push({
      ...step,
      person: r ? personSummary(r) : null,
    });
  }
  return { steps: hydrated, label: relationshipLabel(hydrated) };
}

async function getNeighbors(db, recordName) {
  const out = [];
  // Parents (up)
  const parents = await db.getPersonsParents(recordName);
  for (const fam of parents) {
    if (fam.man) out.push({ neighbor: fam.man.recordName, edge: 'parent' });
    if (fam.woman) out.push({ neighbor: fam.woman.recordName, edge: 'parent' });
  }
  // Children + spouses (down + sideways)
  const families = await db.getPersonsChildrenInformation(recordName);
  for (const fam of families) {
    if (fam.partner) out.push({ neighbor: fam.partner.recordName, edge: 'spouse' });
    for (const child of fam.children) {
      out.push({ neighbor: child.recordName, edge: 'child' });
    }
  }
  return out;
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
