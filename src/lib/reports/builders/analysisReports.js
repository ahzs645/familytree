/**
 * Whole-tree health and analysis reports — plausibility warnings,
 * "today" anniversaries, status counters, and the geocoded-place map.
 */
import { runPlausibilityChecks } from '../../plausibility.js';
import { computeRichStatistics, loadGenealogyMetricRecords } from '../../genealogyMetrics.js';
import { compareStrings, formatInteger } from '../../i18n.js';
import { block, emptyReport } from '../ast.js';
import { normalizeConclusionTypeId } from '../../catalogs.js';
import { refToRecordName } from '../../recordRef.js';
import {
  familySummary,
  getAppDataClient,
  humanizeType,
  loadVisiblePersonIds,
  personSummary,
  placeSummary,
  readField,
  readConclusionType,
  readRef,
  reportPrivacyPolicy,
  visibleReportRecords,
} from './_helpers.js';

export async function buildPlausibilityReport() {
  const warnings = await runPlausibilityChecks();
  const report = emptyReport('Plausibility List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.paragraph(`${formatInteger(warnings.length)} warnings`));
  report.blocks.push(block.table(['Severity', 'Rule', 'Record', 'Message'], warnings.map((w) => [w.severity, w.rule, w.recordName, w.message])));
  return report;
}

export async function buildStatusReport() {
  const db = getAppDataClient().records;
  const [persons, places, sources, media, todos] = await Promise.all([
    db.query('Person', { limit: 100000 }),
    db.query('Place', { limit: 100000 }),
    db.query('Source', { limit: 100000 }),
    db.query('MediaPicture', { limit: 100000 }),
    db.query('ToDo', { limit: 100000 }),
  ]);
  const rows = [
    ['Persons', persons.records.length],
    ['Persons without birth date', persons.records.filter((p) => !readField(p, ['cached_birthDate', 'birthDate'])).length],
    ['Persons without death date', persons.records.filter((p) => !readField(p, ['cached_deathDate', 'deathDate'])).length],
    ['Places', places.records.length],
    ['Places without coordinates', places.records.filter((p) => !readField(p, ['coordinate', 'latitude'])).length],
    ['Sources', sources.records.length],
    ['Pictures', media.records.length],
    ['Open ToDos', todos.records.filter((t) => !/done|complete/i.test(readField(t, ['status'], ''))).length],
  ].map(([name, value]) => [name, formatInteger(value)]);
  const report = emptyReport('Status Report');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Metric', 'Value'], rows));
  return report;
}

export async function buildRichStatisticsReport() {
  const records = await loadGenealogyMetricRecords();
  const stats = computeRichStatistics(records);
  const report = emptyReport('Rich Statistics');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(
    block.table(
      ['Metric', 'Value'],
      [
        ['Persons', formatInteger(stats.totals.persons)],
        ['Families', formatInteger(stats.totals.families)],
        ['Places', formatInteger(stats.totals.places)],
        ['Remarried persons', formatInteger(stats.totals.remarriagePersons)],
        ['Average lifespan', stats.lifespan.averageYears == null ? '' : `${Math.round(stats.lifespan.averageYears)} years`],
        ['Birth-date completeness', `${stats.completeness.birthDate}%`],
        ['Death-date completeness', `${stats.completeness.deathDate}%`],
        ['Parent-family completeness', `${stats.completeness.parentFamily}%`],
      ]
    )
  );
  addCountTable(report, 'Age at Marriage', ['Age Range', 'Count'], stats.ageAtMarriage, 'name');
  addCountTable(report, 'Children Per Family', ['Children', 'Families'], stats.childrenPerFamily, 'children');
  addCountTable(report, 'Parent-Child Age Gaps', ['Age Range', 'Count'], stats.parentChildAgeGaps, 'name');
  addCountTable(report, 'Top Occupations', ['Occupation', 'Count'], stats.topOccupations, 'name');
  addCountTable(report, 'Birth Places', ['Place', 'Count'], stats.birthPlaces, 'name');
  addCountTable(report, 'Marriage Places', ['Place', 'Count'], stats.marriagePlaces, 'name');
  addCountTable(report, 'Marriage Months', ['Month', 'Count'], stats.marriageMonths, 'month');
  return report;
}

export async function buildTodayReport(options = {}) {
  const db = getAppDataClient().records;
  const [{ records: persons }, { records: families }, { records: personEvents }, { records: familyEvents }] = await Promise.all([
    db.query('Person', { limit: 100000 }),
    db.query('Family', { limit: 100000 }),
    db.query('PersonEvent', { limit: 100000 }),
    db.query('FamilyEvent', { limit: 100000 }),
  ]);
  const forDate = reportTargetDate(options.forDate);
  const date = Number.isNaN(forDate.getTime()) ? new Date() : forDate;
  const key = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const personById = new Map(visibleReportRecords(persons).map((person) => [person.recordName, person]));
  const familyById = new Map(visibleReportRecords(families).map((family) => [family.recordName, family]));
  const rows = [];
  const seen = new Set();
  const push = (type, owner, rawDate) => {
    const parts = anniversaryDateParts(rawDate);
    if (!parts || parts.monthDay !== key || !todayEventEnabled(type, options)) return;
    const signature = `${type}|${owner}|${rawDate}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    rows.push({ type, owner, date: String(rawDate || ''), year: parts.year });
  };
  for (const person of personById.values()) {
    const summary = personSummary(person);
    push('Birth', summary?.fullName || person.recordName, summary?.birthDate);
    push('Death', summary?.fullName || person.recordName, summary?.deathDate);
  }
  for (const event of personEvents) {
    const personId = readRef(event.fields?.person);
    const person = personById.get(personId);
    if (!person) continue;
    push(todayEventType(event), personSummary(person)?.fullName || personId, readField(event, ['date', 'cached_dateAsDate', 'dateString'], ''));
  }
  for (const event of familyEvents) {
    const familyId = readRef(event.fields?.family);
    const family = familyById.get(familyId);
    if (!family) continue;
    push(todayEventType(event), familySummary(family)?.familyName || familyId, readField(event, ['date', 'cached_dateAsDate', 'dateString'], ''));
  }
  const targetYear = date.getFullYear();
  rows.sort((a, b) => (
    options.sortBy === 'person'
      ? compareStrings(a.owner, b.owner) || compareStrings(a.type, b.type)
      : compareStrings(a.date, b.date) || compareStrings(a.owner, b.owner)
  ));
  const report = emptyReport('Today Report');
  report.blocks.push(block.title(report.title, 1));
  if (rows.length === 0) {
    report.blocks.push(block.paragraph('There are no person or family events for the selected date.'));
    return report;
  }
  const tableRows = (items) => items.map((row) => [row.owner, row.date, row.year == null ? '' : String(targetYear - row.year)]);
  if (options.groupByEventType !== false) {
    for (const type of [...new Set(rows.map((row) => row.type))].sort((a, b) => compareStrings(a, b))) {
      report.blocks.push(block.title(type, 2));
      report.blocks.push(block.table(['Person / Family', 'Date', 'Anniversary'], tableRows(rows.filter((row) => row.type === type))));
    }
  } else {
    report.blocks.push(block.table(['Type', 'Person / Family', 'Date', 'Anniversary'], rows.map((row) => [row.type, ...tableRows([row])[0]])));
  }
  return report;
}

function reportTargetDate(value) {
  const exact = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (exact) return new Date(Number(exact[1]), Number(exact[2]) - 1, Number(exact[3]));
  return value ? new Date(value) : new Date();
}

function anniversaryDateParts(value) {
  const match = String(value || '').match(/(?:(-?\d{4})[-./])?(\d{1,2})[-./](\d{1,2})/);
  if (!match) return null;
  return {
    year: match[1] ? Number.parseInt(match[1], 10) : null,
    monthDay: `${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`,
  };
}

function todayEventType(event) {
  return humanizeType(readConclusionType(event) || readField(event, ['eventType', 'type'], 'Event')) || 'Event';
}

function todayEventEnabled(type, options) {
  const value = String(type || '').toLowerCase();
  if (value.includes('birth')) return options.includeBirth !== false;
  if (value.includes('christen') || value.includes('bapt')) return options.todayIncludeChristening !== false;
  if (value.includes('death')) return options.includeDeath !== false;
  if (value.includes('burial') || value.includes('cremat')) return options.todayIncludeBurial !== false;
  if (value.includes('marriage') || value.includes('wedding')) return options.includeMarriage !== false;
  if (value.includes('engage')) return options.includeEngagement !== false;
  if (value.includes('divorce') || value.includes('separat')) return options.includeDivorce !== false;
  return !!options.includeOtherEvents;
}

// MFT's PersonAnalysisAnalyzer 18 categories (CorePersonAnalysisAnalyzer.strings).
const PERSON_ANALYSIS_EVENT_CATEGORIES = [
  ['Occupation', 'Occupations'], ['Education', 'Education'], ['Illness', 'Illness'],
  ['Religion', 'Religion'], ['Mission', 'Mission'], ['Graduation', 'Graduation'],
  ['CauseOfDeath', 'Cause of Death'], ['Immigration', 'Immigration'], ['Emigration', 'Emigration'],
];
const PERSON_ANALYSIS_FACT_CATEGORIES = [
  ['EyeColor', 'Eye Color'], ['CasteName', 'Caste'], ['Race', 'Ethnic Origin'],
  ['SkinColor', 'Skin Color'], ['Hobby', 'Hobby'], ['NationalOrTribalOrigin', 'National or Tribal Origin'],
  ['Honors', 'Honors'],
];

export async function buildPersonAnalysisReport(options = {}) {
  const db = getAppDataClient().records;
  const policy = reportPrivacyPolicy();
  const [personEvents, personFacts, labelRelations, labels, persons, visiblePersonIds] = await Promise.all([
    db.query('PersonEvent', { limit: 100000 }),
    db.query('PersonFact', { limit: 100000 }),
    db.query('LabelRelation', { limit: 100000 }),
    db.query('Label', { limit: 100000 }),
    db.query('Person', { limit: 100000 }),
    loadVisiblePersonIds(db, policy),
  ]);
  const onlyCount = !!options.onlyShowCount;
  const report = emptyReport('Person Analysis');
  report.blocks.push(block.title(report.title, 1));

  const addCategory = (title, records, typeId, valueFields) => {
    const byValue = new Map();
    for (const record of records) {
      const personId = refToRecordName(record.fields?.person?.value);
      if (!personId || !visiblePersonIds.has(personId)) continue;
      const type = normalizeConclusionTypeId(refToRecordName(record.fields?.conclusionType?.value) || record.fields?.eventType?.value || record.fields?.factType?.value || '');
      if (type !== typeId) continue;
      const value = String(readField(record, valueFields, '') || '').trim();
      if (!value) continue;
      if (!byValue.has(value)) byValue.set(value, new Set());
      byValue.get(value).add(personId);
    }
    if (byValue.size === 0) return;
    report.blocks.push(block.title(title, 2));
    if (onlyCount) {
      report.blocks.push(block.paragraph(`${formatInteger(byValue.size)} distinct values across ${formatInteger(new Set([].concat(...[...byValue.values()].map((s) => [...s]))).size)} persons`));
      return;
    }
    const rows = [...byValue.entries()]
      .map(([value, set]) => [value, formatInteger(set.size), set.size])
      .sort((a, b) => b[2] - a[2] || compareStrings(a[0], b[0]))
      .map((row) => [row[0], row[1]]);
    report.blocks.push(block.table(['Value', 'Persons'], rows));
  };

  for (const [type, title] of PERSON_ANALYSIS_EVENT_CATEGORIES) {
    addCategory(title, personEvents.records, type, ['description', 'userDescription', 'text', 'placeName']);
  }
  for (const [type, title] of PERSON_ANALYSIS_FACT_CATEGORIES) {
    addCategory(title, personFacts.records, type, ['description', 'value', 'text']);
  }

  // Labels — how many people carry each label.
  const labelNameById = new Map(labels.records.map((l) => [l.recordName, readField(l, ['name', 'title'], '') || l.recordName]));
  const labelCounts = new Map();
  for (const rel of labelRelations.records) {
    const target = refToRecordName(rel.fields?.target?.value) || refToRecordName(rel.fields?.targetPerson?.value);
    if (!target || !visiblePersonIds.has(target)) continue;
    const labelId = refToRecordName(rel.fields?.label?.value);
    const name = labelNameById.get(labelId) || labelId;
    if (!name) continue;
    if (!labelCounts.has(name)) labelCounts.set(name, new Set());
    labelCounts.get(name).add(target);
  }
  if (labelCounts.size > 0) {
    report.blocks.push(block.title('Labels', 2));
    report.blocks.push(block.table(['Label', 'Persons'], [...labelCounts.entries()]
      .map(([name, set]) => [name, formatInteger(set.size), set.size])
      .sort((a, b) => b[2] - a[2] || compareStrings(a[0], b[0]))
      .map((row) => [row[0], row[1]])));
  }

  // Entry counts — overall totals.
  const visiblePersons = visibleReportRecords(persons.records);
  const privateCount = persons.records.filter((p) => p.fields?.isPrivate?.value).length;
  report.blocks.push(block.title('Entry Counts', 2));
  report.blocks.push(block.table(['Metric', 'Value'], [
    ['Persons (visible)', formatInteger(visiblePersons.length)],
    ['Persons marked private', formatInteger(privateCount)],
    ['Person events', formatInteger(personEvents.records.length)],
    ['Person facts', formatInteger(personFacts.records.length)],
  ]));

  return report;
}

function addCountTable(report, title, columns, rows, key = 'name') {
  if (!rows?.length) return;
  report.blocks.push(block.title(title, 2));
  report.blocks.push(block.table(columns, rows.map((row) => [String(row[key] ?? ''), formatInteger(row.count)])));
}

export async function buildMapReport() {
  const db = getAppDataClient().records;
  const [places, coords] = await Promise.all([
    db.query('Place', { limit: 100000 }),
    db.query('Coordinate', { limit: 100000 }),
  ]);
  const coordByPlace = new Map();
  for (const coord of coords.records) {
    const place = readRef(coord.fields?.place);
    if (place) coordByPlace.set(place, coord);
  }
  const points = [];
  const rows = places.records.map((place) => {
    const coord = coordByPlace.get(place.recordName) || null;
    const name = placeSummary(place)?.displayName || placeSummary(place)?.name || place.recordName;
    const lat = parseFloat(readField(coord, ['latitude'], ''));
    const lon = parseFloat(readField(coord, ['longitude'], ''));
    if (Number.isFinite(lat) && Number.isFinite(lon)) points.push({ name, lat, lon });
    return [
      name,
      readField(coord, ['latitude'], ''),
      readField(coord, ['longitude'], ''),
      readField(place, ['geonameID', 'geoNameID'], ''),
    ];
  });
  const report = emptyReport('Map Report');
  report.blocks.push(block.title(report.title, 1));
  if (points.length) {
    report.blocks.push(block.paragraph(`${formatInteger(points.length)} geocoded place(s) plotted.`));
    report.blocks.push(block.image(buildPlacesMapDataUrl(points), 'Geocoded places (equirectangular projection)'));
  }
  report.blocks.push(block.table(['Place', 'Latitude', 'Longitude', 'GeoName ID'], rows));
  return report;
}

/**
 * Render geocoded places as a self-contained SVG map (#32) — an equirectangular
 * projection with a graticule and a marker per place — returned as a data URL so
 * report renderers can embed it via the image block. No tiles/network needed.
 */
function buildPlacesMapDataUrl(points) {
  const width = 720;
  const height = 360;
  const project = (lat, lon) => ({
    x: ((lon + 180) / 360) * width,
    y: ((90 - lat) / 180) * height,
  });
  const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const parts = [];
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#dceaf5"/>`);
  // Graticule every 30°.
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * width;
    parts.push(`<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${height}" stroke="#b6cadb" stroke-width="0.5"/>`);
  }
  for (let lat = -90; lat <= 90; lat += 30) {
    const y = ((90 - lat) / 180) * height;
    parts.push(`<line x1="0" y1="${y.toFixed(1)}" x2="${width}" y2="${y.toFixed(1)}" stroke="#b6cadb" stroke-width="0.5"/>`);
  }
  // Equator + prime meridian emphasised.
  parts.push(`<line x1="0" y1="${(height / 2).toFixed(1)}" x2="${width}" y2="${(height / 2).toFixed(1)}" stroke="#94aec3" stroke-width="0.8"/>`);
  parts.push(`<line x1="${(width / 2).toFixed(1)}" y1="0" x2="${(width / 2).toFixed(1)}" y2="${height}" stroke="#94aec3" stroke-width="0.8"/>`);
  // Markers; label the first 40 to avoid clutter on dense trees.
  points.forEach((point, index) => {
    const { x, y } = project(point.lat, point.lon);
    parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="#d6452c" fill-opacity="0.85" stroke="#7c2113" stroke-width="0.6"/>`);
    if (index < 40) {
      parts.push(`<text x="${(x + 4).toFixed(1)}" y="${(y - 4).toFixed(1)}" font-family="system-ui, sans-serif" font-size="8" fill="#33404d">${esc(point.name)}</text>`);
    }
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
