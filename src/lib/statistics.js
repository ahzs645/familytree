/**
 * Compute aggregate statistics over the imported tree.
 * All counting happens in-memory — fine for trees up to a few thousand records.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { Gender } from '../models/index.js';

function parseYear(s) {
  if (s == null) return null;
  const m = String(s).match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

export async function computeStatistics() {
  const db = getLocalDatabase();
  const summary = await db.getSummary();
  const counts = summary?.types || {};

  const persons = (await db.query('Person', { limit: 100000 })).records;
  const places = (await db.query('Place', { limit: 100000 })).records;

  // Gender split
  const genderCounts = { male: 0, female: 0, unknown: 0, intersex: 0 };
  // Birth/death by century
  const birthsByCentury = new Map();
  const deathsByCentury = new Map();
  // Surnames
  const surnameCounts = new Map();
  // Lifespan
  let lifespanSum = 0;
  let lifespanN = 0;
  // Living/Deceased
  let withDeath = 0;
  let probablyLiving = 0;
  // Missing-data tally
  let noBirthDate = 0;
  let noDeathDate = 0;
  let noPhoto = 0;

  for (const p of persons) {
    const f = p.fields || {};
    const g = f.gender?.value;
    if (g === Gender.Male) genderCounts.male++;
    else if (g === Gender.Female) genderCounts.female++;
    else if (g === Gender.Intersex) genderCounts.intersex++;
    else genderCounts.unknown++;

    const surname = f.lastName?.value;
    if (surname) surnameCounts.set(surname, (surnameCounts.get(surname) || 0) + 1);

    const by = parseYear(f.cached_birthDate?.value);
    const dy = parseYear(f.cached_deathDate?.value);
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
      if (by != null && new Date().getFullYear() - by < 110) probablyLiving++;
    }

    if (!f.thumbnailFileIdentifier?.value) noPhoto++;
  }

  // Places by country (last component of cached_normallocationString)
  const countryCounts = new Map();
  for (const pl of places) {
    const f = pl.fields || {};
    const country = f.country?.value || (f.cached_normallocationString?.value || '').split(',').pop()?.trim();
    if (country) countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
  }

  return {
    counts,
    persons: persons.length,
    genderCounts,
    birthsByCentury: [...birthsByCentury.entries()].sort((a, b) => a[0] - b[0]),
    deathsByCentury: [...deathsByCentury.entries()].sort((a, b) => a[0] - b[0]),
    topSurnames: [...surnameCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
    avgLifespan: lifespanN > 0 ? Math.round(lifespanSum / lifespanN) : null,
    lifespanSampleSize: lifespanN,
    withDeath,
    probablyLiving,
    noBirthDate,
    noDeathDate,
    noPhoto,
    countriesByCount: [...countryCounts.entries()].sort((a, b) => b[1] - a[1]),
  };
}
