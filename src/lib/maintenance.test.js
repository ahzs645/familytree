import { describe, expect, it } from 'vitest';
import { findAncestryLoops, findMaintenanceIssues, findUnusedRecords, sortEventRecords } from './maintenance.js';

describe('maintenance pure helpers', () => {
  it('finds ancestry loops through parent-child edges', () => {
    const records = [
      person('a'),
      person('b'),
      family('fam1', 'a'),
      family('fam2', 'b'),
      childRelation('cr1', 'fam1', 'b'),
      childRelation('cr2', 'fam2', 'a'),
    ];

    expect(findAncestryLoops(records)).toEqual([
      expect.objectContaining({ path: ['a', 'b', 'a'] }),
    ]);
  });

  it('finds unreferenced non-root records', () => {
    const records = [
      person('p1'),
      source('s-used'),
      source('s-unused'),
      { recordName: 'sr1', recordType: 'SourceRelation', fields: { source: ref('s-used', 'Source'), target: ref('p1', 'Person') } },
    ];

    expect(findUnusedRecords(records).map((record) => record.recordName)).toEqual(['s-unused']);
  });

  it('sorts event records by parsed dates then original order', () => {
    const sorted = sortEventRecords([
      event('e3', '1900-01-01', 2),
      event('e1', '1899-12-31', 9),
      event('e2', '1900-01-01', 1),
      event('e4', '', 0),
    ]);

    expect(sorted.map((record) => record.recordName)).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('reports Gramps-style integrity and verification issues', () => {
    const records = [
      person('p1'),
      person('p2'),
      source('empty-source'),
      { recordName: 'empty-citation', recordType: 'Citation', fields: {} },
      family('fam1', 'p1', 'p2'),
      family('fam2', 'p1', 'p2'),
      family('fam-empty', null, null),
      childRelation('cr-broken-family', 'missing-family', 'p1'),
      childRelation('cr-broken-child', 'fam1', 'missing-child'),
      childRelation('cr-no-parents', 'fam-empty', 'p1'),
      { ...person('p3'), fields: { birthEvent: ref('not-birth', 'PersonEvent'), deathEvent: ref('missing-death', 'PersonEvent') } },
      event('e-late', '1900-01-01', 1),
      event('e-early', '1899-01-01', 2),
      { recordName: 'not-birth', recordType: 'PersonEvent', fields: { person: ref('p3', 'Person'), conclusionType: field('Census') } },
    ];

    const codes = findMaintenanceIssues(records).map((issue) => issue.code);

    expect(codes).toEqual(expect.arrayContaining([
      'broken-parent-relationship',
      'family-without-parents',
      'duplicate-spouse-link',
      'empty-source-citation-record',
      'events-out-of-order',
      'invalid-birth-event-link',
      'invalid-death-event-link',
    ]));
  });
});

function person(recordName) {
  return { recordName, recordType: 'Person', fields: {} };
}

function source(recordName) {
  return { recordName, recordType: 'Source', fields: {} };
}

function family(recordName, man, woman = null) {
  return {
    recordName,
    recordType: 'Family',
    fields: {
      ...(man ? { man: ref(man, 'Person') } : {}),
      ...(woman ? { woman: ref(woman, 'Person') } : {}),
    },
  };
}

function childRelation(recordName, family, child) {
  return { recordName, recordType: 'ChildRelation', fields: { family: ref(family, 'Family'), child: ref(child, 'Person') } };
}

function event(recordName, date, order) {
  return { recordName, recordType: 'PersonEvent', fields: { person: ref('p1', 'Person'), date: field(date), order: field(order, 'NUMBER') } };
}

function ref(recordName, recordType) {
  return { value: `${recordName}---${recordType}`, type: 'REFERENCE' };
}

function field(value, type = 'STRING') {
  return { value, type };
}
