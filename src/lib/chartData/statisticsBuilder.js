import { computeRichStatistics, loadGenealogyMetricRecords } from '../genealogyMetrics.js';

export function normalizeStatisticsConfig(raw = {}) {
  return {
    includeGender: raw.includeGender !== false,
    includeCenturies: raw.includeCenturies !== false,
    includeSurnames: raw.includeSurnames !== false,
    includeLifespan: raw.includeLifespan !== false,
    includePlaces: raw.includePlaces !== false,
    includeMissingData: raw.includeMissingData !== false,
    includeRichMetrics: raw.includeRichMetrics !== false,
    topSurnames: Number.isFinite(raw.topSurnames) ? raw.topSurnames : 20,
  };
}

export async function buildStatisticsData(config = {}) {
  const normalized = normalizeStatisticsConfig(config);
  const records = await loadGenealogyMetricRecords();
  const rich = computeRichStatistics(records);

  return {
    config: normalized,
    totals: {
      persons: rich.totals.persons,
      places: rich.totals.places,
      families: rich.totals.families,
      withDeath: rich.totals.withDeath,
      probablyLiving: rich.totals.probablyLiving,
      remarriagePersons: rich.totals.remarriagePersons,
    },
    gender: normalized.includeGender ? rich.genderCounts : null,
    birthsByCentury: normalized.includeCenturies ? rich.birthsByCentury : null,
    deathsByCentury: normalized.includeCenturies ? rich.deathsByCentury : null,
    surnames: normalized.includeSurnames ? rich.topSurnames.slice(0, normalized.topSurnames) : null,
    countries: normalized.includePlaces ? rich.countriesByCount : null,
    lifespan: normalized.includeLifespan ? rich.lifespan : null,
    missingData: normalized.includeMissingData ? rich.missingData : null,
    completeness: normalized.includeMissingData ? rich.completeness : null,
    rich: normalized.includeRichMetrics
      ? {
          topFirstNamesBySex: rich.topFirstNamesBySex,
          topOccupations: rich.topOccupations,
          birthPlaces: rich.birthPlaces,
          deathPlaces: rich.deathPlaces,
          marriagePlaces: rich.marriagePlaces,
          childrenPerFamily: rich.childrenPerFamily,
          ageAtMarriage: rich.ageAtMarriage,
          parentChildAgeGaps: rich.parentChildAgeGaps,
          marriageMonths: rich.marriageMonths,
          marriageWeekdays: rich.marriageWeekdays,
          relationKinds: rich.relationKinds,
        }
      : null,
  };
}
