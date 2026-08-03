import { useEffect, useMemo, useState } from 'react';

/** Persist a list's selected grouping independently from its active sort. */
export function useGroupProfile(listId, groupOptions = [], defaultKey = 'none') {
  const storageKey = `list:group:${listId}`;
  const initial = useMemo(() => {
    const fallback = groupOptions.some((option) => option.key === defaultKey) ? defaultKey : (groupOptions[0]?.key || 'none');
    if (typeof localStorage === 'undefined') return fallback;
    try {
      const stored = localStorage.getItem(storageKey);
      return stored && groupOptions.some((option) => option.key === stored) ? stored : fallback;
    } catch {
      return fallback;
    }
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [groupKey, setGroupKey] = useState(initial);
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.setItem(storageKey, groupKey); } catch {}
  }, [groupKey, storageKey]);

  const activeGroup = groupOptions.find((option) => option.key === groupKey) || groupOptions[0] || null;
  return { groupKey, setGroupKey, groupOptions, activeGroup };
}

export default useGroupProfile;
