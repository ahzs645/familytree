import { useCallback, useMemo, useState } from 'react';

/**
 * useListSelection — tracks a set of selected row IDs with standard toggle /
 * range-select / select-all / clear operations. Pairs with BulkActionBar.
 *
 * allIds is the ordered list of currently-visible IDs (filtering applied).
 * Re-rendered lists should keep this reference stable across toggle events
 * for shift-click range to work correctly.
 */
export function useListSelection(allIds) {
  const [selected, setSelected] = useState(() => new Set());
  const [anchor, setAnchor] = useState(null);

  const isSelected = useCallback((id) => selected.has(id), [selected]);

  const toggle = useCallback((id, { range = false } = {}) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (range && anchor && allIds?.length) {
        const start = allIds.indexOf(anchor);
        const end = allIds.indexOf(id);
        if (start >= 0 && end >= 0) {
          const [lo, hi] = start <= end ? [start, end] : [end, start];
          for (let i = lo; i <= hi; i += 1) next.add(allIds[i]);
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!range) setAnchor(id);
  }, [allIds, anchor]);

  const selectAll = useCallback(() => {
    setSelected(new Set(allIds || []));
  }, [allIds]);

  const clear = useCallback(() => {
    setSelected(new Set());
    setAnchor(null);
  }, []);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const count = selected.size;
  const allSelected = allIds?.length > 0 && allIds.every((id) => selected.has(id));

  return { selectedIds, count, isSelected, toggle, selectAll, clear, allSelected };
}
