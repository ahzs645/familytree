/**
 * ToDo Wizard — bulk-create ToDos from research suggestions.
 *
 * Mirrors MacFamilyTree's ToDoWizardSheet: you pick a single "generator"
 * (creator), choose the object scope (all persons, or one selected person),
 * see a live count of the ToDos it would create, then create them. Each
 * generator corresponds to a research-suggestion category.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { generateResearchSuggestions } from '../lib/researchSuggestions.js';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { logRecordCreated } from '../lib/changeLog.js';
import { matchesSearchText } from '../lib/i18n.js';
import { writeRef } from '../lib/schema.js';
import { generateId } from '../lib/ids.js';
import { collectAncestorIds, collectDescendantIds } from '../lib/subtree.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { Panel } from './ui/Panel.jsx';

// Research suggestions are { key, i18nKey } objects (legacy paths may still pass
// raw strings). Resolve a stable category id from either shape.
const suggestionKey = (s) => (typeof s === 'string' ? s : s.key);

// Generators, in display order. `id` matches a researchSuggestions category
// (so the label comes from researchSuggestions.<id>) and `type` is the ToDo
// type the generated ToDos are tagged with.
const CREATORS = [
  { id: 'findBirthRecord', type: 'Research' },
  { id: 'findDeathRecord', type: 'Research' },
  { id: 'identifyParents', type: 'Research' },
  { id: 'identifySpousesChildren', type: 'Research' },
  { id: 'addPortraitPhoto', type: 'Media' },
  { id: 'confirmFullName', type: 'Verify' },
];

export function ToDoWizardSheet({ open, onClose, onCreated }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  // matchesByCreator: { [creatorId]: [{ recordName, fullName }] }
  const [matchesByCreator, setMatchesByCreator] = useState({});
  const [people, setPeople] = useState([]); // union of persons with any gap, for the picker
  const [currentCreator, setCurrentCreator] = useState(CREATORS[0].id);
  const [scopeAll, setScopeAll] = useState(true);
  const [scopePerson, setScopePerson] = useState('');
  // When a person is selected, scope covers them + direct ancestors/descendants
  // (matching MFT). null until computed; empty means "nothing in scope yet".
  const [scopeIds, setScopeIds] = useState(null);
  const [selected, setSelected] = useState(new Set()); // recordNames within current scope
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setMessage(null);
    (async () => {
      const suggestions = await generateResearchSuggestions();
      const grouped = {};
      const personById = new Map();
      for (const item of suggestions) {
        personById.set(item.recordName, item.fullName);
        for (const suggestion of item.suggestions) {
          const id = suggestionKey(suggestion);
          (grouped[id] ||= []).push({ recordName: item.recordName, fullName: item.fullName });
        }
      }
      if (cancelled) return;
      setMatchesByCreator(grouped);
      setPeople(
        [...personById.entries()]
          .map(([recordName, fullName]) => ({ recordName, fullName }))
          .sort((a, b) => a.fullName.localeCompare(b.fullName)),
      );
      const firstWithMatches = CREATORS.find((c) => (grouped[c.id] || []).length > 0);
      setCurrentCreator(firstWithMatches?.id || CREATORS[0].id);
      setScopeAll(true);
      setScopePerson('');
      setFilter('');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Resolve the selected person's scope (self + ancestors + descendants).
  useEffect(() => {
    if (scopeAll || !scopePerson) {
      setScopeIds(null);
      return;
    }
    let cancelled = false;
    setScopeIds(null);
    (async () => {
      const [ancestors, descendants] = await Promise.all([
        collectAncestorIds(scopePerson),
        collectDescendantIds(scopePerson),
      ]);
      if (!cancelled) setScopeIds(new Set([scopePerson, ...ancestors, ...descendants]));
    })();
    return () => { cancelled = true; };
  }, [scopeAll, scopePerson]);

  // Matches for the current generator, narrowed to the chosen scope.
  const scopedMatches = useMemo(() => {
    const all = matchesByCreator[currentCreator] || [];
    if (scopeAll) return all;
    if (!scopeIds) return [];
    return all.filter((m) => scopeIds.has(m.recordName));
  }, [matchesByCreator, currentCreator, scopeAll, scopeIds]);

  // Default selection = everything in scope. Reset when scope/generator changes.
  useEffect(() => {
    setSelected(new Set(scopedMatches.map((m) => m.recordName)));
  }, [scopedMatches]);

  const filtered = useMemo(() => {
    if (!filter) return scopedMatches;
    return scopedMatches.filter((m) => matchesSearchText(m.fullName, filter));
  }, [scopedMatches, filter]);

  // Per-generator count within the active scope, for the left-hand list badges.
  const countFor = (creatorId) => {
    const all = matchesByCreator[creatorId] || [];
    if (scopeAll) return all.length;
    if (!scopeIds) return 0;
    return all.filter((m) => scopeIds.has(m.recordName)).length;
  };

  const creatorLabel = (id) => t(`researchSuggestions.${id}`);
  const selectedCount = selected.size;

  const totalMatches = useMemo(
    () => Object.values(matchesByCreator).reduce((sum, list) => sum + list.length, 0),
    [matchesByCreator],
  );

  if (!open) return null;

  const toggle = (recordName) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(recordName)) next.delete(recordName);
      else next.add(recordName);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allVisibleSelected = filtered.length > 0 && filtered.every((m) => next.has(m.recordName));
      for (const m of filtered) {
        if (allVisibleSelected) next.delete(m.recordName);
        else next.add(m.recordName);
      }
      return next;
    });
  };

  const onCreate = async () => {
    const creator = CREATORS.find((c) => c.id === currentCreator);
    const chosen = scopedMatches.filter((m) => selected.has(m.recordName));
    if (chosen.length === 0) {
      setMessage(t('todosPage.wizard.pickOne'));
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const db = getLocalDatabase();
      const title = creatorLabel(creator.id);
      const createdTodos = [];
      const createdRelations = [];
      for (const match of chosen) {
        const todo = {
          recordName: generateId('todo'),
          recordType: 'ToDo',
          fields: {
            title: { value: title, type: 'STRING' },
            type: { value: creator.type, type: 'STRING' },
            status: { value: 'Open', type: 'STRING' },
            priority: { value: 'Normal', type: 'STRING' },
            description: { value: `Auto-generated from Research Assistant for ${match.fullName}.`, type: 'STRING' },
          },
        };
        createdTodos.push(todo);
        createdRelations.push({
          recordName: generateId('todo-rel'),
          recordType: 'ToDoRelation',
          fields: {
            todo: writeRef(todo.recordName, 'ToDo'),
            target: writeRef(match.recordName, 'Person'),
            targetType: { value: 'Person', type: 'STRING' },
          },
        });
      }
      await db.applyRecordTransaction({ saveRecords: [...createdTodos, ...createdRelations] });
      for (const todo of createdTodos) await logRecordCreated(todo);
      // Drop the persons we just acted on so counts update and they leave the list.
      const usedIds = new Set(chosen.map((m) => m.recordName));
      setMatchesByCreator((prev) => ({
        ...prev,
        [creator.id]: (prev[creator.id] || []).filter((m) => !usedIds.has(m.recordName)),
      }));
      setMessage(t('todosPage.wizard.created', { count: createdTodos.length }));
      onCreated?.(createdTodos.length);
    } catch (error) {
      setMessage(`Failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title={t('todosPage.wizard.title')}
      meta={t('todosPage.wizard.count', { count: selectedCount })}
      onClose={onClose}
      maxWidth="max-w-3xl"
      maxHeight="max-h-[85vh]"
    >
      {/* Scope selector */}
      <div className="px-5 py-2.5 border-b border-border flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input type="radio" name="todo-wizard-scope" checked={scopeAll} onChange={() => setScopeAll(true)} />
          {t('todosPage.wizard.scopeAll')}
        </label>
        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input type="radio" name="todo-wizard-scope" checked={!scopeAll} onChange={() => setScopeAll(false)} />
          {t('todosPage.wizard.scopePerson')}
        </label>
        {!scopeAll && (
          <select
            value={scopePerson}
            onChange={(e) => setScopePerson(e.target.value)}
            className="bg-background border border-border rounded-md px-2 py-1.5 text-sm min-w-[200px]"
          >
            <option value="">{t('todosPage.wizard.selectPerson')}</option>
            {people.map((p) => <option key={p.recordName} value={p.recordName}>{p.fullName}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="p-6 text-sm text-muted-foreground">{t('todosPage.wizard.analyzing')}</div>
      ) : totalMatches === 0 ? (
        <div className="p-6 text-sm text-muted-foreground text-center">{t('todosPage.wizard.emptyAll')}</div>
      ) : (
        <div className="flex-1 min-h-0 flex">
          {/* Generators */}
          <nav className="w-56 shrink-0 border-e border-border overflow-auto p-2">
            <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              {t('todosPage.wizard.generatorsHeading')}
            </div>
            {CREATORS.map((c) => {
              const count = countFor(c.id);
              const isActive = c.id === currentCreator;
              return (
                <button
                  key={c.id}
                  onClick={() => setCurrentCreator(c.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-start text-sm ${
                    isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
                  } ${count === 0 ? 'opacity-50' : ''}`}
                >
                  <span className="flex-1 truncate">{creatorLabel(c.id)}</span>
                  <span className={`text-xs tabular-nums ${isActive ? 'opacity-90' : 'text-muted-foreground'}`}>{count}</span>
                </button>
              );
            })}
          </nav>

          {/* Preview of objects for the current generator */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="px-4 pt-3 pb-2 border-b border-border">
              <p className="text-sm text-muted-foreground">{t(`todosPage.wizard.explanation.${currentCreator}`)}</p>
              <div className="mt-2 flex gap-2">
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={t('todosPage.wizard.filterPlaceholder')}
                  className="flex-1 bg-background border border-border rounded-md px-2.5 py-1.5 text-sm"
                />
                <button onClick={toggleAllVisible} disabled={filtered.length === 0} className="text-xs border border-border bg-secondary rounded-md px-2 py-1.5 disabled:opacity-50">
                  {t('todosPage.wizard.toggleVisible')}
                </button>
              </div>
            </div>
            <main className="flex-1 overflow-auto p-3 space-y-1">
              {!scopeAll && !scopePerson ? (
                <div className="p-6 text-sm text-muted-foreground text-center">{t('todosPage.wizard.selectPerson')}</div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">{t('todosPage.wizard.noMatches')}</div>
              ) : (
                filtered.map((m) => (
                  <label key={m.recordName} className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-secondary cursor-pointer">
                    <input type="checkbox" checked={selected.has(m.recordName)} onChange={() => toggle(m.recordName)} />
                    <span className="text-sm flex-1 truncate">{m.fullName}</span>
                  </label>
                ))
              )}
            </main>
          </div>
        </div>
      )}

      <footer className="px-5 py-3 border-t border-border flex items-center gap-3">
        {message && <div className="text-xs text-muted-foreground">{message}</div>}
        <button onClick={onClose} disabled={busy} className="ms-auto text-sm border border-border bg-secondary rounded-md px-3 py-1.5">
          {t('todosPage.wizard.cancel')}
        </button>
        <button onClick={onCreate} disabled={busy || selectedCount === 0} className="text-sm bg-primary text-primary-foreground rounded-md px-3 py-1.5 disabled:opacity-60">
          {busy ? t('todosPage.wizard.creating') : t('todosPage.wizard.create', { count: selectedCount })}
        </button>
      </footer>
    </Panel>
  );
}

export default ToDoWizardSheet;
