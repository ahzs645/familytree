/**
 * Pure traversal helpers over LocalDatabase for building tree/chart views.
 * All functions return plain objects (summaries) so chart layouts can stay pure.
 * Uses models/wrap.js for record-to-summary conversion — single source of truth.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { isPublicRecord } from './privacy.js';
import { refToRecordName } from './recordRef.js';
import { readField } from './schema.js';
import { familySummary, personSummary } from '../models/index.js';
import { attachLineageToPersonSummaries, buildPersonLineage } from './personLineage.js';
import { childRelationKind, childRelationLabel } from './childRelationshipTypes.js';

/**
 * Build an ancestor pedigree tree to a given depth.
 * Returns nested { person, father, mother } where missing nodes are null.
 *
 * Options:
 *   - branch: 'both' (default) | 'paternal' | 'maternal'
 *     | 'paternal-from-start' | 'maternal-from-start'
 *       Mirrors MacFamilyTree's AncestorChartBuilderConfiguration traversal
 *       modes: only-paternal and only-maternal follow a single line all the
 *       way up; the *-from-start variants show both parents at the root and
 *       then follow only one side above that.
 */
export async function buildAncestorTree(rootRecordName, maxGenerations = 5, options = {}) {
  const branch = options?.branch || 'both';
  const db = getLocalDatabase();
  const root = await db.getRecord(rootRecordName);
  if (!isPublicRecord(root)) return null;

  function shouldIncludeFather(gen) {
    if (branch === 'both') return true;
    if (branch === 'paternal') return true;
    if (branch === 'maternal') return false;
    if (branch === 'paternal-from-start') return true;
    if (branch === 'maternal-from-start') return gen === 0;
    return true;
  }

  function shouldIncludeMother(gen) {
    if (branch === 'both') return true;
    if (branch === 'maternal') return true;
    if (branch === 'paternal') return false;
    if (branch === 'maternal-from-start') return true;
    if (branch === 'paternal-from-start') return gen === 0;
    return true;
  }

  async function recurse(record, gen) {
    if (!isPublicRecord(record)) return null;
    const node = { person: personSummary(record), father: null, mother: null, generation: gen };
    if (gen >= maxGenerations) return node;
    const parents = await db.getPersonsParents(record.recordName);
    if (parents.length > 0) {
      const fam = parents.find((p) => isPublicRecord(p.family));
      if (fam?.man && shouldIncludeFather(gen)) node.father = await recurse(fam.man, gen + 1);
      if (fam?.woman && shouldIncludeMother(gen)) node.mother = await recurse(fam.woman, gen + 1);
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
        family: familySummary(fam.family),
        marriageDate: familySummary(fam.family)?.marriageDate || null,
        partner: isPublicRecord(fam.partner) ? personSummary(fam.partner) : null,
        children: [],
      };
      const relationByChild = new Map((fam.childRelations || []).map(({ child, relation }) => [child?.recordName, relation]));
      for (const child of fam.children) {
        const childNode = await recurse(child, gen + 1);
        if (childNode) {
          const relation = relationByChild.get(child.recordName);
          union.children.push({
            ...childNode,
            relationKind: childRelationKind(relation),
            relationLabel: childRelationLabel(relation),
          });
        }
      }
      node.unions.push(union);
    }
    return node;
  }

  return recurse(root, 0);
}

/**
 * Build the broader context used by MacFamilyTree's Interactive Tree:
 * direct ancestors plus the collateral people in those families.
 *
 * The chart builders above intentionally return strict ancestor/descendant
 * trees. The interactive view needs more context: siblings, aunts/uncles,
 * partners, and children of the displayed family groups.
 */
