/**
 * Duplicate detection for Person, Family, Source, and Place records.
 *
 * Approach:
 * - Person: block by soundex-ish key of lastName, then score pairs by name + date similarity.
 * - Family: block by pair-of-partner recordNames; duplicates are families with same partners.
 * - Source: block by first 6 chars of title, then score by Levenshtein-ratio of title.
 *
 * Each candidate is { a, b, score, reasons[] } with score in [0..1].
 * Pairs with score >= threshold are returned.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { refToRecordName } from './recordRef.js';
import { planReferenceRewrite, countReferencesTo } from './referenceGraph.js';

const PERSON_THRESHOLD = 0.85;
const SOURCE_THRESHOLD = 0.85;
const PLACE_THRESHOLD = 0.86;
const MIN_FIELD_SIM = 0.7;
const SKIPPED_DUPLICATE_PAIRS_META = 'duplicateSkippedPairs';

function normalize(s) {
  return (s || '').toString().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function soundexKey(s) {
  const n = normalize(s);
  if (!n) return '';
  const first = n[0];
  const tail = n
    .slice(1)
    .replace(/[hw]/g, '')
    .replace(/[bfpv]/g, '1')
    .replace(/[cgjkqsxz]/g, '2')
    .replace(/[dt]/g, '3')
    .replace(/l/g, '4')
    .replace(/[mn]/g, '5')
    .replace(/r/g, '6')
    .replace(/[aeiouy]/g, '');
  let prev = '';
  let out = '';
  for (const ch of tail) {
    if (ch !== prev) out += ch;
    prev = ch;
  }
  return (first + out).slice(0, 4).padEnd(4, '0');
}

function levenshtein(a, b) {
  a = normalize(a);
  b = normalize(b);
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function similarity(a, b) {
  a = normalize(a);
  b = normalize(b);
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const d = levenshtein(a, b);
  const m = Math.max(a.length, b.length);
  return 1 - d / m;
}

function yearOf(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

function scorePersonPair(a, b, context = buildDuplicateContext([a, b])) {
  const af = a.fields || {};
  const bf = b.fields || {};
  const firstSim = similarity(af.firstName?.value, bf.firstName?.value);
  const lastSim = similarity(af.lastName?.value, bf.lastName?.value);

  // Hard gates: both first and last name must be highly similar, and gender
  // must match if both are known. Without these gates a family tree produces
  // noise (hundreds of siblings sharing a surname).
  if (firstSim < MIN_FIELD_SIM || lastSim < MIN_FIELD_SIM) {
    return { score: 0, reasons: [] };
  }
  const ag = af.gender?.value;
  const bg = bf.gender?.value;
  if (ag != null && bg != null && ag !== 0 && bg !== 0 && ag !== bg) {
    return { score: 0, reasons: [] };
  }
  if (isAncestorPair(a.recordName, b.recordName, context)) {
    return { score: 0, reasons: ['Ancestor/descendant pair excluded'] };
  }

  // Corroboration requirement: similar names alone aren't enough — family trees
  // are full of same-named relatives. We need EITHER exact name match OR
  // matching birth year to flag as a duplicate candidate.
  const ay = yearOf(af.cached_birthDate?.value);
  const by = yearOf(bf.cached_birthDate?.value);
  const ady = yearOf(af.cached_deathDate?.value);
  const bdy = yearOf(bf.cached_deathDate?.value);
  const sameYear = ay != null && by != null && Math.abs(ay - by) <= 1;
  const sameDeathYear = ady != null && bdy != null && Math.abs(ady - bdy) <= 1;
  const identicalNames = firstSim >= 0.98 && lastSim >= 0.98;
  const birthPlaceSim = eventPlaceSimilarity(a.recordName, b.recordName, 'Birth', context);
  const deathPlaceSim = eventPlaceSimilarity(a.recordName, b.recordName, 'Death', context);
  const parentSim = parentNameSimilarity(a.recordName, b.recordName, context);
  const spouseSim = spouseNameSimilarity(a.recordName, b.recordName, context);

  const corroborated = sameYear || sameDeathYear || birthPlaceSim >= 0.9 || deathPlaceSim >= 0.9 || parentSim >= 0.9 || spouseSim >= 0.9;
  if (!corroborated) return { score: 0, reasons: [] };

  const reasons = [];
  if (identicalNames) reasons.push('Identical names');
  else reasons.push('Similar names');
  if (sameYear) reasons.push(ay === by ? 'Same birth year' : 'Birth years within 1');
  if (sameDeathYear) reasons.push(ady === bdy ? 'Same death year' : 'Death years within 1');
  if (birthPlaceSim >= 0.9) reasons.push('Same birth place');
  else if (birthPlaceSim >= 0.75) reasons.push('Similar birth place');
  if (deathPlaceSim >= 0.9) reasons.push('Same death place');
  if (parentSim >= 0.9) reasons.push('Matching parent names');
  if (spouseSim >= 0.9) reasons.push('Matching spouse names');

  const score = (
    0.34 * firstSim +
    0.34 * lastSim +
    (sameYear ? 0.13 : 0) +
    (sameDeathYear ? 0.05 : 0) +
    (Math.max(birthPlaceSim, deathPlaceSim) * 0.06) +
    (parentSim * 0.05) +
    (spouseSim * 0.04) +
    (identicalNames ? 0.04 : 0)
  );
  return { score: Math.max(0, Math.min(1, score)), reasons };
}

export function findDuplicatePersonCandidates(records = [], threshold = PERSON_THRESHOLD) {
  const persons = records.filter((record) => record.recordType === 'Person');
  const context = buildDuplicateContext(records);
  const blocks = new Map();
  for (const r of persons) {
    const key = soundexKey(r.fields?.lastName?.value || '');
    if (!blocks.has(key)) blocks.set(key, []);
    blocks.get(key).push(r);
  }
  const pairs = [];
  for (const group of blocks.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const { score, reasons } = scorePersonPair(group[i], group[j], context);
        if (score >= threshold) pairs.push({ a: group[i], b: group[j], score, reasons });
      }
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}

export async function findDuplicatePersons(threshold = PERSON_THRESHOLD) {
  const db = getLocalDatabase();
  const all = typeof db.getAllRecords === 'function'
    ? await db.getAllRecords()
    : (await db.query('Person', { limit: 100000 })).records;
  return filterSkippedDuplicatePairs('Person', findDuplicatePersonCandidates(all, threshold));
}

function buildDuplicateContext(records = []) {
  const people = new Map(records.filter((record) => record.recordType === 'Person').map((record) => [record.recordName, record]));
  const places = new Map(records.filter((record) => record.recordType === 'Place').map((record) => [record.recordName, record]));
  const eventsByPerson = new Map();
  for (const event of records.filter((record) => record.recordType === 'PersonEvent')) {
    const personId = refToRecordName(event.fields?.person?.value);
    if (!personId) continue;
    if (!eventsByPerson.has(personId)) eventsByPerson.set(personId, []);
    eventsByPerson.get(personId).push(event);
  }
  const families = records.filter((record) => record.recordType === 'Family');
  const childRelations = records.filter((record) => record.recordType === 'ChildRelation');
  const familyById = new Map(families.map((family) => [family.recordName, family]));
  const parentsByChild = new Map();
  const spousesByPerson = new Map();
  const childrenByParent = new Map();
  const push = (map, key, value) => {
    if (!key || !value) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };
  for (const family of families) {
    const man = refToRecordName(family.fields?.man?.value);
    const woman = refToRecordName(family.fields?.woman?.value);
    push(spousesByPerson, man, woman);
    push(spousesByPerson, woman, man);
  }
  for (const relation of childRelations) {
    const family = familyById.get(refToRecordName(relation.fields?.family?.value));
    const childId = refToRecordName(relation.fields?.child?.value);
    const man = refToRecordName(family?.fields?.man?.value);
    const woman = refToRecordName(family?.fields?.woman?.value);
    push(parentsByChild, childId, man);
    push(parentsByChild, childId, woman);
    push(childrenByParent, man, childId);
    push(childrenByParent, woman, childId);
  }
  return { people, places, eventsByPerson, parentsByChild, spousesByPerson, childrenByParent };
}

function eventPlaceSimilarity(aId, bId, eventType, context) {
  const left = (context.eventsByPerson.get(aId) || []).filter((event) => eventConclusionType(event) === eventType);
  const right = (context.eventsByPerson.get(bId) || []).filter((event) => eventConclusionType(event) === eventType);
  let best = 0;
  for (const a of left) {
    for (const b of right) {
      best = Math.max(best, similarity(eventPlaceText(a, context), eventPlaceText(b, context)));
    }
  }
  return best;
}

function eventConclusionType(event) {
  return event?.fields?.conclusionType?.value || event?.fields?.eventType?.value || '';
}

function eventPlaceText(event, context) {
  const placeId = refToRecordName(event?.fields?.place?.value);
  const place = placeId ? context.places.get(placeId) : null;
  return event?.fields?.placeName?.value ||
    place?.fields?.placeName?.value ||
    place?.fields?.cached_normallocationString?.value ||
    place?.fields?.cached_normalLocationString?.value ||
    '';
}

function parentNameSimilarity(aId, bId, context) {
  return relatedNameSimilarity(context.parentsByChild.get(aId), context.parentsByChild.get(bId), context);
}

function spouseNameSimilarity(aId, bId, context) {
  return relatedNameSimilarity(context.spousesByPerson.get(aId), context.spousesByPerson.get(bId), context);
}

function relatedNameSimilarity(leftIds = [], rightIds = [], context) {
  let best = 0;
  for (const leftId of leftIds || []) {
    for (const rightId of rightIds || []) {
      const left = context.people.get(leftId);
      const right = context.people.get(rightId);
      if (!left || !right) continue;
      const first = similarity(left.fields?.firstName?.value, right.fields?.firstName?.value);
      const last = similarity(left.fields?.lastName?.value, right.fields?.lastName?.value);
      best = Math.max(best, (first + last) / 2);
    }
  }
  return best;
}

function isAncestorPair(aId, bId, context) {
  return isAncestorOf(aId, bId, context) || isAncestorOf(bId, aId, context);
}

function isAncestorOf(ancestorId, descendantId, context, seen = new Set()) {
  if (!ancestorId || !descendantId || seen.has(ancestorId)) return false;
  seen.add(ancestorId);
  for (const childId of context.childrenByParent.get(ancestorId) || []) {
    if (childId === descendantId || isAncestorOf(childId, descendantId, context, seen)) return true;
  }
  return false;
}

export async function findDuplicateFamilies() {
  const db = getLocalDatabase();
  const { records } = await db.query('Family', { limit: 100000 });
  const byPair = new Map();
  for (const r of records) {
    const m = refToRecordName(r.fields?.man?.value) || '';
    const w = refToRecordName(r.fields?.woman?.value) || '';
    if (!m && !w) continue;
    const key = [m, w].sort().join('|');
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key).push(r);
  }
  const pairs = [];
  for (const group of byPair.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        pairs.push({
          a: group[i],
          b: group[j],
          score: 1,
          reasons: ['Same partners'],
        });
      }
    }
  }
  return filterSkippedDuplicatePairs('Family', pairs);
}

export async function findDuplicateSources(threshold = SOURCE_THRESHOLD) {
  const db = getLocalDatabase();
  const { records } = await db.query('Source', { limit: 100000 });
  const blocks = new Map();
  for (const r of records) {
    const title = normalize(r.fields?.title?.value || '');
    const key = title.slice(0, 6);
    if (!key) continue;
    if (!blocks.has(key)) blocks.set(key, []);
    blocks.get(key).push(r);
  }
  const pairs = [];
  for (const group of blocks.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const titleSim = similarity(group[i].fields?.title?.value, group[j].fields?.title?.value);
        const authorSim = similarity(group[i].fields?.author?.value, group[j].fields?.author?.value);
        const score = 0.7 * titleSim + 0.3 * authorSim;
        if (score >= threshold) {
          const reasons = [];
          if (titleSim > 0.85) reasons.push('Similar title');
          if (authorSim > 0.85) reasons.push('Similar author');
          pairs.push({ a: group[i], b: group[j], score, reasons });
        }
      }
    }
  }
  pairs.sort((x, y) => y.score - x.score);
  return filterSkippedDuplicatePairs('Source', pairs);
}

function readPlaceDisplayName(record) {
  const fields = record?.fields || {};
  return (
    fields.placeName?.value ||
    fields.cached_normallocationString?.value ||
    fields.cached_normalizedLocationString?.value ||
    fields.cached_standardizedLocationString?.value ||
    fields.name?.value ||
    fields.title?.value ||
    ''
  );
}

function findDuplicatePlaceCandidates(records = [], threshold = PLACE_THRESHOLD) {
  const places = records.filter((record) => record.recordType === 'Place');
  const blocks = new Map();
  for (const place of places) {
    const name = readPlaceDisplayName(place);
    const block = normalize(name).slice(0, 6);
    if (!block) continue;
    if (!blocks.has(block)) blocks.set(block, []);
    blocks.get(block).push(place);
  }
  const pairs = [];
  for (const group of blocks.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const score = similarity(readPlaceDisplayName(a), readPlaceDisplayName(b));
        if (score >= threshold) {
          const reasons = [];
          if (score >= 0.97) reasons.push('Nearly identical names');
          else reasons.push('Similar names');
          pairs.push({ a, b, score, reasons });
        }
      }
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}

export async function findDuplicatePlaces(threshold = PLACE_THRESHOLD) {
  const db = getLocalDatabase();
  const { records } = await db.query('Place', { limit: 100000 });
  return filterSkippedDuplicatePairs('Place', findDuplicatePlaceCandidates(records, threshold));
}

export function duplicatePairKey(kind, a, b) {
  const left = typeof a === 'string' ? a : a?.recordName;
  const right = typeof b === 'string' ? b : b?.recordName;
  return [kind || a?.recordType || b?.recordType || 'Record', ...[left, right].filter(Boolean).sort()].join(':');
}

export async function getSkippedDuplicatePairs(kind = null) {
  const stored = await getLocalDatabase().getMeta(SKIPPED_DUPLICATE_PAIRS_META);
  const list = Array.isArray(stored) ? stored : [];
  return kind ? list.filter((entry) => entry.kind === kind) : list;
}

export async function skipDuplicatePair(kind, a, b) {
  const db = getLocalDatabase();
  const list = await getSkippedDuplicatePairs();
  const key = duplicatePairKey(kind, a, b);
  if (list.some((entry) => entry.key === key)) return list;
  const next = [
    ...list,
    {
      key,
      kind,
      recordNames: [a?.recordName || a, b?.recordName || b].filter(Boolean).sort(),
      skippedAt: new Date().toISOString(),
    },
  ];
  await db.setMeta(SKIPPED_DUPLICATE_PAIRS_META, next);
  return next;
}

export async function clearSkippedDuplicatePairs(kind = null) {
  const db = getLocalDatabase();
  if (!kind) {
    await db.setMeta(SKIPPED_DUPLICATE_PAIRS_META, []);
    return [];
  }
  const next = (await getSkippedDuplicatePairs()).filter((entry) => entry.kind !== kind);
  await db.setMeta(SKIPPED_DUPLICATE_PAIRS_META, next);
  return next;
}

async function filterSkippedDuplicatePairs(kind, pairs) {
  const skippedKeys = new Set((await getSkippedDuplicatePairs(kind)).map((entry) => entry.key));
  if (!skippedKeys.size) return pairs;
  return pairs.filter((pair) => !skippedKeys.has(duplicatePairKey(kind, pair.a, pair.b)));
}

/**
 * Merge record `source` into `target`: for each field missing on target,
 * copy from source; then delete source. Does NOT rewire references (caller
 * should handle relinking ChildRelations / Family refs etc. if needed).
 */
