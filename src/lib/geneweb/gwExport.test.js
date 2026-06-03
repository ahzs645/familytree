import { describe, expect, it } from 'vitest';
import { Gender } from '../../models/index.js';
import { buildGeneWeb } from './gwExport.js';
import { parseGeneWeb } from './gwImport.js';

function field(value, type = 'STRING') {
  return { value, type };
}

describe('GeneWeb export', () => {
  it('exports a gwplus family subset that the parser can read back', () => {
    const records = [
      {
        recordName: 'p1',
        recordType: 'Person',
        fields: {
          firstName: field('John'),
          lastName: field('Doe'),
          gender: field(Gender.Male, 'NUMBER'),
          cached_birthDate: field('1870'),
        },
      },
      {
        recordName: 'p2',
        recordType: 'Person',
        fields: {
          firstName: field('Jane'),
          lastName: field('Smith'),
          gender: field(Gender.Female, 'NUMBER'),
        },
      },
      {
        recordName: 'p3',
        recordType: 'Person',
        fields: {
          firstName: field('Jill'),
          lastName: field('Doe'),
          gender: field(Gender.Female, 'NUMBER'),
          cached_birthDate: field('1903'),
        },
      },
      {
        recordName: 'f1',
        recordType: 'Family',
        fields: {
          man: field('p1---Person', 'REFERENCE'),
          woman: field('p2---Person', 'REFERENCE'),
          cached_marriageDate: field('1/1/1900'),
        },
      },
      {
        recordName: 'cr1',
        recordType: 'ChildRelation',
        fields: {
          family: field('f1---Family', 'REFERENCE'),
          child: field('p3---Person', 'REFERENCE'),
          order: field(0, 'NUMBER'),
        },
      },
      {
        recordName: 'n1',
        recordType: 'Note',
        fields: {
          person: field('p1---Person', 'REFERENCE'),
          text: field('Exported note'),
        },
      },
    ];

    const text = buildGeneWeb(records);
    expect(text).toContain('gwplus');
    expect(text).toContain('fam Doe John +1/1/1900 Smith Jane');
    expect(text).toContain('- f Jill 1903');
    expect(text).toContain('notes Doe John');

    const parsed = parseGeneWeb(text);
    expect(parsed.filter((record) => record.recordType === 'Family')).toHaveLength(1);
    expect(parsed.some((record) => record.recordType === 'Person' && record.fields.cached_fullName.value === 'Jill Doe')).toBe(true);
  });
});

