/**
 * Distribution chart data builder.
 *
 * Mac reference: DistributionChartBuilder, DistributionChartBuilderItem,
 * DistributionChartBuilderItemValueRange. Aggregates persons / events / facts
 * into serializable distribution items (each with optional value ranges).
 */

import {
  getAllPersons,
  getAllPersonEvents,
  getAllPersonFacts,
  loadPlaceIndex,
  parseYear,
  readBirthYear,
  readDeathYear,
  readEventYear,
  readEventType,
  readEventPlaceRef,
  readPlaceName,
} from './recordQueries.js';
import { readField, readRef } from '../schema.js';
import { Gender } from '../../models/index.js';

// Ordered list of every distribution type the builder can compute, with a
// friendly label that mirrors the Mac _DistributionChartBuilder_Type_* names.
// Exported so the chart options UI can offer a Distribution Type selector
// without re-deriving the labels.
export const DISTRIBUTION_TYPES = [
  { id: 'lastName', label: 'Last Names' },
  { id: 'firstName', label: 'First Names' },
  { id: 'birthPlace', label: 'Birth Places' },
  { id: 'birthCountry', label: 'Birth Countries' },
  { id: 'deathPlace', label: 'Death Places' },
  { id: 'deathCountry', label: 'Death Countries' },
  { id: 'gender', label: 'Genders' },
  { id: 'birthCentury', label: 'Birth Centuries' },
  { id: 'deathCentury', label: 'Death Centuries' },
  { id: 'occupation', label: 'Occupations' },
  { id: 'illness', label: 'Illnesses' },
  { id: 'eyeColor', label: 'Eye Colors' },
  { id: 'race', label: 'Races' },
  { id: 'skinColor', label: 'Skin Colors' },
  { id: 'caste', label: 'Caste Names' },
  { id: 'nationalOrigin', label: 'National Origins' },
];

export const SUPPORTED_TYPES = new Set(DISTRIBUTION_TYPES.map((type) => type.id));

const FACT_FIELD_BY_TYPE = {
  occupation: 'occupation',
  illness: 'illness',
  eyeColor: 'eyeColor',
  nationalOrigin: 'nationalOrigin',
  race: 'race',
  skinColor: 'skinColor',
  caste: 'caste',
};

export function normalizeDistributionConfig(raw = {}) {
  return {
    distributionType: SUPPORTED_TYPES.has(raw.distributionType) ? raw.distributionType : 'gender',
    relativeValues: Boolean(raw.relativeValues),
    graphType: raw.graphType === 'line' ? 'line' : 'bar',
    showValueLabels: raw.showValueLabels !== false,
    minBucketSize: Number.isFinite(raw.minBucketSize) ? raw.minBucketSize : 0,
    fromYear: Number.isFinite(raw.fromYear) ? Number(raw.fromYear) : null,
    toYear: Number.isFinite(raw.toYear) ? Number(raw.toYear) : null,
  };
}

// A person passes the date-range filter when at least one of their birth/death
// years falls inside the (optional) from/to bounds. When both bounds are unset
// every person is included.
function withinDateRange(birth, death, fromYear, toYear) {
  if (fromYear == null && toYear == null) return true;
  const years = [birth, death].filter((year) => Number.isFinite(year));
  if (!years.length) return false;
  return years.some((year) => {
    if (fromYear != null && year < fromYear) return false;
    if (toYear != null && year > toYear) return false;
    return true;
  });
}

