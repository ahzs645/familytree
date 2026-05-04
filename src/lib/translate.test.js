import { describe, expect, it } from 'vitest';
import { flattenKeys, MESSAGE_CATALOGS, translate } from './translate.js';

describe('translation catalogs', () => {
  it('keeps English and Arabic catalog keys aligned', () => {
    const en = flattenKeys(MESSAGE_CATALOGS.en).sort();
    const ar = flattenKeys(MESSAGE_CATALOGS.ar).sort();
    expect(ar).toEqual(en);
  });

  it('interpolates and pluralizes messages by locale', () => {
    expect(translate('common.records', { count: 1 }, { localization: { locale: 'en' } })).toBe('1 record');
    expect(translate('common.records', { count: 3 }, { localization: { locale: 'en' } })).toBe('3 records');
    expect(translate('persons.summary', { visible: '٢', total: '٥' }, { localization: { locale: 'ar' } })).toBe('٢ من ٥');
  });
});
