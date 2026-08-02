import { describe, expect, it } from 'vitest';
import { renderHTML } from './html.js';

describe('renderHTML report presentation', () => {
  it('includes report locale, watermark, and table print settings', () => {
    const html = renderHTML({
      title: 'Test',
      localization: { locale: 'ar', direction: 'rtl' },
      pageStyle: { watermarkText: 'مسودة', watermarkOpacity: 0.2, tableGridLines: 'all', repeatTableHeader: true, stripeTableRows: true },
      blocks: [{ kind: 'table', columns: ['Name'], rows: [['Ada']] }],
    });
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain('class="report-watermark"');
    expect(html).toContain('مسودة');
    expect(html).toContain('display:table-header-group');
    expect(html).toContain('tbody tr:nth-child(even)');
  });
});
