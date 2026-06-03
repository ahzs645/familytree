/**
 * Find kinship paths between two persons over the Family graph.
 * Each step is either "parent" (up), "child" (down), or "spouse" (sideways).
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { isPublicRecord } from './privacy.js';
import { personSummary } from '../models/index.js';
import { evidenceStateForRecord, loadResearchCompleteness } from './researchCompleteness.js';
import { getCurrentLocalization, languageCode } from './i18n.js';
import { Gender } from '../models/constants.js';
import { isPrimaryChildRelation } from './childRelationshipTypes.js';
import { refToRecordName } from './recordRef.js';

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
    localization = getCurrentLocalization(),
  } = options;
  const db = getLocalDatabase();
  const [start, end, analysis] = await Promise.all([
    db.getRecord(startRecordName),
    db.getRecord(endRecordName),
    typeof db.query === 'function' ? loadResearchCompleteness() : Promise.resolve(null),
  ]);
  if (!isPublicRecord(start) || !isPublicRecord(end)) return { paths: [], selectedPathId: null };
  if (startRecordName === endRecordName) {
    const path = hydratePath([{ recordName: startRecordName, edgeFromPrev: 'self' }], new Map([[startRecordName, start]]), analysis, localization);
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
    for (const { neighbor, edge, record, evidenceRecordName } of neighbors) {
      if (!neighbor || visitedInPath.has(neighbor)) continue;
      if (record) recordCache.set(neighbor, record);
      const nextPath = [...path, { recordName: neighbor, edgeFromPrev: edge, evidenceRecordName }];
      if (neighbor === endRecordName) {
        const hydrated = hydratePath(nextPath, recordCache, analysis, localization);
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

export async function buildRelationshipMatrix(personIds = [], options = {}) {
  const {
    maxPeople = 10,
    maxDepth = 8,
    bloodlineOnly = false,
    localization = getCurrentLocalization(),
  } = options;
  const ids = [...new Set((personIds || []).filter(Boolean))].slice(0, maxPeople);
  const db = getLocalDatabase();
  const people = new Map();
  for (const id of ids) {
    const record = await db.getRecord(id);
    if (isPublicRecord(record)) people.set(id, personSummary(record));
  }
  const visibleIds = ids.filter((id) => people.has(id));
  const rows = visibleIds.map((id) => ({ id, person: people.get(id), cells: [] }));
  for (const row of rows) {
    for (const columnId of visibleIds) {
      if (row.id === columnId) {
        row.cells.push({ from: row.id, to: columnId, label: 'Self', distance: 0, pathId: null, path: null });
        continue;
      }
      const result = await findRelationshipPaths(row.id, columnId, {
        maxPaths: 1,
        maxDepth,
        bloodlineOnly,
        localization,
      });
      const path = result.paths[0] || null;
      row.cells.push({
        from: row.id,
        to: columnId,
        label: path?.label || 'No path',
        distance: path ? Math.max(0, path.steps.length - 1) : null,
        pathId: path?.id || null,
        path,
      });
    }
  }
  return {
    people: visibleIds.map((id) => ({ id, person: people.get(id) })),
    rows,
    truncated: (personIds || []).length > visibleIds.length,
  };
}

export async function computeKinshipCoefficient(recordA, recordB, options = {}) {
  const {
    maxGenerations = 8,
    includePrivate = false,
  } = options;
  if (!recordA || !recordB) return null;
  const db = getLocalDatabase();
  const [personA, personB, familiesResult, relationsResult, personsResult] = await Promise.all([
    db.getRecord(recordA),
    db.getRecord(recordB),
    db.query('Family', { limit: 100000 }),
    db.query('ChildRelation', { limit: 100000 }),
    db.query('Person', { limit: 100000 }),
  ]);
  if (!includePrivate && (!isPublicRecord(personA) || !isPublicRecord(personB))) return null;
  const personsById = new Map((personsResult.records || []).filter((person) => includePrivate || isPublicRecord(person)).map((person) => [person.recordName, person]));
  const familiesById = new Map((familiesResult.records || []).filter((family) => includePrivate || isPublicRecord(family)).map((family) => [family.recordName, family]));
  const parentFamiliesByChild = new Map();
  for (const relation of relationsResult.records || []) {
    const childId = refToRecordName(relation.fields?.child?.value);
    const familyId = refToRecordName(relation.fields?.family?.value);
    if (!childId || !familyId || !familiesById.has(familyId)) continue;
    if (!parentFamiliesByChild.has(childId)) parentFamiliesByChild.set(childId, []);
    parentFamiliesByChild.get(childId).push(familyId);
  }
  const ancestorsA = collectAncestorDistances(recordA, { personsById, familiesById, parentFamiliesByChild }, maxGenerations);
  const ancestorsB = collectAncestorDistances(recordB, { personsById, familiesById, parentFamiliesByChild }, maxGenerations);
  const contributions = [];
  let relationshipCoefficient = 0;
  let kinshipCoefficient = 0;
  for (const [ancestorId, pathsA] of ancestorsA.entries()) {
    const pathsB = ancestorsB.get(ancestorId);
    if (!pathsB) continue;
    for (const pathA of pathsA) {
      for (const pathB of pathsB) {
        const meioses = pathA.distance + pathB.distance;
        const relationship = Math.pow(0.5, meioses);
        const kinship = Math.pow(0.5, meioses + 1);
        relationshipCoefficient += relationship;
        kinshipCoefficient += kinship;
        contributions.push({
          ancestorId,
          ancestor: personSummary(personsById.get(ancestorId)),
          distanceA: pathA.distance,
          distanceB: pathB.distance,
          pathA: pathA.path,
          pathB: pathB.path,
          relationship,
          kinship,
        });
      }
    }
  }
  contributions.sort((a, b) => b.relationship - a.relationship || String(a.ancestorId).localeCompare(String(b.ancestorId)));
  return {
    personA: personSummary(personA),
    personB: personSummary(personB),
    relationshipCoefficient,
    kinshipCoefficient,
    contributions,
    truncated: contributions.some((entry) => entry.distanceA >= maxGenerations || entry.distanceB >= maxGenerations),
  };
}

async function getNeighbors(db, recordName, options = {}) {
  const { includeSpouses = true, excludeNonBiological = false } = options;
  const out = [];
  const seen = new Set();
  const push = (record, edge, evidenceRecordName) => {
    if (!isPublicRecord(record) || seen.has(record.recordName)) return;
    seen.add(record.recordName);
    out.push({ neighbor: record.recordName, edge, record, evidenceRecordName });
  };

  // Parents (up)
  const parents = await db.getPersonsParents(recordName);
  for (const fam of parents) {
    if (!isPublicRecord(fam.family)) continue;
    if (excludeNonBiological && !isBiologicalChildLink(fam)) continue;
    push(fam.man, 'parent', fam.family?.recordName);
    push(fam.woman, 'parent', fam.family?.recordName);
  }
  // Children + spouses (down + sideways)
  const families = await db.getPersonsChildrenInformation(recordName);
  for (const fam of families) {
    if (!isPublicRecord(fam.family)) continue;
    if (includeSpouses) push(fam.partner, 'spouse', fam.family?.recordName);
    const relationByChild = new Map((fam.childRelations || []).map(({ child, relation }) => [child?.recordName, relation]));
    for (const child of fam.children) {
      if (excludeNonBiological && !isPrimaryChildRelation(relationByChild.get(child.recordName))) continue;
      push(child, 'child', fam.family?.recordName);
    }
  }
  return out;
}

// Treat a parent relation as biological unless it explicitly marks itself as
// adopted/step/foster. Real-world ChildRelation records frequently omit the
// type for simple biological cases, so absence ≈ biological.
function isBiologicalChildLink(fam) {
  return isPrimaryChildRelation(fam?.childRelation || fam?.relation || fam);
}

function collectAncestorDistances(rootId, indexes, maxGenerations) {
  const out = new Map();
  const visit = (personId, distance, path, seen) => {
    if (!personId || distance > maxGenerations || seen.has(personId)) return;
    if (!out.has(personId)) out.set(personId, []);
    out.get(personId).push({ distance, path });
    const nextSeen = new Set([...seen, personId]);
    for (const familyId of indexes.parentFamiliesByChild.get(personId) || []) {
      const family = indexes.familiesById.get(familyId);
      const fatherId = refToRecordName(family?.fields?.man?.value);
      const motherId = refToRecordName(family?.fields?.woman?.value);
      if (fatherId && indexes.personsById.has(fatherId)) visit(fatherId, distance + 1, `${path}F`, nextSeen);
      if (motherId && indexes.personsById.has(motherId)) visit(motherId, distance + 1, `${path}M`, nextSeen);
    }
  };
  visit(rootId, 0, '', new Set());
  return out;
}

function hydratePath(steps, recordCache, analysis, localization = getCurrentLocalization()) {
  const hydratedSteps = steps.map((step) => {
    const record = recordCache.get(step.recordName);
    return {
      ...step,
      person: record ? personSummary(record) : null,
      evidence: step.evidenceRecordName ? evidenceStateForRecord(step.evidenceRecordName, analysis) : null,
    };
  });
  const edgeCounts = countEdges(hydratedSteps);
  const id = hydratedSteps.map((step) => `${step.edgeFromPrev || 'start'}:${step.recordName}`).join('|');
  return {
    id,
    steps: hydratedSteps,
    label: relationshipLabel(hydratedSteps, localization),
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
export function relationshipLabel(steps, localization = getCurrentLocalization()) {
  const locale = typeof localization === 'string' ? localization : localization?.locale;
  const lang = languageCode(locale || 'en');
  if (lang === 'ar') return arabicRelationshipLabel(steps);
  if (lang === 'vi') return vietnameseRelationshipLabel(steps);
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
  if (ups >= 2 && downs >= 2) return englishCousinLabel(ups, downs);
  return `Relative (${ups}↑ / ${downs}↓${spouses ? ` / ${spouses} spouse` : ''})`;
}

function englishCousinLabel(ups, downs) {
  const degree = Math.min(ups, downs) - 1;
  const removed = Math.abs(ups - downs);
  const base = `${ordinal(degree)} Cousin`;
  if (!removed) return base;
  if (removed === 1) return `${base} Once Removed`;
  if (removed === 2) return `${base} Twice Removed`;
  return `${base} ${removed} Times Removed`;
}

function vietnameseRelationshipLabel(steps) {
  if (!steps || steps.length === 0) return '';
  if (steps.length === 1) return 'Cùng một người';
  let ups = 0;
  let downs = 0;
  let spouses = 0;
  for (let i = 1; i < steps.length; i++) {
    const e = steps[i].edgeFromPrev;
    if (e === 'parent') ups++;
    else if (e === 'child') downs++;
    else if (e === 'spouse') spouses++;
  }
  const target = steps[steps.length - 1]?.person;
  const targetIsFemale = target?.gender === Gender.Female || target?.gender === 'female';
  const targetIsMale = target?.gender === Gender.Male || target?.gender === 'male';
  const gendered = (male, female, unknown) => (targetIsFemale ? female : targetIsMale ? male : unknown);
  if (spouses === 1 && ups === 0 && downs === 0) return gendered('chồng', 'vợ', 'vợ/chồng');
  if (ups === 1 && downs === 0) return gendered('cha', 'mẹ', 'cha/mẹ');
  if (ups === 0 && downs === 1) return gendered('con trai', 'con gái', 'con');
  if (ups === 1 && downs === 1) return gendered('anh/em trai', 'chị/em gái', 'anh/chị/em');
  if (ups === 2 && downs === 0) return gendered('ông', 'bà', 'ông/bà');
  if (ups === 0 && downs === 2) return gendered('cháu trai', 'cháu gái', 'cháu');
  if (ups === 2 && downs === 1) return vietnameseUncleAuntLabel(steps, targetIsFemale, targetIsMale);
  if (ups === 1 && downs === 2) return gendered('cháu trai', 'cháu gái', 'cháu');
  if (ups >= 2 && downs >= 2) return vietnameseCousinLabel(ups, downs);
  return `Họ hàng (${ups}↑ / ${downs}↓${spouses ? ` / ${spouses} hôn phối` : ''})`;
}

function vietnameseUncleAuntLabel(steps, targetIsFemale, targetIsMale) {
  const connector = steps[1]?.person;
  const paternal = connector?.gender === Gender.Male || connector?.gender === 'male';
  if (paternal) {
    if (targetIsFemale) return 'cô';
    if (targetIsMale) return 'chú/bác';
    return 'cô/chú/bác';
  }
  if (targetIsFemale) return 'dì';
  if (targetIsMale) return 'cậu';
  return 'cậu/dì';
}

function vietnameseCousinLabel(ups, downs) {
  const degree = Math.min(ups, downs) - 1;
  const removed = Math.abs(ups - downs);
  if (degree <= 1 && removed === 0) return 'anh/chị/em họ';
  if (!removed) return `anh/chị/em họ bậc ${degree}`;
  return `anh/chị/em họ bậc ${degree} (${removed} đời lệch)`;
}

function arabicRelationshipLabel(steps) {
  if (!steps || steps.length === 0) return '';
  if (steps.length === 1) return 'نفس الشخص';
  let ups = 0;
  let downs = 0;
  let spouses = 0;
  for (let i = 1; i < steps.length; i++) {
    const e = steps[i].edgeFromPrev;
    if (e === 'parent') ups++;
    else if (e === 'child') downs++;
    else if (e === 'spouse') spouses++;
  }
  const target = steps[steps.length - 1]?.person;
  const targetIsFemale = target?.gender === Gender.Female || target?.gender === 'female';
  const gendered = (male, female) => (targetIsFemale ? female : male);
  if (spouses === 1 && ups === 0 && downs === 0) return gendered('زوج', 'زوجة');
  if (ups === 1 && downs === 0) return gendered('أب', 'أم');
  if (ups === 0 && downs === 1) return gendered('ابن', 'ابنة');
  if (ups === 1 && downs === 1) return gendered('أخ', 'أخت');
  if (ups === 2 && downs === 0) return gendered('جد', 'جدة');
  if (ups === 0 && downs === 2) return gendered('حفيد', 'حفيدة');
  if (ups === 2 && downs === 1) return uncleAuntLabel(steps, targetIsFemale);
  if (ups === 1 && downs === 2) return nephewNieceLabel(steps, targetIsFemale);
  if (ups >= 2 && downs >= 2) return cousinLabel(steps, ups, downs, targetIsFemale);
  return `قريب (${ups}↑ / ${downs}↓${spouses ? ` / ${spouses} زواج` : ''})`;
}

function uncleAuntLabel(steps, targetIsFemale) {
  const connector = steps[1]?.person;
  const paternal = connector?.gender === Gender.Male || connector?.gender === 'male';
  if (paternal) return targetIsFemale ? 'عمة' : 'عم';
  return targetIsFemale ? 'خالة' : 'خال';
}

function nephewNieceLabel(steps, targetIsFemale) {
  const sibling = steps[2]?.person;
  const siblingMale = sibling?.gender === Gender.Male || sibling?.gender === 'male';
  if (targetIsFemale) return siblingMale ? 'ابنة أخ' : 'ابنة أخت';
  return siblingMale ? 'ابن أخ' : 'ابن أخت';
}

function cousinLabel(steps, ups, downs, targetIsFemale) {
  const startBranch = steps[ups - 1]?.person;
  const targetBranch = steps[steps.length - 2]?.person;
  const paternal = startBranch?.gender === Gender.Male || startBranch?.gender === 'male';
  const branchMale = targetBranch?.gender === Gender.Male || targetBranch?.gender === 'male';
  const side = paternal ? (branchMale ? 'عم' : 'عمة') : (branchMale ? 'خال' : 'خالة');
  const base = targetIsFemale ? `ابنة ${side}` : `ابن ${side}`;
  const degree = Math.min(ups, downs) - 1;
  const removed = Math.abs(ups - downs);
  if (degree <= 1 && removed === 0) return base;
  const degreeText = degree === 2 ? 'الدرجة الثانية' : degree === 3 ? 'الدرجة الثالثة' : `الدرجة ${degree}`;
  if (!removed) return `${base} من ${degreeText}`;
  return `${base} من ${degreeText} (${removed} جيل فارق)`;
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
