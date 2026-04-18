/**
 * Parse and format event dates consistently.
 *
 * MacFamilyTree event dates arrive in many shapes:
 *   "2014-09"
 *   "2000-10-04"
 *   "September 2014"
 *   "31 12 1961"
 *   "28/11/1957"
 *   "10 04 2000"
 *   "01/08/1990"
 *
 * `parseEventDate` returns { year, month, day } (month/day may be null) or null.
 * `formatEventDate` renders as ISO-ish with the components available.
 */

const MONTH_NAMES = [
  'january','february','march','april','may','june','july','august','september','october','november','december',
];

function monthIndex(token) {
  if (!token) return null;
  const t = String(token).trim().toLowerCase();
  if (!t) return null;
  const i = MONTH_NAMES.findIndex((m) => m.startsWith(t));
  return i >= 0 ? i + 1 : null;
}

function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function pad2(n) { return String(n).padStart(2, '0'); }

export function parseEventDate(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // ISO-ish: 2014-09 or 2000-10-04
  const iso = s.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/);
  if (iso) {
    return { year: toInt(iso[1]), month: toInt(iso[2]), day: toInt(iso[3]) };
  }

  // "September 2014" or "Sep 2014" or "04 September 2014"
  const monthTextMatch = s.match(/^(?:(\d{1,2})\s+)?([A-Za-z]+)\s+(\d{4})$/);
  if (monthTextMatch) {
    const m = monthIndex(monthTextMatch[2]);
    if (m) return { year: toInt(monthTextMatch[3]), month: m, day: toInt(monthTextMatch[1]) };
  }

  // Pure year: "2014"
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) return { year: toInt(yearOnly[1]), month: null, day: null };

  // Split on [/ .-] or whitespace — DD MM YYYY, DD/MM/YYYY, YYYY/MM/DD
  const parts = s.split(/[\s/.\-]+/).filter(Boolean);
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
    const [a, b, c] = parts.map(toInt);
    if (c >= 1000) return { year: c, month: b, day: a }; // DD MM YYYY
    if (a >= 1000) return { year: a, month: b, day: c }; // YYYY MM DD
  }
  if (parts.length === 2 && parts.every((p) => /^\d+$/.test(p))) {
    const [a, b] = parts.map(toInt);
    if (b >= 1000) return { year: b, month: a, day: null }; // MM YYYY
    if (a >= 1000) return { year: a, month: b, day: null }; // YYYY MM
  }

  // Fallback: scrape a 4-digit year.
  const yearMatch = s.match(/\b(\d{4})\b/);
  if (yearMatch) return { year: toInt(yearMatch[1]), month: null, day: null };
  return null;
}

export function formatEventDate(raw) {
  const d = parseEventDate(raw);
  if (!d || d.year == null) return raw ? String(raw) : '';
  if (d.day && d.month) return `${d.year}-${pad2(d.month)}-${pad2(d.day)}`;
  if (d.month) return `${d.year}-${pad2(d.month)}`;
  return String(d.year);
}

export default formatEventDate;
