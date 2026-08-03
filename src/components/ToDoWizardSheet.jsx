/**
 * ToDo Wizard — bulk-create ToDos from research suggestions.
 *
 * Mirrors MacFamilyTree's ToDoWizardSheet: you pick a single "generator"
 * (creator), choose the object scope (all persons, or one selected person),
 * see a live count of the ToDos it would create, then create them. Each
 * generator corresponds to a research-suggestion category.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { generateResearchSuggestions } from '../lib/researchSuggestions.js';
import { Button } from './ui/Button.jsx';
import { matchesSearchText } from '../lib/i18n.js';
import { writeRef } from '../lib/schema.js';
import { generateId } from '../lib/ids.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { Panel } from './ui/Panel.jsx';
import { createWithChangeLog } from '../lib/recordWrite.js';
import { RelativesSelectionSheet } from './editors/RelativesSelectionSheet.jsx';

// Research suggestions are { key, i18nKey } objects (legacy paths may still pass
// raw strings). Resolve a stable category id from either shape.
const suggestionKey = (s) => (typeof s === 'string' ? s : s.key);

// Generators, in display order. `id` matches a researchSuggestions category
// (so the label comes from researchSuggestions.<id>) and `type` is the ToDo
// type the generated ToDos are tagged with.
const CREATORS = [
  { id: 'findBirthRecord', type: 'Research' },
  { id: 'findDeathRecord', type: 'Research' },
  { id: 'findMarriageRecord', type: 'Research' },
  { id: 'identifyParents', type: 'Research' },
  { id: 'identifySpousesChildren', type: 'Research' },
  { id: 'findSourceCitation', type: 'Source' },
  { id: 'addPortraitPhoto', type: 'Media' },
  { id: 'confirmFullName', type: 'Verify' },
];

export function ToDoWizardSheet({ open, onClose, onCreated }) {
  const { t } = useTranslation();
  const openerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  // matchesByCreator: { [creatorId]: [{ recordName, fullName }] }
  const [matchesByCreator, setMatchesByCreator] = useState({});
  const [people, setPeople] = useState([]); // union of persons with any gap, for the picker
  const [currentCreator, setCurrentCreator] = useState(CREATORS[0].id);
  const [scopeAll, setScopeAll] = useState(true);
  const [scopePerson, setScopePerson] = useState('');
  // A custom scope is the reusable relative set returned by the selection
  // sheet. null means all people; an empty set means nothing is in scope.
  const [scopeIds, setScopeIds] = useState(null);
  const [scopeSheetOpen, setScopeSheetOpen] = useState(false);
  const [selected, setSelected] = useState(new Set()); // recordNames within current scope
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  // Pre-assign: priority + optional due date stamped on every ToDo this batch
  // creates (mirrors MFT's wizard, which lets you set these before generating).
  const [priority, setPriority] = useState('Normal');
  const [dueDate, setDueDate] = useState('');
  const [todoType, setTodoType] = useState('Research');
  const [todoStatus, setTodoStatus] = useState('Open');
  const [todoText, setTodoText] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = document.activeElement;
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openerRef.current?.focus?.();
    };
  }, [open, onClose]);

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
      setPriority('Normal');
      setDueDate('');
      setTodoType(firstWithMatches?.type || 'Research');
      setTodoStatus('Open');
      setTodoText('');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open]);

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
      const title = creatorLabel(creator.id);
      const createdTodos = [];
      const createdRelations = [];
      for (const match of chosen) {
        const todo = {
          recordName: generateId('todo'),
          recordType: 'ToDo',
          fields: {
            title: { value: title, type: 'STRING' },
            type: { value: todoType, type: 'STRING' },
            status: { value: todoStatus, type: 'STRING' },
            priority: { value: priority, type: 'STRING' },
            ...(dueDate ? { dueDate: { value: dueDate, type: 'STRING' } } : {}),
            description: { value: todoText.trim() || t('todosPage.wizard.defaultText', { name: match.fullName }), type: 'STRING' },
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
      for (const todo of createdTodos) await createWithChangeLog(todo);
      for (const relation of createdRelations) await createWithChangeLog(relation);
      // Drop the persons we just acted on so counts update and they leave the list.
      const usedIds = new Set(chosen.map((m) => m.recordName));
      setMatchesByCreator((prev) => ({
        ...prev,
        [creator.id]: (prev[creator.id] || []).filter((m) => !usedIds.has(m.recordName)),
      }));
      setMessage(t('todosPage.wizard.created', { count: createdTodos.length }));
      onCreated?.(createdTodos.length);
    } catch (error) {
      setMessage(t('todosPage.wizard.failed', { message: error.message }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
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
          <input type="radio" name="todo-wizard-scope" checked={!scopeAll} onChange={() => setScopeSheetOpen(true)} />
          {t('todosPage.wizard.scopePerson')}
        </label>
        {!scopeAll && (
          <button type="button" onClick={() => setScopeSheetOpen(true)} className="bg-background border border-border rounded-md px-3 py-1.5 text-sm">
            {scopePerson ? people.find((person) => person.recordName === scopePerson)?.fullName || t('relativeSelection.changeSet') : t('relativeSelection.chooseSet')}
          </button>
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
            <div className="px-2 py-1 text-2xs uppercase tracking-wide text-muted-foreground">
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
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <label className="flex items-center gap-1.5">
                  {t('todosPage.field.type')}
                  <select
                    value={todoType}
                    onChange={(e) => setTodoType(e.target.value)}
                    className="bg-background border border-border rounded-md px-2 py-1 text-foreground"
                  >
                    {['Research', 'Verify', 'Source', 'Media', 'Cleanup'].map((value) => (
                      <option key={value} value={value}>{t(`todosPage.todoType.${value}`)}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5">
                  {t('todosPage.field.status')}
                  <select
                    value={todoStatus}
                    onChange={(e) => setTodoStatus(e.target.value)}
                    className="bg-background border border-border rounded-md px-2 py-1 text-foreground"
                  >
                    {['Open', 'InProgress', 'Blocked', 'Done'].map((value) => (
                      <option key={value} value={value}>{t(`todosPage.status.${value}`)}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5">
                  {t('todosPage.field.priority')}
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="bg-background border border-border rounded-md px-2 py-1 text-foreground"
                  >
                    {['Low', 'Normal', 'High'].map((p) => (
                      <option key={p} value={p}>{t(`todosPage.priority.${p}`, { defaultValue: p })}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5">
                  {t('todosPage.field.dueDate')}
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bg-background border border-border rounded-md px-2 py-1 text-foreground"
                  />
                </label>
              </div>
              <label className="mt-2 block text-xs text-muted-foreground" htmlFor="todo-wizard-text">
                {t('todosPage.wizard.text')}
                <textarea
                  id="todo-wizard-text"
                  value={todoText}
                  onChange={(e) => setTodoText(e.target.value)}
                  placeholder={t('todosPage.wizard.textPlaceholder')}
                  className="mt-1 min-h-16 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
                />
              </label>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-1">
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
            </div>
          </div>
        </div>
      )}

      <footer className="px-5 py-3 border-t border-border flex items-center gap-3">
        {message && <div className="text-xs text-muted-foreground">{message}</div>}
        <button onClick={onClose} disabled={busy} className="ms-auto text-sm border border-border bg-secondary rounded-md px-3 py-1.5">
          {t('todosPage.wizard.cancel')}
        </button>
        <Button variant="primary" size="md" onClick={onCreate} disabled={busy || selectedCount === 0}>
          {busy ? t('todosPage.wizard.creating') : t('todosPage.wizard.create', { count: selectedCount })}
        </Button>
      </footer>
    </Panel>
    <RelativesSelectionSheet
      open={scopeSheetOpen}
      onClose={() => setScopeSheetOpen(false)}
      persons={people}
      initialPersonId={scopePerson}
      initialRelationSet="ancestorsAndDescendants"
      onApply={(ids, selection) => {
        setScopeAll(false);
        setScopePerson(selection.personId);
        setScopeIds(ids);
      }}
    />
    </>
  );
}

export default ToDoWizardSheet;
