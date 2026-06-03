import { Gender } from '../models/index.js';
import { getLocalDatabase } from './LocalDatabase.js';
import { refToRecordName } from './recordRef.js';
import { readField } from './schema.js';
import { sosaGeneration, sosaRelation } from './sosa.js';

const DEFAULT_LIMIT = 100000;

export function parseMetricYear(value) {
  if (value == null) return null;
  const raw = typeof value === 'object' && 'value' in value ? value.value : value;
  const match = String(raw ?? '').match(/-?\d{1,4}/);
  if (!match) return null;
  const year = Number.parseInt(match[0], 10);
  return Number.isFinite(year) ? year : null;
}

export async function loadGenealogyMetricRecords(options = {}) {
  const db = getLocalDatabase();
  const query = (recordType) => db.query(recordType, { limit: DEFAULT_LIMIT }).then((r) => r.records || []);
  const [
    persons,
    families,
    childRelations,
    places,
    personEvents,
    familyEvents,
    facts,
  ] = await Promise.all([
    query('Person'),
    query('Family'),
    query('ChildRelation'),
    query('Place'),
    query('PersonEvent').catch(() => []),
    query('FamilyEvent').catch(() => []),
    query('PersonFact').catch(() => []),
  ]);
  return {
    persons,
    families,
    childRelations,
    places,
    personEvents,
    familyEvents,
    facts,
    ...(options.includeIndexes === false ? {} : buildGenealogyIndexes({ persons, families, childRelations, places, personEvents, familyEvents, facts })),
  };
}

export function buildGenealogyIndexes(records = {}) {
  const personsById = new Map((records.persons || []).map((person) => [person.recordName, person]));
  const familiesById = new Map((records.families || []).map((family) => [family.recordName, family]));
  const placesById = new Map((records.places || []).map((place) => [place.recordName, place]));
  const childrenByFamily = new Map();
  const parentFamiliesByChild = new Map();
  for (const relation of records.childRelations || []) {
    const familyId = refToRecordName(relation.fields?.family?.value);
    const childId = refToRecordName(relation.fields?.child?.value);
    if (!familyId || !childId) continue;
    if (!childrenByFamily.has(familyId)) childrenByFamily.set(familyId, []);
    childrenByFamily.get(familyId).push({ childId, relation });
    if (!parentFamiliesByChild.has(childId)) parentFamiliesByChild.set(childId, []);
    parentFamiliesByChild.get(childId).push({ familyId, relation });
  }
  return { personsById, familiesById, placesById, childrenByFamily, parentFamiliesByChild };
}