function bucketKeyForPerson(person, type, placeIndex) {
  if (type === 'gender') {
    const g = person?.fields?.gender?.value;
    if (g === Gender.Male) return 'Male';
    if (g === Gender.Female) return 'Female';
    if (g === Gender.Intersex) return 'Intersex';
    return 'Unknown';
  }
  if (type === 'firstName') return readField(person, ['firstName']) || 'Unknown';
  if (type === 'lastName') return readField(person, ['lastName']) || 'Unknown';
  if (type === 'birthCentury') {
    const y = readBirthYear(person);
    return y == null ? 'Unknown' : `${Math.floor(y / 100) + 1}th century`;
  }
  if (type === 'deathCentury') {
    const y = readDeathYear(person);
    return y == null ? 'Unknown' : `${Math.floor(y / 100) + 1}th century`;
  }
  if (type === 'birthPlace' || type === 'deathPlace' || type === 'birthCountry' || type === 'deathCountry') {
    const field = type.startsWith('birth') ? 'birthPlace' : 'deathPlace';
    const ref = readRef(person?.fields?.[field]?.value ?? person?.fields?.[field]);
    const place = ref ? placeIndex.get(ref) : null;
    const name = readPlaceName(place);
    if (!name) return 'Unknown';
    if (type === 'birthCountry' || type === 'deathCountry') {
      const parts = String(name).split(',').map((s) => s.trim()).filter(Boolean);
      return parts[parts.length - 1] || name;
    }
    return name;
  }
  return null;
}

export async function buildDistributionData(config = {}) {
  const normalized = normalizeDistributionConfig(config);
  const [persons, placeIndex, events, facts] = await Promise.all([
    getAllPersons(),
    loadPlaceIndex(),
    getAllPersonEvents(),
    getAllPersonFacts(),
  ]);

  // Each bucket accumulates count + a min/max year range derived from the
  // contributing persons, so renderers that want a ribbon-style timeline
  // visualization (like the web DistributionChart) can draw per-category
  // bars without re-scanning the records.
  const buckets = new Map();
  const increment = (key, { birth, death } = {}) => {
    if (!key) return;
    const existing = buckets.get(key) || { count: 0, min: Infinity, max: -Infinity };
    existing.count += 1;
    if (Number.isFinite(birth)) {
      if (birth < existing.min) existing.min = birth;
      if (birth > existing.max) existing.max = birth;
    }
    if (Number.isFinite(death)) {
      if (death < existing.min) existing.min = death;
      if (death > existing.max) existing.max = death;
    }
    buckets.set(key, existing);
  };

  const type = normalized.distributionType;
  const factField = FACT_FIELD_BY_TYPE[type];
  const { fromYear, toYear } = normalized;
  const personById = new Map();
  for (const person of persons) {
    if (person?.recordName) personById.set(person.recordName, person);
  }

  if (factField) {
    for (const fact of facts) {
      const factType = readField(fact, ['factType', 'type']);
      if (factType && String(factType).toLowerCase() !== factField.toLowerCase()) continue;
      const value = readField(fact, ['value', 'text', 'name']) || 'Unknown';
      const personRef = fact?.fields?.person?.value;
      const person = personRef && typeof personRef === 'string'
        ? personById.get(personRef.split('---')[0])
        : null;
      const birth = person ? readBirthYear(person) : null;
      const death = person ? readDeathYear(person) : null;
      if (!withinDateRange(birth, death, fromYear, toYear)) continue;
      increment(value, { birth, death });
    }
  } else {
    for (const person of persons) {
      const key = bucketKeyForPerson(person, type, placeIndex);
      const birth = readBirthYear(person);
      const death = readDeathYear(person);
      if (!withinDateRange(birth, death, fromYear, toYear)) continue;
      increment(key, { birth, death });
    }
  }

  const total = [...buckets.values()].reduce((sum, b) => sum + b.count, 0) || 1;
  const items = [...buckets.entries()]
    .filter(([, bucket]) => bucket.count >= normalized.minBucketSize)
    .map(([label, bucket]) => ({
      label,
      count: bucket.count,
      fraction: bucket.count / total,
      minYear: Number.isFinite(bucket.min) ? bucket.min : null,
      maxYear: Number.isFinite(bucket.max) ? bucket.max : null,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    config: normalized,
    total,
    items,
    valueRanges: computeValueRanges(items, normalized),
  };
}

function computeValueRanges(items, config) {
  if (!items.length) return [];
  const counts = items.map((item) => item.count);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  return [{ min, max, bucketCount: items.length, relative: config.relativeValues }];
}
