import { describe, expect, it } from 'vitest';
import { block, emptyReport } from './ast.js';
import { localizeReportAst } from './localizeReport.js';
import { translate } from '../translate.js';

const ar = (key, params) => translate(key, params, { localization: { locale: 'ar' } });

describe('localizeReportAst', () => {
  it('localizes table column headers', () => {
    // Regression: this pass read `entry.headers`, but ast.js emits `columns`,
    // so report tables rendered English headers in every locale.
    const report = emptyReport('Person Summary');
    report.blocks.push(block.table(['Type', 'Date', 'Description'], [['Birth', '1900', '-']]));

    const { columns } = localizeReportAst(report, ar).blocks[0];

    expect(columns).toEqual([ar('reports.type'), ar('glossary.date'), ar('reports.terms.description')]);
    expect(columns.every((c) => !/^(Type|Date|Description)$/.test(c))).toBe(true);
  });

  it('localizes known structural values in table rows', () => {
    const report = emptyReport('Changes List');
    report.blocks.push(block.table(['Changes', 'Still in Database'], [['Delete', 'Yes']]));
    const table = localizeReportAst(report, ar).blocks[0];
    expect(table.rows[0]).toEqual([ar('reports.terms.delete'), ar('common.yes')]);
  });

  it('localizes the label half of "Label: value" lines and leaves the value alone', () => {
    const report = emptyReport('Person Summary');
    report.blocks.push(block.paragraph('Born: 10 04 2000'));
    report.blocks.push(block.list(['Father: رعد جليل ابراهيم', 'Mother: جنان سامي قاسم']));

    const out = localizeReportAst(report, ar);

    expect(out.blocks[0].text).toBe(`${ar('glossary.birth')}: 10 04 2000`);
    expect(out.blocks[1].items).toEqual([
      `${ar('glossary.father')}: رعد جليل ابراهيم`,
      `${ar('glossary.mother')}: جنان سامي قاسم`,
    ]);
  });

  it('leaves record data and unrecognised text untouched', () => {
    const report = emptyReport('Person Summary');
    report.blocks.push(block.paragraph('احمد رعد جليل'));
    report.blocks.push(block.paragraph('Occupation notes: worked in Baghdad'));
    report.blocks.push(block.table(['Name'], [['احمد رعد جليل']]));

    const out = localizeReportAst(report, ar);

    expect(out.blocks[0].text).toBe('احمد رعد جليل');
    // "Occupation notes" is not a term — the whole line passes through.
    expect(out.blocks[1].text).toBe('Occupation notes: worked in Baghdad');
    expect(out.blocks[2].rows[0]).toEqual(['احمد رعد جليل']);
  });

  it('is a no-op without a translator', () => {
    const report = emptyReport('Person Summary');
    report.blocks.push(block.table(['Type'], [['Birth']]));
    expect(localizeReportAst(report, null)).toBe(report);
  });
});
