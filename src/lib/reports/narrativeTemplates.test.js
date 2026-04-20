import { describe, it, expect } from 'vitest';
import {
  narrativeSentenceFor,
  describeBirth,
  describeDeath,
  describeMarriage,
  EVENT,
} from './narrativeTemplates.js';
import { Gender } from '../../models/constants.js';

describe('narrativeTemplates', () => {
  it('male birth with date and place', () => {
    expect(narrativeSentenceFor(EVENT.BIRTH, Gender.Male, { Name: 'Ada', Date: '10 Dec 1815', Place: 'London' }))
      .toBe('Ada was born on 10 Dec 1815 in London.');
  });

  it('female death uses she pronoun', () => {
    const text = describeDeath({ fullName: 'Ada Lovelace', gender: Gender.Female, birthDate: '1815', deathDate: '1852' });
    expect(text).toMatch(/^She died/);
    expect(text).toContain('37');
  });

  it('unknown gender falls back to name', () => {
    const text = describeDeath({ fullName: 'X', gender: Gender.UnknownGender, deathDate: '1900' });
    expect(text.startsWith('X died')).toBe(true);
  });

  it('marriage with partner', () => {
    const text = describeMarriage(
      { fullName: 'Ada', gender: Gender.Female },
      { fullName: 'William' },
      '8 Jul 1835',
      'Surrey',
    );
    expect(text).toBe('Ada married William on 8 Jul 1835 in Surrey.');
  });

  it('progressively falls back when slots are missing', () => {
    expect(narrativeSentenceFor(EVENT.BIRTH, Gender.Male, { Name: 'Ada', Date: '1815' }))
      .toBe('Ada was born on 1815.');
    expect(narrativeSentenceFor(EVENT.BIRTH, Gender.Male, { Name: 'Ada' }))
      .toBe('Ada was born.');
  });

  it('residence uses Year slot', () => {
    expect(narrativeSentenceFor(EVENT.RESIDENCE, Gender.Male, { Name: 'Ada', Date: '1850', Year: '1850', Place: 'London' }))
      .toBe('In 1850 he lived in London.');
  });
});
