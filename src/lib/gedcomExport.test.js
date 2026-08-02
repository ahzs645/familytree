import { afterEach, describe, expect, it } from 'vitest';
import { setAppDataClientForTesting } from './data/index.js';
import { buildGedcom, formatGedcomExtensions, formatGedcomTextLines } from './gedcomExport.js';
import { parseGedcom } from './gedcomImport.js';

afterEach(() => {
  setAppDataClientForTesting(null);
});

describe('formatGedcomTextLines', () => {
  it('emits CONT lines for multiline GEDCOM text instead of flattening it', () => {
    expect(formatGedcomTextLines(1, 'NOTE', 'first line\nsecond line')).toEqual([
      '1 NOTE first line',
      '2 CONT second line',
    ]);
  });

  it('emits CONC chunks for long single-line values', () => {
    const lines = formatGedcomTextLines(1, 'TEXT', 'a'.repeat(250));

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(`1 TEXT ${'a'.repeat(220)}`);
    expect(lines[1]).toBe(`2 CONC ${'a'.repeat(30)}`);
  });
});

describe('formatGedcomExtensions', () => {
  it('emits preserved GEDCOM extension subtrees', () => {
    expect(formatGedcomExtensions([
      {
        tag: '_UID',
        value: 'abc123',
        children: [
          { tag: '_SOUR', value: '@S1@' },
        ],
      },
    ], 1)).toEqual([
      '1 _UID abc123',
      '2 _SOUR @S1@',
    ]);
  });

  it('rewrites exact pointer values when an imported xref has a new export id', () => {
    expect(formatGedcomExtensions([
      { tag: '_LINK', value: '@I9@' },
    ], 1, new Map([['@I9@', '@I1@']]))).toEqual([
      '1 _LINK @I1@',
    ]);
  });
});

describe('buildGedcom source citations', () => {
  it('exports SourceRelation rows on person and event records', async () => {
    setAppDataClientForTesting(createMemoryClient([
      { recordName: 'p1', recordType: 'Person', fields: { firstName: { value: 'Jane' }, lastName: { value: 'Doe' } } },
      { recordName: 's1', recordType: 'Source', fields: { title: { value: 'Census' } } },
      { recordName: 'e1', recordType: 'PersonEvent', fields: { person: { value: 'p1---Person', type: 'REFERENCE' }, conclusionType: { value: 'Birth' }, date: { value: '1900' } } },
      { recordName: 'sr-person', recordType: 'SourceRelation', fields: { source: { value: 's1---Source', type: 'REFERENCE' }, target: { value: 'p1---Person', type: 'REFERENCE' }, targetType: { value: 'Person' }, page: { value: '12' }, text: { value: 'household' } } },
      { recordName: 'sr-event', recordType: 'SourceRelation', fields: { source: { value: 's1---Source', type: 'REFERENCE' }, target: { value: 'e1---PersonEvent', type: 'REFERENCE' }, targetType: { value: 'PersonEvent' }, page: { value: '13' } } },
    ]));

    const gedcom = await buildGedcom();
    expect(gedcom).toContain('1 SOUR @S1@\n2 PAGE 12\n2 TEXT household');
    expect(gedcom).toContain('2 SOUR @S1@\n3 PAGE 13');
  });
});

describe('extended event GEDCOM round trip', () => {
  it('writes standard TIME, ADDR, AGNC, and CAUS tags and imports them again', async () => {
    setAppDataClientForTesting(createMemoryClient([
      { recordName: 'p1', recordType: 'Person', fields: { firstName: { value: 'Jane' }, lastName: { value: 'Doe' } } },
      {
        recordName: 'e1',
        recordType: 'PersonEvent',
        fields: {
          person: { value: 'p1---Person', type: 'REFERENCE' },
          conclusionType: { value: 'Death' },
          date: { value: '10 MAY 1999' },
          time: { value: '14:35' },
          address: { value: '12 Registry Road\nSuite 4' },
          agency: { value: 'County Registry Office' },
          cause: { value: 'Pneumonia' },
        },
      },
    ]));

    const gedcom = await buildGedcom();
    expect(gedcom).toContain('2 DATE 10 MAY 1999\n3 TIME 14:35');
    expect(gedcom).toContain('2 ADDR 12 Registry Road\n3 CONT Suite 4');
    expect(gedcom).toContain('2 AGNC County Registry Office');
    expect(gedcom).toContain('2 CAUS Pneumonia');

    const event = parseGedcom(gedcom).find((record) => (
      record.recordType === 'PersonEvent' && record.fields?.time?.value === '14:35'
    ));
    expect(event?.fields).toMatchObject({
      address: { value: '12 Registry Road\nSuite 4' },
      agency: { value: 'County Registry Office' },
      cause: { value: 'Pneumonia' },
    });
  });
});

function createMemoryClient(records) {
  return {
    records: {
      query: async (recordType) => ({ records: records.filter((record) => record.recordType === recordType), hasMore: false }),
    },
  };
}
