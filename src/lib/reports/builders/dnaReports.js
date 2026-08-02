import { getAppDataClient } from '../../data/AppDataClient.js';
import { compareStrings } from '../../i18n.js';
import { readField, readRef } from '../../schema.js';
import { personSummary } from '../../../models/index.js';
import { block, emptyReport } from '../ast.js';
import { isRecordVisibleInReport, reportPrivacyPolicy } from './_helpers.js';

export async function buildDNAReport() {
  const db = getAppDataClient().records;
  const policy = reportPrivacyPolicy();
  const [{ records: tests }, { records: persons }] = await Promise.all([
    db.query('DNATestResult', { limit: 100000 }),
    db.query('Person', { limit: 100000 }),
  ]);
  const people = new Map(persons.filter((person) => isRecordVisibleInReport(person, policy)).map((person) => [person.recordName, person]));
  const rows = [];
  for (const test of tests) {
    if (!isRecordVisibleInReport(test, policy)) continue;
    const personId = readRef(test.fields?.person);
    if (personId && !people.has(personId)) continue;
    const person = people.get(personId);
    rows.push([
      personSummary(person)?.fullName || personId || '',
      readField(test, ['testName', 'kitNumber'], test.recordName),
      dnaKind(readField(test, ['testType'], '')),
      readField(test, ['lab', 'provider'], ''),
      readField(test, ['haplogroup', 'terminalSNP'], ''),
      hasResultData(test) ? 'Yes' : 'No',
      rawFileReference(test),
    ]);
  }
  rows.sort((a, b) => compareStrings(a[0], b[0]) || compareStrings(a[2], b[2]) || compareStrings(a[1], b[1]));
  const report = emptyReport('DNA Report');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(
    ['Person', 'Test', 'Test Kind', 'Provider', 'Haplogroup', 'Markers / SNP Data', 'Raw File'],
    rows,
  ));
  return report;
}

export function dnaKind(value) {
  const type = String(value || '').toLowerCase().replace(/[^a-z]/g, '');
  if (type.includes('mitochondrial') || type.includes('mtdna')) return 'MTDNA';
  if (type.includes('ydna') || type === 'y') return 'YDNA';
  return 'ATDNA';
}

function hasResultData(test) {
  return ['markers', 'mtdnaHVR1', 'mtdnaHVR2', 'mtdnaCodingRegion', 'mtdnaSnpDifferences', 'ystrMarkerCount', 'ystrMarkers', 'terminalSNP']
    .some((field) => String(readField(test, [field], '') || '').trim());
}

function rawFileReference(test) {
  return [readField(test, ['rawDataFileName'], ''), readField(test, ['rawDataSource'], '')]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' — ');
}
