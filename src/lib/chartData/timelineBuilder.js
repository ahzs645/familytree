/**
 * Timeline chart data builder.
 *
 * Mac reference: TimelineChartBuilder, TimelineChartBuilderConfiguration.
 * Produces a set of timeline rows (persons and famous/history rows) together
 * with an optional year range, grouping info, and per-row event markers.
 *
 * The renderer converts rows + events into bars/from-to ranges/event markers
 * according to the compositor style configuration on the chart document.
 */

import {
  getAllPersonEvents,
  getAllFamilyEvents,
  getAllFamilies,
  loadPersonIndex,
  loadPlaceIndex,
  parseYear,
  readBirthYear,
  readDeathYear,
  readEventYear,
  readEventType,
  readEventPlaceRef,
  readPlaceName,
} from './recordQueries.js';
import { readField, readRef, FIELD_ALIASES } from '../schema.js';
import { Gender } from '../../models/index.js';

const GROUPING_MODES = new Set([
  'none',
  'birthCountry',
  'deathCountry',
  'birthPlace',
  'deathPlace',
  'lastName',
  'gender',
]);

export function normalizeTimelineConfig(raw = {}) {
  return {
    grouping: GROUPING_MODES.has(raw.grouping) ? raw.grouping : 'none',
    collapseForBestFit: raw.collapseForBestFit !== false,
    showHistoryPersons: Boolean(raw.showHistoryPersons),
    markerMode: raw.markerMode === 'event' ? 'event' : 'bar',
    fromYear: Number.isFinite(raw.fromYear) ? Number(raw.fromYear) : null,
    toYear: Number.isFinite(raw.toYear) ? Number(raw.toYear) : null,
    includeFamilyEvents: raw.includeFamilyEvents !== false,
    rootPersonId: raw.rootPersonId || null,
  };
}

function groupKey(person, mode, placeIndex) {
  if (mode === 'none') return 'all';
  if (mode === 'gender') {
    const g = person?.fields?.gender?.value;
    if (g === Gender.Male) return 'Male';
    if (g === Gender.Female) return 'Female';
    if (g === Gender.Intersex) return 'Intersex';
    return 'Unknown';
  }
  if (mode === 'lastName') {
    return readField(person, ['lastName']) || 'Unknown';
  }
  if (mode === 'birthPlace' || mode === 'birthCountry') {
    const ref = readRef(person?.fields?.birthPlace?.value ?? person?.fields?.birthPlace);
    const place = ref ? placeIndex.get(ref) : null;
    const name = readPlaceName(place);
    if (!name) return 'Unknown';
    if (mode === 'birthCountry') return extractCountry(name);
    return name;
  }
  if (mode === 'deathPlace' || mode === 'deathCountry') {
    const ref = readRef(person?.fields?.deathPlace?.value ?? person?.fields?.deathPlace);
    const place = ref ? placeIndex.get(ref) : null;
    const name = readPlaceName(place);
    if (!name) return 'Unknown';
    if (mode === 'deathCountry') return extractCountry(name);
    return name;
  }
  return 'all';
}

function extractCountry(placeName) {
  if (!placeName) return 'Unknown';
  const parts = String(placeName).split(',').map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] || placeName;
}

export async function buildTimelineData(config = {}) {
  const normalized = normalizeTimelineConfig(config);
  const [personIndex, placeIndex, personEvents, familyEvents, families] = await Promise.all([
    loadPersonIndex(),
    loadPlaceIndex(),
    getAllPersonEvents(),
    normalized.includeFamilyEvents ? getAllFamilyEvents() : Promise.resolve([]),
    normalized.includeFamilyEvents ? getAllFamilies() : Promise.resolve([]),
  ]);

  const familyIndex = new Map();
  for (const family of families) familyIndex.set(family.recordName, family);

  const rowsByPerson = new Map();
  const addRow = (person) => {
    if (!person) return null;
    const existing = rowsByPerson.get(person.recordName);
    if (existing) return existing;
    const birthYear = readBirthYear(person);
    const deathYear = readDeathYear(person);
    const row = {
      id: person.recordName,
      kind: 'person',
      name: `${readField(person, ['firstName']) || ''} ${readField(person, ['lastName']) || ''}`.trim() || 'Unknown',
      birthYear,
      deathYear,
      group: groupKey(person, normalized.grouping, placeIndex),
      events: [],
    };
    rowsByPerson.set(person.recordName, row);
    return row;
  };

  for (const person of personIndex.values()) addRow(person);

  const fromYear = normalized.fromYear;
  const toYear = normalized.toYear;
  const withinRange = (year) => {
    if (year == null) return false;
    if (fromYear != null && year < fromYear) return false;
    if (toYear != null && year > toYear) return false;
    return true;
  };

  for (const event of personEvents) {
    const personRef = readRef(event.fields?.person?.value ?? event.fields?.person);
    const row = personRef ? rowsByPerson.get(personRef) : null;
    if (!row) continue;
    const year = readEventYear(event);
    if (fromYear != null || toYear != null) {
      if (year == null || !withinRange(year)) continue;
    }
    const placeRef = readEventPlaceRef(event);
    const place = placeRef ? placeIndex.get(placeRef) : null;
    row.events.push({
      id: event.recordName,
      type: readEventType(event) || 'event',
      year,
      placeName: readPlaceName(place) || null,
    });
  }

  if (normalized.includeFamilyEvents) {
    for (const event of familyEvents) {
      const familyRef = readRef(event.fields?.family?.value ?? event.fields?.family);
      const family = familyRef ? familyIndex.get(familyRef) : null;
      if (!family) continue;
      const manRef = readRef(family.fields?.man?.value ?? family.fields?.man);
      const womanRef = readRef(family.fields?.woman?.value ?? family.fields?.woman);
      const year = readEventYear(event);
      if ((fromYear != null || toYear != null) && (year == null || !withinRange(year))) continue;
      for (const ref of [manRef, womanRef]) {
        const row = ref ? rowsByPerson.get(ref) : null;
        if (!row) continue;
        row.events.push({
          id: `${event.recordName}::${ref}`,
          type: readEventType(event) || 'familyEvent',
          year,
          placeName: null,
        });
      }
    }
  }

  const rows = [...rowsByPerson.values()]
    .filter((row) => row.birthYear != null || row.deathYear != null || row.events.length > 0)
    .sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999));

  for (const row of rows) {
    row.events.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
  }

  const computedRange = computeRange(rows, normalized);

  const groups = new Map();
  for (const row of rows) {
    const key = row.group || 'all';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row.id);
  }

  return {
    config: normalized,
    rows,
    groups: [...groups.entries()].map(([key, ids]) => ({ key, rowIds: ids })),
    range: computedRange,
  };
}

function computeRange(rows, config) {
  let min = config.fromYear;
  let max = config.toYear;
  for (const row of rows) {
    for (const year of [row.birthYear, row.deathYear, ...row.events.map((e) => e.year)]) {
      if (year == null) continue;
      if (min == null || year < min) min = year;
      if (max == null || year > max) max = year;
    }
  }
  return { fromYear: min, toYear: max };
}
