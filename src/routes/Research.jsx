/**
 * Research Assistant — heuristic suggestions per person, sorted by gap count.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateResearchSuggestions } from '../lib/researchSuggestions.js';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { readRef } from '../lib/schema.js';

const STATE_KEY = 'researchAssistantState';

export default function Research() {
  const [items, setItems] = useState(null);
  const [imported, setImported] = useState([]);
  const [state, setState] = useState({ done: {}, ignored: {} });
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let cancel = false;
    (async () => {
      const list = await generateResearchSuggestions();
      const db = getLocalDatabase();
      const rows = await db.query('ResearchAssistantQuestionInfo', { limit: 100000 });
      const savedState = await db.getMeta(STATE_KEY);
      const hydrated = [];
      for (const row of rows.records) {
        const targetId = readRef(row.fields?.target);
        const target = targetId ? await db.getRecord(targetId) : null;
        hydrated.push({ row, target });
      }
      if (!cancel) {
        setItems(list);
        setImported(hydrated);
        setState(normalizeState(savedState));
      }
    })();
    return () => { cancel = true; };
  }, []);

  if (!items) return <div className="p-10 text-muted-foreground">Analyzing tree…</div>;
  const persistState = async (next) => {
    const normalized = normalizeState(typeof next === 'function' ? next(state) : next);
    setState(normalized);
    const db = getLocalDatabase();
    await db.setMeta(STATE_KEY, normalized);
  };
  const mark = (key, field, value = true) => persistState((prev) => ({
    ...prev,
    [field]: { ...prev[field], [key]: value },
  }));
  const visible = (filter
    ? items.filter((i) => i.suggestions.some((s) => s.toLowerCase().includes(filter.toLowerCase())) || i.fullName.toLowerCase().includes(filter.toLowerCase()))
    : items
  ).map((item) => ({
    ...item,
    suggestions: item.suggestions.filter((suggestion) => {
      const key = generatedKey(item.recordName, suggestion);
      return !state.done[key] && !state.ignored[key];
    }),
  })).filter((item) => item.suggestions.length > 0);
  const importedOpen = imported.filter(({ row }) => !state.done[row.recordName] && !state.ignored[row.recordName]);

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">Research Assistant</h1>
        <span className="text-xs text-muted-foreground">{visible.length} persons with open questions</span>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…"
          className="ml-auto bg-secondary border border-border rounded-md px-3 py-1.5 text-sm w-64" />
      </header>
      <main className="flex-1 overflow-auto p-5 bg-background">
        <div className="max-w-3xl mx-auto space-y-2">
          {importedOpen.length > 0 && (
            <section className="mb-6">
              <h2 className="text-sm font-semibold mb-2">Imported MacFamilyTree Questions · {importedOpen.length}</h2>
              <div className="space-y-2">
                {importedOpen.slice(0, 100).map(({ row, target }) => (
                  <div key={row.recordName} className="bg-card border border-border rounded-md p-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="text-sm font-semibold">
                        {row.fields?.infoKey?.value || `Question ${row.fields?.questionType?.value ?? ''}`}
                      </div>
                      <div className="text-xs text-muted-foreground">{row.fields?.targetType?.value || target?.recordType || ''}</div>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{row.fields?.infoValue?.value || 'No stored answer value.'}</div>
                    {target && (
                      <button onClick={() => navigate(target.recordType === 'Person' ? `/person/${target.recordName}` : target.recordType === 'Family' ? `/family/${target.recordName}` : '#')}
                        className="text-xs text-primary hover:underline mt-2">
                        {target.fields?.cached_fullName?.value || target.fields?.title?.value || target.recordName}
                      </button>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => mark(row.recordName, 'done')} className="text-xs rounded-md border border-border bg-secondary px-2 py-1">Mark done</button>
                      <button onClick={() => mark(row.recordName, 'ignored')} className="text-xs rounded-md border border-border bg-secondary px-2 py-1">Ignore</button>
                    </div>
                  </div>
                ))}
                {importedOpen.length > 100 && <div className="text-xs text-muted-foreground text-center">... +{importedOpen.length - 100} more imported questions</div>}
              </div>
            </section>
          )}
          {visible.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">No matching suggestions.</div>
          ) : visible.slice(0, 200).map((it) => (
            <div key={it.recordName} className="bg-card border border-border rounded-md p-4">
              <div className="flex items-baseline justify-between mb-2">
                <button onClick={() => navigate(`/person/${it.recordName}`)} className="text-sm font-semibold text-primary hover:underline text-left">
                  {it.fullName}
                </button>
                <span className="text-xs text-muted-foreground">{it.suggestions.length} open</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                {it.suggestions.map((s, i) => {
                  const key = generatedKey(it.recordName, s);
                  return (
                    <li key={i} className="flex items-start gap-2">
                      <span className="pt-1">·</span>
                      <span className="flex-1">{s}</span>
                      <button onClick={() => mark(key, 'done')} className="text-[11px] rounded border border-border bg-secondary px-1.5 py-0.5 text-foreground">Done</button>
                      <button onClick={() => mark(key, 'ignored')} className="text-[11px] rounded border border-border bg-secondary px-1.5 py-0.5 text-foreground">Ignore</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {visible.length > 200 && <div className="text-xs text-muted-foreground text-center">… +{visible.length - 200} more</div>}
        </div>
      </main>
    </div>
  );
}

function generatedKey(recordName, suggestion) {
  return `${recordName}:${suggestion}`;
}

function normalizeState(value) {
  return {
    done: { ...(value?.done || {}) },
    ignored: { ...(value?.ignored || {}) },
  };
}
