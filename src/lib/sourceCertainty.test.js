import { describe, expect, it } from 'vitest';
import { CERTAINTY, CERTAINTY_AXES, CERTAINTY_LABELS, certaintySortKey } from './sourceCertainty.js';

describe('sourceCertainty', () => {
  it('uses MacFamilyTree-specific values for each certainty axis', () => {
    expect(CERTAINTY_AXES.find((axis) => axis.key === 'sourceQuality').values).toEqual([
      CERTAINTY.DONT_KNOW,
      CERTAINTY.DERIVATIVE,
      CERTAINTY.ORIGINAL,
    ]);
    expect(CERTAINTY_AXES.find((axis) => axis.key === 'informationQuality').values).toEqual([
      CERTAINTY.DONT_KNOW,
      CERTAINTY.SECONDARY,
      CERTAINTY.PRIMARY,
    ]);
    expect(CERTAINTY_AXES.find((axis) => axis.key === 'evidenceQuality').values).toEqual([
      CERTAINTY.DONT_KNOW,
      CERTAINTY.NEGATIVE,
      CERTAINTY.INDIRECT,
      CERTAINTY.DIRECT,
    ]);
    expect(CERTAINTY_LABELS[CERTAINTY.PRIMARY]).toBe('Primary');
    expect(CERTAINTY_LABELS[CERTAINTY.DIRECT]).toBe('Direct');
  });

  it('sorts complete original primary direct evidence above weaker citations', () => {
    const strong = { fields: { sourceQuality: { value: 'Original' }, informationQuality: { value: 'Primary' }, evidenceQuality: { value: 'Direct' } } };
    const weak = { fields: { sourceQuality: { value: 'Derivative' }, informationQuality: { value: 'Secondary' }, evidenceQuality: { value: 'Indirect' } } };
    expect(certaintySortKey(strong)).toBeGreaterThan(certaintySortKey(weak));
  });
});
