import { describe, expect, it } from 'vitest';
import {
  CALENDAR,
  DATE_PRECISION,
  ageInYears,
  compareGenealogyDates,
  extractComparableDate,
  normalizeDateString,
  normalizeGedcomDateLine,
  parseGenealogyDate,
  sortGenealogyDates,
} from './genealogyDate.js';

describe('genealogyDate', () => {
  it('parses exact dates with day, month, and year precision', () => {
    const parsed = parseGenealogyDate('4 jan 1900');

    expect(parsed).toMatchObject({
      precision: DATE_PRECISION.EXACT,
      calendar: CALENDAR.GREGORIAN,
      normalized: '4 JAN 1900',
    });
    expect(parsed.comparable.start).toEqual({ year: 1900, month: 1, day: 4 });
  });

  it('parses partial dates and keeps only known comparable parts', () => {
    expect(parseGenealogyDate('APR 1850').comparable.start).toEqual({ year: 1850, month: 4, day: null });
    expect(parseGenealogyDate('1850').comparable.start).toEqual({ year: 1850, month: null, day: null });
    expect(parseGenealogyDate('1850-04').normalized).toBe('APR 1850');
  });

  it('parses approximate, before, and after dates', () => {
    expect(parseGenealogyDate('about 1820')).toMatchObject({
      precision: DATE_PRECISION.ABOUT,
      normalized: 'ABT 1820',
    });
    expect(parseGenealogyDate('BEFORE 1900')).toMatchObject({
      precision: DATE_PRECISION.BEFORE,
      normalized: 'BEF 1900',
    });
    expect(parseGenealogyDate('aft 1 Feb 1900')).toMatchObject({
      precision: DATE_PRECISION.AFTER,
      normalized: 'AFT 1 FEB 1900',
    });
  });

  it('parses between and from-to ranges', () => {
    const between = parseGenealogyDate('BET 1701 and 1704');
    expect(between).toMatchObject({
      precision: DATE_PRECISION.BETWEEN,
      normalized: 'BET 1701 AND 1704',
    });
    expect(between.comparable).toEqual({
      start: { year: 1701, month: null, day: null },
      end: { year: 1704, month: null, day: null },
    });

    const fromTo = parseGenealogyDate('FROM 1 Mar 1901 TO 1905');
    expect(fromTo).toMatchObject({
      precision: DATE_PRECISION.FROM_TO,
      normalized: 'FROM 1 MAR 1901 TO 1905',
    });
    expect(fromTo.comparable.start).toEqual({ year: 1901, month: 3, day: 1 });
    expect(fromTo.comparable.end).toEqual({ year: 1905, month: null, day: null });
  });

  it('parses period dates with only a start or an end', () => {
    expect(parseGenealogyDate('FROM 1901')).toMatchObject({
      precision: DATE_PRECISION.PERIOD,
      normalized: 'FROM 1901',
      comparable: { start: { year: 1901, month: null, day: null }, end: null },
    });
    expect(parseGenealogyDate('TO 1905')).toMatchObject({
      precision: DATE_PRECISION.PERIOD,
      normalized: 'TO 1905',
      comparable: { start: null, end: { year: 1905, month: null, day: null } },
    });
  });

  it('keeps lightweight calendar placeholders without converting calendars', () => {
    const julian = parseGenealogyDate('@#DJULIAN@ 4 OCT 1582');
    expect(julian.calendar).toBe(CALENDAR.JULIAN);
    expect(julian.normalized).toBe('@#DJULIAN@ 4 OCT 1582');
    expect(julian.comparable.start).toEqual({ year: 1582, month: 10, day: 4 });

    const hebrew = parseGenealogyDate('@#DHEBREW@ 5700');
    expect(hebrew.calendar).toBe(CALENDAR.HEBREW);
    expect(hebrew.normalized).toBe('@#DHEBREW@ 5700');
    expect(hebrew.comparable.start).toEqual({ year: 5700, month: null, day: null });
  });

  it('normalizes date strings and GEDCOM DATE lines', () => {
    expect(normalizeDateString('  circa   10 september  1840 ')).toBe('ABT 10 SEP 1840');
    expect(normalizeDateString('44 BC')).toBe('44 BC');
    expect(parseGenealogyDate('44 BC').comparable.start).toEqual({ year: -43, month: null, day: null });
    expect(normalizeGedcomDateLine('2 date bet 1701 and 1704')).toBe('2 DATE BET 1701 AND 1704');
    expect(normalizeGedcomDateLine('1 NAME Ada /Lovelace/')).toBe('1 NAME Ada /Lovelace/');
  });

  it('compares and sorts by comparable date parts', () => {
    expect(compareGenealogyDates('1899', '1 JAN 1900')).toBeLessThan(0);
    expect(compareGenealogyDates('1 JAN 1900', 'FEB 1900')).toBeLessThan(0);

    expect(sortGenealogyDates(['ABT 1900', '1900', 'BEF 1900', 'AFT 1899', 'not a date'])).toEqual([
      'AFT 1899',
      'BEF 1900',
      '1900',
      'ABT 1900',
      'not a date',
    ]);
  });

  it('extracts comparable date ranges for callers that only need sort fields', () => {
    expect(extractComparableDate('FROM 1901 TO 1905')).toEqual({
      precision: DATE_PRECISION.FROM_TO,
      calendar: CALENDAR.GREGORIAN,
      start: { year: 1901, month: null, day: null },
      end: { year: 1905, month: null, day: null },
    });
    expect(extractComparableDate('date unknown')).toBeNull();
  });

  it('computes age in years from exact and partial birth/death dates', () => {
    expect(ageInYears('10 JUN 1900', '9 JUN 1950')).toBe(49);
    expect(ageInYears('10 JUN 1900', '10 JUN 1950')).toBe(50);
    expect(ageInYears('1900', '1950')).toBe(50);
    expect(ageInYears('ABT 1900', 'BEF 1950')).toBe(50);
    expect(ageInYears('1950', '1900')).toBeNull();
    expect(ageInYears('unknown', '1900')).toBeNull();
  });
});
