/**
 * "List" reports — global queries that produce a sortable table of every
 * record of a given kind: persons, places, sources, events, anniversaries,
 * facts, marriages, change-log entries, and the to-do queue.
 */
import { compareStrings, formatInteger } from '../../i18n.js';
import { block, emptyReport } from '../ast.js';
import {
  addAnniversary,
  eventOwnerLabel,
  genderLabel,
  getLocalDatabase,
  isRecordVisibleInReport,
  loadVisiblePersonIds,
  placeLabel,
  placeSummary,
  personSummary,
  readConclusionType,
  readField,
  readRef,
  reportPrivacyPolicy,
  sourceSummary,
  trimText,
  visibleReportRecords,
} from './_helpers.js';

export async function buildPersonsList(options = {}) {
  const db = getLocalDatabase();
  const { records } = await db.query('Person', { limit: 100000 });
  let people = visibleReportRecords(records).map(personSummary).filter(Boolean);
  if (options.onlyWithDates) people = people.filter((p) => p.birthDate || p.deathDate);
  // Per-list search: free-text narrowing on the person's name (#74).
  const search = (options.search || '').trim().toLowerCase();
  if (search) people = people.filter((p) => `${p.fullName} ${p.lastName || ''}`.toLowerCase().includes(search));
  const sortBy = options.sortBy || 'name';
  people.sort((a, b) => (
    sortBy === 'birth' ? compareStrings(a.birthDate || '', b.birthDate || '') || compareStrings(a.fullName, b.fullName)
      : sortBy === 'death' ? compareStrings(a.deathDate || '', b.deathDate || '') || compareStrings(a.fullName, b.fullName)
        : compareStrings(a.fullName, b.fullName)
  ));
  const includeGender = options.includeGender !== false;
  const columns = includeGender ? ['Name', 'Gender', 'Born', 'Died'] : ['Name', 'Born', 'Died'];
  const toRow = (p) => (includeGender
    ? [p.fullName, genderLabel(p.gender), p.birthDate || '', p.deathDate || '']
    : [p.fullName, p.birthDate || '', p.deathDate || '']);
  const report = emptyReport('Persons List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.paragraph(`${formatInteger(people.length)} persons`));

  // Sectioned output: split into titled groups by surname initial, birth decade,
  // or gender (#37). 'none' keeps the original single-table layout.
  const groupBy = options.groupBy || 'none';
  if (groupBy === 'none') {
    report.blocks.push(block.table(columns, people.map(toRow)));
    return report;
  }
  const groups = new Map();
  for (const person of people) {
    const key = personGroupLabel(person, groupBy);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(person);
  }
  const sortedKeys = [...groups.keys()].sort(compareStrings);
  for (const key of sortedKeys) {
    const groupPeople = groups.get(key);
    report.blocks.push(block.title(`${key} (${formatInteger(groupPeople.length)})`, 2));
    report.blocks.push(block.table(columns, groupPeople.map(toRow)));
  }
  return report;
}

function personGroupLabel(person, groupBy) {
  if (groupBy === 'gender') return genderLabel(person.gender) || 'Unknown';
  if (groupBy === 'birthDecade') {
    const year = parseInt(String(person.birthDate || '').match(/(\d{4})/)?.[1] || '', 10);
    return Number.isFinite(year) ? `${Math.floor(year / 10) * 10}s` : 'No birth date';
  }
  // surname initial
  const initial = (person.lastName || '').trim().charAt(0).toUpperCase();
  return initial || '—';
}

export async function buildPlacesList(options = {}) {
  const db = getLocalDatabase();
  const { records } = await db.query('Place', { limit: 100000 });
  let places = visibleReportRecords(records).map(placeSummary).filter(Boolean);
  if (options.onlyMissingGeoname) places = places.filter((p) => !p.geonameID);
  const sortBy = options.sortBy || 'name';
  places.sort((a, b) => (sortBy === 'geoname'
    ? compareStrings(a.geonameID || '', b.geonameID || '') || compareStrings(a.displayName || a.name || '', b.displayName || b.name || '')
    : compareStrings(a.displayName || a.name || '', b.displayName || b.name || '')));
  const rows = places.map((p) => [p.displayName || p.name || '', p.shortName || '', p.geonameID || '']);
  const report = emptyReport('Places List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.paragraph(`${formatInteger(rows.length)} places`));
  report.blocks.push(block.table(['Place', 'Short Name', 'GeoName ID'], rows));
  return report;
}

export async function buildSourcesList(options = {}) {
  const db = getLocalDatabase();
  const { records } = await db.query('Source', { limit: 100000 });
  const sources = visibleReportRecords(records).map(sourceSummary).filter(Boolean);
  const sortBy = options.sortBy || 'title';
  sources.sort((a, b) => (sortBy === 'date'
    ? compareStrings(a.date || '', b.date || '') || compareStrings(a.title || '', b.title || '')
    : compareStrings(a.title || '', b.title || '')));
  const includeText = options.includeText !== false;
  const columns = includeText ? ['Title', 'Date', 'Text'] : ['Title', 'Date'];
  const rows = sources.map((s) => (includeText
    ? [s.title || '', s.date || '', trimText(s.text || '', 90)]
    : [s.title || '', s.date || '']));
  const report = emptyReport('Sources List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.paragraph(`${formatInteger(rows.length)} sources`));
  report.blocks.push(block.table(columns, rows));
  return report;
}

export async function buildSourceCitationAuditReport() {
  const db = getLocalDatabase();
  const { records } = await db.query('SourceRelation', { limit: 100000 });
  const rows = [];
  for (const rel of records) {
    const sourceId = readRef(rel.fields?.source);
    const targetId = readRef(rel.fields?.target);
    const [source, target] = await Promise.all([
      sourceId ? db.getRecord(sourceId) : null,
      targetId ? db.getRecord(targetId) : null,
    ]);
    rows.push([
      sourceSummary(source)?.title || sourceId || '',
      target?.fields?.cached_fullName?.value || target?.fields?.cached_familyName?.value || readField(target, ['title', 'name', 'description']) || targetId || '',
      rel.fields?.targetType?.value || target?.recordType || '',
      readField(rel, ['page'], ''),
      readField(rel, ['citation', 'text'], ''),
      readField(rel, ['lineageOperation'], 'Legacy / unknown origin'),
      readRef(rel.fields?.lineageBatch) || '',
    ]);
  }
  rows.sort((a, b) => compareStrings(a[0], b[0]) || compareStrings(a[1], b[1]));
  const report = emptyReport('Source Citation Audit');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.paragraph(`${formatInteger(rows.length)} source citations`));
  report.blocks.push(block.table(['Source', 'Referenced Entry', 'Type', 'Page', 'Citation', 'Lineage', 'Batch'], rows));
  return report;
}

function hasFullDate(value) {
  return /\d{3,4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{3,4}/.test(String(value || ''));
}

export async function buildEventsList(options = {}) {
  const db = getLocalDatabase();
  const policy = reportPrivacyPolicy();
  const [personEvents, familyEvents, families, visiblePersonIds] = await Promise.all([
    db.query('PersonEvent', { limit: 100000 }),
    db.query('FamilyEvent', { limit: 100000 }),
    db.query('Family', { limit: 100000 }),
    loadVisiblePersonIds(db, policy),
  ]);
  const familyById = new Map(families.records.map((f) => [f.recordName, f]));
  const eventOwnerVisible = (ev) => {
    const personId = readRef(ev.fields?.person);
    if (personId) return visiblePersonIds.has(personId);
    const familyId = readRef(ev.fields?.family);
    if (familyId) {
      const fam = familyById.get(familyId);
      if (fam && !isRecordVisibleInReport(fam, policy)) return false;
      const man = readRef(fam?.fields?.man);
      const woman = readRef(fam?.fields?.woman);
      if (man && !visiblePersonIds.has(man)) return false;
      if (woman && !visiblePersonIds.has(woman)) return false;
    }
    return true;
  };
  const rows = [];
  for (const ev of [...personEvents.records, ...familyEvents.records]) {
    if (!eventOwnerVisible(ev)) continue;
    const date = readField(ev, ['date']) || '';
    if (options.onlyFullDate && !hasFullDate(date)) continue;
    const owner = await eventOwnerLabel(db, ev);
    const place = await placeLabel(db, readRef(ev.fields?.place) || readRef(ev.fields?.assignedPlace));
    rows.push([
      readConclusionType(ev) || readField(ev, ['eventType', 'type']) || 'Event',
      date,
      owner,
      place,
      readField(ev, ['description', 'userDescription', 'text']) || '',
    ]);
  }
  const sortBy = options.sortBy || 'date';
  const sortIndex = sortBy === 'type' ? 0 : sortBy === 'owner' ? 2 : 1;
  rows.sort((a, b) => compareStrings(a[sortIndex], b[sortIndex]) || compareStrings(a[1], b[1]));
  const report = emptyReport('Events List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.paragraph(`${formatInteger(rows.length)} events`));
  report.blocks.push(block.table(['Type', 'Date', 'Owner', 'Place', 'Description'], rows));
  return report;
}

export async function buildAnniversaryList(options = {}) {
  const db = getLocalDatabase();
  const { records } = await db.query('Person', { limit: 100000 });
  const typeFilter = options.type && options.type !== 'all' ? options.type : null;
  const rows = [];
  for (const record of visibleReportRecords(records)) {
    const p = personSummary(record);
    if (!typeFilter || typeFilter === 'Birth') addAnniversary(rows, p, 'Birth', p?.birthDate);
    if (!typeFilter || typeFilter === 'Death') addAnniversary(rows, p, 'Death', p?.deathDate);
  }
  const sortBy = options.sortBy || 'monthDay';
  const idx = sortBy === 'person' ? 2 : sortBy === 'year' ? 3 : 0;
  rows.sort((a, b) => compareStrings(a[idx], b[idx]) || compareStrings(a[0], b[0]) || compareStrings(a[2], b[2]));
  const report = emptyReport('Anniversary List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Month/Day', 'Type', 'Person', 'Year'], rows));
  return report;
}

export async function buildToDoListReport(options = {}) {
  const db = getLocalDatabase();
  const { records } = await db.query('ToDo', { limit: 100000 });
  const includeCompleted = options.includeCompleted !== false;
  const showText = options.showText !== false;
  const items = includeCompleted
    ? records
    : records.filter((todo) => !/done|complete|closed/i.test(readField(todo, ['status'], '')));
  const rows = items.map((todo) => {
    const base = [
      readField(todo, ['title', 'name']) || todo.recordName,
      readField(todo, ['status']) || '',
      readField(todo, ['priority']) || '',
      readField(todo, ['dueDate', 'cached_dueDateAsDate']) || '',
    ];
    if (showText) base.push(trimText(readField(todo, ['description', 'text'], ''), 120));
    return base;
  });
  const sortBy = options.sortBy || 'due';
  const idx = sortBy === 'priority' ? 2 : sortBy === 'status' ? 1 : sortBy === 'title' ? 0 : 3;
  rows.sort((a, b) => compareStrings(a[idx], b[idx]) || compareStrings(a[0], b[0]));
  const columns = showText ? ['Title', 'Status', 'Priority', 'Due', 'Description'] : ['Title', 'Status', 'Priority', 'Due'];
  const report = emptyReport('ToDo List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(columns, rows));
  return report;
}

export async function buildChangesListReport() {
  const db = getLocalDatabase();
  const { records } = await db.query('ChangeLogEntry', { limit: 100000 });
  const rows = records
    .map((entry) => [
      readField(entry, ['timestamp'], ''),
      readField(entry, ['changeType'], ''),
      readField(entry, ['targetType'], ''),
      readField(entry, ['summary'], ''),
    ])
    .sort((a, b) => compareStrings(b[0], a[0]));
  const report = emptyReport('Changes List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Date', 'Type', 'Target', 'Summary'], rows));
  return report;
}

export async function buildFactsListReport() {
  const db = getLocalDatabase();
  const policy = reportPrivacyPolicy();
  const [{ records }, visiblePersonIds] = await Promise.all([
    db.query('PersonFact', { limit: 100000 }),
    loadVisiblePersonIds(db, policy),
  ]);
  const rows = [];
  for (const fact of records) {
    const personId = readRef(fact.fields?.person);
    if (personId && !visiblePersonIds.has(personId)) continue;
    const person = personId ? await db.getRecord(personId) : null;
    rows.push([
      personSummary(person)?.fullName || personId || '',
      readConclusionType(fact) || readField(fact, ['factType', 'type'], 'Fact'),
      readField(fact, ['value', 'description', 'text'], ''),
      readField(fact, ['date'], ''),
    ]);
  }
  const report = emptyReport('Facts List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Person', 'Fact', 'Value', 'Date'], rows.sort((a, b) => compareStrings(a[0], b[0]))));
  return report;
}