export function computeRichStatistics(records = {}) {
  const indexes = records.personsById ? records : { ...records, ...buildGenealogyIndexes(records) };
  const persons = records.persons || [];
  const families = records.families || [];
  const places = records.places || [];
  const personEvents = records.personEvents || [];
  const facts = records.facts || [];
  const thisYear = new Date().getFullYear();

  const genderCounts = { male: 0, female: 0, unknown: 0, intersex: 0 };
  const birthsByCentury = new Map();
  const deathsByCentury = new Map();
  const surnameCounts = new Map();
  const firstNameBySex = { male: new Map(), female: new Map(), unknown: new Map() };
  const occupationCounts = new Map();
  const birthPlaceCounts = new Map();
  const deathPlaceCounts = new Map();
  const marriagePlaceCounts = new Map();
  const countryCounts = new Map();
  const childrenPerFamily = new Map();
  const ageAtMarriage = [];
  const parentChildAgeGaps = [];
  const marriageMonthCounts = new Map();
  const marriageWeekdayCounts = new Map();
  const relationKindCounts = new Map();
  let lifespanSum = 0;
  let lifespanN = 0;
  let withDeath = 0;
  let probablyLiving = 0;
  let noBirthDate = 0;
  let noDeathDate = 0;
  let noPhoto = 0;
  let remarriagePersons = 0;
  let personsWithParents = 0;

  for (const person of persons) {
    const fields = person.fields || {};
    const genderKey = genderBucket(fields.gender?.value);
    genderCounts[genderKey]++;
    increment(firstNameBySex[genderKey], readField(person, ['firstName', 'cached_firstName']));
    increment(surnameCounts, readField(person, ['lastName', 'surname']));

    const by = personBirthYear(person);
    const dy = personDeathYear(person);
    if (by != null) increment(birthsByCentury, Math.floor(by / 100) + 1);
    else noBirthDate++;
    if (dy != null) {
      withDeath++;
      increment(deathsByCentury, Math.floor(dy / 100) + 1);
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
    if ((indexes.parentFamiliesByChild.get(person.recordName) || []).length) personsWithParents++;
  }

  for (const fact of facts) {
    const type = String(readField(fact, ['factType', 'conclusionType', 'type'], '')).toLowerCase();
    if (type.includes('occupation')) increment(occupationCounts, readField(fact, ['value', 'description', 'title']));
  }
  for (const event of personEvents) {
    const type = String(readField(event, ['conclusionType', 'eventType'], '')).toLowerCase();
    const place = eventPlaceLabel(event, records.placesById);
    if (type.includes('birth')) increment(birthPlaceCounts, place);
    if (type.includes('death')) increment(deathPlaceCounts, place);
    if (type.includes('occupation')) increment(occupationCounts, readField(event, ['description', 'value']));
  }

  const marriagesByPerson = new Map();
  for (const family of families) {
    const familyId = family.recordName;
    const children = indexes.childrenByFamily.get(familyId) || [];
    increment(childrenPerFamily, children.length);
    const manId = refToRecordName(family.fields?.man?.value);
    const womanId = refToRecordName(family.fields?.woman?.value);
    incrementPersonMarriage(marriagesByPerson, manId);
    incrementPersonMarriage(marriagesByPerson, womanId);
    const marriageYear = parseMetricYear(readField(family, ['cached_marriageDate', 'marriageDate']));
    const marriageDate = readField(family, ['cached_marriageDate', 'marriageDate']);
    const placeName = readField(family, ['cached_marriagePlace', 'marriagePlace', 'placeName']);
    increment(marriagePlaceCounts, placeName);
    incrementDateParts(marriageMonthCounts, marriageWeekdayCounts, marriageDate);
    if (marriageYear != null) {
      for (const spouseId of [manId, womanId]) {
        const spouse = indexes.personsById.get(spouseId);
        const birthYear = personBirthYear(spouse);
        if (birthYear != null) pushBounded(ageAtMarriage, marriageYear - birthYear, 12, 100);
      }
    }
    for (const { childId } of children) {
      const childBirth = personBirthYear(indexes.personsById.get(childId));
      if (childBirth == null) continue;
      for (const parentId of [manId, womanId]) {
        const parentBirth = personBirthYear(indexes.personsById.get(parentId));
        if (parentBirth != null) pushBounded(parentChildAgeGaps, childBirth - parentBirth, 10, 80);
      }
    }
  }
  for (const count of marriagesByPerson.values()) if (count > 1) remarriagePersons++;
  for (const familyEvent of records.familyEvents || []) {
    const type = String(readField(familyEvent, ['conclusionType', 'eventType'], '')).toLowerCase();
    if (type.includes('marriage')) {
      increment(marriagePlaceCounts, eventPlaceLabel(familyEvent, records.placesById));
      incrementDateParts(marriageMonthCounts, marriageWeekdayCounts, readField(familyEvent, ['date', 'cached_date']));
    }
  }

  for (const place of places) {
    const label = readField(place, ['country']) || splitLast(readField(place, ['cached_normallocationString', 'cached_normalLocationString', 'cached_standardizedLocationString', 'placeName']));
    increment(countryCounts, label);
  }
  for (const family of families) {
    const relation = readField(family, ['relation', 'relationshipType', 'familyType']);
    increment(relationKindCounts, relation || 'Family');
  }

  const completeness = {
    birthDate: percentage(persons.length - noBirthDate, persons.length),
    deathDate: percentage(persons.length - noDeathDate, persons.length),
    photo: percentage(persons.length - noPhoto, persons.length),
    parentFamily: percentage(personsWithParents, persons.length),
  };

  return {
    totals: {
      persons: persons.length,
      families: families.length,
      places: places.length,
      withDeath,
      probablyLiving,
      remarriagePersons,
    },
    genderCounts,
    birthsByCentury: sortedPairs(birthsByCentury, 'century'),
    deathsByCentury: sortedPairs(deathsByCentury, 'century'),
    topSurnames: topPairs(surnameCounts),
    topFirstNamesBySex: {
      male: topPairs(firstNameBySex.male),
      female: topPairs(firstNameBySex.female),
      unknown: topPairs(firstNameBySex.unknown),
    },
    topOccupations: topPairs(occupationCounts),
    countriesByCount: topPairs(countryCounts, 50),
    birthPlaces: topPairs(birthPlaceCounts, 30),
    deathPlaces: topPairs(deathPlaceCounts, 30),
    marriagePlaces: topPairs(marriagePlaceCounts, 30),
    childrenPerFamily: sortedPairs(childrenPerFamily, 'children'),
    ageAtMarriage: histogram(ageAtMarriage, 5),
    parentChildAgeGaps: histogram(parentChildAgeGaps, 5),
    marriageMonths: sortedPairs(marriageMonthCounts, 'month'),
    marriageWeekdays: sortedPairs(marriageWeekdayCounts, 'weekday'),
    relationKinds: topPairs(relationKindCounts),
    lifespan: { averageYears: lifespanN > 0 ? lifespanSum / lifespanN : null, sampleSize: lifespanN },
    missingData: { noBirthDate, noDeathDate, noPhoto },
    completeness,
  };
}

export function computeAncestorCompleteness(rootId, records = {}, options = {}) {
  const maxGenerations = Math.max(1, Number(options.maxGenerations) || 6);
  const indexes = records.personsById ? records : { ...records, ...buildGenealogyIndexes(records) };
  const rowsByGeneration = new Map();
  const pathsByPerson = new Map();
  const visit = (personId, sosa, generation, path, seen = new Set()) => {
    if (!personId || generation > maxGenerations) return;
    if (!rowsByGeneration.has(generation)) rowsByGeneration.set(generation, { generation, theoretical: 2 ** (generation - 1), known: 0, unique: new Set(), repeatedPaths: 0, minYear: null, maxYear: null });
    const row = rowsByGeneration.get(generation);
    row.known++;
    if (row.unique.has(personId)) row.repeatedPaths++;
    row.unique.add(personId);
    if (!pathsByPerson.has(personId)) pathsByPerson.set(personId, []);
    pathsByPerson.get(personId).push({ sosa, generation, path, relation: sosaRelation(sosa) });
    const birthYear = personBirthYear(indexes.personsById.get(personId));
    if (birthYear != null) {
      row.minYear = row.minYear == null ? birthYear : Math.min(row.minYear, birthYear);
      row.maxYear = row.maxYear == null ? birthYear : Math.max(row.maxYear, birthYear);
    }
    if (seen.has(personId)) return;
    const parentFamily = indexes.parentFamiliesByChild.get(personId)?.[0];
    const family = indexes.familiesById.get(parentFamily?.familyId);
    if (!family) return;
    const fatherId = refToRecordName(family.fields?.man?.value);
    const motherId = refToRecordName(family.fields?.woman?.value);
    visit(fatherId, sosa * 2, generation + 1, `${path}F`, new Set([...seen, personId]));
    visit(motherId, sosa * 2 + 1, generation + 1, `${path}M`, new Set([...seen, personId]));
  };
  visit(rootId, 1, 1, '');
  const generations = [];
  for (let generation = 1; generation <= maxGenerations; generation++) {
    const row = rowsByGeneration.get(generation) || { generation, theoretical: 2 ** (generation - 1), known: 0, unique: new Set(), repeatedPaths: 0, minYear: null, maxYear: null };
    generations.push({
      generation,
      theoretical: row.theoretical,
      known: row.known,
      unique: row.unique.size,
      missing: Math.max(0, row.theoretical - row.known),
      repeatedPaths: row.repeatedPaths,
      coverage: percentage(row.known, row.theoretical),
      uniqueCoverage: percentage(row.unique.size, row.theoretical),
      implex: row.known > 0 ? percentage(row.known - row.unique.size, row.known) : 0,
      minYear: row.minYear,
      maxYear: row.maxYear,
    });
  }
  return {
    rootId,
    generations,
    repeatedAncestors: [...pathsByPerson.entries()]
      .filter(([, paths]) => paths.length > 1)
      .map(([personId, paths]) => ({ personId, paths }))
      .sort((a, b) => b.paths.length - a.paths.length),
  };
}

function personBirthYear(person) {
  return parseMetricYear(readField(person, ['cached_birthDate', 'birthDate']));
}

function personDeathYear(person) {
  return parseMetricYear(readField(person, ['cached_deathDate', 'deathDate']));
}

function genderBucket(gender) {
  if (gender === Gender.Male) return 'male';
  if (gender === Gender.Female) return 'female';
  if (gender === Gender.Intersex) return 'intersex';
  return 'unknown';
}

function eventPlaceLabel(event, placesById) {
  const direct = readField(event, ['placeName', 'cached_placeName', 'place']);
  if (direct && typeof direct === 'string' && !direct.includes('recordName')) return direct;
  const placeId = refToRecordName(event?.fields?.place?.value);
  const place = placesById?.get(placeId);
  return readField(place, ['cached_normallocationString', 'cached_normalLocationString', 'cached_standardizedLocationString', 'placeName']);
}

function increment(map, key, by = 1) {
  const label = String(key || '').trim();
  if (!label) return;
  map.set(label, (map.get(label) || 0) + by);
}

function incrementPersonMarriage(map, personId) {
  if (!personId) return;
  map.set(personId, (map.get(personId) || 0) + 1);
}

function pushBounded(values, value, min, max) {
  if (Number.isFinite(value) && value >= min && value <= max) values.push(value);
}

function splitLast(value) {
  const parts = String(value || '').split(',').map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] || '';
}

