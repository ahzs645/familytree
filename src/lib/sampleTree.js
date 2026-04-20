/**
 * Minimal sample tree — three generations, Arabic-and-English names — used
 * by Home's "Load Sample Tree" CTA on first run. Keeps the payload small
 * (no media) so it fits the landing bundle and loads in one frame.
 */
import { getLocalDatabase } from './LocalDatabase.js';

function uuid(prefix) {
  return `${prefix}-sample-${Math.random().toString(36).slice(2, 10)}`;
}

function person(first, last, gender, birth, death) {
  const id = uuid('p');
  return {
    recordName: id,
    recordType: 'Person',
    fields: {
      firstName: { value: first, type: 'STRING' },
      lastName: { value: last, type: 'STRING' },
      gender: { value: gender, type: 'NUMBER' },
      cached_fullName: { value: `${first} ${last}`.trim(), type: 'STRING' },
      cached_birthDate: birth ? { value: birth, type: 'STRING' } : undefined,
      cached_deathDate: death ? { value: death, type: 'STRING' } : undefined,
    },
  };
}

function family(manId, womanId, marriageDate) {
  const id = uuid('f');
  return {
    recordName: id,
    recordType: 'Family',
    fields: {
      man: { value: `${manId}---Person`, type: 'REFERENCE' },
      woman: { value: `${womanId}---Person`, type: 'REFERENCE' },
      cached_marriageDate: marriageDate ? { value: marriageDate, type: 'STRING' } : undefined,
    },
  };
}

function childRel(familyId, childId) {
  return {
    recordName: uuid('cr'),
    recordType: 'ChildRelation',
    fields: {
      family: { value: `${familyId}---Family`, type: 'REFERENCE' },
      child: { value: `${childId}---Person`, type: 'REFERENCE' },
    },
  };
}

export function buildSampleTreeRecords() {
  // Grandparents
  const granddadA = person('Ahmad', 'Al-Ahmad', 0, '1920', '1998');
  const grandmaA = person('Fatima', 'Al-Hasan', 1, 'ABT 1925', '2001');
  const granddadB = person('James', 'Smith', 0, '1918', '1990');
  const grandmaB = person('Mary', 'Johnson', 1, '1921', '2010');

  // Parents
  const father = person('Omar', 'Al-Ahmad', 0, '1955');
  const mother = person('Sarah', 'Smith', 1, '1957');

  // Children
  const child1 = person('Laila', 'Al-Ahmad', 1, '1985');
  const child2 = person('Yusuf', 'Al-Ahmad', 0, '1988');

  // Families
  const famA = family(granddadA.recordName, grandmaA.recordName, '1950');
  const famB = family(granddadB.recordName, grandmaB.recordName, '1948');
  const famParents = family(father.recordName, mother.recordName, '1980');

  // Parent-child links
  const links = [
    childRel(famA.recordName, father.recordName),
    childRel(famB.recordName, mother.recordName),
    childRel(famParents.recordName, child1.recordName),
    childRel(famParents.recordName, child2.recordName),
  ];

  father.fields.isStartPerson = { value: true, type: 'BOOLEAN' };

  return [
    granddadA, grandmaA, granddadB, grandmaB,
    father, mother,
    child1, child2,
    famA, famB, famParents,
    ...links,
  ];
}

export async function loadSampleTree() {
  const db = getLocalDatabase();
  const records = buildSampleTreeRecords();
  const dataset = {
    format: 'cloudtreeweb-backup',
    version: 2,
    exportedAt: new Date().toISOString(),
    records: Object.fromEntries(records.map((r) => [r.recordName, r])),
    assets: [],
    meta: { sampleTree: true, loadedAt: new Date().toISOString() },
  };
  await db.importDataset(dataset);
  return records.length;
}
