import { describe, it, expect } from 'vitest';
import {
  yearFromDate,
  worldEventsInRange,
  yearSpanOfDates,
  worldEventLine,
} from './worldHistoryInject.js';

describe('yearFromDate', () => {
  it('extracts a 4-digit year', () => {
    expect(yearFromDate('12 May 1900')).toBe(1900);
    expect(yearFromDate('1900-05-12')).toBe(1900);
  });
  it('returns null when no year present', () => {
    expect(yearFromDate('')).toBeNull();
    expect(yearFromDate('no date')).toBeNull();
  });
});

describe('yearSpanOfDates', () => {
  it('computes min and max years across mixed strings', () => {
    expect(yearSpanOfDates(['1850', '12 Jan 1900', 'unknown', '1875-06-01'])).toEqual({ minYear: 1850, maxYear: 1900 });
  });
  it('returns nulls when nothing parseable', () => {
    expect(yearSpanOfDates(['', 'n/a'])).toEqual({ minYear: null, maxYear: null });
  });
});

describe('worldEventsInRange', () => {
  it('returns events that intersect the span, sorted by year', () => {
    const events = worldEventsInRange(1060, 1070);
    expect(events.length).toBeGreaterThan(0);
    // 1066 Norman Conquest is in the seeded dataset and falls in range.
    expect(events.some((e) => /Norman Conquest/i.test(e.title))).toBe(true);
    const years = events.map((e) => e.year);
    expect([...years]).toEqual([...years].sort((a, b) => a - b));
  });
  it('respects the limit option', () => {
    const events = worldEventsInRange(1000, 2000, { limit: 3 });
    expect(events.length).toBeLessThanOrEqual(3);
  });
  it('returns nothing when both bounds are null', () => {
    expect(worldEventsInRange(null, null)).toEqual([]);
  });
  it('honors padding to widen the window', () => {
    const narrow = worldEventsInRange(1067, 1067);
    const padded = worldEventsInRange(1067, 1067, { pad: 5 });
    expect(padded.length).toBeGreaterThanOrEqual(narrow.length);
  });
});

describe('worldEventLine', () => {
  it('formats a single event with year and title', () => {
    const line = worldEventLine({ year: 1066, date: '1066', title: 'Norman Conquest of England', region: 'Great Britain' });
    expect(line).toBe('1066: Norman Conquest of England (Great Britain)');
  });
  it('omits a World region annotation', () => {
    const line = worldEventLine({ year: 1054, date: '1054', title: 'Great Schism', region: 'World' });
    expect(line).toBe('1054: Great Schism');
  });
  it('renders a date range when endDate differs', () => {
    const line = worldEventLine({ year: 1096, date: '1096', endDate: '1099', title: 'First Crusade', region: 'World' });
    expect(line).toBe('1096–1099: First Crusade');
  });
});