function incrementDateParts(monthCounts, weekdayCounts, value) {
  const raw = String(value || '');
  const match = raw.match(/(\d{1,2})[-/ .]([A-Za-z]{3,}|\d{1,2})[-/ .](\d{4})|(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) return;
  const month = match[5] ? Number(match[5]) : monthNumber(match[2]);
  const day = match[6] ? Number(match[6]) : Number(match[1]);
  const year = match[4] ? Number(match[4]) : Number(match[3]);
  if (month >= 1 && month <= 12) increment(monthCounts, monthName(month));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
    increment(weekdayCounts, ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getUTCDay()]);
  }
}

function monthNumber(value) {
  const n = Number(value);
  if (Number.isInteger(n)) return n;
  const key = String(value || '').slice(0, 3).toLowerCase();
  return ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(key) + 1;
}

function monthName(month) {
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month - 1] || String(month);
}

function topPairs(map, limit = 12) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, limit).map(([name, count]) => ({ name, count }));
}

function sortedPairs(map, key) {
  return [...map.entries()].sort((a, b) => compareMixed(a[0], b[0])).map(([value, count]) => ({ [key]: value, count }));
}

function compareMixed(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function histogram(values, bucketSize = 5) {
  const buckets = new Map();
  for (const value of values) {
    const start = Math.floor(value / bucketSize) * bucketSize;
    const label = `${start}-${start + bucketSize - 1}`;
    increment(buckets, label);
  }
  return topPairs(buckets, 100).sort((a, b) => compareMixed(a.name, b.name));
}

function percentage(part, total) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}
