/**
 * Centralized person display-name resolution.
 *
 * Many views render `personSummary(p).fullName` directly, which yields the
 * literal "No name recorded" (NO_NAME) for records that have neither a
 * first/last name nor a cached full name — extremely common in Arabic
 * patrilineal trees. The Persons list (loadPersonRows) already substitutes an
 * Arabic patrilineal descriptor; this helper lets every other list / picker /
 * chart apply the same fallback chain so a person never renders as a bare,
 * indistinguishable "No name recorded".
 *
 * Fallback chain: real name → Arabic patrilineal name → "No name recorded (#id)".
 */
import { NO_NAME } from '../models/index.js';

/** Compact, stable identifier for a record, e.g. "person-1381" → "#1381". */
export function shortPersonId(recordName) {
  if (!recordName) return '';
  const match = String(recordName).match(/(\d+)\s*$/);
  return match ? `#${match[1]}` : String(recordName);
}

/** True when the summary carries an actual name (not the NO_NAME placeholder). */
export function hasRealName(summary) {
  return !!(summary && summary.fullName && summary.fullName !== NO_NAME);
}

/**
 * Best display label for a person summary.
 * @param summary person summary (must expose fullName; may expose
 *   arabicPatrilinealName / arabicPatrilinealTail / recordName|id).
 * @param options.patrilineal explicit patrilineal name to prefer as fallback.
 * @param options.allowId when false, stop at NO_NAME instead of appending #id.
 */
export function personDisplayName(summary, options = {}) {
  if (!summary) return '';
  if (hasRealName(summary)) return summary.fullName;
  const patrilineal =
    options.patrilineal ||
    summary.arabicPatrilinealName ||
    summary.arabicPatrilinealTail ||
    '';
  if (patrilineal) return patrilineal;
  if (options.allowId === false) return NO_NAME;
  const id = shortPersonId(summary.recordName || summary.id);
  return id ? `${NO_NAME} (${id})` : NO_NAME;
}

export default personDisplayName;
