import { describe, expect, it } from 'vitest';
import { analyzeGedcomText, canImportGedcomAnalysis, parseGedcom, tokenizeGedcomText } from './gedcomImport.js';

describe('analyzeGedcomText', () => {
  it('reports duplicate XREFs as blocking shared validation issues', () => {
    const result = analyzeGedcomText([
      '0 HEAD',
      '1 GEDC',
      '2 VERS 5.5.1',
      '0 @I1@ INDI',
      '1 NAME Jane /Doe/',
      '0 @I1@ INDI',
      '1 NAME Duplicate /Doe/',
      '0 TRLR',
    ].join('\n'));

    expect(result.canImport).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scope: 'gedcom-import',
        code: 'duplicate-xref',
        severity: 'error',
        blocking: true,
        line: 6,
      }),
    ]));
  });

  it('reports unresolved record pointers without blocking import', () => {
    const result = analyzeGedcomText([
      '0 HEAD',
      '0 @F1@ FAM',
      '1 HUSB @I404@',
      '0 TRLR',
    ].join('\n'));

    expect(result.canImport).toBe(true);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'unresolved-xref',
        severity: 'warning',
        line: 3,
        refs: ['@I404@'],
      }),
    ]));
  });

  it('keeps existing GEDCOM summary counts', () => {
    const result = analyzeGedcomText([
      '0 HEAD',
      '0 @I1@ INDI',
      '1 NAME Jane /Doe/',
      '1 OBJE @M1@',
      '0 @M1@ OBJE',
      '1 FILE portrait.jpg',
      '0 TRLR',
    ].join('\n'));

    expect(result.counts).toMatchObject({ INDI: 1, FAM: 0, SOUR: 0, OBJE: 2 });
    expect(result.issues.some((issue) => issue.code === 'media-resource-matching')).toBe(true);
  });

  it('reports structural token diagnostics before import mapping', () => {
    const result = analyzeGedcomText([
      '0 HEAD',
      '1 SOUR Test',
      '3 VERS bad jump',
      '0 CONT orphan',
      '0 TRLR',
    ].join('\n'));

    expect(result.canImport).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'level-jump', severity: 'error', line: 3 }),
      expect.objectContaining({ code: 'orphan-continuation', severity: 'error', line: 4 }),
    ]));
  });

  it('tracks custom tags and continuation usage for review', () => {
    const result = analyzeGedcomText([
      '0 HEAD',
      '0 @I1@ INDI',
      '1 NAME Jane /Doe/',
      '1 NOTE first',
      '2 CONT second',
      '1 _UID abc123',
      '0 TRLR',
    ].join('\n'));

    expect(result.counts).toMatchObject({ customTags: 1, continuations: 1 });
    expect(result.tags).toContain('_UID');
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'custom-tags', severity: 'warning', refs: ['_UID'] }),
    ]));
  });
});

describe('tokenizeGedcomText', () => {
  it('keeps line numbers on valid tokens and reports malformed lines', () => {
    const result = tokenizeGedcomText(['0 HEAD', 'not gedcom', '0 TRLR'].join('\n'));

    expect(result.tokens.map((token) => [token.line, token.level, token.tag])).toEqual([
      [1, 0, 'HEAD'],
      [3, 0, 'TRLR'],
    ]);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'gedcom-syntax', line: 2, severity: 'error' }),
    ]));
  });
});

describe('canImportGedcomAnalysis', () => {
  it('applies strict, review, and lenient import modes', () => {
    const warningOnly = analyzeGedcomText([
      '0 HEAD',
      '0 @I1@ INDI',
      '1 NAME Jane /Doe/',
      '1 _UID abc123',
      '0 TRLR',
    ].join('\n'));
    const syntaxError = analyzeGedcomText(['0 HEAD', 'not gedcom', '0 TRLR'].join('\n'));
    const duplicate = analyzeGedcomText(['0 HEAD', '0 @I1@ INDI', '0 @I1@ INDI', '0 TRLR'].join('\n'));

    expect(canImportGedcomAnalysis(warningOnly, 'strict')).toBe(false);
    expect(canImportGedcomAnalysis(warningOnly, 'review')).toBe(true);
    expect(canImportGedcomAnalysis(syntaxError, 'review')).toBe(false);
    expect(canImportGedcomAnalysis(syntaxError, 'lenient')).toBe(true);
    expect(canImportGedcomAnalysis(duplicate, 'lenient')).toBe(false);
  });
});

describe('parseGedcom', () => {
  it('round-trips CONT and CONC note text into imported note records', () => {
    const records = parseGedcom([
      '0 HEAD',
      '0 @I1@ INDI',
      '1 NAME Jane /Doe/',
      '1 NOTE first line',
      '2 CONT second ',
      '2 CONC line',
      '0 TRLR',
    ].join('\n'));

    const note = records.find((record) => record.recordType === 'Note');
    expect(note?.fields?.text?.value).toBe('first line\nsecond line');
  });

  it('preserves unknown GEDCOM subtrees on imported records', () => {
    const records = parseGedcom([
      '0 HEAD',
      '0 @I9@ INDI',
      '1 NAME Jane /Doe/',
      '1 _UID abc123',
      '1 BIRT',
      '2 DATE 1900',
      '2 _ORIG imported birth note',
      '0 @F1@ FAM',
      '1 HUSB @I9@',
      '1 _REL custom family metadata',
      '0 TRLR',
    ].join('\n'));

    const person = records.find((record) => record.recordType === 'Person');
    const birth = records.find((record) => record.recordType === 'PersonEvent');
    const family = records.find((record) => record.recordType === 'Family');

    expect(person?.fields?.gedcomXref?.value).toBe('@I9@');
    expect(person?.fields?.gedcomExtensions?.value).toEqual([
      expect.objectContaining({ tag: '_UID', value: 'abc123' }),
    ]);
    expect(birth?.fields?.gedcomExtensions?.value).toEqual([
      expect.objectContaining({ tag: '_ORIG', value: 'imported birth note' }),
    ]);
    expect(family?.fields?.gedcomExtensions?.value).toEqual([
      expect.objectContaining({ tag: '_REL', value: 'custom family metadata' }),
    ]);
  });
});
