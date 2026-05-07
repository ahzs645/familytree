/**
 * Home route — minimal dashboard.
 *
 * Layout (top to bottom):
 *   - Hero (title + body)
 *   - Import drop zone (with "Load sample" when no data)
 *   - Stats summary (when data is loaded)
 *   - Next anniversaries (max 4)
 *   - Saved trees ("My family trees")
 *
 * Wayfinding lives in the sidebar; this page no longer mirrors it.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImportDropZone } from '../components/ImportDropZone.jsx';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';
import { useModal } from '../contexts/ModalContext.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { loadSampleTree } from '../lib/sampleTree.js';
import {
  deleteTreeSnapshot,
  listTreeSnapshots,
  renameTreeSnapshot,
  restoreTreeSnapshot,
  setTreeSnapshotFavorite,
  setTreeSnapshotLabel,
} from '../lib/treeLibrary.js';
import { loadAnniversaryRows } from '../lib/listData.js';

export function Home() {
  const navigate = useNavigate();
  const { t, localization } = useTranslation();
  const { hasData, summary, refresh, clear } = useDatabaseStatus();
  const modal = useModal();

  const [sortBy, setSortBy] = useState(() => {
    try { return localStorage.getItem('treeLibrary.homeSortBy') || 'favorites'; } catch { return 'favorites'; }
  });
  const [snapshots, setSnapshots] = useState([]);
  const [upcomingAnniversaries, setUpcomingAnniversaries] = useState([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setSnapshots(await listTreeSnapshots({ sortBy }));
  }, [sortBy]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (!hasData) {
      setUpcomingAnniversaries([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const rows = await loadAnniversaryRows();
      if (!cancelled) setUpcomingAnniversaries(nextAnniversaries(rows, 30).slice(0, 4));
    })();
    return () => { cancelled = true; };
  }, [hasData, summary?.total]);
  useEffect(() => {
    try { localStorage.setItem('treeLibrary.homeSortBy', sortBy); } catch {}
  }, [sortBy]);

  const withBusy = (fn) => async (...args) => {
    setBusy(true);
    try { await fn(...args); } finally { setBusy(false); }
  };

  const onFavorite = withBusy(async (snapshot) => {
    await setTreeSnapshotFavorite(snapshot.id, !snapshot.favorite);
    await reload();
  });

  const onRename = withBusy(async (snapshot) => {
    const name = await modal.prompt(t('home.renamePrompt'), snapshot.name, { title: t('home.renameTitle') });
    if (!name) return;
    await renameTreeSnapshot(snapshot.id, name);
    await reload();
  });

  const onLabel = withBusy(async (snapshot) => {
    const label = await modal.prompt(t('home.labelPrompt'), snapshot.label || '', { title: t('home.labelTitle') });
    if (label === null) return;
    await setTreeSnapshotLabel(snapshot.id, label);
    await reload();
  });

  const onRestore = withBusy(async (snapshot) => {
    if (!(await modal.confirm(t('home.openConfirm', { name: snapshot.name }), { title: t('home.openTitle'), okLabel: t('home.openOk') }))) return;
    await restoreTreeSnapshot(snapshot.id);
    await refresh();
    await reload();
  });

  const onDelete = withBusy(async (snapshot) => {
    const answer = await modal.prompt(t('home.deletePrompt', { name: snapshot.name }), '', { title: t('home.deleteTitle'), okLabel: t('home.deleteOk'), placeholder: snapshot.name });
    if (answer === null) return;
    if (answer.trim() !== snapshot.name.trim()) {
      await modal.alert(t('home.deleteMismatch'));
      return;
    }
    await deleteTreeSnapshot(snapshot.id);
    await reload();
  });

  const localeForFormat = localization?.locale || 'en';

  return (
    <div className="px-6 py-8 pb-16 h-full overflow-auto">
      <section className="mb-8">
        <h1 className="text-3xl font-bold mb-3">{t('home.heroTitle')}</h1>
        <p className="text-muted-foreground leading-relaxed max-w-3xl">
          {t('home.heroBody')}
        </p>
      </section>

      <section className="mb-8">
        <ImportDropZone onImported={() => navigate('/tree')} />
        {!hasData && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm">
            <span className="text-muted-foreground">{t('home.or')}</span>
            <button
              type="button"
              onClick={async () => {
                const count = await loadSampleTree();
                if (count) navigate('/tree');
              }}
              className="bg-secondary border border-border rounded-md px-3 py-1.5 hover:bg-accent"
            >
              {t('home.loadSample')}
            </button>
            <span className="text-xs text-muted-foreground">{t('home.sampleHint')}</span>
          </div>
        )}
      </section>

      {hasData && summary && (
        <section className="mb-8 p-5 rounded-xl border border-border bg-card flex flex-wrap items-center gap-5">
          <div className="flex-1 min-w-[220px]">
            <div className="text-sm text-muted-foreground">{t('home.loaded')}</div>
            <div className="text-2xl font-bold">
              {t('common.records', { count: summary.total || 0 })}
            </div>
            <div className="text-xs text-muted-foreground mt-1.5">
              {t('home.summary', {
                persons: summary.types.Person || 0,
                families: summary.types.Family || 0,
                events: summary.types.PersonEvent || 0,
                places: summary.types.Place || 0,
                sources: summary.types.Source || 0,
              })}
            </div>
          </div>
          <button
            onClick={async () => {
              if (await modal.confirm(t('home.clearConfirm'), { title: t('home.clearTitle'), okLabel: t('home.clearOk'), destructive: true })) await clear();
            }}
            className="rounded-md border border-border bg-transparent text-destructive px-3 py-2 text-xs hover:bg-destructive/10"
          >
            {t('home.clearData')}
          </button>
        </section>
      )}

      {upcomingAnniversaries.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('home.nextAnniversaries')}</h2>
            <button type="button" onClick={() => navigate('/anniversaries')} className="text-xs text-primary hover:underline">{t('home.openList')}</button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {upcomingAnniversaries.map((row) => (
              <button
                key={`${row.personId}-${row.type}-${row.month}-${row.day}`}
                type="button"
                onClick={() => navigate(`/person/${row.personId}`)}
                className="text-start rounded-lg border border-border bg-card p-3 hover:bg-accent"
              >
                <div className="text-sm font-semibold truncate">{row.personName}</div>
                <div className="text-xs text-muted-foreground">
                  {translateAnniversaryType(t, row.type)} · {row.monthDayLabel}
                  {row.yearLabel ? ` · ${translateYearLabel(t, row.yearLabel)}` : ''}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {row.daysUntil === 0
                    ? t('home.today')
                    : t('home.inDays', { count: row.daysUntil })}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {snapshots.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('home.myTrees')}</h2>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-secondary border border-border rounded-md px-2 py-1 text-xs"
              aria-label={t('home.sortAria')}
            >
              <option value="favorites">{t('home.sortFavorites')}</option>
              <option value="updatedAt">{t('home.sortUpdated')}</option>
              <option value="name">{t('home.sortName')}</option>
            </select>
          </div>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
            {snapshots.map((snapshot) => (
              <li key={snapshot.id} className="p-4 rounded-xl border border-border bg-card">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">
                      {snapshot.favorite && <span aria-hidden className="text-yellow-500 me-1">★</span>}
                      {snapshot.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {t('home.treeStats', {
                        records: snapshot.recordCount.toLocaleString(localeForFormat),
                        assets: snapshot.assetCount.toLocaleString(localeForFormat),
                      })}
                      {snapshot.label ? ` · ${snapshot.label}` : ''}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {t('home.treeUpdated', { date: new Date(snapshot.updatedAt).toLocaleString(localeForFormat) })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onFavorite(snapshot)}
                    disabled={busy}
                    title={snapshot.favorite ? t('home.treeUnfavorite') : t('home.treeFavorite')}
                    aria-label={snapshot.favorite ? t('home.treeUnfavorite') : t('home.treeFavorite')}
                    className="text-lg text-muted-foreground hover:text-yellow-500"
                  >
                    {snapshot.favorite ? '★' : '☆'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <button onClick={() => onRestore(snapshot)} disabled={busy} className="text-xs bg-primary text-primary-foreground rounded-md px-2.5 py-1 font-medium">{t('home.treeOpen')}</button>
                  <button onClick={() => onRename(snapshot)} disabled={busy} className="text-xs border border-border bg-secondary rounded-md px-2.5 py-1 hover:bg-accent">{t('home.treeRename')}</button>
                  <button onClick={() => onLabel(snapshot)} disabled={busy} className="text-xs border border-border bg-secondary rounded-md px-2.5 py-1 hover:bg-accent">{t('home.treeLabel')}</button>
                  <button onClick={() => onDelete(snapshot)} disabled={busy} className="text-xs border border-border bg-transparent text-destructive rounded-md px-2.5 py-1 hover:bg-destructive/10 ms-auto">{t('home.treeDelete')}</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default Home;

function translateAnniversaryType(t, type) {
  if (type === 'Birth') return t('home.anniversaryBirth');
  if (type === 'Death') return t('home.anniversaryDeath');
  return type;
}

function translateYearLabel(t, yearLabel) {
  if (yearLabel === 'Year unknown') return t('home.yearUnknown');
  return yearLabel;
}

function nextAnniversaries(rows, daysAhead = 30, from = new Date()) {
  const start = startOfDay(from);
  return (rows || [])
    .map((row) => ({ ...row, daysUntil: daysUntilMonthDay(row.month, row.day, start) }))
    .filter((row) => Number.isFinite(row.daysUntil) && row.daysUntil <= daysAhead)
    .sort((a, b) => a.daysUntil - b.daysUntil || String(a.personName).localeCompare(String(b.personName)));
}

function daysUntilMonthDay(month, day, from) {
  if (!month || !day) return Infinity;
  const thisYear = new Date(from.getFullYear(), month - 1, day);
  const target = thisYear < from ? new Date(from.getFullYear() + 1, month - 1, day) : thisYear;
  return Math.round((target - from) / 86400000);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
