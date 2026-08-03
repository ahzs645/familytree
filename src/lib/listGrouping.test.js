import { describe, expect, it } from 'vitest';
import { decadeDescriptor, initialDescriptor, sectionRows, todoScheduleBucket, yearFromListDate } from './listGrouping.js';

describe('list grouping', () => {
  it('preserves the active row order inside first-seen sections', () => {
    const rows = [
      { id: '3', type: 'B' },
      { id: '2', type: 'A' },
      { id: '1', type: 'B' },
    ];
    expect(sectionRows(rows, (row) => row.type, 'Unknown')).toEqual([
      { key: 'B', label: 'B', rows: [rows[0], rows[2]] },
      { key: 'A', label: 'A', rows: [rows[1]] },
    ]);
  });

  it('extracts genealogy years and decades', () => {
    expect(yearFromListDate('ABT 1897')).toBe(1897);
    expect(decadeDescriptor('BET 1912 AND 1914')).toEqual({ key: '1910', year: 1910 });
    expect(decadeDescriptor('unknown')).toBeNull();
  });

  it('classifies ToDos relative to the local calendar day', () => {
    const today = new Date(2026, 7, 1, 15);
    expect(todoScheduleBucket('2026-07-31', 'Open', today)).toBe('overdue');
    expect(todoScheduleBucket('2026-08-01', 'Open', today)).toBe('upcoming');
    expect(todoScheduleBucket('', 'Open', today)).toBe('noDueDate');
    expect(todoScheduleBucket('2027-01-01', 'Done', today)).toBe('completed');
  });

  it('builds an uppercase initial and handles missing values', () => {
    expect(initialDescriptor(' smith')).toBe('S');
    expect(initialDescriptor('')).toBeNull();
  });
});
