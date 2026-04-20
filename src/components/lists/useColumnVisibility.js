import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * useColumnVisibility — persists a per-list column-visibility map in
 * localStorage (`list:columns:<listId>`).
 *
 * columns: [{ key, label, alwaysVisible? }] — alwaysVisible columns can't
 * be hidden (usually the name/title column).
 */
export function useColumnVisibility(listId, columns, defaults) {
  const storageKey = `list:columns:${listId}`;
  const initial = useMemo(() => {
    if (typeof localStorage === 'undefined') return defaults || columnsToDefaultMap(columns);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return { ...columnsToDefaultMap(columns), ...(defaults || {}), ...JSON.parse(raw) };
    } catch {}
    return { ...columnsToDefaultMap(columns), ...(defaults || {}) };
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [visibility, setVisibility] = useState(initial);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.setItem(storageKey, JSON.stringify(visibility)); } catch {}
  }, [storageKey, visibility]);

  const isVisible = useCallback((key) => {
    const col = columns.find((c) => c.key === key);
    if (col?.alwaysVisible) return true;
    return visibility[key] !== false;
  }, [columns, visibility]);

  const toggle = useCallback((key) => {
    const col = columns.find((c) => c.key === key);
    if (col?.alwaysVisible) return;
    setVisibility((prev) => ({ ...prev, [key]: prev[key] === false ? true : false }));
  }, [columns]);

  const resetToDefaults = useCallback(() => {
    setVisibility(columnsToDefaultMap(columns));
  }, [columns]);

  const visibleColumns = useMemo(() => columns.filter((c) => isVisible(c.key)), [columns, isVisible]);

  return { isVisible, toggle, resetToDefaults, visibleColumns };
}

function columnsToDefaultMap(columns) {
  const out = {};
  for (const col of columns) out[col.key] = col.defaultVisible !== false;
  return out;
}
