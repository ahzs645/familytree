// @ts-check

/**
 * Build stable sections from rows that have already been sorted. Keeping the
 * input order is important: changing grouping must never silently replace the
 * user's active sort profile inside a section.
 *
 * @template T
 * @param {T[]} rows
 * @param {((row: T) => string | { key?: string, label?: string }) | undefined} getGroup
 * @param {string} fallbackLabel
 */
export function sectionRows(rows, getGroup, fallbackLabel) {
  if (!getGroup) return [{ key: 'all', label: '', rows: [...rows] }];
  /** @type {Map<string, { key: string, label: string, rows: T[] }>} */
  const sections = new Map();
  for (const row of rows) {
    const raw = getGroup(row);
    const descriptor = typeof raw === 'object' && raw
      ? { key: String(raw.key || raw.label || 'unknown'), label: String(raw.label || fallbackLabel) }
      : { key: String(raw || 'unknown'), label: String(raw || fallbackLabel) };
    if (!sections.has(descriptor.key)) sections.set(descriptor.key, { ...descriptor, rows: [] });
    sections.get(descriptor.key)?.rows.push(row);
  }
  return [...sections.values()];
}

/** @param {unknown} value */
export function yearFromListDate(value) {
  const match = String(value ?? '').match(/(?:^|\D)(\d{3,4})(?:\D|$)/);
  return match ? Number(match[1]) : null;
}

/** @param {unknown} value */
export function decadeDescriptor(value) {
  const year = typeof value === 'number' ? value : yearFromListDate(value);
  if (!Number.isFinite(year)) return null;
  const decade = Math.floor(Number(year) / 10) * 10;
  return { key: String(decade), year: decade };
}

/**
 * @param {unknown} dueDate
 * @param {unknown} status
 * @param {Date} [today]
 */
export function todoScheduleBucket(dueDate, status, today = new Date()) {
  if (/^(done|completed|complete|closed)$/i.test(String(status || ''))) return 'completed';
  const raw = String(dueDate || '').trim();
  if (!raw) return 'noDueDate';
  const match = raw.match(/(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!match) return 'noDueDate';
  const due = new Date(Number(match[1]), Number(match[2] || 1) - 1, Number(match[3] || 1));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return due < start ? 'overdue' : 'upcoming';
}

/** @param {unknown} value */
export function initialDescriptor(value) {
  const text = String(value || '').trim();
  return text ? text[0].toLocaleUpperCase() : null;
}

