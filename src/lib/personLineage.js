import { Gender, NO_NAME, personSummary } from '../models/index.js';
import { compareStrings, matchesSearchText, normalizeSearchText } from './i18n.js';
import { readRef } from './schema.js';

export function buildPersonLineage(records = [], families = [], childRelations = []) {
  const people = records.filter((record) => record?.recordType === 'Person');
  const familyRows = families.filter((record) => record?.recordType === 'Family');
  const childRows = childRelations.filter((record) => record?.recordType === 'ChildRelation');
  const peopleById = new Map(people.map((person) => [person.recordName, person]));
  const familyById = new Map(familyRows.map((family) => [family.recordName, family]));
  const parentFamilyByChild = new Map();

  for (const relation of childRows) {
    const childId = readRef(relation.fields?.child);
    const familyId = readRef(relation.fields?.family);
    if (childId && familyId && !parentFamilyByChild.has(childId)) parentFamilyByChild.set(childId, familyId);
  }

  const parentIdsFor = (personId) => {
    const family = familyById.get(parentFamilyByChild.get(personId));
    if (!family) return { fatherId: null, motherId: null };
    return {
      fatherId: readRef(family.fields?.man),
      motherId: readRef(family.fields?.woman),
    };
  };

  const fullName = (personId) => personSummary(peopleById.get(personId))?.fullName || '';
  const firstName = (personId) => {
    const summary = personSummary(peopleById.get(personId));
    if (summary?.firstName) return summary.firstName;
    // Fall back to the first token of the display name — but never the
    // "No name recorded" placeholder, which would otherwise leak the literal
    // word "No" into lineage chains and search text.
    const full = String(summary?.fullName || '').trim();
    if (!full || full === NO_NAME) return '';
    return full.split(/\s+/)[0] || '';
  };
  const gender = (personId) => personSummary(peopleById.get(personId))?.gender;

  const lineageById = new Map();
  for (const person of people) {
    const { fatherId, motherId } = parentIdsFor(person.recordName);
    const { fatherId: grandfatherId } = fatherId ? parentIdsFor(fatherId) : {};
    const arabicPatrilinealName = buildArabicPatrilinealName(person.recordName, { firstName, gender, parentIdsFor });
    const parts = [
      fullName(person.recordName),
      arabicPatrilinealName,
      firstName(fatherId),
      firstName(grandfatherId),
      firstName(motherId),
      personSummary(person)?.lastName || '',
    ].filter(Boolean);
    lineageById.set(person.recordName, {
      fatherId,
      motherId,
      grandfatherId: grandfatherId || null,
      arabicPatrilinealName,
      arabicPatrilinealTail: buildArabicPatrilinealTail(arabicPatrilinealName, firstName(person.recordName)),
      lineageSearchText: parts.join(' '),
    });
  }
  return lineageById;
}

export function buildArabicPatrilinealName(personId, helpers = {}) {
  const { firstName, gender, parentIdsFor, maxGenerations = 12 } = helpers;
  if (!personId || typeof firstName !== 'function' || typeof parentIdsFor !== 'function') return '';
  const ownName = firstName(personId);

  const parts = [];
  let currentId = personId;
  const seen = new Set([personId]);

  if (ownName) {
    parts.push(ownName);
  } else {
    // No given name recorded — open the chain with "son/daughter of <father>"
    // (ابن/بنت) so the person still reads as a real patrilineal identifier
    // instead of a bare "No name recorded" placeholder.
    const fatherId = parentIdsFor(personId)?.fatherId;
    if (!fatherId) return '';
    if (typeof gender === 'function' && gender(fatherId) != null && gender(fatherId) !== Gender.Male) return '';
    const fatherName = firstName(fatherId);
    if (!fatherName) return '';
    const ownGender = typeof gender === 'function' ? gender(personId) : null;
    parts.push(`${ownGender === Gender.Female ? 'بنت' : 'ابن'} ${fatherName}`);
    seen.add(fatherId);
    currentId = fatherId;
  }

  for (let depth = 0; depth < maxGenerations; depth += 1) {
    const fatherId = parentIdsFor(currentId)?.fatherId;
    if (!fatherId || seen.has(fatherId)) break;
    seen.add(fatherId);
    if (typeof gender === 'function' && gender(fatherId) != null && gender(fatherId) !== Gender.Male) break;
    const fatherName = firstName(fatherId);
    if (!fatherName) break;
    const currentGender = typeof gender === 'function' ? gender(currentId) : null;
    const relationWord = currentGender === Gender.Female ? 'بنت' : 'بن';
    parts.push(`${relationWord} ${fatherName}`);
    currentId = fatherId;
  }
  // A bare given name with no ancestors isn't a patrilineal name; but a
  // "son of <father>" lead already is, even without further generations.
  if (ownName) return parts.length > 1 ? parts.join(' ') : '';
  return parts.join(' ');
}

export function buildArabicPatrilinealTail(arabicPatrilinealName, ownName) {
  const name = String(arabicPatrilinealName || '').trim();
  const first = String(ownName || '').trim();
  if (!name || !first) return name;
  return name === first ? '' : name.startsWith(`${first} `) ? name.slice(first.length).trim() : name;
}

export function attachLineageToPersonSummaries(persons = [], lineageById = new Map()) {
  return persons.map((person) => ({
    ...person,
    ...(lineageById.get(person.recordName || person.id) || {}),
  }));
}

export function personSearchHaystack(person) {
  return [person?.fullName, person?.lineageSearchText, person?.firstName, person?.lastName]
    .filter(Boolean)
    .join(' ');
}

export function matchesPersonLineageSearch(person, query, localization) {
  if (!query?.trim()) return true;
  return matchesSearchText(personSearchHaystack(person), query, localization);
}

export function scorePersonLineageSearch(person, query, localization) {
  const words = normalizeSearchText(query, localization).split(/[^\p{L}\p{N}@_-]+/u).filter(Boolean);
  if (!words.length) return 0;
  const fields = [
    { value: person?.fullName, weight: 450 },
    { value: person?.firstName, weight: 500 },
    { value: person?.lineageSearchText, weight: 220 },
    { value: person?.lastName, weight: 120 },
  ].map((field) => ({ ...field, normalized: normalizeSearchText(field.value || '', localization) }));

  let score = 0;
  for (const word of words) {
    let best = 0;
    for (const field of fields) {
      if (!field.normalized) continue;
      if (field.normalized === word) best = Math.max(best, field.weight + 120);
      else if (field.normalized.startsWith(word)) best = Math.max(best, field.weight + 60);
      else if (field.normalized.includes(word)) best = Math.max(best, field.weight);
    }
    score += best;
  }

  const lineage = normalizeSearchText(person?.lineageSearchText || '', localization);
  const queryNorm = words.join(' ');
  if (lineage.startsWith(queryNorm)) score += 800;
  else if (lineage.includes(queryNorm)) score += 500;
  return score;
}

export function comparePersonSearchResults(a, b, query, localization) {
  const scoreDiff = scorePersonLineageSearch(b, query, localization) - scorePersonLineageSearch(a, query, localization);
  if (scoreDiff) return scoreDiff;
  const genderDiff = (a.gender === Gender.Male ? 0 : 1) - (b.gender === Gender.Male ? 0 : 1);
  return genderDiff || compareStrings(a.fullName, b.fullName, localization);
}
