/**
 * Sidebar widget that lists the oldest known ancestors reachable from a person.
 * Mirrors MacFamilyTree's `OldestAncestorsWidget`.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { findOldestAncestors } from '../../lib/oldestAncestors.js';

export function OldestAncestorsWidget({ recordName }) {
  const [items, setItems] = useState(null);
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    if (!recordName) { setItems([]); return; }
    setItems(null);
    (async () => {
      try {
        const list = await findOldestAncestors(recordName, { limit: 6 });
        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => { cancelled = true; };
  }, [recordName]);

  if (items === null) return <div className="text-xs text-muted-foreground py-1">Walking ancestor lines…</div>;
  if (items.length === 0) return <div className="text-xs text-muted-foreground py-1">No ancestors recorded for this person yet.</div>;
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((ancestor) => (
        <li key={ancestor.recordName}>
          <button
            onClick={() => navigate(`/person/${ancestor.recordName}`)}
            className="text-start w-full rounded-md border border-border bg-secondary px-2 py-1.5 hover:border-muted-foreground/50"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-foreground truncate">{ancestor.fullName}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {ancestor.birthYear != null ? ancestor.birthYear : '—'}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground flex gap-2">
              <span>{ancestor.generations} gen{ancestor.generations === 1 ? '' : 's'} up</span>
              {ancestor.deathDate && <span>· d. {ancestor.deathDate}</span>}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default OldestAncestorsWidget;
