import { describe, expect, it } from 'vitest';
import { normalizeReportLanguage, normalizeReportPageStyle, reportConfigurationSignature } from './presentationSettings.js';

describe('report presentation settings', () => {
  it('normalizes watermark and table settings', () => {
    expect(normalizeReportPageStyle({ watermarkText: 'DRAFT', watermarkOpacity: 9, tableGridLines: 'all', repeatTableHeader: false, stripeTableRows: true })).toMatchObject({
      watermarkText: 'DRAFT',
      watermarkOpacity: 0.35,
      tableGridLines: 'all',
      repeatTableHeader: false,
      stripeTableRows: true,
    });
  });

  it('keeps supported report locales and produces stable signatures', () => {
    expect(normalizeReportLanguage('ar')).toBe('ar');
    expect(normalizeReportLanguage('xx')).toBe('app');
    expect(reportConfigurationSignature({ builderId: 'x', options: { b: 2, a: 1 } }))
      .toBe(reportConfigurationSignature({ options: { a: 1, b: 2 }, builderId: 'x' }));
  });
});
