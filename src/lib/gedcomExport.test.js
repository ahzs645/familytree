import { describe, expect, it } from 'vitest';
import { formatGedcomExtensions, formatGedcomTextLines } from './gedcomExport.js';

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
