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

  const buckets = new Map();
  const increment = (key) => {
    if (!key) return;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  };

  const type = normalized.distributionType;
  const factField = FACT_FIELD_BY_TYPE[type];

  if (factField) {
    for (const fact of facts) {
      const factType = readField(fact, ['factType', 'type']);
      if (factType && String(factType).toLowerCase() !== factField.toLowerCase()) continue;
      const value = readField(fact, ['value', 'text', 'name']);
      increment(value || 'Unknown');
    }
  } else if (type === 'birthPlace' || type === 'birthCountry') {
    for (const person of persons) increment(bucketKeyForPerson(person, type, placeIndex));
  } else if (type === 'deathPlace' || type === 'deathCountry') {
    for (const person of persons) increment(bucketKeyForPerson(person, type, placeIndex));
  } else {
    for (const person of persons) increment(bucketKeyForPerson(person, type, placeIndex));
  }

  const total = [...buckets.values()].reduce((sum, n) => sum + n, 0) || 1;
  const items = [...buckets.entries()]
    .filter(([, count]) => count >= normalized.minBucketSize)
    .map(([label, count]) => ({
      label,
      count,
      fraction: count / total,
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
