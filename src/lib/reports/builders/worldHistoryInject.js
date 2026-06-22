/**
 * World-history interleaving for report builders.
 *
 * WORLD_EVENTS (src/lib/worldHistory.js) is otherwise only consumed by the
 * browse route. Several report builders gained a "Show World History" option;
 * when enabled they interleave the world-history rows that fall within the
 * report's covered year span. Pure data shaping — no IO.
 */
import { WORLD_EVENTS } from '../../worldHistory.js';

/** Extract the first 4-digit year from a free-form date string. */
export function yearFromDate(raw) {
  const match = String(raw || '').match(/\b(\d{3,4})\b/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Return world-history events whose [year, end] range intersects [minYear,
 * maxYear], sorted by year. A small padding widens the window so context-
 * setting events just before/after the span are still surfaced.
 *
 * @param {number|null} minYear
 * @param {number|null} maxYear
 * @param {{ pad?: number, limit?: number }} [opts]
 */
export function worldEventsInRange(minYear, maxYear, opts = {}) {
  if (!Number.isFinite(minYear) && !Number.isFinite(maxYear)) return [];
  const pad = Number.isFinite(opts.pad) ? opts.pad : 0;
  const lo = (Number.isFinite(minYear) ? minYear : maxYear) - pad;
  const hi = (Number.isFinite(maxYear) ? maxYear : minYear) + pad;
  const matches = WORLD_EVENTS.filter((event) => {
    const start = Number.isFinite(event.year) ? event.year : yearFromDate(event.date);
    if (!Number.isFinite(start)) return false;
    const end = Number.isFinite(event.end) ? event.end : start;
    return end >= lo && start <= hi;
  }).sort((a, b) => (a.year || 0) - (b.year || 0));
  return Number.isFinite(opts.limit) ? matches.slice(0, opts.limit) : matches;
}

/**
 * Compute the [min, max] year span covered by an iterable of raw date strings.
 * Returns { minYear, maxYear } with nulls when no years are parseable.
 */
export function yearSpanOfDates(dates = []) {
  let minYear = null;
  let maxYear = null;
  for (const raw of dates) {
    const year = yearFromDate(raw);
    if (year == null) continue;
    if (minYear == null || year < minYear) minYear = year;
    if (maxYear == null || year > maxYear) maxYear = year;
  }
  return { minYear, maxYear };
}

/** Format a world-history event as a single narrative line. */
export function worldEventLine(event) {
  const yearLabel = event.endDate && event.endDate !== event.date
    ? `${event.date}–${event.endDate}`
    : event.date || String(event.year || '');
  const region = event.region && event.region !== 'World' ? ` (${event.region})` : '';
  return `${yearLabel}: ${event.title}${region}`;
}