export async function buildMarriageListReport(options = {}) {
  const db = getLocalDatabase();
  const policy = reportPrivacyPolicy();
  const [{ records: families }, visiblePersonIds] = await Promise.all([
    db.query('Family', { limit: 100000 }),
    loadVisiblePersonIds(db, policy),
  ]);
  const rows = [];
  for (const family of families) {
    if (!isRecordVisibleInReport(family, policy)) continue;
    const manId = readRef(family.fields?.man);
    const womanId = readRef(family.fields?.woman);
    if (manId && !visiblePersonIds.has(manId)) continue;
    if (womanId && !visiblePersonIds.has(womanId)) continue;
    const man = await db.getRecord(manId);
    const woman = await db.getRecord(womanId);
    rows.push([
      personSummary(man)?.fullName || '',
      personSummary(woman)?.fullName || '',
      readField(family, ['cached_marriageDate', 'marriageDate'], ''),
    ]);
  }
  const sortBy = options.sortBy || 'date';
  const idx = sortBy === 'partner1' ? 0 : sortBy === 'partner2' ? 1 : 2;
  rows.sort((a, b) => compareStrings(a[idx], b[idx]) || compareStrings(a[0], b[0]));
  const report = emptyReport('Marriage List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Partner 1', 'Partner 2', 'Marriage Date'], rows));
  return report;
}
