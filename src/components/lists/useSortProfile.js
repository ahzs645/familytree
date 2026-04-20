import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * useSortProfile — typed sort presets per list, persisted in localStorage.
 *
 *   sortOptions: [{ key, label, compare(a, b) }]
 *   defaultKey:  initial selection when nothing is persisted.
 *
 * Each list route passes its own typed set of sort options (Mac's Sorting_By*
 * menus are the inspiration). The hook returns the current key, a setter,
 * and a `sort(rows)` helper that applies the active comparator.
 */
export function useSortProfile(listId, sortOptions, defaultKey) {
  const storageKey = `list:sort:${listId}`;
  const initial = useMemo(() => {
    const firstKey = sortOptions[0]?.key;
    if (typeof localStorage === 'undefined') return defaultKey || firstKey;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw && sortOptions.some((o) => o.key === raw)) return raw;
    } catch {}
    return defaultKey || firstKey;
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [sortKey, setSortKey] = useState(initial);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.setItem(storageKey, sortKey); } catch {}
  }, [storageKey, sortKey]);

  const active = sortOptions.find((o) => o.key === sortKey) || sortOptions[0];

  const sort = useCallback((rows) => {
    if (!active?.compare || !Array.isArray(rows)) return rows;
    return [...rows].sort(active.compare);
  }, [active]);

  return { sortKey, setSortKey, sort, sortOptions, activeLabel: active?.label };
}

export const SORT_PROFILES = Object.freeze({
  Notes: [
    { key: 'creationDate', label: 'Creation date' },
    { key: 'changeDate', label: 'Change date' },
    { key: 'text', label: 'Text' },
  ],
  Events: [
    { key: 'typeAndDate', label: 'Type + date' },
    { key: 'typeName', label: 'Type name' },
    { key: 'date', label: 'Date' },
    { key: 'description', label: 'Description' },
  ],
  ToDos: [
    { key: 'title', label: 'Title' },
    { key: 'dueDate', label: 'Due date' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'type', label: 'Type' },
  ],
  Sources: [
    { key: 'title', label: 'Title' },
    { key: 'certainty', label: 'Certainty' },
    { key: 'date', label: 'Date' },
    { key: 'page', label: 'Page' },
  ],
  Places: [
    { key: 'type', label: 'Type' },
    { key: 'date', label: 'Date' },
  ],
});
