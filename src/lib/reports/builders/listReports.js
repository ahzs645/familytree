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
  placeLabel,
  placeSummary,
  personSummary,
  readConclusionType,
  readField,
  readRef,
  sourceSummary,
  trimText,
} from './_helpers.js';

export async function buildPersonsList() {
  const db = getLocalDatabase();
  const { records } = await db.query('Person', { limit: 100000 });
  const rows = records
    .map(personSummary)
    .filter(Boolean)
    .sort((a, b) => compareStrings(a.fullName, b.fullName))
    .map((p) => [p.fullName, genderLabel(p.gender), p.birthDate || '', p.deathDate || '']);
  const report = emptyReport('Persons List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.paragraph(`${formatInteger(rows.length)} persons`));
  report.blocks.push(block.table(['Name', 'Gender', 'Born', 'Died'], rows));
  return report;
}

export async function buildPlacesList() {
  const db = getLocalDatabase();
  const { records } = await db.query('Place', { limit: 100000 });
  const rows = records
    .map(placeSummary)
    .filter(Boolean)
    .sort((a, b) => compareStrings(a.displayName || a.name || '', b.displayName || b.name || ''))
    .map((p) => [p.displayName || p.name || '', p.shortName || '', p.geonameID || '']);
  const report = emptyReport('Places List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.paragraph(`${formatInteger(rows.length)} places`));
  report.blocks.push(block.table(['Place', 'Short Name', 'GeoName ID'], rows));
  return report;
}

export async function buildSourcesList() {
  const db = getLocalDatabase();
  const { records } = await db.query('Source', { limit: 100000 });
  const rows = records
    .map(sourceSummary)
    .filter(Boolean)
    .sort((a, b) => compareStrings(a.title || '', b.title || ''))
    .map((s) => [s.title || '', s.date || '', trimText(s.text || '', 90)]);
  const report = emptyReport('Sources List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.paragraph(`${formatInteger(rows.length)} sources`));
  report.blocks.push(block.table(['Title', 'Date', 'Text'], rows));
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

export async function buildEventsList() {
  const db = getLocalDatabase();
  const [personEvents, familyEvents] = await Promise.all([
    db.query('PersonEvent', { limit: 100000 }),
    db.query('FamilyEvent', { limit: 100000 }),
  ]);
  const rows = [];
  for (const ev of [...personEvents.records, ...familyEvents.records]) {
    const owner = await eventOwnerLabel(db, ev);
    const place = await placeLabel(db, readRef(ev.fields?.place) || readRef(ev.fields?.assignedPlace));
    rows.push([
      readConclusionType(ev) || readField(ev, ['eventType', 'type']) || 'Event',
      readField(ev, ['date']) || '',
      owner,
      place,
      readField(ev, ['description', 'userDescription', 'text']) || '',
    ]);
  }
  rows.sort((a, b) => compareStrings(a[1], b[1]));
  const report = emptyReport('Events List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.paragraph(`${formatInteger(rows.length)} events`));
  report.blocks.push(block.table(['Type', 'Date', 'Owner', 'Place', 'Description'], rows));
  return report;
}

export async function buildAnniversaryList() {
  const db = getLocalDatabase();
  const { records } = await db.query('Person', { limit: 100000 });
  const rows = [];
  for (const record of records) {
    const p = personSummary(record);
    addAnniversary(rows, p, 'Birth', p?.birthDate);
    addAnniversary(rows, p, 'Death', p?.deathDate);
  }
  rows.sort((a, b) => compareStrings(a[0], b[0]) || compareStrings(a[2], b[2]));
  const report = emptyReport('Anniversary List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Month/Day', 'Type', 'Person', 'Year'], rows));
  return report;
}

export async function buildToDoListReport() {
  const db = getLocalDatabase();
  const { records } = await db.query('ToDo', { limit: 100000 });
  const rows = records
    .map((todo) => [
      readField(todo, ['title', 'name']) || todo.recordName,
      readField(todo, ['status']) || '',
      readField(todo, ['priority']) || '',
      readField(todo, ['dueDate', 'cached_dueDateAsDate']) || '',
      trimText(readField(todo, ['description', 'text'], ''), 120),
    ])
    .sort((a, b) => compareStrings(a[3], b[3]) || compareStrings(a[0], b[0]));
  const report = emptyReport('ToDo List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Title', 'Status', 'Priority', 'Due', 'Description'], rows));
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
  const { records } = await db.query('PersonFact', { limit: 100000 });
  const rows = [];
  for (const fact of records) {
    const personId = readRef(fact.fields?.person);
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

export async function buildMarriageListReport() {
  const db = getLocalDatabase();
  const { records: families } = await db.query('Family', { limit: 100000 });
  const rows = [];
  for (const family of families) {
    const man = await db.getRecord(readRef(family.fields?.man));
    const woman = await db.getRecord(readRef(family.fields?.woman));
    rows.push([
      personSummary(man)?.fullName || '',
      personSummary(woman)?.fullName || '',
      readField(family, ['cached_marriageDate', 'marriageDate'], ''),
    ]);
  }
  const report = emptyReport('Marriage List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Partner 1', 'Partner 2', 'Marriage Date'], rows.sort((a, b) => compareStrings(a[2], b[2]))));
  return report;
}
