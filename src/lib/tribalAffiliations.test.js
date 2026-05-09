import { describe, expect, it } from 'vitest';
import { factAffiliationInfo, makeAffiliationKey } from './tribalAffiliations.js';

describe('tribal affiliation helpers', () => {
  it('recognizes imported clan facts', () => {
    const fact = {
      fields: {
        conclusionType: { value: 'UniqueID_PersonFact_Clan---ConclusionPersonFactType', type: 'REFERENCE' },
        description: { value: 'الكلابي', type: 'STRING' },
      },
    };

    expect(factAffiliationInfo(fact)).toEqual({
      name: 'الكلابي',
      level: 'clan',
      factType: 'Clan',
    });
  });

  it('normalizes affiliation keys by level and case', () => {
    expect(makeAffiliationKey('Al Azzawi', 'clan')).toBe(makeAffiliationKey('al azzawi', 'clan'));
    expect(makeAffiliationKey('Al Azzawi', 'tribe')).not.toBe(makeAffiliationKey('Al Azzawi', 'clan'));
  });
});
