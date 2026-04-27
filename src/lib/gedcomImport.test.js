import { describe, expect, it } from 'vitest';
import { analyzeGedcomText } from './gedcomImport.js';

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
});

