/**
 * Research Assistant — heuristic suggestions per person, sorted by gap count.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateResearchSuggestions } from '../lib/researchSuggestions.js';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { matchesSearchText } from '../lib/i18n.js';
import { readRef, writeRef } from '../lib/schema.js';
import { logRecordCreated } from '../lib/changeLog.js';
import { useModal } from '../contexts/ModalContext.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

const STATE_KEY = 'researchAssistantState';
const JOURNAL_KEY = 'researchJournal';

function uuid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Research() {
  const modal = useModal();
  const { t, localization } = useTranslation();
  const [items, setItems] = useState(null);
  const [imported, setImported] = useState([]);
  const [state, setState] = useState({ done: {}, ignored: {}, ignoredEntities: {} });
  const [journal, setJournal] = useState([]);
  const [journalDraft, setJournalDraft] = useState('');
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState(null);
  const [creatingKeys, setCreatingKeys] = useState({});
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
    if (!(await modal.confirm(t('research.deleteEntryConfirm'), { title: t('research.deleteEntryTitle'), okLabel: t('research.deleteEntryOk'), destructive: true }))) return;
    await persistJournal(journal.filter((entry) => entry.id !== id));
  };

  if (!items) return <div className="p-10 text-muted-foreground">{t('research.analyzing')}</div>;
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
  const createTodo = async ({ key, title, description, target }) => {
    if (!title || !target?.recordName || creatingKeys[key]) return;
    setCreatingKeys((prev) => ({ ...prev, [key]: true }));
    setStatus(null);
    try {
      const db = getLocalDatabase();
      const todo = {
        recordName: uuid('todo'),
        recordType: 'ToDo',
        fields: {
          title: { value: title, type: 'STRING' },
          type: { value: 'Research', type: 'STRING' },
          status: { value: 'Open', type: 'STRING' },
          priority: { value: 'Normal', type: 'STRING' },
          description: { value: description, type: 'STRING' },
        },
      };
      const relation = {
        recordName: uuid('todo-rel'),
        recordType: 'ToDoRelation',
        fields: {
          todo: writeRef(todo.recordName, 'ToDo'),
          target: writeRef(target.recordName, target.recordType || 'Person'),
          targetType: { value: target.recordType || 'Person', type: 'STRING' },
        },
      };
      await db.applyRecordTransaction({ saveRecords: [todo, relation] });
      await logRecordCreated(todo);
      await mark(key, 'done');
      setStatus(t('research.todoCreated'));
      setTimeout(() => setStatus(null), 1800);
    } catch (error) {
      setStatus(t('research.todoFailed', { message: error.message }));
    } finally {
      setCreatingKeys((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };
  const suggestionDisplay = (s) => (typeof s === 'string' ? s : t(s.i18nKey));
  const suggestionKey = (s) => (typeof s === 'string' ? s : s.key);
  const visible = (filter
    ? items.filter((i) => i.suggestions.some((s) => matchesSearchText(suggestionDisplay(s), filter)) || matchesSearchText(i.fullName, filter))
    : items
  ).filter((item) => !state.ignoredEntities[item.recordName])
    .map((item) => ({
      ...item,
      suggestions: item.suggestions.filter((suggestion) => {
        const key = generatedKey(item.recordName, suggestionKey(suggestion));
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
      <header className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">{t('research.title')}</h1>
        <span className="text-xs text-muted-foreground">{t('research.openQuestions', { count: visible.length })}</span>
        {status && <span className="text-xs text-muted-foreground">{status}</span>}
        {Object.keys(state.ignoredEntities).length > 0 && (
          <button
            onClick={() => persistState((prev) => ({ ...prev, ignoredEntities: {} }))}
            className="text-xs text-muted-foreground hover:text-foreground border border-border bg-secondary rounded-md px-2 py-1"
            title={t('research.silencedResetTitle')}
          >
            {t('research.silencedReset', { count: Object.keys(state.ignoredEntities).length })}
          </button>
        )}
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('research.filterPlaceholder')}
          className="w-full bg-secondary border border-border rounded-md px-3 py-1.5 text-sm md:ms-auto md:w-64" />
      </header>
      <main className="flex-1 overflow-auto p-5 bg-background">
        <div className="max-w-3xl mx-auto space-y-2">
          <section className="mb-6">
            <h2 className="text-sm font-semibold mb-2">{t('research.researchLog', { count: journal.length })}</h2>
            <p className="text-xs text-muted-foreground mb-2">{t('research.researchLogBody')}</p>
            <div className="bg-card border border-border rounded-md p-3 mb-3">
              <textarea
                value={journalDraft}
                onChange={(e) => setJournalDraft(e.target.value)}
                placeholder={t('research.logPlaceholder')}
                className="w-full min-h-20 bg-background border border-border rounded-md p-2 text-sm"
              />
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={addJournalEntry}
                  disabled={!journalDraft.trim()}
                  className="text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 font-semibold disabled:opacity-60"
                >
                  {t('research.addLogEntry')}
                </button>
              </div>
            </div>
            {journal.length === 0 ? (
              <div className="text-xs text-muted-foreground">{t('research.noLogEntries')}</div>
            ) : (
              <ul className="space-y-2">
                {journal.map((entry) => (
                  <li key={entry.id} className="bg-card border border-border rounded-md p-3">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString(localization?.locale || 'en')}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeJournalEntry(entry.id)}
                        className="text-[11px] text-muted-foreground hover:text-destructive"
                      >
                        {t('research.delete')}
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
              <h2 className="text-sm font-semibold mb-2">{t('research.importedQuestions', { count: importedOpen.length })}</h2>
              <div className="space-y-2">
                {importedOpen.slice(0, 100).map(({ row, target }) => (
                  <div key={row.recordName} className="bg-card border border-border rounded-md p-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="text-sm font-semibold">
                        {row.fields?.infoKey?.value || t('research.questionLabel', { type: row.fields?.questionType?.value ?? '' })}
                      </div>
                      <div className="text-xs text-muted-foreground">{row.fields?.targetType?.value || target?.recordType || ''}</div>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{row.fields?.infoValue?.value || t('research.noAnswer')}</div>
                    {target && (
                      <button onClick={() => navigate(target.recordType === 'Person' ? `/person/${target.recordName}` : target.recordType === 'Family' ? `/family/${target.recordName}` : '#')}
                        className="text-xs text-primary hover:underline mt-2">
                        {target.fields?.cached_fullName?.value || target.fields?.title?.value || target.recordName}
                      </button>
                    )}
                    <div className="flex gap-2 mt-3">
                      {target && (
                        <button
                          onClick={() => createTodo({
                            key: row.recordName,
                            title: row.fields?.infoKey?.value || t('research.questionLabel', { type: row.fields?.questionType?.value ?? '' }).trim(),
                            description: row.fields?.infoValue?.value || t('research.noAnswer'),
                            target,
                          })}
                          disabled={creatingKeys[row.recordName]}
                          className="text-xs rounded-md border border-border bg-secondary px-2 py-1"
                        >
                          {creatingKeys[row.recordName] ? t('research.creating') : t('research.createTodo')}
                        </button>
                      )}
                      <button onClick={() => mark(row.recordName, 'done')} className="text-xs rounded-md border border-border bg-secondary px-2 py-1">{t('research.markDone')}</button>
                      <button onClick={() => mark(row.recordName, 'ignored')} className="text-xs rounded-md border border-border bg-secondary px-2 py-1">{t('research.ignore')}</button>
                    </div>
                  </div>
                ))}
                {importedOpen.length > 100 && <div className="text-xs text-muted-foreground text-center">{t('research.moreImported', { count: importedOpen.length - 100 })}</div>}
              </div>
            </section>
          )}
          {visible.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">{t('research.noMatches')}</div>
          ) : visible.slice(0, 200).map((it) => (
            <div key={it.recordName} className="bg-card border border-border rounded-md p-4">
              <div className="flex items-baseline justify-between mb-2 gap-2">
                <button onClick={() => navigate(`/person/${it.recordName}`)} className="text-sm font-semibold text-primary hover:underline text-start">
                  {it.fullName}
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t('research.openCount', { count: it.suggestions.length })}</span>
                  <button
                    onClick={() => mark(it.recordName, 'ignoredEntities')}
                    title={t('research.ignoreAllTitle')}
                    className="text-[11px] rounded border border-border bg-secondary px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                  >
                    {t('research.ignoreAll')}
                  </button>
                </div>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                {it.suggestions.map((s, i) => {
                  const sKey = suggestionKey(s);
                  const display = suggestionDisplay(s);
                  const key = generatedKey(it.recordName, sKey);
                  return (
                    <li key={i} className="flex items-start gap-2">
                      <span className="pt-1">·</span>
                      <span className="flex-1">{display}</span>
                      <button
                        onClick={() => createTodo({
                          key,
                          title: display,
                          description: t('research.todoDescription', { name: it.fullName }),
                          target: { recordName: it.recordName, recordType: 'Person' },
                        })}
                        disabled={creatingKeys[key]}
                        className="text-[11px] rounded border border-border bg-secondary px-1.5 py-0.5 text-foreground"
                      >
                        {creatingKeys[key] ? t('research.creating') : t('research.todoShort')}
                      </button>
                      <button onClick={() => mark(key, 'done')} className="text-[11px] rounded border border-border bg-secondary px-1.5 py-0.5 text-foreground">{t('research.doneShort')}</button>
                      <button onClick={() => mark(key, 'ignored')} className="text-[11px] rounded border border-border bg-secondary px-1.5 py-0.5 text-foreground">{t('research.ignore')}</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {visible.length > 200 && <div className="text-xs text-muted-foreground text-center">{t('research.moreSuggestions', { count: visible.length - 200 })}</div>}
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
