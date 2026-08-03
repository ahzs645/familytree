import { describe, expect, it } from 'vitest';
import { rowsToCsv } from './listExport.js';

describe('rowsToCsv', () => {
  it('uses report CSV escaping and list exportValue accessors', () => {
    const csv = rowsToCsv(
      [{ name: 'Smith, Jane', hidden: 'x', nested: { year: 1901 } }],
      [
        { key: 'name', label: 'Name' },
        { key: 'year', label: 'Year', exportValue: (row) => row.nested.year },
        { key: 'hidden', label: 'Hidden', export: false },
      ]
    );
    expect(csv).toBe('Name,Year\n"Smith, Jane",1901');
  });

  it('supports the active semicolon-style separator', () => {
    expect(rowsToCsv([{ value: 'a;b' }], [{ key: 'value', label: 'Value' }], { separator: ';' }))
      .toBe('Value\n"a;b"');
  });
});