export async function buildInteractiveFamilyGraph(rootRecordName, options = {}) {
  const maxAncestorGenerations = options.maxAncestorGenerations ?? 4;
  const maxDescendantGenerations = options.maxDescendantGenerations ?? 1;
  // Persons the user has clicked to expand-in-place: each reveals that person's
  // otherwise-hidden families (the "further persons" the down-pin points at),
  // mirroring the native viewer's click-to-expand on the further-persons mark.
  const expandedIds = new Set(options.expandedIds || []);
  const db = getLocalDatabase();
  const root = await db.getRecord(rootRecordName);
  if (!isPublicRecord(root)) return null;

  const [
    { records: familyRecords },
    { records: childRelationRecords },
    { records: personRecords },
    { records: personGroupRelations },
    { records: personGroups },
    associateRelations,
  ] = await Promise.all([
    db.query('Family', { limit: 100000 }),
    db.query('ChildRelation', { limit: 100000 }),
    db.query('Person', { limit: 100000 }),
    db.query('PersonGroupRelation', { limit: 100000 }),
    db.query('PersonGroup', { limit: 100000 }),
    db.query('AssociateRelation', { limit: 100000 }).catch(() => ({ records: [] })),
  ]);

  // Persons who own at least one influential (associate) relation — used to
  // flag the "Display Influential Relations Icon" marker on tree nodes.
  const influentialPersonIds = new Set();
  for (const relation of associateRelations.records || []) {
    const ownerId = refToRecordName(relation.fields?.person?.value);
    if (ownerId) influentialPersonIds.add(ownerId);
  }

  const familyById = new Map(familyRecords.filter(isPublicRecord).map((family) => [family.recordName, family]));
  const personById = new Map(personRecords.filter(isPublicRecord).map((person) => [person.recordName, person]));
  const duplicateSets = buildInteractiveDuplicateSets(personRecords.filter(isPublicRecord));
  const childrenByFamily = new Map();
  const childRelationByFamilyChild = new Map();
  const parentFamiliesByChild = new Map();

  for (const relation of childRelationRecords) {
    const familyId = refToRecordName(relation.fields?.family?.value);
    const childId = refToRecordName(relation.fields?.child?.value);
    if (!familyId || !childId || !familyById.has(familyId)) continue;
    if (!childrenByFamily.has(familyId)) childrenByFamily.set(familyId, []);
    childrenByFamily.get(familyId).push(childId);
    childRelationByFamilyChild.set(`${familyId}:${childId}`, relation);
    if (!parentFamiliesByChild.has(childId)) parentFamiliesByChild.set(childId, []);
    parentFamiliesByChild.get(childId).push(familyId);
  }

  const groupNameById = new Map(personGroups.filter(isPublicRecord).map((group) => [
    group.recordName,
    readField(group, ['name', 'title'], group.recordName),
  ]));
  const groupsByPerson = new Map();
  for (const relation of personGroupRelations) {
    const personId = refToRecordName(relation.fields?.person?.value);
    const groupId = refToRecordName(relation.fields?.personGroup?.value);
    if (!personId || !groupId || !groupNameById.has(groupId)) continue;
    if (!groupsByPerson.has(personId)) groupsByPerson.set(personId, []);
    groupsByPerson.get(personId).push({ id: groupId, name: groupNameById.get(groupId) });
  }

  const personIds = new Set([rootRecordName]);
  const familyIds = new Set();
  const nodeHints = new Map();
  const addHint = (personId, generation, role = 'relative', branch = null) => {
    if (!personId) return;
    const existing = nodeHints.get(personId);
    if (!existing || Math.abs(generation) < Math.abs(existing.generation)) {
      nodeHints.set(personId, { generation, roles: new Set([role]), branches: new Set(branch ? [branch] : []) });
    } else {
      existing.roles.add(role);
      if (branch) existing.branches.add(branch);
    }
    personIds.add(personId);
  };

  addHint(rootRecordName, 0, 'root');
  const rootFamilyId = parentFamiliesByChild.get(rootRecordName)?.[0] || null;
  const familyHints = new Map();

  const addFamily = (familyId, generationForChildren, role = 'family', branch = null, childIdForBranch = null) => {
    const family = familyById.get(familyId);
    if (!family) return;
    familyIds.add(familyId);
    const existingFamilyHint = familyHints.get(familyId);
    const familyBranch = branch || existingFamilyHint?.branch || 'collateral';
    if (!existingFamilyHint || Math.abs(generationForChildren) < Math.abs(existingFamilyHint.generation)) {
      familyHints.set(familyId, { generation: generationForChildren, branch: familyBranch, preferredChildId: childIdForBranch || null });
    }
    const manId = refToRecordName(family.fields?.man?.value);
    const womanId = refToRecordName(family.fields?.woman?.value);
    const fatherBranch = branch === 'root' ? 'paternal' : branch;
    const motherBranch = branch === 'root' ? 'maternal' : branch;
    addHint(manId, generationForChildren - 1, `${role}-parent`, fatherBranch);
    addHint(womanId, generationForChildren - 1, `${role}-parent`, motherBranch);
    for (const childId of childrenByFamily.get(familyId) || []) {
      const childBranch = childId === childIdForBranch ? branch : branch === 'root' ? null : branch;
      addHint(childId, generationForChildren, role === 'ancestor' ? 'collateral' : role, childBranch);
    }
  };

  const visitAncestorLine = (personId, generation, depth, branch = 'root') => {
    if (depth > maxAncestorGenerations) return;
    for (const familyId of parentFamiliesByChild.get(personId) || []) {
      addFamily(familyId, generation, 'ancestor', branch, personId);
      const family = familyById.get(familyId);
      const fatherId = refToRecordName(family?.fields?.man?.value);
      const motherId = refToRecordName(family?.fields?.woman?.value);
      const fatherBranch = branch === 'root' ? 'paternal' : branch;
      const motherBranch = branch === 'root' ? 'maternal' : branch;
      if (fatherId) visitAncestorLine(fatherId, generation - 1, depth + 1, fatherBranch);
      if (motherId) visitAncestorLine(motherId, generation - 1, depth + 1, motherBranch);
    }
  };
  visitAncestorLine(rootRecordName, 0, 1);

  const visitDescendantFamilies = (personId, generation, depth) => {
    if (depth > maxDescendantGenerations) return;
    for (const family of familyById.values()) {
      const manId = refToRecordName(family.fields?.man?.value);
      const womanId = refToRecordName(family.fields?.woman?.value);
      if (manId !== personId && womanId !== personId) continue;
      familyIds.add(family.recordName);
      addHint(manId, generation, 'partner-family');
      addHint(womanId, generation, 'partner-family');
      for (const childId of childrenByFamily.get(family.recordName) || []) {
        addHint(childId, generation + 1, 'descendant');
        visitDescendantFamilies(childId, generation + 1, depth + 1);
      }
    }
  };
  visitDescendantFamilies(rootRecordName, 0, 1);

  // Expand-in-place: for each visible person the user has expanded, pull in any
  // of their families that aren't shown yet (partner + children one level down).
  // addFamily also seeds the partner/children hints, so the new members appear
  // attached to the expanded person.
  const expandPersonInPlace = (personId) => {
    const generation = nodeHints.get(personId)?.generation ?? 0;
    // Own (hidden) families: partner + children one generation down (down-pin).
    for (const family of familyById.values()) {
      const manId = refToRecordName(family.fields?.man?.value);
      const womanId = refToRecordName(family.fields?.woman?.value);
      if (manId !== personId && womanId !== personId) continue;
      if (familyIds.has(family.recordName)) continue;
      addFamily(family.recordName, generation + 1, 'descendant');
    }
    // Hidden parent families: parents one generation up (up-pin).
    for (const familyId of parentFamiliesByChild.get(personId) || []) {
      if (familyIds.has(familyId)) continue;
      addFamily(familyId, generation, 'ancestor', null, personId);
    }
  };
  for (const personId of expandedIds) {
    if (personIds.has(personId)) expandPersonInPlace(personId);
  }

  const publicPeople = [...personIds].map((personId) => personById.get(personId)).filter(Boolean);
  const publicPersonIds = new Set(publicPeople.map((person) => person.recordName));

  const nodes = publicPeople.map((person) => {
    const hint = nodeHints.get(person.recordName) || { generation: 0, roles: new Set(['relative']) };
    const parentFamilyIds = parentFamiliesByChild.get(person.recordName) || [];
    const childFamilyIds = [...familyById.values()]
      .filter((family) => (
        refToRecordName(family.fields?.man?.value) === person.recordName
        || refToRecordName(family.fields?.woman?.value) === person.recordName
      ))
      .map((family) => family.recordName);
    const hiddenParentFamilies = parentFamilyIds.filter((familyId) => !familyIds.has(familyId) && familyById.has(familyId));
    const hiddenChildFamilies = childFamilyIds.filter((familyId) => !familyIds.has(familyId) && familyById.has(familyId));
    return {
      id: person.recordName,
      person: personSummary(person),
      generation: hint.generation,
      roles: [...hint.roles],
      branches: [...(hint.branches || [])],
      more: {
        parents: hiddenParentFamilies.length,
        families: hiddenChildFamilies.length,
        relatives: hiddenParentFamilies.length + hiddenChildFamilies.length,
      },
      status: {
        familySearch: Boolean(readField(person, ['familySearchID', 'familySearchId'])),
        influential: influentialPersonIds.has(person.recordName),
        duplicateRisk: duplicateSets.high.has(person.recordName)
          ? 'High'
          : duplicateSets.medium.has(person.recordName)
            ? 'Medium'
            : 'Low',
      },
      featured: person.recordName === rootRecordName,
      groups: groupsByPerson.get(person.recordName) || [],
    };
  });

  const families = [...familyIds]
    .map((familyId) => familyById.get(familyId))
    .filter(Boolean)
    .map((family) => {
      const manId = refToRecordName(family.fields?.man?.value);
      const womanId = refToRecordName(family.fields?.woman?.value);
      const children = (childrenByFamily.get(family.recordName) || []).filter((childId) => publicPersonIds.has(childId));
      return {
        id: family.recordName,
        parents: [manId, womanId].filter((id) => id && publicPersonIds.has(id)),
        children,
        childRelations: Object.fromEntries(children.map((childId) => {
          const relation = childRelationByFamilyChild.get(`${family.recordName}:${childId}`);
          return [childId, {
            kind: childRelationKind(relation),
            label: childRelationLabel(relation),
          }];
        })),
        branch: family.recordName === rootFamilyId ? 'root' : familyHints.get(family.recordName)?.branch || 'collateral',
        generation: family.recordName === rootFamilyId ? 0 : familyHints.get(family.recordName)?.generation ?? 0,
        preferredChildId: family.recordName === rootFamilyId ? rootRecordName : familyHints.get(family.recordName)?.preferredChildId || null,
      };
    })
    .filter((family) => family.parents.length > 0 || family.children.length > 0);

  return { rootId: rootRecordName, rootFamilyId, nodes, families };
}

