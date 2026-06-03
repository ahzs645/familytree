/**
 * World History - interleave a focus person's life events with MacFamilyTree's
 * built-in historical event database.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Filter, RotateCcw, Search } from 'lucide-react';
import { useActivePerson } from '../contexts/ActivePersonContext.jsx';
import { listAllPersons, findStartPerson } from '../lib/treeQuery.js';
import { buildPersonContext } from '../lib/personContext.js';
import { PersonPicker } from '../components/charts/PersonPicker.jsx';
import { lifeSpanLabel } from '../models/index.js';
import { WORLD_EVENTS } from '../lib/worldHistory.js';
import { eventTypeLabel } from '../lib/catalogs.js';
import { formatEventDate } from '../utils/formatDate.js';
import { BdiText, LtrText } from '../components/BdiText.jsx';

const CATEGORY_STORAGE_KEY = 'worldHistory.enabledCategories';
const RANGE_PADDING_YEARS = 20;

function yearOf(s) {
  const m = String(s || '').match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

function formatRange(item) {
  const start = item.date ? formatEventDate(item.date) : '';
  const end = item.endDate ? formatEventDate(item.endDate) : '';
  if (start && end && start !== end) return `${start} - ${end}`;
  if (start) return start;
  return item.end && item.end !== item.year ? `${item.year} - ${item.end}` : String(item.year);
}

function sourceUrl(source) {
  if (!source?.startsWith('wiki/')) return null;
  return encodeURI(`https://en.wikipedia.org/wiki/${source.slice(5).replace(/\s+/g, '_')}`);
}

export default function WorldHistory() {
  const { recordName, setActivePerson } = useActivePerson();
  const [persons, setPersons] = useState([]);
  const [context, setContext] = useState(null);
  const [query, setQuery] = useState('');
  const [showPersonOnlyRange, setShowPersonOnlyRange] = useState(true);
  const [enabledCategories, setEnabledCategories] = useState(() => {
    try {
      const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
      if (raw) return new Set(JSON.parse(raw));
    } catch {}
    return null;
  });

  const allCategories = useMemo(() => [...new Set(WORLD_EVENTS.map((e) => e.kind))].sort(), []);

  useEffect(() => {
    if (enabledCategories === null) return;
    try { localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify([...enabledCategories])); } catch {}
  }, [enabledCategories]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const list = await listAllPersons();
      if (cancel) return;
      setPersons(list);
      if (!recordName) {
        const start = await findStartPerson();
        if (start && !cancel) setActivePerson(start.recordName);
      }
    })();
    return () => { cancel = true; };
  }, [recordName, setActivePerson]);

  useEffect(() => {
    if (!recordName) return;
    let cancel = false;
    (async () => {
      const ctx = await buildPersonContext(recordName);
      if (!cancel) setContext(ctx);
    })();
    return () => { cancel = true; };
  }, [recordName]);

  const focusName = context?.selfSummary?.fullName;
  const personEvents = useMemo(() => (context?.events || []).map((e) => {
    const rawDate = e.fields?.date?.value || '';
    return {
      sourceKind: 'person',
      year: yearOf(rawDate),
      title: eventTypeLabel(e.fields?.conclusionType?.value || e.fields?.eventType?.value),
      detail: e.fields?.place?.value || formatEventDate(rawDate) || '',
      date: rawDate,
      category: 'Family events',
    };
  }).filter((e) => e.year), [context]);

  const personRange = useMemo(() => {
    const years = personEvents.map((e) => e.year);
    if (years.length === 0) return null;
    return [Math.min(...years) - RANGE_PADDING_YEARS, Math.max(...years) + RANGE_PADDING_YEARS];
  }, [personEvents]);

  const visibleCategoryCount = enabledCategories === null ? allCategories.length : enabledCategories.size;
  const isEnabled = (cat) => enabledCategories === null || enabledCategories.has(cat);
  const toggleCategory = (cat) => {
    setEnabledCategories((prev) => {
      const next = prev ? new Set(prev) : new Set(allCategories);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const normalizedQuery = query.trim().toLowerCase();
  const worldEvents = useMemo(() => WORLD_EVENTS
    .filter((e) => isEnabled(e.kind))
    .filter((e) => !showPersonOnlyRange || !personRange || (e.year >= personRange[0] && e.year <= personRange[1]))
    .filter((e) => {
      if (!normalizedQuery) return true;
      return [e.title, e.kind, e.region, e.date, e.source].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
    })
    .map((e) => ({
      ...e,
      sourceKind: 'world',
      category: e.kind,
      detail: e.region,
    })), [enabledCategories, normalizedQuery, personRange, showPersonOnlyRange]);

  const items = useMemo(() => [...personEvents, ...worldEvents].sort((a, b) => (
    a.year - b.year || (a.sourceKind === 'person' ? -1 : 1) || a.title.localeCompare(b.title)
  )), [personEvents, worldEvents]);

  const featuredEvents = worldEvents.slice(0, 4);
  const firstYear = items[0]?.year;
  const lastYear = items.at(-1)?.end || items.at(-1)?.year;

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="border-b border-border bg-card px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-base font-semibold">World History</h1>
          <div className="w-full sm:w-72">
            <PersonPicker persons={persons} value={recordName} onChange={(id) => setActivePerson(id)} />
          </div>
          {focusName && (
            <span className="text-xs text-muted-foreground inline-flex flex-wrap items-baseline gap-1.5">
              <span>Timeline for</span>
              <BdiText>{focusName}</BdiText>
              {lifeSpanLabel(context?.selfSummary) && <><span aria-hidden="true">.</span><LtrText>{lifeSpanLabel(context.selfSummary)}</LtrText></>}
            </span>
          )}
          <div className="ms-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span>{worldEvents.length} historical</span>
            <span aria-hidden="true">/</span>
            <span>{personEvents.length} personal</span>
          </div>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-b border-border bg-muted/30 p-4 lg:border-b-0 lg:border-e">
          <div className="space-y-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search history"
                className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-lg font-semibold tabular-nums">{WORLD_EVENTS.length}</div>
                <div className="text-[11px] text-muted-foreground">events</div>
              </div>
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-lg font-semibold tabular-nums">{allCategories.length}</div>
                <div className="text-[11px] text-muted-foreground">sets</div>
              </div>
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-lg font-semibold tabular-nums">{firstYear && lastYear ? `${firstYear}-${lastYear}` : '-'}</div>
                <div className="text-[11px] text-muted-foreground">range</div>
              </div>
            </div>

            <div className="rounded-md border border-border bg-card p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-sm font-medium">
                  <Filter className="h-4 w-4" />
                  Categories
                </div>
                <button
                  type="button"
                  onClick={() => setEnabledCategories(null)}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-accent"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  All
                </button>
              </div>
              <div className="mb-3 text-xs text-muted-foreground">{visibleCategoryCount} of {allCategories.length} visible</div>
              <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                {allCategories.map((cat) => (
                  <label key={cat} className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent">
                    <span className="min-w-0 truncate">{cat}</span>
                    <input type="checkbox" checked={isEnabled(cat)} onChange={() => toggleCategory(cat)} />
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-2 rounded-md border border-border bg-card p-3 text-xs">
              <input
                type="checkbox"
                checked={showPersonOnlyRange}
                onChange={(event) => setShowPersonOnlyRange(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium text-foreground">Follow the selected life span</span>
                <span className="text-muted-foreground">Show world events near the selected person&apos;s dated events.</span>
              </span>
            </label>
          </div>
        </aside>

        <section className="min-h-0 overflow-auto p-5">
          <div className="mx-auto max-w-5xl">
            {featuredEvents.length > 0 && (
              <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {featuredEvents.map((event) => (
                  <div key={`${event.title}-${event.year}`} className="rounded-md border border-border bg-card p-3">
                    <div className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">{formatRange(event)}</div>
                    <div className="text-sm font-semibold leading-snug">{event.title}</div>
                    <div className="mt-2 truncate text-xs text-muted-foreground">{event.category}</div>
                  </div>
                ))}
              </div>
            )}

            {items.length === 0 ? (
              <div className="rounded-md border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                Pick a person with dated events or widen the filters to see world history.
              </div>
            ) : (
              <ol className="relative border-s-2 border-border ps-5">
                {items.map((it, i) => {
                  const isPerson = it.sourceKind === 'person';
                  const href = sourceUrl(it.source);
                  return (
                    <li key={`${it.sourceKind}-${it.title}-${it.year}-${i}`} className="relative pb-5">
                      <span className={`absolute -left-[27px] top-1 h-4 w-4 rounded-full border-2 ${isPerson ? 'border-primary bg-primary' : 'border-border bg-card'}`} />
                      <div className="grid gap-2 rounded-md border border-border bg-card p-3 shadow-sm sm:grid-cols-[92px_minmax(0,1fr)]">
                        <div className="text-xs font-medium tabular-nums text-muted-foreground">{formatRange(it)}</div>
                        <div className="min-w-0">
                          <div className="flex items-start gap-2">
                            <h2 className={`min-w-0 flex-1 text-sm leading-snug ${isPerson ? 'font-semibold text-primary' : 'font-semibold text-foreground'}`}>
                              {it.title}
                            </h2>
                            {href && (
                              <a href={href} target="_blank" rel="noreferrer" className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Open reference">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>{isPerson ? focusName || 'Selected person' : it.detail}</span>
                            <span aria-hidden="true">.</span>
                            <span>{isPerson ? formatEventDate(it.date) : it.category}</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
