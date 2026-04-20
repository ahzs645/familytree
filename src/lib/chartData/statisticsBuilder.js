/**
 * Statistics chart data builder.
 *
 * Mac reference: the Statistics pane aggregates counts by gender, century,
 * surname, lifespan, missing-data rates, and country. Unlike the existing
 * `statistics.js` helper (which is called from the UI directly), this builder
 * produces a serializable document compatible with the schema V2 pipeline,
 * so saved chart documents can persist their statistics snapshot.
 */

import {
  getAllPersons,
  getAllPlaces,
  readBirthYear,
  readDeathYear,
} from './recordQueries.js';
import { readField } from '../schema.js';
import { Gender } from '../../models/index.js';

export function normalizeStatisticsConfig(raw = {}) {
  return {
    includeGender: raw.includeGender !== false,
    includeCenturies: raw.includeCenturies !== false,
    includeSurnames: raw.includeSurnames !== false,
    includeLifespan: raw.includeLifespan !== false,
    includePlaces: raw.includePlaces !== false,
    includeMissingData: raw.includeMissingData !== false,
    topSurnames: Number.isFinite(raw.topSurnames) ? raw.topSurnames : 20,
  };
}

export async function buildStatisticsData(config = {}) {
  const normalized = normalizeStatisticsConfig(config);
  const [persons, places] = await Promise.all([
    getAllPersons(),
    getAllPlaces(),
  ]);

  const genderCounts = { male: 0, female: 0, unknown: 0, intersex: 0 };
  const birthsByCentury = new Map();
  const deathsByCentury = new Map();
  const surnameCounts = new Map();
  let lifespanSum = 0;
  let lifespanN = 0;
  let withDeath = 0;
  let probablyLiving = 0;
  let noBirthDate = 0;
  let noDeathDate = 0;
  let noPhoto = 0;
  const thisYear = new Date().getFullYear();

  for (const person of persons) {
    const fields = person.fields || {};
    const g = fields.gender?.value;
    if (g === Gender.Male) genderCounts.male++;
    else if (g === Gender.Female) genderCounts.female++;
    else if (g === Gender.Intersex) genderCounts.intersex++;
    else genderCounts.unknown++;

    const surname = readField(person, ['lastName']);
    if (surname) surnameCounts.set(surname, (surnameCounts.get(surname) || 0) + 1);

    const by = readBirthYear(person);
    const dy = readDeathYear(person);
    if (by != null) {
      const c = Math.floor(by / 100) + 1;
      birthsByCentury.set(c, (birthsByCentury.get(c) || 0) + 1);
    } else {
      noBirthDate++;
    }
    if (dy != null) {
      withDeath++;
      const c = Math.floor(dy / 100) + 1;
      deathsByCentury.set(c, (deathsByCentury.get(c) || 0) + 1);
      if (by != null) {
        const span = dy - by;
        if (span > 0 && span < 130) {
          lifespanSum += span;
          lifespanN++;
        }
      }
    } else {
      noDeathDate++;
      if (by != null && thisYear - by < 110) probablyLiving++;
    }

    if (!fields.thumbnailFileIdentifier?.value) noPhoto++;
  }

  const countryCounts = new Map();
  if (normalized.includePlaces) {
    for (const place of places) {
      const name = readField(place, [
        'cached_normallocationString',
        'cached_normalLocationString',
        'cached_standardizedLocationString',
        'placeName',
      ]);
      if (!name) continue;
      const parts = String(name).split(',').map((s) => s.trim()).filter(Boolean);
      const country = parts[parts.length - 1];
      if (country) countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
    }
  }

  const sortedSurnames = [...surnameCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, normalized.topSurnames)
    .map(([name, count]) => ({ name, count }));

  const sortedCountries = [...countryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  const averageLifespan = lifespanN > 0 ? lifespanSum / lifespanN : null;

  return {
    config: normalized,
    totals: {
      persons: persons.length,
      places: places.length,
      withDeath,
      probablyLiving,
    },
    gender: normalized.includeGender ? genderCounts : null,
    birthsByCentury: normalized.includeCenturies
      ? [...birthsByCentury.entries()].map(([century, count]) => ({ century, count })).sort((a, b) => a.century - b.century)
      : null,
    deathsByCentury: normalized.includeCenturies
      ? [...deathsByCentury.entries()].map(([century, count]) => ({ century, count })).sort((a, b) => a.century - b.century)
      : null,
    surnames: normalized.includeSurnames ? sortedSurnames : null,
    countries: normalized.includePlaces ? sortedCountries : null,
    lifespan: normalized.includeLifespan
      ? { averageYears: averageLifespan, sampleSize: lifespanN }
      : null,
    missingData: normalized.includeMissingData
      ? { noBirthDate, noDeathDate, noPhoto }
      : null,
  };
}
