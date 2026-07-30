import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buttonClasses } from '../components/ui/Button.jsx';
import { getAppPreferences, saveAppPreferences } from '../lib/appPreferences.js';
import { APP_FUNCTIONS, functionByRoute } from '../lib/functionCatalog.js';
import { useRecords } from '../lib/data/useRecords.js';
import { familySummary, personSummary, placeSummary, sourceSummary } from '../models/index.js';
import { BdiText } from '../components/BdiText.jsx';

const BOOKMARK_TYPES = [
  { id: 'Person', label: 'People', route: 'person', summarize: personSummary },
  { id: 'Family', label: 'Families', route: 'family', summarize: familySummary },
  { id: 'Place', label: 'Places', route: 'places', summarize: placeSummary },
  { id: 'Source', label: 'Sources', route: 'sources', summarize: sourceSummary },
];

export default function Favorites() {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState(null);
  const [status, setStatus] = useState('');
  // Fixed hook order mirrors BOOKMARK_TYPES: Person, Family, Place, Source.
  const personQuery = useRecords('Person');
  const familyQuery = useRecords('Family');
  const placeQuery = useRecords('Place');
  const sourceQuery = useRecords('Source');
  const bookmarkQueries = [personQuery, familyQuery, placeQuery, sourceQuery];
  const bookmarksLoading = bookmarkQueries.some((query) => query.loading);

  const bookmarks = useMemo(() => {
    const grouped = {};
    BOOKMARK_TYPES.forEach((type, index) => {
      grouped[type.id] = bookmarkQueries[index].records.filter((record) => record.fields?.isBookmarked?.value);
    });
    return grouped;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personQuery.records, familyQuery.records, placeQuery.records, sourceQuery.records]);

  useEffect(() => {
    let cancelled = false;
    getAppPreferences().then((nextPrefs) => {
      if (!cancelled) setPrefs(nextPrefs);
    });
    return () => { cancelled = true; };
  }, []);

  const favoriteFunctions = useMemo(() => {
    if (!prefs) return [];
    return prefs.functions.favorites
      .map(functionByRoute)
      .filter(Boolean)
      .filter((item) => !prefs.functions.hidden.includes(item.to));
  }, [prefs]);

  const addFavorite = useCallback(async (route) => {
    if (!prefs || !route) return;
    const set = new Set(prefs.functions.favorites);
    set.add(route);
    const next = { ...prefs, functions: { ...prefs.functions, favorites: [...set] } };
    await saveAppPreferences(next);
    setPrefs(next);
    setStatus('Favorite added');
    setTimeout(() => setStatus(''), 1500);
  }, [prefs]);

  const removeFavorite = useCallback(async (route) => {
    if (!prefs) return;
    const next = {
      ...prefs,
      functions: {
        ...prefs.functions,
        favorites: prefs.functions.favorites.filter((item) => item !== route),
      },
    };
    await saveAppPreferences(next);
    setPrefs(next);
  }, [prefs]);

  if (!prefs || bookmarksLoading) return <div className="p-10 text-muted-foreground">Loading favorites...</div>;

  const bookmarkTotal = Object.values(bookmarks).reduce((sum, records) => sum + records.length, 0);
  const availableToAdd = APP_FUNCTIONS.filter((item) => !item.unavailable && !prefs.functions.favorites.includes(item.to));

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-6xl mx-auto p-5">
        <header className="flex items-center gap-3 mb-5">
          <div>
            <h2 className="text-xl font-bold">Favorites</h2>
            <p className="text-sm text-muted-foreground mt-1">Favorite functions and bookmarked records.</p>
          </div>
          {status && <span className="ms-auto text-xs text-success-text">{status}</span>}
          <button onClick={() => navigate('/settings')} className={secondaryButton}>Settings</button>
        </header>

        <section className="rounded-lg border border-border bg-card p-5 mb-5">
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="me-auto">
              <h2 className="text-base font-semibold">Favorite Functions</h2>
              <div className="text-xs text-muted-foreground mt-1">{favoriteFunctions.length} shortcuts</div>
            </div>
            <select aria-label="Add a function to favorites" value="" onChange={(event) => addFavorite(event.target.value)} className={inputClass}>
              <option value="">Add function...</option>
              {availableToAdd.map((item) => <option key={item.to} value={item.to}>{item.label}</option>)}
            </select>
          </div>
          {favoriteFunctions.length === 0 ? (
            <div className="text-sm text-muted-foreground">No favorite functions selected.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {favoriteFunctions.map((item) => (
                <div key={item.to} className="rounded-md border border-border bg-background p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.category}</div>
                  <div className="text-sm font-semibold mt-1">{item.label}</div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => navigate(item.to)} className={primaryButton}>Open</button>
                    <button onClick={() => removeFavorite(item.to)} className={secondaryButton}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Bookmarked Records</h2>
          <div className="text-xs text-muted-foreground mt-1 mb-4">{bookmarkTotal} records</div>
          {bookmarkTotal === 0 ? (
            <div className="text-sm text-muted-foreground">No bookmarked records yet.</div>
          ) : (
            <div className="space-y-5">
              {BOOKMARK_TYPES.map((type) => {
                const records = bookmarks[type.id] || [];
                if (records.length === 0) return null;
                return (
                  <section key={type.id}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{type.label} · {records.length}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {records.map((record) => {
                        const summary = type.summarize(record) || {};
                        const label = summary.fullName || summary.familyName || summary.displayName || summary.name || summary.title || record.recordName;
                        const href = type.route === 'person' || type.route === 'family' ? `/${type.route}/${record.recordName}` : `/${type.route}`;
                        return (
                          <button key={record.recordName} onClick={() => navigate(href)} className="text-start rounded-md border border-border bg-background p-3 hover:bg-secondary">
                            <div className="text-sm font-medium truncate"><BdiText>{label}</BdiText></div>
                            <div className="text-[11px] text-muted-foreground mt-1">{record.recordType}</div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const inputClass = 'rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';
const primaryButton = buttonClasses({ variant: 'primary', size: 'sm' });
const secondaryButton = 'rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60';
