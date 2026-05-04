import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  compareStrings,
  formatInteger,
  equalsSearchText,
  localeWithExtensions,
  matchesSearchText,
  normalizeSearchText,
  resolveLocalization,
  startsWithSearchText,
  SUPPORTED_LOCALES,
  textDirection,
  wrapGraphemes,
} from './i18n.js';
import { formatEventDate } from '../utils/formatDate.js';

const fixture = JSON.parse(readFileSync(new URL('../../fixtures/arabic-smoke/records.json', import.meta.url), 'utf8'));

describe('i18n helpers', () => {
  it('normalizes Arabic search variants without mutating source text', () => {
    expect(normalizeSearchText('إِبراهيم')).toBe(normalizeSearchText('ابراهيم'));
    expect(normalizeSearchText('فاطمة')).toBe(normalizeSearchText('فاطمه'));
    expect(normalizeSearchText('رعــــد')).toBe(normalizeSearchText('رعد'));
    expect(matchesSearchText('مسؤول الأسرة', 'مسوول')).toBe(true);
    expect(startsWithSearchText('إبراهيم بن علي', 'ابراهيم')).toBe(true);
    expect(matchesSearchText('أحمد رعد الجليل', 'السيد أحمد')).toBe(true);
    expect(matchesSearchText('فاطمة الهاشمي', 'دكتورة فاطمة')).toBe(true);
  });

  it('matches Arabic names from likely English romanizations', () => {
    expect(matchesSearchText('أحمد رعد الجليل', 'Ahmad raad jalil')).toBe(true);
    expect(matchesSearchText('أحمد رعد الجليل', 'Ahmed Raad Jalil')).toBe(true);
    expect(matchesSearchText('أحمد Raad الجليل', 'ahmed raad jalil')).toBe(true);
    expect(matchesSearchText('محمد عبد الله الهاشمي', 'Mohamed Abdul Allah Hashemi')).toBe(true);
    expect(matchesSearchText('علي حسين خالد', '3li Hussain Khaled')).toBe(true);
    expect(matchesSearchText('فاطمة خديجة مريم', 'Fatimah Khadeeja Mariam')).toBe(true);
    expect(startsWithSearchText('أحمد رعد الجليل', 'Ahmed Raad')).toBe(true);
    expect(equalsSearchText('أحمد', 'Ahmed')).toBe(true);
  });

  it('resolves Arabic locale options for direction, numbering, and collation', () => {
    const localization = resolveLocalization(fixture.localization);

    expect(localization.direction).toBe('rtl');
    expect(localeWithExtensions(localization)).toContain('nu-arab');
    expect(formatInteger(1234, localization)).toMatch(/[٠-٩]/);
    expect(compareStrings('أحمد 2', 'أحمد 10', localization)).toBeLessThan(0);
  });

  it('supports Vietnamese locale and date formatting', () => {
    expect(SUPPORTED_LOCALES).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'vi', nativeLabel: 'Tiếng Việt' }),
    ]));
    expect(resolveLocalization({ locale: 'vi' }).direction).toBe('ltr');
    expect(formatEventDate('1900-01-02', { locale: 'vi' })).toBe('2 thg 1, 1900');
    expect(formatEventDate('ABT 1900', { locale: 'vi' })).toBe('khoảng 1900');
    expect(formatEventDate('FROM 1900 TO 1902', { locale: 'vi' })).toBe('từ 1900 đến 1902');
  });

  it('detects bidi direction and wraps Arabic labels by grapheme clusters', () => {
    expect(textDirection('أحمد Raad الجليل')).toBe('rtl');
    expect(textDirection('Raad الجليل')).toBe('ltr');

    const lines = wrapGraphemes('أحمد رعد الجليل الهاشمي', 10, 2);
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines.every((line) => [...line].length <= 10)).toBe(true);
  });

  it('keeps the Arabic smoke fixture searchable and sort-safe', () => {
    const names = fixture.records
      .filter((record) => record.recordType === 'Person')
      .map((record) => record.fields.cached_fullName.value);

    expect(names.some((name) => matchesSearchText(name, 'احمد raad', fixture.localization))).toBe(true);
    expect(names.some((name) => matchesSearchText(name, 'Ahmed Raad Jalil', fixture.localization))).toBe(true);
    expect(names.some((name) => matchesSearchText(name, 'ابراهيم', fixture.localization))).toBe(true);

    const sorted = [...names].sort((a, b) => compareStrings(a, b, fixture.localization));
    expect(sorted).toEqual(expect.arrayContaining(names));
  });
});
