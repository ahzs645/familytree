import { describe, expect, it } from 'vitest';
import {
  buildOcrPageImportPlan,
  buildSeedImportPlan,
  createTribalAffiliationFromSeed,
  createTribalSourcePageRecord,
  IRAQI_TRIBES_SEED,
} from './arabicTribesDataPackage.js';
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

  it('creates bilingual Iraqi tribe seed records', () => {
    const record = createTribalAffiliationFromSeed(IRAQI_TRIBES_SEED[0]);

    expect(record.recordType).toBe('TribalAffiliation');
    expect(record.fields.name.value).toContain('/');
    expect(record.fields.arabicName.value).toBeTruthy();
    expect(record.fields.englishName.value).toBeTruthy();
    expect(record.fields.dataPackage.value).toBe('arabic-iraqi-tribes-corpus');
  });

  it('skips seed records that were already imported', () => {
    const seed = IRAQI_TRIBES_SEED[0];
    const imported = createTribalAffiliationFromSeed(seed);
    const plan = buildSeedImportPlan([imported], [seed, IRAQI_TRIBES_SEED[1]]);

    expect(plan.records).toHaveLength(1);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0].id).toBe(seed.id);
  });

  it('converts reviewed OCR page entities into tribe records with source evidence', () => {
    const page = {
      sourceId: 'nyu_aco001717',
      pageIndex: 12,
      printedPage: '٧',
      reviewStatus: 'human-reviewed',
      arabicText: 'ذكر شمر والدليم في هذا الموضع.',
      englishTranslation: 'Shammar and Dulaim are mentioned here.',
      entities: [
        { type: 'tribe', arabicName: 'شمر', englishName: 'Shammar', evidenceText: 'ذكر شمر' },
        { type: 'place', arabicName: 'العراق', englishName: 'Iraq', evidenceText: 'في العراق' },
      ],
    };

    const sourcePage = createTribalSourcePageRecord(page);
    const plan = buildOcrPageImportPlan([], [page]);

    expect(sourcePage.recordType).toBe('TribalSourcePage');
    expect(sourcePage.fields.arabicText.value).toContain('شمر');
    expect(plan.sourcePages).toHaveLength(1);
    expect(plan.affiliations).toHaveLength(1);
    expect(plan.affiliations[0].fields.confidence.value).toBe('documented');
    expect(plan.affiliations[0].fields.evidenceText.value).toBe('ذكر شمر');
  });
});
