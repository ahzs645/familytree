/**
 * Duplicate detection for Person, Family, and Source records.
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

const PERSON_THRESHOLD = 0.85;
const SOURCE_THRESHOLD = 0.85;
const MIN_FIELD_SIM = 0.7;

function normalize(s) {
  return (s || '').toString().toLowerCase().trim().replace(/\s+/g, ' ');
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

function scorePersonPair(a, b) {
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

  // Corroboration requirement: similar names alone aren't enough — family trees
  // are full of same-named relatives. We need EITHER exact name match OR
  // matching birth year to flag as a duplicate candidate.
  const ay = yearOf(af.cached_birthDate?.value);
  const by = yearOf(bf.cached_birthDate?.value);
  const sameYear = ay != null && by != null && Math.abs(ay - by) <= 1;
  const identicalNames = firstSim >= 0.98 && lastSim >= 0.98;
  // Same name alone isn't enough — family trees have many cousins/siblings sharing names.
  // Require matching birth year as corroboration.
  if (!sameYear) return { score: 0, reasons: [] };

  const reasons = [];
  if (identicalNames) reasons.push('Identical names');
  else reasons.push('Similar names');
  if (sameYear) reasons.push(ay === by ? 'Same birth year' : 'Birth years within 1');

  const score = 0.45 * firstSim + 0.45 * lastSim + (sameYear ? 0.15 : 0) + (identicalNames ? 0.05 : 0);
  return { score: Math.max(0, Math.min(1, score)), reasons };
}

export async function findDuplicatePersons(threshold = PERSON_THRESHOLD) {
  const db = getLocalDatabase();
  const { records } = await db.query('Person', { limit: 100000 });
  // Block by soundex of last name
  const blocks = new Map();
  for (const r of records) {
    const key = soundexKey(r.fields?.lastName?.value || '');
    if (!blocks.has(key)) blocks.set(key, []);
    blocks.get(key).push(r);
  }
  const pairs = [];
  for (const group of blocks.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const { score, reasons } = scorePersonPair(group[i], group[j]);
        if (score >= threshold) {
          pairs.push({ a: group[i], b: group[j], score, reasons });
        }
      }
    }
  }
  pairs.sort((x, y) => y.score - x.score);
  return pairs;
}

export async function findDuplicateFamilies() {
  const db = getLocalDatabase();
  const { records } = await db.query('Family', { limit: 100000 });
  const byPair = new Map();
  for (const r of records) {
    const m = r.fields?.man?.value?.recordName || '';
    const w = r.fields?.woman?.value?.recordName || '';
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
  return pairs;
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
  return pairs;
}

/**
 * Merge record `source` into `target`: for each field missing on target,
 * copy from source; then delete source. Does NOT rewire references (caller
 * should handle relinking ChildRelations / Family refs etc. if needed).
 */
export async function mergeRecords(targetName, sourceName) {
  const db = getLocalDatabase();
  const target = await db.getRecord(targetName);
  const source = await db.getRecord(sourceName);
  if (!target || !source) throw new Error('Record not found for merge');
  const merged = { ...target, fields: { ...source.fields, ...target.fields } };
  await db.saveRecord(merged);
  await db.deleteRecord(sourceName);
  return merged;
}
