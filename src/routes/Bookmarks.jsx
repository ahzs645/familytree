/**
 * Bookmarks — quick-jump list of every record with isBookmarked = true,
 * grouped by record type. Supports per-group manual reordering persisted to
 * localStorage.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAppDataClient } from '../lib/data/AppDataClient.js';
import { useRecords } from '../lib/data/useRecords.js';
import { saveWithChangeLog } from '../lib/changeLog.js';
import { personSummary, familySummary, placeSummary, sourceSummary } from '../models/index.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { BdiText, LtrText } from '../components/BdiText.jsx';
import { PageTitle } from '../components/ui/PageTitle.jsx';

const TYPE_DEFS = [
  { id: 'Person', labelKey: 'bookmarks.people', route: 'person', summarize: personSummary },
  { id: 'Family', labelKey: 'bookmarks.families', route: 'family', summarize: familySummary },
  { id: 'Place', labelKey: 'bookmarks.places', route: 'places', summarize: placeSummary },
  { id: 'Source', labelKey: 'bookmarks.sources', route: 'sources', summarize: sourceSummary },
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
  const { t } = useTranslation();
  const [order, setOrder] = useState(() => loadOrder());
  const [editMode, setEditMode] = useState(false);
  const navigate = useNavigate();

  // Fixed hook order mirrors TYPE_DEFS: Person, Family, Place, Source.
  const personQuery = useRecords('Person');
  const familyQuery = useRecords('Family');
  const placeQuery = useRecords('Place');
  const sourceQuery = useRecords('Source');
  const typeQueries = [personQuery, familyQuery, placeQuery, sourceQuery];
  const loading = typeQueries.some((query) => query.loading);

  const groups = useMemo(() => {
    const result = {};
    TYPE_DEFS.forEach((def, index) => {
      result[def.id] = typeQueries[index].records.filter((r) => r.fields?.isBookmarked?.value);
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personQuery.records, familyQuery.records, placeQuery.records, sourceQuery.records]);

  const removeBookmark = async (recordName) => {
    const record = await getAppDataClient().records.get(recordName);
    if (!record) return;
    const next = { ...record, fields: { ...record.fields, isBookmarked: { value: false, type: 'BOOLEAN' } } };
    // saveWithChangeLog emits a record-change event, so the cached type list
    // refreshes and the removed bookmark drops out of `groups`.
    await saveWithChangeLog(next);
  };

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

  const total = Object.values(groups).reduce((n, list) => n + list.length, 0);
  if (loading && total === 0) return <div className="p-10 text-muted-foreground">{t('bookmarks.loading')}</div>;

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-4xl mx-auto p-5">
        <header className="mb-5 flex items-center gap-3">
          <div className="flex-1">
            <PageTitle className="text-xl font-bold">{t('bookmarks.title')}</PageTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {total === 0 ? t('bookmarks.empty') : t('bookmarks.count', { count: total })}
            </p>
          </div>
          {total > 0 ? (
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent"
            >
              {editMode ? t('bookmarks.done') : t('bookmarks.reorder')}
            </button>
          ) : null}
        </header>

        {TYPE_DEFS.map((typ) => {
          const items = applyOrder(groups[typ.id] || [], order[typ.id]);
          if (items.length === 0) return null;
          return (
            <section key={typ.id} className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t(typ.labelKey)} · {items.length}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map((r, index) => {
                  const s = typ.summarize(r) || {};
                  const label = s.fullName || s.familyName || s.displayName || s.name || s.title || r.recordName;
                  const href = typ.route === 'person' || typ.route === 'family' ? `/${typ.route}/${r.recordName}` : `/${typ.route}`;
                  return (
                    <div key={r.recordName} className="flex items-center gap-2 p-3 rounded-md border border-border bg-card hover:bg-secondary/40 transition-colors">
                      {editMode ? (
                        <div className="flex flex-col gap-1">
                          <button type="button" onClick={() => move(typ.id, r.recordName, -1)} disabled={index === 0} className="text-xs border border-border rounded px-1 disabled:opacity-40" aria-label={t('bookmarks.moveUp')}>↑</button>
                          <button type="button" onClick={() => move(typ.id, r.recordName, 1)} disabled={index === items.length - 1} className="text-xs border border-border rounded px-1 disabled:opacity-40" aria-label={t('bookmarks.moveDown')}>↓</button>
                        </div>
                      ) : null}
                      <button onClick={() => !editMode && navigate(href)}
                        className="flex-1 text-start min-w-0">
                        <div className="text-sm font-medium truncate">★ <BdiText>{label}</BdiText></div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate"><LtrText>{r.recordName}</LtrText></div>
                      </button>
                      {!editMode ? (
                        <button
                          type="button"
                          onClick={() => removeBookmark(r.recordName)}
                          className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive-text"
                          title={t('bookmarks.remove')}
                          aria-label={t('bookmarks.remove')}
                        >
                          ★✕
                        </button>
                      ) : null}
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
