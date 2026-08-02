import { computeRichStatistics, loadGenealogyMetricRecords } from './genealogyMetrics.js';
import { Gender, familySummary, personSummary, placeSummary } from '../models/index.js';
import { readField, readRef } from './schema.js';

export async function computeStatistics(inputRecords = null) {
  const records = inputRecords || await loadGenealogyMetricRecords();
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

/** Return the exact records represented by a Statistics route bucket. */
export function statisticsDrilldown(records, criterion) {
  if (!records || !criterion) return [];
  let source = [];
  if (criterion.kind === 'count') {
    const key = { Person: 'persons', Family: 'families', Place: 'places' }[criterion.recordType];
    source = key ? records[key] || [] : [];
  }
  else if (criterion.kind === 'placeCountry') source = (records.places || []).filter((place) => placeCountry(place) === criterion.value);
  else if (criterion.kind === 'childrenPerFamily') source = (records.families || []).filter((family) => (records.childrenByFamily?.get(family.recordName) || []).length === Number(criterion.value));
  else if (criterion.kind === 'occupation') source = recordsForOccupation(records, criterion.value);
  else if (criterion.kind === 'ageAtMarriage') source = recordsForMarriageAge(records, criterion.value);
  else if (criterion.kind === 'marriageMonth') source = recordsForMarriageMonth(records, criterion.value);
  else source = (records.persons || []).filter((person) => matchesPersonCriterion(person, criterion));
  return source.map((record) => ({
    id: record.recordName,
    recordType: record.recordType,
    label: record.recordType === 'Person'
      ? personSummary(record)?.fullName || record.recordName
      : record.recordType === 'Family'
        ? familySummary(record)?.familyName || record.recordName
        : placeSummary(record)?.displayName || placeSummary(record)?.name || record.recordName,
  })).sort((a, b) => a.label.localeCompare(b.label));
}

function matchesPersonCriterion(person, criterion) {
  const birthYear = metricYear(readField(person, ['cached_birthDate', 'birthDate']));
  const deathYear = metricYear(readField(person, ['cached_deathDate', 'deathDate']));
  switch (criterion.kind) {
    case 'allPersons': return true;
    case 'gender': return genderBucket(person.fields?.gender?.value) === criterion.value;
    case 'birthCentury': return birthYear != null && Math.floor(birthYear / 100) + 1 === Number(criterion.value);
    case 'deathCentury': return deathYear != null && Math.floor(deathYear / 100) + 1 === Number(criterion.value);
    case 'surname': return String(readField(person, ['lastName', 'surname'], '')).trim() === String(criterion.value);
    case 'withDeath': return deathYear != null;
    case 'probablyLiving': return deathYear == null && birthYear != null && new Date().getFullYear() - birthYear < 110;
    case 'noBirthDate': return birthYear == null;
    case 'noDeathDate': return deathYear == null;
    case 'noPhoto': return !person.fields?.thumbnailFileIdentifier?.value;
    default: return false;
  }
}

function recordsForOccupation(records, value) {
  const personIds = new Set();
  for (const record of [...(records.facts || []), ...(records.personEvents || [])]) {
    const type = String(readField(record, ['factType', 'conclusionType', 'eventType', 'type'], '')).toLowerCase();
    const label = String(readField(record, ['value', 'description', 'title'], '')).trim();
    if (type.includes('occupation') && label === String(value)) {
      const personId = readRef(record.fields?.person);
      if (personId) personIds.add(personId);
    }
  }
  return (records.persons || []).filter((person) => personIds.has(person.recordName));
}

function recordsForMarriageAge(records, label) {
  const [minimum, maximum] = String(label || '').split('-').map(Number);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return [];
  const people = new Map((records.persons || []).map((person) => [person.recordName, person]));
  const matches = new Set();
  for (const family of records.families || []) {
    const marriageYear = metricYear(readField(family, ['cached_marriageDate', 'marriageDate']));
    if (marriageYear == null) continue;
    for (const personId of [readRef(family.fields?.man), readRef(family.fields?.woman)]) {
      const birthYear = metricYear(readField(people.get(personId), ['cached_birthDate', 'birthDate']));
      const age = birthYear == null ? null : marriageYear - birthYear;
      if (age != null && age >= minimum && age <= maximum) matches.add(personId);
    }
  }
  return (records.persons || []).filter((person) => matches.has(person.recordName));
}

function recordsForMarriageMonth(records, month) {
  const matchingFamilies = new Set();
  for (const family of records.families || []) {
    if (dateMonthName(readField(family, ['cached_marriageDate', 'marriageDate'])) === month) matchingFamilies.add(family.recordName);
  }
  for (const event of records.familyEvents || []) {
    const type = String(readField(event, ['conclusionType', 'eventType', 'type'], '')).toLowerCase();
    if (type.includes('marriage') && dateMonthName(readField(event, ['date', 'cached_date'])) === month) {
      const familyId = readRef(event.fields?.family);
      if (familyId) matchingFamilies.add(familyId);
    }
  }
  return (records.families || []).filter((family) => matchingFamilies.has(family.recordName));
}

function dateMonthName(value) {
  const raw = String(value || '');
  const match = raw.match(/\d{4}[-/](\d{1,2})[-/]\d{1,2}|\d{1,2}[-/]([A-Za-z]{3,}|\d{1,2})[-/]\d{4}/);
  if (!match) return '';
  const rawMonth = match[1] || match[2];
  const numeric = Number(rawMonth);
  const index = Number.isInteger(numeric) ? numeric - 1 : ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(String(rawMonth).slice(0, 3).toLowerCase());
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][index] || '';
}

function metricYear(value) {
  const match = String(value || '').match(/-?\d{1,4}/);
  return match ? Number.parseInt(match[0], 10) : null;
}

function genderBucket(gender) {
  if (gender === Gender.Male) return 'male';
  if (gender === Gender.Female) return 'female';
  if (gender === Gender.Intersex) return 'intersex';
  return 'unknown';
}

function placeCountry(place) {
  const direct = readField(place, ['country'], '');
  if (direct) return String(direct).trim();
  const value = readField(place, ['cached_normallocationString', 'cached_normalLocationString', 'cached_standardizedLocationString', 'placeName'], '');
  return String(value).split(',').map((part) => part.trim()).filter(Boolean).at(-1) || '';
}
