/**
 * Additional-name suffixes for chart and tree labels — the web counterpart of
 * MacFamilyTree's `Person_AdditionalNamePreferenceConfiguration`. The Settings
 * preference (Formats panel) picks which variant renders; the tree/chart
 * builders load the map once per build and append the suffix to each label.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { refToRecordName } from './recordRef.js';
import { ADDITIONAL_NAME_DISPLAY, getActiveAdditionalNameDisplay } from './nameFormat.js';

// Conclusion-type ids (normalized, lowercased) admitted by each preference.
const TYPE_FILTERS = {
  [ADDITIONAL_NAME_DISPLAY.ONLY_MARRIED]: new Set(['marriedname']),
  [ADDITIONAL_NAME_DISPLAY.ONLY_FAMILY]: new Set(['familyname']),
  [ADDITIONAL_NAME_DISPLAY.ONLY_NICKNAME]: new Set(['nickname']),
};

function normalizedTypeId(record) {
  const raw = refToRecordName(record.fields?.conclusionType?.value) || record.fields?.type?.value || '';
  return String(raw)
    .replace(/^Conclusion(?:Person)?(?:AdditionalName)?Type_?/i, '')
    .replace(/^AdditionalName_?/i, '')
    .replace(/[\s_-]+/g, '')
    .toLowerCase();
}

/**
 * Map of personId -> label suffix (e.g. ' "Abu Ali"' or ' (Khalil)') for the
 * given preference. Returns null when the preference is 'none' so callers can
 * skip decoration entirely.
 */
export async function loadAdditionalNameSuffixes(preference = getActiveAdditionalNameDisplay()) {
  if (!preference || preference === ADDITIONAL_NAME_DISPLAY.NONE) return null;
  const db = getLocalDatabase();
  const { records } = await db.query('AdditionalName', { limit: 100000 });
  const filter = TYPE_FILTERS[preference] || null;
  const byPerson = new Map();
  for (const record of records) {
    const personId = refToRecordName(record.fields?.person?.value);
    const value = String(record.fields?.name?.value || record.fields?.value?.value || '').trim();
    if (!personId || !value) continue;
    const type = normalizedTypeId(record);
    if (filter && !filter.has(type)) continue;
    if (!byPerson.has(personId)) byPerson.set(personId, []);
    byPerson.get(personId).push({ type, value });
  }
  const suffixes = new Map();
  for (const [personId, entries] of byPerson) {
    const suffix = additionalNameSuffix(entries);
    if (suffix) suffixes.set(personId, suffix);
  }
  return suffixes;
}

/** Nicknames render quoted, other variants parenthesised — the Mac label style. */
export function additionalNameSuffix(entries) {
  if (!entries?.length) return '';
  const parts = [];
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.value)) continue;
    seen.add(entry.value);
    parts.push(entry.type === 'nickname' ? `“${entry.value}”` : `(${entry.value})`);
  }
  return parts.length ? ` ${parts.join(' ')}` : '';
}

/** Append the person's suffix to a summary's fullName (no-op without a map hit). */
export function decorateSummaryName(summary, suffixes) {
  if (!summary || !suffixes) return summary;
  const suffix = suffixes.get(summary.recordName);
  if (!suffix) return summary;
  return { ...summary, fullName: `${summary.fullName}${suffix}` };
}
