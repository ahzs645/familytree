import { describe, it, expect } from 'vitest';
import {
  parseQualifiedDate,
  formatQualifiedDate,
  displayQualifiedDate,
  hasQualifier,
  parseHistoricalDateParts,
  parseHistoricalDateRange,
  validateHistoricalDate,
  PREFIX,
  ERA,
} from './dateQualifiers.js';

describe('dateQualifiers', () => {
  describe('parseQualifiedDate', () => {
    it('handles empty input', () => {
      expect(parseQualifiedDate('')).toEqual({ prefix: '', date1: '', date2: '', era: '', phrase: '' });
      expect(parseQualifiedDate(null)).toEqual({ prefix: '', date1: '', date2: '', era: '', phrase: '' });
    });

    it('parses bare dates as unqualified', () => {
      expect(parseQualifiedDate('1820')).toMatchObject({ prefix: '', date1: '1820' });
      expect(parseQualifiedDate('2000-10-04')).toMatchObject({ prefix: '', date1: '2000-10-04' });
      expect(parseQualifiedDate('4 Jul 1776')).toMatchObject({ prefix: '', date1: '4 Jul 1776' });
    });

    it('parses ABT and aliases', () => {
      expect(parseQualifiedDate('ABT 1820').prefix).toBe(PREFIX.ABT);
      expect(parseQualifiedDate('Circa 1820').prefix).toBe(PREFIX.ABT);
      expect(parseQualifiedDate('About 1820').prefix).toBe(PREFIX.ABT);
      expect(parseQualifiedDate('CA 1820').prefix).toBe(PREFIX.ABT);
    });

    it('parses BEF / AFT / CAL / EST', () => {
      expect(parseQualifiedDate('BEF 1900')).toMatchObject({ prefix: PREFIX.BEF, date1: '1900' });
      expect(parseQualifiedDate('AFT 1820')).toMatchObject({ prefix: PREFIX.AFT, date1: '1820' });
      expect(parseQualifiedDate('CAL 1820')).toMatchObject({ prefix: PREFIX.CAL, date1: '1820' });
      expect(parseQualifiedDate('EST 1820')).toMatchObject({ prefix: PREFIX.EST, date1: '1820' });
    });

    it('parses multi-word prefix "Prior To"', () => {
      expect(parseQualifiedDate('Prior To 1900')).toMatchObject({ prefix: PREFIX.BEF, date1: '1900' });
    });

    it('parses BET ... AND range', () => {
      expect(parseQualifiedDate('BET 1701 AND 1704')).toMatchObject({
        prefix: PREFIX.BET,
        date1: '1701',
        date2: '1704',
      });
    });

    it('parses FROM ... TO span', () => {
      expect(parseQualifiedDate('FROM 1901 TO 1905')).toMatchObject({
        prefix: PREFIX.FROM,
        date1: '1901',
        date2: '1905',
      });
    });

    it('parses BC era suffix', () => {
      expect(parseQualifiedDate('44 BC')).toMatchObject({ date1: '44', era: ERA.BC });
      expect(parseQualifiedDate('ABT 500 BC')).toMatchObject({ prefix: PREFIX.ABT, date1: '500', era: ERA.BC });
    });

    it('parses INT with phrase in parens', () => {
      expect(parseQualifiedDate('INT 1820 (census)')).toMatchObject({
        prefix: PREFIX.INT,
        date1: '1820',
        phrase: 'census',
      });
    });
  });

  describe('formatQualifiedDate', () => {
    it('round-trips unqualified date', () => {
      const parsed = parseQualifiedDate('1820');
      expect(formatQualifiedDate(parsed)).toBe('1820');
    });

    it('round-trips ABT', () => {
      expect(formatQualifiedDate(parseQualifiedDate('ABT 1820'))).toBe('ABT 1820');
    });

    it('round-trips BET range', () => {
      expect(formatQualifiedDate(parseQualifiedDate('BET 1701 AND 1704'))).toBe('BET 1701 AND 1704');
    });

    it('round-trips FROM..TO span', () => {
      expect(formatQualifiedDate(parseQualifiedDate('FROM 1901 TO 1905'))).toBe('FROM 1901 TO 1905');
    });

    it('round-trips BC era', () => {
      expect(formatQualifiedDate(parseQualifiedDate('ABT 500 BC'))).toBe('ABT 500 BC');
    });

    it('round-trips INT with phrase', () => {
      expect(formatQualifiedDate(parseQualifiedDate('INT 1820 (census)'))).toBe('INT 1820 (census)');
    });

    it('emits empty string for empty parts', () => {
      expect(formatQualifiedDate({})).toBe('');
    });
  });

  describe('displayQualifiedDate', () => {
    it('renders about-form in prose', () => {
      expect(displayQualifiedDate('ABT 1820')).toBe('about 1820');
    });
    it('renders BET range in prose', () => {
      expect(displayQualifiedDate('BET 1701 AND 1704')).toBe('between 1701 and 1704');
    });
    it('renders FROM..TO span in prose', () => {
      expect(displayQualifiedDate('FROM 1901 TO 1905')).toBe('from 1901 to 1905');
    });
    it('honors supplied atomic formatter', () => {
      const fmt = (s) => `[${s}]`;
      expect(displayQualifiedDate('ABT 1820', fmt)).toBe('about [1820]');
    });
  });

  describe('hasQualifier', () => {
    it('returns false for bare dates', () => {
      expect(hasQualifier('1820')).toBe(false);
      expect(hasQualifier('')).toBe(false);
    });
    it('returns true for any prefix/era/phrase', () => {
      expect(hasQualifier('ABT 1820')).toBe(true);
      expect(hasQualifier('44 BC')).toBe(true);
      expect(hasQualifier('1820 (approx)')).toBe(true);
    });
  });

  describe('historical calendar validation', () => {
    it('parses common numeric and month-name dates', () => {
      expect(parseHistoricalDateParts('1900-02-28')).toEqual({ year: 1900, month: 2, day: 28 });
      expect(parseHistoricalDateParts('29 Feb 1904')).toEqual({ year: 1904, month: 2, day: 29 });
      expect(parseHistoricalDateParts('February 29, 1904')).toEqual({ year: 1904, month: 2, day: 29 });
    });

    it('parses Gramps-style quarter and localized month names', () => {
      expect(parseHistoricalDateRange('Q1 1900')).toEqual({
        start: { year: 1900, month: 1, day: 1 },
        end: { year: 1900, month: 3, day: 31 },
        precision: 'quarter',
      });
      expect(parseHistoricalDateRange('q4 1904')?.end).toEqual({ year: 1904, month: 12, day: 31 });
      expect(parseHistoricalDateParts('5 septembre 1789')).toEqual({ year: 1789, month: 9, day: 5 });
      expect(parseHistoricalDateParts('5 сентяб 1789')).toEqual({ year: 1789, month: 9, day: 5 });
      expect(parseHistoricalDateParts('Maj 5 1900')).toEqual({ year: 1900, month: 5, day: 5 });
    });

    it('validates Gregorian and Julian leap day differences', () => {
      expect(validateHistoricalDate('1900-02-29', 'gregorian').valid).toBe(false);
      expect(validateHistoricalDate('1900-02-29', 'julian').valid).toBe(true);
    });

    it('handles Swedish calendar exceptions', () => {
      expect(validateHistoricalDate('1712-02-30', 'swedish').valid).toBe(true);
      expect(validateHistoricalDate('1700-02-29', 'swedish').valid).toBe(false);
    });

    it('validates French Republican complementary days', () => {
      expect(validateHistoricalDate({ year: 3, month: 13, day: 6 }, 'french').valid).toBe(true);
      expect(validateHistoricalDate({ year: 3, month: 13, day: 7 }, 'french').valid).toBe(false);
    });
  });
});
