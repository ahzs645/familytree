import { describe, expect, it } from 'vitest';
import { statisticsDrilldown } from './statistics.js';

const field = (value) => ({ value });
const persons = [
  { recordName: 'p1', recordType: 'Person', fields: { cached_fullName: field('Ada Smith'), lastName: field('Smith'), cached_birthDate: field('1901-01-01') } },
  { recordName: 'p2', recordType: 'Person', fields: { cached_fullName: field('Ben Jones'), lastName: field('Jones') } },
];

describe('statisticsDrilldown', () => {
  it('returns the persons behind century, surname, and missing-data buckets', () => {
    const records = { persons, families: [], places: [] };
    expect(statisticsDrilldown(records, { kind: 'birthCentury', value: 20 }).map((row) => row.id)).toEqual(['p1']);
    expect(statisticsDrilldown(records, { kind: 'surname', value: 'Smith' }).map((row) => row.id)).toEqual(['p1']);
    expect(statisticsDrilldown(records, { kind: 'noBirthDate' }).map((row) => row.id)).toEqual(['p2']);
  });

  it('returns families behind children-count buckets', () => {
    const family = { recordName: 'f1', recordType: 'Family', fields: { cached_familyName: field('Smith family') } };
    const records = { persons, families: [family], places: [], childrenByFamily: new Map([['f1', [{}, {}]]]) };
    expect(statisticsDrilldown(records, { kind: 'childrenPerFamily', value: 2 })).toEqual([{ id: 'f1', recordType: 'Family', label: 'Smith family' }]);
  });
});
