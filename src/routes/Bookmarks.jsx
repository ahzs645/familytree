/**
 * Bookmarks — quick-jump list of every record with isBookmarked = true,
 * grouped by record type.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { personSummary, familySummary, placeSummary, sourceSummary } from '../models/index.js';

const TYPES = [
  { id: 'Person', label: 'People', route: 'person', summarize: personSummary },
  { id: 'Family', label: 'Families', route: 'family', summarize: familySummary },
  { id: 'Place', label: 'Places', route: 'places', summarize: placeSummary },
  { id: 'Source', label: 'Sources', route: 'sources', summarize: sourceSummary },
];

export default function Bookmarks() {
  const [groups, setGroups] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancel = false;
    (async () => {
      const db = getLocalDatabase();
      const result = {};
      for (const t of TYPES) {
        const { records } = await db.query(t.id, { limit: 100000 });
        result[t.id] = records.filter((r) => r.fields?.isBookmarked?.value);
      }
      if (!cancel) setGroups(result);
    })();
    return () => { cancel = true; };
  }, []);

  if (!groups) return <div className="p-10 text-muted-foreground">Loading…</div>;
  const total = Object.values(groups).reduce((n, list) => n + list.length, 0);

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-4xl mx-auto p-5">
        <header className="mb-5">
          <h1 className="text-xl font-bold">Bookmarks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total === 0
              ? 'No bookmarked records yet. Toggle the Bookmark switch in any record editor.'
              : `${total} bookmarked record${total === 1 ? '' : 's'}`}
          </p>
        </header>

        {TYPES.map((t) => {
          const items = groups[t.id] || [];
          if (items.length === 0) return null;
          return (
            <section key={t.id} className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t.label} · {items.length}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map((r) => {
                  const s = t.summarize(r) || {};
                  const label = s.fullName || s.familyName || s.displayName || s.name || s.title || r.recordName;
                  const href = t.route === 'person' || t.route === 'family' ? `/${t.route}/${r.recordName}` : `/${t.route}`;
                  return (
                    <button key={r.recordName} onClick={() => navigate(href)}
                      className="text-left p-3 rounded-md border border-border bg-card hover:bg-secondary/40 transition-colors">
                      <div className="text-sm font-medium truncate">★ {label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{r.recordName}</div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
