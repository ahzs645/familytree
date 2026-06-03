import { computeRichStatistics, loadGenealogyMetricRecords } from './genealogyMetrics.js';

export async function computeStatistics() {
  const records = await loadGenealogyMetricRecords();
  const rich = computeRichStatistics(records);
  return {
    counts: {
      Person: rich.totals.persons,
      Family: rich.totals.families,
      Place: rich.totals.places,
    },
    persons: rich.totals.persons,
    genderCounts: rich.genderCounts,
    birthsByCentury: rich.birthsByCentury.map((row) => [row.century, row.count]),
    deathsByCentury: rich.deathsByCentury.map((row) => [row.century, row.count]),
    topSurnames: rich.topSurnames.map((row) => [row.name, row.count]),
    avgLifespan: rich.lifespan.averageYears == null ? null : Math.round(rich.lifespan.averageYears),
    lifespanSampleSize: rich.lifespan.sampleSize,
    withDeath: rich.totals.withDeath,
    probablyLiving: rich.totals.probablyLiving,
    noBirthDate: rich.missingData.noBirthDate,
    noDeathDate: rich.missingData.noDeathDate,
    noPhoto: rich.missingData.noPhoto,
    countriesByCount: rich.countriesByCount.map((row) => [row.name, row.count]),
    rich,
  };
}
