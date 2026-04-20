/**
 * Research Assistant — heuristic suggestions per person, sorted by gap count.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateResearchSuggestions } from '../lib/researchSuggestions.js';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { readRef } from '../lib/schema.js';

const STATE_KEY = 'researchAssistantState';
const JOURNAL_KEY = 'researchJournal';

export default function Research() {
  const [items, setItems] = useState(null);
  const [imported, setImported] = useState([]);
  const [state, setState] = useState({ done: {}, ignored: {}, ignoredEntities: {} });
  const [journal, setJournal] = useState([]);
  const [journalDraft, setJournalDraft] = useState('');
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let cancel = false;
    (async () => {
      const list = await generateResearchSuggestions();
      const db = getLocalDatabase();
      const rows = await db.query('ResearchAssistantQuestionInfo', { limit: 100000 });
      const savedState = await db.getMeta(STATE_KEY);
      const savedJournal = await db.getMeta(JOURNAL_KEY);
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
        setJournal(Array.isArray(savedJournal) ? savedJournal : []);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const persistJournal = async (next) => {
    setJournal(next);
    await getLocalDatabase().setMeta(JOURNAL_KEY, next);
  };
  const addJournalEntry = async () => {
    const text = journalDraft.trim();
    if (!text) return;
    const entry = {
      id: `rj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      text,
    };
    await persistJournal([entry, ...journal]);
    setJournalDraft('');
  };
  const removeJournalEntry = async (id) => {
    if (!confirm('Delete this research log entry?')) return;
    await persistJournal(journal.filter((entry) => entry.id !== id));
  };

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
  ).filter((item) => !state.ignoredEntities[item.recordName])
    .map((item) => ({
      ...item,
      suggestions: item.suggestions.filter((suggestion) => {
        const key = generatedKey(item.recordName, suggestion);
        return !state.done[key] && !state.ignored[key];
      }),
    })).filter((item) => item.suggestions.length > 0);
  const importedOpen = imported.filter(({ row, target }) => {
    if (state.done[row.recordName] || state.ignored[row.recordName]) return false;
    if (target?.recordName && state.ignoredEntities[target.recordName]) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">Research Assistant</h1>
        <span className="text-xs text-muted-foreground">{visible.length} persons with open questions</span>
        {Object.keys(state.ignoredEntities).length > 0 && (
          <button
            onClick={() => persistState((prev) => ({ ...prev, ignoredEntities: {} }))}
            className="text-xs text-muted-foreground hover:text-foreground border border-border bg-secondary rounded-md px-2 py-1"
            title="Restore all previously silenced persons"
          >
            {Object.keys(state.ignoredEntities).length} silenced · reset
          </button>
        )}
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…"
          className="ms-auto bg-secondary border border-border rounded-md px-3 py-1.5 text-sm w-64" />
      </header>
      <main className="flex-1 overflow-auto p-5 bg-background">
        <div className="max-w-3xl mx-auto space-y-2">
          <section className="mb-6">
            <h2 className="text-sm font-semibold mb-2">Research Log · {journal.length}</h2>
            <p className="text-xs text-muted-foreground mb-2">
              Free-text journal of what you investigated, what you found, and what you concluded. Separate from ToDos — these are narrative notes, not tasks.
            </p>
            <div className="bg-card border border-border rounded-md p-3 mb-3">
              <textarea
                value={journalDraft}
                onChange={(e) => setJournalDraft(e.target.value)}
                placeholder="Checked 1891 census for Agnes McDonald — no match. Try Glasgow registry next."
                className="w-full min-h-20 bg-background border border-border rounded-md p-2 text-sm"
              />
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={addJournalEntry}
                  disabled={!journalDraft.trim()}
                  className="text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 font-semibold disabled:opacity-60"
                >
                  Add log entry
                </button>
              </div>
            </div>
            {journal.length === 0 ? (
              <div className="text-xs text-muted-foreground">No log entries yet.</div>
            ) : (
              <ul className="space-y-2">
                {journal.map((entry) => (
                  <li key={entry.id} className="bg-card border border-border rounded-md p-3">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString()}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeJournalEntry(entry.id)}
                        className="text-[11px] text-muted-foreground hover:text-destructive"
                      >
                        Delete
                      </button>
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{entry.text}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
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
              <div className="flex items-baseline justify-between mb-2 gap-2">
                <button onClick={() => navigate(`/person/${it.recordName}`)} className="text-sm font-semibold text-primary hover:underline text-start">
                  {it.fullName}
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{it.suggestions.length} open</span>
                  <button
                    onClick={() => mark(it.recordName, 'ignoredEntities')}
                    title="Ignore all questions for this person"
                    className="text-[11px] rounded border border-border bg-secondary px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                  >
                    Ignore all
                  </button>
                </div>
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
    ignoredEntities: { ...(value?.ignoredEntities || {}) },
  };
}
