/**
 * Bookmarks — quick-jump list of every record with isBookmarked = true,
 * grouped by record type. Supports per-group manual reordering persisted to
 * localStorage.
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

const ORDER_KEY = 'bookmarks.order';

function loadOrder() {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveOrder(order) {
  try { localStorage.setItem(ORDER_KEY, JSON.stringify(order)); } catch {}
}

function applyOrder(records, savedOrder) {
  if (!Array.isArray(savedOrder) || savedOrder.length === 0) return records;
  const byName = new Map(records.map((r) => [r.recordName, r]));
  const ordered = [];
  for (const id of savedOrder) {
    const rec = byName.get(id);
    if (rec) { ordered.push(rec); byName.delete(id); }
  }
  return [...ordered, ...byName.values()];
}

export default function Bookmarks() {
  const [groups, setGroups] = useState(null);
  const [order, setOrder] = useState(() => loadOrder());
  const [editMode, setEditMode] = useState(false);
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

  const move = (typeId, recordName, delta) => {
    const list = (groups[typeId] || []);
    const applied = applyOrder(list, order[typeId]);
    const index = applied.findIndex((r) => r.recordName === recordName);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= applied.length) return;
    const next = [...applied];
    [next[index], next[target]] = [next[target], next[index]];
    const nextOrder = { ...order, [typeId]: next.map((r) => r.recordName) };
    setOrder(nextOrder);
    saveOrder(nextOrder);
  };

  if (!groups) return <div className="p-10 text-muted-foreground">Loading…</div>;
  const total = Object.values(groups).reduce((n, list) => n + list.length, 0);

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-4xl mx-auto p-5">
        <header className="mb-5 flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-bold">Bookmarks</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {total === 0
                ? 'No bookmarked records yet. Toggle the Bookmark switch in any record editor.'
                : `${total} bookmarked record${total === 1 ? '' : 's'}`}
            </p>
          </div>
          {total > 0 ? (
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent"
            >
              {editMode ? 'Done' : 'Reorder'}
            </button>
          ) : null}
        </header>

        {TYPES.map((t) => {
          const items = applyOrder(groups[t.id] || [], order[t.id]);
          if (items.length === 0) return null;
          return (
            <section key={t.id} className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t.label} · {items.length}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map((r, index) => {
                  const s = t.summarize(r) || {};
                  const label = s.fullName || s.familyName || s.displayName || s.name || s.title || r.recordName;
                  const href = t.route === 'person' || t.route === 'family' ? `/${t.route}/${r.recordName}` : `/${t.route}`;
                  return (
                    <div key={r.recordName} className="flex items-center gap-2 p-3 rounded-md border border-border bg-card hover:bg-secondary/40 transition-colors">
                      {editMode ? (
                        <div className="flex flex-col gap-1">
                          <button type="button" onClick={() => move(t.id, r.recordName, -1)} disabled={index === 0} className="text-xs border border-border rounded px-1 disabled:opacity-40" aria-label="Move up">↑</button>
                          <button type="button" onClick={() => move(t.id, r.recordName, 1)} disabled={index === items.length - 1} className="text-xs border border-border rounded px-1 disabled:opacity-40" aria-label="Move down">↓</button>
                        </div>
                      ) : null}
                      <button onClick={() => !editMode && navigate(href)}
                        className="flex-1 text-start min-w-0">
                        <div className="text-sm font-medium truncate">★ {label}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{r.recordName}</div>
                      </button>
                    </div>
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
