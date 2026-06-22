import { describe, expect, it } from 'vitest';
import {
  DISTRIBUTION_TYPES,
  SUPPORTED_TYPES,
  normalizeDistributionConfig,
} from './distributionBuilder.js';

describe('distribution builder config', () => {
  it('exposes a friendly-labelled type for every supported type and vice versa', () => {
    expect(DISTRIBUTION_TYPES.length).toBe(SUPPORTED_TYPES.size);
    for (const type of DISTRIBUTION_TYPES) {
      expect(typeof type.id).toBe('string');
      expect(type.label.length).toBeGreaterThan(0);
      expect(SUPPORTED_TYPES.has(type.id)).toBe(true);
    }
  });

  it('covers the gender + fact + place-derived families MFT supports', () => {
    const ids = new Set(DISTRIBUTION_TYPES.map((type) => type.id));
    for (const expected of ['gender', 'lastName', 'birthPlace', 'birthCountry', 'occupation', 'illness', 'eyeColor', 'caste']) {
      expect(ids.has(expected)).toBe(true);
    }
  });

  it('defaults to gender for an unknown distribution type', () => {
    expect(normalizeDistributionConfig({ distributionType: 'nope' }).distributionType).toBe('gender');
    expect(normalizeDistributionConfig({}).distributionType).toBe('gender');
  });

  it('normalizes graph type to bar unless line is requested', () => {
    expect(normalizeDistributionConfig({ graphType: 'line' }).graphType).toBe('line');
    expect(normalizeDistributionConfig({ graphType: 'wat' }).graphType).toBe('bar');
    expect(normalizeDistributionConfig({}).graphType).toBe('bar');
  });

  it('coerces relativeValues to a boolean', () => {
    expect(normalizeDistributionConfig({ relativeValues: 1 }).relativeValues).toBe(true);
    expect(normalizeDistributionConfig({}).relativeValues).toBe(false);
  });

  it('keeps finite from/to year bounds and nulls everything else', () => {
    const cfg = normalizeDistributionConfig({ fromYear: 1800, toYear: 1900 });
    expect(cfg.fromYear).toBe(1800);
    expect(cfg.toYear).toBe(1900);
    const empty = normalizeDistributionConfig({ fromYear: NaN, toYear: undefined });
    expect(empty.fromYear).toBeNull();
    expect(empty.toYear).toBeNull();
  });
});
