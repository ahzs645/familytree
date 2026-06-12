import { describe, expect, it } from 'vitest';
import { additionalNameSuffix, decorateSummaryName } from './additionalNames.js';

describe('additionalNameSuffix', () => {
  it('quotes nicknames and parenthesises other variants', () => {
    expect(additionalNameSuffix([{ type: 'nickname', value: 'Abu Ali' }])).toBe(' “Abu Ali”');
    expect(additionalNameSuffix([{ type: 'marriedname', value: 'Khalil' }])).toBe(' (Khalil)');
  });

  it('joins multiple variants and dedupes repeated values', () => {
    expect(additionalNameSuffix([
      { type: 'nickname', value: 'Abu Ali' },
      { type: 'marriedname', value: 'Khalil' },
      { type: 'familyname', value: 'Khalil' },
    ])).toBe(' “Abu Ali” (Khalil)');
  });

  it('returns empty for no entries', () => {
    expect(additionalNameSuffix([])).toBe('');
    expect(additionalNameSuffix(null)).toBe('');
  });
});

describe('decorateSummaryName', () => {
  it('appends the suffix for a mapped person and leaves others untouched', () => {
    const suffixes = new Map([['p1', ' “Abu Ali”']]);
    expect(decorateSummaryName({ recordName: 'p1', fullName: 'Ali' }, suffixes).fullName).toBe('Ali “Abu Ali”');
    expect(decorateSummaryName({ recordName: 'p2', fullName: 'Omar' }, suffixes).fullName).toBe('Omar');
  });

  it('is a no-op without a map', () => {
    const summary = { recordName: 'p1', fullName: 'Ali' };
    expect(decorateSummaryName(summary, null)).toBe(summary);
  });
});
