import { describe, it, expect } from 'vitest';
import { describeResidence, describeOccupation } from './narrativeTemplates.js';
import { Gender } from '../../models/constants.js';

describe('describeResidence', () => {
  it('uses the year + place template', () => {
    expect(describeResidence({ fullName: 'Anна', gender: Gender.Female }, 'Boston', '1880')).toBe('In 1880 she lived in Boston.');
  });
  it('falls back to bare place when no date', () => {
    expect(describeResidence({ fullName: 'John', gender: Gender.Male }, 'Boston', '')).toBe('He lived in Boston.');
  });
  it('falls back to bare sentence with no place', () => {
    expect(describeResidence({ fullName: 'Pat', gender: Gender.UnknownGender }, '', '')).toBe('A residence was recorded for Pat.');
  });
});

describe('describeOccupation', () => {
  it('uses the year + description template', () => {
    expect(describeOccupation({ fullName: 'John', gender: Gender.Male }, 'a blacksmith', '1890')).toBe('In 1890 he worked as a blacksmith.');
  });
  it('falls back to bare description when no date', () => {
    expect(describeOccupation({ fullName: 'Mary', gender: Gender.Female }, 'a teacher', '')).toBe('She worked as a teacher.');
  });
});
