import { describe, expect, it } from 'vitest';
import { renderCSV } from './csv.js';

const report = {
  blocks: [
    { kind: 'title', text: 'People', level: 1 },
    { kind: 'table', columns: ['Name', 'Note'], rows: [['Ada, Jr.', 'Line one\nLine two']] },
  ],
};

describe('renderCSV', () => {
  it('supports delimiter, line endings, and omitted headers', () => {
    expect(renderCSV(report, { delimiter: ';', newline: '\r\n', includeHeader: false }))
      .toBe('Ada, Jr.;"Line one\nLine two"');
  });

  it('quotes values containing the selected delimiter', () => {
    expect(renderCSV(report, { delimiter: ',', newline: '\n', includeHeader: true }))
      .toBe('# People\nName,Note\n"Ada, Jr.","Line one\nLine two"');
  });
});
