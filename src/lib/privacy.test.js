import { describe, it, expect } from 'vitest';
import {
  isLiving,
  isMarkedPrivate,
  isVisibleRecord,
  filterVisibleRecords,
  maskLivingDetails,
  privacyPolicyFromPreferences,
  DEFAULT_PRIVACY_POLICY,
} from './privacy.js';

function person({ birth, death, private: priv } = {}) {
  const fields = {};
  if (birth) fields.cached_birthDate = { value: birth };
  if (death) fields.cached_deathDate = { value: death };
  if (priv) fields.isPrivate = { value: true };
  return { recordType: 'Person', fields };
}

describe('privacy', () => {
  it('detects marked private records', () => {
    expect(isMarkedPrivate(person({ private: true }))).toBe(true);
    expect(isMarkedPrivate(person())).toBe(false);
  });

  it('marks recent birth with no death as living', () => {
    const year = new Date().getFullYear() - 30;
    expect(isLiving(person({ birth: String(year) }))).toBe(true);
  });

  it('does not mark records with a death date as living', () => {
    expect(isLiving(person({ birth: '1950', death: '2010' }))).toBe(false);
  });

  it('does not mark old births as living', () => {
    expect(isLiving(person({ birth: '1820' }))).toBe(false);
  });

  it('isVisibleRecord defaults: hides marked-private, keeps living', () => {
    const year = new Date().getFullYear() - 30;
    expect(isVisibleRecord(person({ private: true }))).toBe(false);
    expect(isVisibleRecord(person({ birth: String(year) }))).toBe(true);
  });

  it('isVisibleRecord hides living when policy demands it', () => {
    const year = new Date().getFullYear() - 30;
    const policy = { ...DEFAULT_PRIVACY_POLICY, hideLivingPersons: true };
    expect(isVisibleRecord(person({ birth: String(year) }), policy)).toBe(false);
  });

  it('hideLivingDetailsOnly preserves visibility but enables masking', () => {
    const year = new Date().getFullYear() - 30;
    const record = person({ birth: String(year) });
    const policy = { ...DEFAULT_PRIVACY_POLICY, hideLivingPersons: true, hideLivingDetailsOnly: true };
    expect(isVisibleRecord(record, policy)).toBe(true);
    const masked = maskLivingDetails(record, policy);
    expect(masked.fields.cached_birthDate).toBeUndefined();
  });

  it('maskLivingDetails is a no-op for non-living or when policy off', () => {
    const record = person({ birth: '1820' });
    const policy = { ...DEFAULT_PRIVACY_POLICY, hideLivingDetailsOnly: true };
    expect(maskLivingDetails(record, policy)).toBe(record);
  });

  it('filterVisibleRecords skips null and hidden records', () => {
    const year = new Date().getFullYear() - 30;
    const records = [null, person(), person({ private: true }), person({ birth: String(year) })];
    expect(filterVisibleRecords(records)).toHaveLength(2);
  });

  it('privacyPolicyFromPreferences reads nested config', () => {
    const policy = privacyPolicyFromPreferences({
      privacy: { hideLivingPersons: true, livingPersonThresholdYears: 80 },
    });
    expect(policy.hideLivingPersons).toBe(true);
    expect(policy.livingPersonThresholdYears).toBe(80);
    expect(policy.hideMarkedPrivate).toBe(true);
  });
});