function buildInteractiveDuplicateSets(persons) {
  const byName = new Map();
  const byNameBirth = new Map();
  for (const person of persons) {
    const summary = personSummary(person);
    const name = normalizeInteractiveName(summary?.fullName);
    if (!name) continue;
    pushDuplicateGroup(byName, name, person.recordName);
    const birthYear = extractDuplicateYear(summary?.birthDate);
    if (birthYear) pushDuplicateGroup(byNameBirth, `${name}|${birthYear}`, person.recordName);
  }
  return {
    high: idsFromDuplicateGroups(byNameBirth),
    medium: idsFromDuplicateGroups(byName),
  };
}

function normalizeInteractiveName(value) {
  return String(value || '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function pushDuplicateGroup(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function idsFromDuplicateGroups(groups) {
  const ids = new Set();
  for (const group of groups.values()) {
    if (group.length > 1) group.forEach((id) => ids.add(id));
  }
  return ids;
}

function extractDuplicateYear(value) {
  const match = String(value || '').match(/\b([12]\d{3}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

/**
 * Flat list of all persons (for picker UIs). Sorted by full name.
 */
export async function listAllPersons({ includePrivate = false } = {}) {
  const db = getLocalDatabase();
  const [{ records }, { records: families }, { records: childRelations }] = await Promise.all([
    db.query('Person', { limit: 100000 }),
    db.query('Family', { limit: 100000 }),
    db.query('ChildRelation', { limit: 100000 }),
  ]);
  const lineage = buildPersonLineage(records, families, childRelations);
  const persons = records
    .filter((record) => includePrivate || isPublicRecord(record))
    .map(personSummary)
    .filter(Boolean);
  return attachLineageToPersonSummaries(persons, lineage)
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

/**
 * Pick the root that best matches SunTree's original behavior: the oldest
 * ancestor/root person with the largest descendant tree.
 */
export async function findLargestDescendantRoot() {
  const db = getLocalDatabase();
  const [{ records: personRecords }, { records: familyRecords }, { records: childRelationRecords }] = await Promise.all([
    db.query('Person', { limit: 100000 }),
    db.query('Family', { limit: 100000 }),
    db.query('ChildRelation', { limit: 100000 }),
  ]);
  const people = personRecords.filter(isPublicRecord);
  if (!people.length) return null;

  const publicPersonIds = new Set(people.map((person) => person.recordName));
  const familyById = new Map(familyRecords.filter(isPublicRecord).map((family) => [family.recordName, family]));
  const parentFamiliesByChild = new Map();
  const childFamiliesByParent = new Map();

  for (const family of familyById.values()) {
    const manId = refToRecordName(family.fields?.man?.value);
    const womanId = refToRecordName(family.fields?.woman?.value);
    for (const parentId of [manId, womanId]) {
      if (!parentId || !publicPersonIds.has(parentId)) continue;
      if (!childFamiliesByParent.has(parentId)) childFamiliesByParent.set(parentId, []);
      childFamiliesByParent.get(parentId).push(family.recordName);
    }
  }

  const childrenByFamily = new Map();
  for (const relation of childRelationRecords) {
    const familyId = refToRecordName(relation.fields?.family?.value);
    const childId = refToRecordName(relation.fields?.child?.value);
    if (!familyId || !childId || !familyById.has(familyId) || !publicPersonIds.has(childId)) continue;
    if (!childrenByFamily.has(familyId)) childrenByFamily.set(familyId, []);
    childrenByFamily.get(familyId).push(childId);
    if (!parentFamiliesByChild.has(childId)) parentFamiliesByChild.set(childId, []);
    parentFamiliesByChild.get(childId).push(familyId);
  }

  const rootCandidates = people.filter((person) => !(parentFamiliesByChild.get(person.recordName) || []).length);
  const candidates = rootCandidates.length ? rootCandidates : people;
  const scoreCache = new Map();

  function descendantCount(personId, seen = new Set()) {
    if (!personId || seen.has(personId)) return 0;
    if (scoreCache.has(personId)) return scoreCache.get(personId);
    seen.add(personId);
    let total = 1;
    for (const familyId of childFamiliesByParent.get(personId) || []) {
      for (const childId of childrenByFamily.get(familyId) || []) {
        total += descendantCount(childId, seen);
      }
    }
    seen.delete(personId);
    scoreCache.set(personId, total);
    return total;
  }

  let best = candidates[0];
  let bestScore = descendantCount(best.recordName);
  for (const candidate of candidates.slice(1)) {
    const score = descendantCount(candidate.recordName);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return personSummary(best);
}
