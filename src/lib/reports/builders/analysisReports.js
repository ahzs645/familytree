/**
 * Whole-tree health and analysis reports — plausibility warnings,
 * "today" anniversaries, status counters, and the geocoded-place map.
 */
import { runPlausibilityChecks } from '../../plausibility.js';
import { computeRichStatistics, loadGenealogyMetricRecords } from '../../genealogyMetrics.js';
import { formatInteger } from '../../i18n.js';
import { block, emptyReport } from '../ast.js';
import {
  addTodayRow,
  getLocalDatabase,
  personSummary,
  placeSummary,
  readField,
  readRef,
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
  const db = getLocalDatabase();
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

export async function buildTodayReport(date = new Date()) {
  const db = getLocalDatabase();
  const { records } = await db.query('Person', { limit: 100000 });
  const key = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const rows = [];
  for (const person of records) {
    const summary = personSummary(person);
    addTodayRow(rows, key, summary, 'Birth', summary?.birthDate);
    addTodayRow(rows, key, summary, 'Death', summary?.deathDate);
  }
  const report = emptyReport('Today Report');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Type', 'Person', 'Date'], rows));
  return report;
}

function addCountTable(report, title, columns, rows, key = 'name') {
  if (!rows?.length) return;
  report.blocks.push(block.title(title, 2));
  report.blocks.push(block.table(columns, rows.map((row) => [String(row[key] ?? ''), formatInteger(row.count)])));
}

export async function buildMapReport() {
  const db = getLocalDatabase();
  const [places, coords] = await Promise.all([
    db.query('Place', { limit: 100000 }),
    db.query('Coordinate', { limit: 100000 }),
  ]);
  const coordByPlace = new Map();
  for (const coord of coords.records) {
    const place = readRef(coord.fields?.place);
    if (place) coordByPlace.set(place, coord);
  }
  const rows = places.records.map((place) => {
    const coord = coordByPlace.get(place.recordName) || null;
    return [
      placeSummary(place)?.displayName || placeSummary(place)?.name || place.recordName,
      readField(coord, ['latitude'], ''),
      readField(coord, ['longitude'], ''),
      readField(place, ['geonameID', 'geoNameID'], ''),
    ];
  });
  const report = emptyReport('Map Report');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Place', 'Latitude', 'Longitude', 'GeoName ID'], rows));
  return report;
}