export async function mergeRecords(targetName, sourceName) {
  return mergeRecordsSafely(targetName, sourceName);
}

export async function previewMergeRecords(targetName, sourceName) {
  const db = getLocalDatabase();
  const all = await db.getAllRecords();
  const source = all.find((r) => r.recordName === sourceName);
  if (!source) throw new Error('Record not found for merge preview');
  const rewrite = planReferenceRewrite(all, sourceName, targetName, source.recordType);
  const counts = countReferencesTo(all, sourceName);
  return {
    rewrittenReferenceCount: rewrite.rewrittenReferenceCount,
    dedupedRelationCount: rewrite.dedupedRelationCount,
    preservedRecordCount: rewrite.preservedRecordCount,
    deletedRecordNames: [sourceName, ...rewrite.deleteRecordNames],
    recordsWithReferences: counts.recordsWithReferences,
    warnings: [],
  };
}

export async function mergeRecordsSafely(targetName, sourceName, options = {}) {
  const db = getLocalDatabase();
  const all = await db.getAllRecords();
  const target = all.find((r) => r.recordName === targetName);
  const source = all.find((r) => r.recordName === sourceName);
  if (!target || !source) throw new Error('Record not found for merge');
  if (target.recordType !== source.recordType) throw new Error('Cannot merge different record types');

  const mergedRecord = {
    ...target,
    fields: options.mergedFields ? { ...options.mergedFields } : { ...source.fields, ...target.fields },
  };
  const rewrite = planReferenceRewrite(all, sourceName, targetName, target.recordType);
  const sourceAssets = await db.listAssetsForRecord(sourceName);
  const movedAssets = sourceAssets.map((asset) => ({ ...asset, ownerRecordName: targetName }));
  const saveByName = new Map(rewrite.saveRecords.map((r) => [r.recordName, r]));
  saveByName.set(mergedRecord.recordName, mergedRecord);
  const deleteRecordNames = [sourceName, ...rewrite.deleteRecordNames.filter((name) => name !== targetName)];

  await db.applyRecordTransaction({
    saveRecords: [...saveByName.values()],
    deleteRecordNames,
    saveAssets: movedAssets,
  });

  return {
    mergedRecord,
    rewrittenReferenceCount: rewrite.rewrittenReferenceCount,
    dedupedRelationCount: rewrite.dedupedRelationCount,
    preservedRecordCount: rewrite.preservedRecordCount,
    deletedRecordNames,
    warnings: [],
  };
}
