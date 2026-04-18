/**
 * Pure traversal helpers over LocalDatabase for building tree/chart views.
 * All functions return plain objects (summaries) so chart layouts can stay pure.
 * Uses models/wrap.js for record-to-summary conversion — single source of truth.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { isPublicRecord } from './privacy.js';
import { personSummary } from '../models/index.js';

/**
 * Build an ancestor pedigree tree to a given depth.
 * Returns nested { person, father, mother } where missing nodes are null.
 */
export async function buildAncestorTree(rootRecordName, maxGenerations = 5) {
  const db = getLocalDatabase();
  const root = await db.getRecord(rootRecordName);
  if (!isPublicRecord(root)) return null;

  async function recurse(record, gen) {
    if (!isPublicRecord(record)) return null;
    const node = { person: personSummary(record), father: null, mother: null, generation: gen };
    if (gen >= maxGenerations) return node;
    const parents = await db.getPersonsParents(record.recordName);
    if (parents.length > 0) {
      const fam = parents.find((p) => isPublicRecord(p.family));
      if (fam?.man) node.father = await recurse(fam.man, gen + 1);
      if (fam?.woman) node.mother = await recurse(fam.woman, gen + 1);
    }
    return node;
  }

  return recurse(root, 0);
}

/**
 * Build a descendant tree to a given depth.
 * Returns nested { person, unions: [{ partner, children }] }.
 */
export async function buildDescendantTree(rootRecordName, maxGenerations = 4) {
  const db = getLocalDatabase();
  const root = await db.getRecord(rootRecordName);
  if (!isPublicRecord(root)) return null;

  async function recurse(record, gen) {
    if (!isPublicRecord(record)) return null;
    const node = { person: personSummary(record), unions: [], generation: gen };
    if (gen >= maxGenerations) return node;
    const families = await db.getPersonsChildrenInformation(record.recordName);
    for (const fam of families) {
      if (!isPublicRecord(fam.family)) continue;
      const union = {
        familyRecordName: fam.family.recordName,
        partner: isPublicRecord(fam.partner) ? personSummary(fam.partner) : null,
        children: [],
      };
      for (const child of fam.children) {
        const childNode = await recurse(child, gen + 1);
        if (childNode) union.children.push(childNode);
      }
      node.unions.push(union);
    }
    return node;
  }

  return recurse(root, 0);
}

/**
 * Flat list of all persons (for picker UIs). Sorted by full name.
 */
export async function listAllPersons({ includePrivate = false } = {}) {
  const db = getLocalDatabase();
  const { records } = await db.query('Person', { limit: 100000 });
  return records
    .filter((record) => includePrivate || isPublicRecord(record))
    .map(personSummary)
    .filter(Boolean)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/**
 * Pick a sensible starting person — the one flagged as the start person, or the first.
 */
export async function findStartPerson() {
  const db = getLocalDatabase();
  const { records } = await db.query('Person', { limit: 100000 });
  const visible = records.filter(isPublicRecord);
  const start = visible.find((r) => r.fields?.isStartPerson?.value);
  return personSummary(start || visible[0] || null);
}
