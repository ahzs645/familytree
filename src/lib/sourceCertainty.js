/**
 * Source certainty model — three independent axes borrowed from
 * MacFamilyTree's `CoreSourceRelations.strings` (`_SourceRelation_Quality_*`)
 * and Evidence Explained / GPS conventions.
 *
 *   - Source Quality    — nature of the source itself (original vs derived)
 *   - Information Quality — how the information was obtained
 *   - Evidence Quality  — how directly the information answers the question
 *
 * Each axis is a 3-level ordinal enum. Sorting uses the ordinal value.
 */

export const CERTAINTY = Object.freeze({
  DONT_KNOW: 'DontKnow',
  DERIVATIVE: 'Derivative',
  ORIGINAL: 'Original',
});

export const CERTAINTY_ORDER = Object.freeze({
  [CERTAINTY.DONT_KNOW]: 0,
  [CERTAINTY.DERIVATIVE]: 1,
  [CERTAINTY.ORIGINAL]: 2,
});

export const CERTAINTY_LABELS = Object.freeze({
  [CERTAINTY.DONT_KNOW]: '—',
  [CERTAINTY.DERIVATIVE]: 'Derivative',
  [CERTAINTY.ORIGINAL]: 'Original',
});

export const CERTAINTY_AXES = Object.freeze([
  { key: 'sourceQuality', label: 'Source' },
  { key: 'informationQuality', label: 'Information' },
  { key: 'evidenceQuality', label: 'Evidence' },
]);

export function readCertainty(rel, key) {
  return rel?.fields?.[key]?.value || CERTAINTY.DONT_KNOW;
}

/**
 * Combined sort key: sum of ordinals across all three axes so that
 * "Original/Original/Original" ranks highest and "DontKnow/DontKnow/DontKnow"
 * ranks lowest.
 */
export function certaintySortKey(rel) {
  return CERTAINTY_AXES.reduce((sum, { key }) => sum + (CERTAINTY_ORDER[readCertainty(rel, key)] || 0), 0);
}
