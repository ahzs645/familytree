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

const SUPPORTED_TYPES = new Set([
  'gender',
  'firstName',
  'lastName',
  'birthPlace',
  'deathPlace',
  'birthCountry',
  'deathCountry',
  'birthCentury',
  'deathCentury',
  'occupation',
  'illness',
  'eyeColor',
  'nationalOrigin',
  'race',
  'skinColor',
  'caste',
]);

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
  };
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
      increment(value, { birth, death });
    }
  } else {
    for (const person of persons) {
      const key = bucketKeyForPerson(person, type, placeIndex);
      const birth = readBirthYear(person);
      const death = readDeathYear(person);
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
