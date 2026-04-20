/**
 * Privacy model for records.
 *
 * MacFamilyTree splits privacy into three distinct concepts:
 *   1. `isMarkedPrivate`  — explicit per-record flag (`isPrivate` / `markedPrivate`).
 *   2. `isLiving`         — computed: no death date + birth within threshold.
 *   3. render policy      — export/chart/report chooses which of the above to hide.
 *
 * Earlier releases treated all three as a single boolean, so chart builders,
 * the website exporter, and the GEDCOM exporter never honored "hide living
 * person details" at render time. `isVisibleRecord(record, policy)` is the new
 * policy-aware gate; `isPublicRecord` is preserved for back-compat and is the
 * equivalent of `isVisibleRecord(record, DEFAULT_PRIVACY_POLICY)`.
 */

import { readBoolean } from './schema.js';
import { parseEventDate } from '../utils/formatDate.js';

const DEFAULT_LIVING_THRESHOLD_YEARS = 110;

export const DEFAULT_PRIVACY_POLICY = Object.freeze({
  hideMarkedPrivate: true,
  hideLivingPersons: false,
  hideLivingDetailsOnly: false, // keep the person node, strip sensitive fields
  livingPersonThresholdYears: DEFAULT_LIVING_THRESHOLD_YEARS,
});

export function isMarkedPrivate(record) {
  return readBoolean(record, ['isPrivate', 'private', 'markedPrivate'], false);
}

/**
 * A record counts as living when it looks like a Person record with a birth
 * date in the last `thresholdYears` years and no death date.
 */
export function isLiving(record, thresholdYears = DEFAULT_LIVING_THRESHOLD_YEARS) {
  if (!record || record.recordType !== 'Person') return false;
  const deathDate = record.fields?.cached_deathDate?.value
    || record.fields?.deathDate?.value
    || record.fields?.cached_deathYear?.value;
  if (deathDate) return false;
  const birthDate = record.fields?.cached_birthDate?.value
    || record.fields?.birthDate?.value
    || record.fields?.cached_birthYear?.value;
  const parsed = parseEventDate(birthDate);
  if (!parsed?.year) return false;
  const currentYear = new Date().getFullYear();
  return (currentYear - parsed.year) <= thresholdYears;
}

export function isPrivateRecord(record) {
  return isMarkedPrivate(record);
}

export function isPublicRecord(record) {
  return !!record && !isMarkedPrivate(record);
}

export function filterPublicRecords(records) {
  return (records || []).filter(isPublicRecord);
}

/**
 * Policy-aware visibility check. Returns false when a record should be hidden
 * entirely (omitted from exports/charts). When only the sensitive fields
 * should be masked (policy.hideLivingDetailsOnly), callers should keep the
 * record but pass it through `maskLivingDetails`.
 */
export function isVisibleRecord(record, policy = DEFAULT_PRIVACY_POLICY) {
  if (!record) return false;
  if (policy.hideMarkedPrivate !== false && isMarkedPrivate(record)) return false;
  if (policy.hideLivingPersons && !policy.hideLivingDetailsOnly && isLiving(record, policy.livingPersonThresholdYears)) return false;
  return true;
}

export function filterVisibleRecords(records, policy = DEFAULT_PRIVACY_POLICY) {
  return (records || []).filter((record) => isVisibleRecord(record, policy));
}

const SENSITIVE_PERSON_FIELDS = ['cached_birthDate', 'birthDate', 'cached_deathDate', 'deathDate', 'ssn', 'socialSecurity', 'phone', 'email', 'address'];

/**
 * Return a shallow clone of `record` with sensitive fields stripped. Used
 * when `policy.hideLivingDetailsOnly` is true — the person node stays visible
 * in the tree but dates/addresses don't leak.
 */
export function maskLivingDetails(record, policy = DEFAULT_PRIVACY_POLICY) {
  if (!record) return record;
  if (!policy.hideLivingDetailsOnly) return record;
  if (!isLiving(record, policy.livingPersonThresholdYears)) return record;
  const fields = { ...(record.fields || {}) };
  for (const name of SENSITIVE_PERSON_FIELDS) delete fields[name];
  return { ...record, fields };
}

export function privacyPolicyFromPreferences(prefs) {
  const p = prefs?.privacy || {};
  return {
    hideMarkedPrivate: p.hideMarkedPrivate !== false,
    hideLivingPersons: !!p.hideLivingPersons,
    hideLivingDetailsOnly: !!p.hideLivingDetailsOnly,
    livingPersonThresholdYears: Number.isFinite(+p.livingPersonThresholdYears) ? +p.livingPersonThresholdYears : DEFAULT_LIVING_THRESHOLD_YEARS,
  };
}
