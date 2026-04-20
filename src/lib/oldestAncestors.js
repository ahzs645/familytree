/**
 * Oldest-known-ancestor walker. For a given person, climbs each parent line and
 * records the furthest ancestor reached together with whichever birth year it
 * (or its descendants along the same line) carries.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { personSummary } from '../models/index.js';

const MAX_GENERATIONS = 20;

export async function findOldestAncestors(recordName, { limit = 6 } = {}) {
  if (!recordName) return [];
  const db = getLocalDatabase();
  const visited = new Set();
  const leaves = [];

  async function walk(id, depth, line) {
    if (!id || visited.has(id) || depth > MAX_GENERATIONS) {
      if (id) collectLeaf(id, line);
      return;
    }
    visited.add(id);
    const parents = await db.getPersonsParents(id);
    const parentIds = [];
    for (const fam of parents || []) {
      for (const side of ['man', 'woman']) {
        const parent = fam?.[side];
        if (parent?.recordName) parentIds.push(parent.recordName);
      }
    }
    if (parentIds.length === 0) {
      collectLeaf(id, line);
      return;
    }
    for (const parentId of parentIds) {
      await walk(parentId, depth + 1, [...line, parentId]);
    }
  }

  function collectLeaf(id, line) {
    leaves.push({ recordName: id, generations: line.length });
  }

  await walk(recordName, 0, []);
  const seen = new Set();
  const enriched = [];
  for (const leaf of leaves.sort((a, b) => b.generations - a.generations)) {
    if (seen.has(leaf.recordName)) continue;
    seen.add(leaf.recordName);
    const record = await db.getRecord(leaf.recordName);
    const summary = personSummary(record);
    if (!summary) continue;
    const birthYear = extractYear(summary.birthDate);
    enriched.push({
      recordName: leaf.recordName,
      fullName: summary.fullName,
      birthDate: summary.birthDate || '',
      deathDate: summary.deathDate || '',
      birthYear,
      generations: leaf.generations,
    });
    if (enriched.length >= limit) break;
  }
  enriched.sort((a, b) => {
    if (a.birthYear != null && b.birthYear != null) return a.birthYear - b.birthYear;
    if (a.birthYear != null) return -1;
    if (b.birthYear != null) return 1;
    return b.generations - a.generations;
  });
  return enriched;
}

function extractYear(value) {
  if (!value) return null;
  const match = String(value).match(/(-?\d{3,4})/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  return Number.isFinite(year) ? year : null;
}
