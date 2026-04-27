import { describe, expect, it } from 'vitest';
import { duplicatePairKey } from './duplicates.js';

describe('duplicatePairKey', () => {
  it('is stable regardless of pair order', () => {
    const a = { recordName: 'person-b', recordType: 'Person' };
    const b = { recordName: 'person-a', recordType: 'Person' };

    expect(duplicatePairKey('Person', a, b)).toBe('Person:person-a:person-b');
    expect(duplicatePairKey('Person', b, a)).toBe('Person:person-a:person-b');
  });

  it('accepts raw record names', () => {
    expect(duplicatePairKey('Source', 's2', 's1')).toBe('Source:s1:s2');
  });
});

