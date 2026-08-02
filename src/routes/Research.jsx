import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';
import { DatePicker } from '../components/ui/DatePicker.jsx';
import { PageTitle } from '../components/ui/PageTitle.jsx';
import { PlacePickerSheet } from '../components/editors/PlacePickerSheet.jsx';
import { SourcePickerSheet } from '../components/editors/SourcePickerSheet.jsx';
import { ResearchToDoSheet } from '../components/ResearchToDoSheet.jsx';
import { getAppDataClient } from '../lib/data/AppDataClient.js';
import { useRecords } from '../lib/data/useRecords.js';
import { listCustomFilters, runCustomFilter } from '../lib/customScopes.js';
import { matchesSearchText } from '../lib/i18n.js';
import { readConclusionType, readField, readRef } from '../lib/schema.js';
import { personSummary, placeSummary, sourceSummary } from '../models/index.js';
import {
  buildResearchQuestions,
  DEFAULT_RESEARCH_OPTIONS,
  normalizeResearchOptions,
  RESEARCH_CATEGORIES,
  saveResearchEventAnswer,
} from '../lib/researchQuestions.js';
import { generateId } from '../lib/ids.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

const STATE_KEY = 'researchAssistantState';
const OPTIONS_KEY = 'researchAssistantOptions';
const JOURNAL_KEY = 'researchJournal';

function normalizeState(value) {
  return {
    done: { ...(value?.done || {}) },
    ignored: { ...(value?.ignored || {}) },
    ignoredEntities: { ...(value?.ignoredEntities || {}) },
    notes: { ...(value?.notes || {}) },
  };
}

function questionText(question, t) {
  return t(`research.questions.${question.kind}`, {
    name: question.personName,
    partner: question.partnerName || t('research.unknownPartner'),
  });
}

export default function Research() {
  const { t, localization } = useTranslation();
  const navigate = useNavigate();
  const personRows = useRecords('Person');
  const familyRows = useRecords('Family');
  const childRows = useRecords('ChildRelation');
  const personEventRows = useRecords('PersonEvent');
  const familyEventRows = useRecords('FamilyEvent');
  const sourceRelationRows = useRecords('SourceRelation');
  const sourceRows = useRecords('Source');
  const placeRows = useRecords('Place');
  const groupRows = useRecords('PersonGroup');
  const groupRelationRows = useRecords('PersonGroupRelation');

  const [state, setState] = useState(() => normalizeState(null));
  const [options, setOptions] = useState(DEFAULT_RESEARCH_OPTIONS);
  const [smartFilters, setSmartFilters] = useState([]);
  const [scopeIds, setScopeIds] = useState(null);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [answerDate, setAnswerDate] = useState('');
  const [answerNote, setAnswerNote] = useState('');
  const [placePickerOpen, setPlacePickerOpen] = useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [todoQuestion, setTodoQuestion] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [journal, setJournal] = useState([]);
  const [journalDraft, setJournalDraft] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [savedState, savedOptions, filters, savedJournal] = await Promise.all([
        getAppDataClient().meta.get(STATE_KEY),
        getAppDataClient().meta.get(OPTIONS_KEY),
        listCustomFilters('Person'),
        getAppDataClient().meta.get(JOURNAL_KEY),
      ]);
      if (cancelled) return;
      setState(normalizeState(savedState));
      setOptions(normalizeResearchOptions(savedOptions));
      setSmartFilters(filters);
      setJournal(Array.isArray(savedJournal) ? savedJournal : []);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (options.targetPersonId || options.scopeMode === 'all') {
      setScopeIds(null);
      return;
    }
    if (options.scopeMode === 'personGroup') {
      setScopeIds(new Set(groupRelationRows.records
        .filter((relation) => readRef(relation.fields?.personGroup) === options.personGroupId)
        .map((relation) => readRef(relation.fields?.person))
        .filter(Boolean)));
      return;
    }
    const smartFilter = smartFilters.find((item) => item.id === options.smartFilterId);
    if (!smartFilter) {
      setScopeIds(new Set());
      return;
    }
    let cancelled = false;
    setScopeIds(new Set());
    runCustomFilter(smartFilter).then((result) => {
      if (!cancelled) setScopeIds(new Set(result.records.map((record) => record.recordName)));
    });
    return () => { cancelled = true; };
  }, [groupRelationRows.records, options.personGroupId, options.scopeMode, options.smartFilterId, options.targetPersonId, smartFilters]);

  const personSummaries = useMemo(() => personRows.records
    .map((record) => ({ record, summary: personSummary(record) }))
    .filter(({ summary }) => summary)
    .sort((a, b) => a.summary.fullName.localeCompare(b.summary.fullName)), [personRows.records]);
  const personById = useMemo(() => new Map(personRows.records.map((record) => [record.recordName, record])), [personRows.records]);
  const familyById = useMemo(() => new Map(familyRows.records.map((record) => [record.recordName, record])), [familyRows.records]);
  const placeById = useMemo(() => new Map(placeRows.records.map((record) => [record.recordName, placeSummary(record)])), [placeRows.records]);
  const sourceById = useMemo(() => new Map(sourceRows.records.map((record) => [record.recordName, sourceSummary(record)])), [sourceRows.records]);

  const generated = useMemo(() => buildResearchQuestions({
    persons: personRows.records,
    families: familyRows.records,
    childRelations: childRows.records,
    personEvents: personEventRows.records,
    familyEvents: familyEventRows.records,
    sourceRelations: sourceRelationRows.records,
    places: placeRows.records,
  }, options, scopeIds), [childRows.records, familyEventRows.records, familyRows.records, options, personEventRows.records, personRows.records, placeRows.records, scopeIds, sourceRelationRows.records]);

  const openQuestions = useMemo(() => generated.filter((question) => (
    !state.done[question.id]
    && !state.ignored[question.id]
    && !state.ignoredEntities[question.personId]
    && (categoryFilter === 'all' || question.category === categoryFilter)
    && (!filter.trim() || matchesSearchText(`${question.personName} ${questionText(question, t)}`, filter))
  )), [categoryFilter, filter, generated, state, t]);

  useEffect(() => {
    if (!openQuestions.some((question) => question.id === selectedId)) setSelectedId(openQuestions[0]?.id || '');
  }, [openQuestions, selectedId]);

  const selected = openQuestions.find((question) => question.id === selectedId) || null;
  useEffect(() => {
    setAnswerDate('');
    setAnswerNote('');
  }, [selectedId]);

  const grouped = useMemo(() => RESEARCH_CATEGORIES.map((category) => ({
    category,
    questions: openQuestions.filter((question) => question.category === category),
  })).filter((group) => group.questions.length > 0), [openQuestions]);

  const loading = !ready || [personRows, familyRows, childRows, personEventRows, familyEventRows, sourceRelationRows, sourceRows, placeRows].some((row) => row.loading);
  const persistState = async (next) => {
    const normalized = normalizeState(typeof next === 'function' ? next(state) : next);
    setState(normalized);
    await getAppDataClient().meta.set(STATE_KEY, normalized);
  };
  const updateOptions = async (patch) => {
    const next = normalizeResearchOptions({ ...options, ...patch });
    setOptions(next);
    await getAppDataClient().meta.set(OPTIONS_KEY, next);
  };
  const mark = (question, field, note = '') => persistState((current) => ({
    ...current,
    [field]: { ...current[field], [question.id]: true },
    notes: note ? { ...current.notes, [question.id]: note } : current.notes,
  }));
  const completeWithMessage = async (question, text) => {
    await mark(question, 'done', text);
    setMessage(t('research.answerSaved'));
  };
  const saveDate = async () => {
    if (!selected || !answerDate || busy) return;
    setBusy(true);
    try {
      await saveResearchEventAnswer(selected, { date: answerDate });
      await completeWithMessage(selected, answerDate);
    } catch (error) {
      setMessage(t('research.answerFailed', { message: error.message }));
    } finally {
      setBusy(false);
    }
  };
  const choosePlace = async (place) => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await saveResearchEventAnswer(selected, { placeId: place.recordName });
      await completeWithMessage(selected, placeSummary(place)?.displayName || place.recordName);
    } catch (error) {
      setMessage(t('research.answerFailed', { message: error.message }));
    } finally {
      setBusy(false);
    }
  };
  const addJournalEntry = async () => {
    const text = journalDraft.trim();
    if (!text) return;
    const next = [{ id: generateId('rj'), createdAt: new Date().toISOString(), text }, ...journal];
    setJournal(next);
    setJournalDraft('');
    await getAppDataClient().meta.set(JOURNAL_KEY, next);
  };

  const selectedPerson = selected ? personById.get(selected.personId) : null;
  const context = useMemo(() => selected ? buildContext(selected, {
    persons: personRows.records,
    families: familyRows.records,
    childRelations: childRows.records,
    personEvents: personEventRows.records,
    familyEvents: familyEventRows.records,
    sourceRelations: sourceRelationRows.records,
    personById,
    familyById,
    placeById,
    sourceById,
  }) : null, [childRows.records, familyById, familyEventRows.records, familyRows.records, personById, personEventRows.records, personRows.records, placeById, selected, sourceById, sourceRelationRows.records]);

  if (loading) return <div className="p-10 text-muted-foreground">{t('research.analyzing')}</div>;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <PageTitle className="text-base font-semibold">{t('research.title')}</PageTitle>
          <span className="text-xs text-muted-foreground">{t('research.questionCount', { count: openQuestions.length })}</span>
          {message && <span className="text-xs text-success-text" role="status">{message}</span>}
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <label className="text-xs" htmlFor="research-person-mode">{t('research.targetPerson')}</label>
            <select
              id="research-person-mode"
              value={options.targetPersonId}
              onChange={(event) => updateOptions({ targetPersonId: event.target.value })}
              className="h-9 max-w-56 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">{t('research.wholeTree')}</option>
              {personSummaries.map(({ record, summary }) => <option key={record.recordName} value={record.recordName}>{summary.fullName}</option>)}
            </select>
            <button type="button" onClick={() => setOptionsOpen((value) => !value)} aria-expanded={optionsOpen} className="h-9 rounded-md border border-border bg-secondary px-3 text-xs">{t('research.options')}</button>
          </div>
        </div>
        {optionsOpen && (
          <GenerationOptions
            options={options}
            smartFilters={smartFilters}
            groups={groupRows.records}
            onChange={updateOptions}
            onReset={() => persistState(normalizeState(null))}
            onRestoreIgnored={() => persistState((current) => ({ ...current, ignored: {}, ignoredEntities: {} }))}
            t={t}
          />
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[minmax(240px,0.8fr)_minmax(320px,1.2fr)_minmax(260px,0.9fr)] lg:overflow-hidden">
        <aside className="min-h-[280px] border-b border-border bg-card lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-e" aria-label={t('research.questionList')}>
          <div className="sticky top-0 z-10 space-y-2 border-b border-border bg-card p-3">
            <label className="sr-only" htmlFor="research-filter">{t('research.filterLabel')}</label>
            <input id="research-filter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={t('research.filterPlaceholder')} className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm" />
            <label className="sr-only" htmlFor="research-category">{t('research.categoryFilter')}</label>
            <select id="research-category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
              <option value="all">{t('research.allCategories')}</option>
              {RESEARCH_CATEGORIES.map((category) => <option key={category} value={category}>{t(`research.categories.${category}`)}</option>)}
            </select>
          </div>
          {grouped.length === 0 ? <p className="p-5 text-sm text-muted-foreground">{t('research.noMatches')}</p> : grouped.map((group) => (
            <section key={group.category}>
              <h2 className="sticky top-[105px] bg-muted px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-muted-foreground">{t(`research.categories.${group.category}`)} · {group.questions.length}</h2>
              <div role="listbox" aria-label={t(`research.categories.${group.category}`)}>
                {group.questions.map((question) => (
                  <button
                    key={question.id}
                    type="button"
                    role="option"
                    aria-selected={selectedId === question.id}
                    onClick={() => setSelectedId(question.id)}
                    className={`block w-full border-b border-border px-3 py-3 text-start hover:bg-accent ${selectedId === question.id ? 'bg-accent' : ''}`}
                  >
                    <span className="block text-sm font-medium">{t(`research.questionNames.${question.kind}`)}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{question.personName}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </aside>

        <main className="min-h-[360px] border-b border-border p-4 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-e" aria-label={t('research.questionPane')}>
          {!selected ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t('research.noMoreQuestions')}</div>
          ) : (
            <div className="mx-auto max-w-xl space-y-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(`research.categories.${selected.category}`)}</div>
                <h1 className="mt-1 text-xl font-semibold">{t(`research.questionNames.${selected.kind}`)}</h1>
                <p className="mt-3 text-base leading-relaxed">{questionText(selected, t)}</p>
              </div>

              {(selected.kind.endsWith('Date')) && (
                <section className="rounded-lg border border-border bg-card p-4">
                  <label className="mb-2 block text-sm font-medium">{t('research.enterDate')}</label>
                  <DatePicker value={answerDate} onChange={setAnswerDate} ariaLabel={t('research.enterDate')} />
                  <Button variant="primary" size="md" className="mt-3" onClick={saveDate} disabled={!answerDate || busy}>{t('research.saveAnswer')}</Button>
                </section>
              )}

              {(selected.kind.endsWith('Place')) && (
                <section className="rounded-lg border border-border bg-card p-4">
                  <p className="mb-3 text-sm text-muted-foreground">{t('research.placeAnswerHint')}</p>
                  <Button variant="primary" size="md" onClick={() => setPlacePickerOpen(true)} disabled={busy}>{t('research.selectExistingPlace')}</Button>
                </section>
              )}

              {selected.kind === 'personSource' && (
                <section className="rounded-lg border border-border bg-card p-4">
                  <p className="mb-3 text-sm text-muted-foreground">{t('research.sourceAnswerHint')}</p>
                  <Button variant="primary" size="md" onClick={() => setSourcePickerOpen(true)}>{t('research.selectExistingSource')}</Button>
                </section>
              )}

              {(selected.kind === 'parents' || selected.kind === 'partner') && (
                <section className="rounded-lg border border-border bg-card p-4">
                  <p className="mb-3 text-sm text-muted-foreground">{t('research.relativeAnswerHint')}</p>
                  <div className="flex flex-wrap gap-2">
                    {selected.kind === 'parents' ? (
                      <>
                        <Button variant="primary" size="md" onClick={() => navigate(`/person/new?relation=father&anchor=${encodeURIComponent(selected.personId)}`, { state: { intent: 'create' } })}>{t('research.addFather')}</Button>
                        <Button variant="secondary" size="md" onClick={() => navigate(`/person/new?relation=mother&anchor=${encodeURIComponent(selected.personId)}`, { state: { intent: 'create' } })}>{t('research.addMother')}</Button>
                      </>
                    ) : (
                      <Button variant="primary" size="md" onClick={() => navigate(`/person/new?relation=partner&anchor=${encodeURIComponent(selected.personId)}`, { state: { intent: 'create' } })}>{t('research.addPartner')}</Button>
                    )}
                  </div>
                </section>
              )}

              <section className="rounded-lg border border-border bg-card p-4">
                <label htmlFor="research-answer-note" className="block text-sm font-medium">{t('research.answerNote')}</label>
                <textarea id="research-answer-note" value={answerNote} onChange={(event) => setAnswerNote(event.target.value)} placeholder={t('research.answerNotePlaceholder')} className="mt-2 min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => completeWithMessage(selected, answerNote.trim() || t('research.dontKnow'))} className="rounded-md border border-border bg-secondary px-3 py-2 text-xs">{t('research.dontKnow')}</button>
                  <button type="button" onClick={() => completeWithMessage(selected, answerNote.trim() || t('research.none'))} className="rounded-md border border-border bg-secondary px-3 py-2 text-xs">{t('research.none')}</button>
                  <button type="button" onClick={() => mark(selected, 'ignored', answerNote.trim() || t('research.later'))} className="rounded-md border border-border bg-secondary px-3 py-2 text-xs">{t('research.later')}</button>
                </div>
              </section>

              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <button type="button" onClick={() => setTodoQuestion(selected)} className="rounded-md border border-border bg-secondary px-3 py-2 text-xs">{t('research.createTodo')}</button>
                <button type="button" onClick={() => mark(selected, 'ignored')} className="rounded-md border border-border bg-secondary px-3 py-2 text-xs">{t('research.ignore')}</button>
                <button type="button" onClick={() => persistState((current) => ({ ...current, ignoredEntities: { ...current.ignoredEntities, [selected.personId]: true } }))} className="rounded-md border border-border bg-secondary px-3 py-2 text-xs">{t('research.ignoreAll')}</button>
              </div>
            </div>
          )}
        </main>

        <aside className="min-h-[320px] bg-card p-4 lg:min-h-0 lg:overflow-y-auto" aria-label={t('research.context')}>
          {!selected || !context ? <p className="text-sm text-muted-foreground">{t('research.contextEmpty')}</p> : (
            <div className="space-y-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('research.context')}</div>
                <button type="button" onClick={() => navigate(`/person/${selected.personId}`)} className="mt-1 text-start text-base font-semibold text-interactive hover:underline">{selected.personName}</button>
                <div className="text-xs text-muted-foreground">{[personSummary(selectedPerson)?.birthDate, personSummary(selectedPerson)?.deathDate].filter(Boolean).join(' – ') || t('research.noLifeDates')}</div>
              </div>
              <ContextSection title={t('research.contextEvents')} empty={t('research.noContextEvents')}>
                {context.events.map((event) => <li key={event.recordName} className="rounded-md bg-secondary/50 px-2.5 py-2 text-xs"><span className="font-medium">{readConclusionType(event) || t('research.event')}</span>{readField(event, ['date', 'cached_date'], '') && ` · ${readField(event, ['date', 'cached_date'], '')}`}{context.placeLabel(event) && <span className="block text-muted-foreground">{context.placeLabel(event)}</span>}</li>)}
              </ContextSection>
              <ContextSection title={t('research.contextRelatives')} empty={t('research.noContextRelatives')}>
                {context.relatives.map((relative) => <li key={relative.recordName} className="rounded-md bg-secondary/50 px-2.5 py-2 text-xs">{relative.name}<span className="ms-1 text-muted-foreground">· {t(`research.relativeTypes.${relative.type}`)}</span></li>)}
              </ContextSection>
              <ContextSection title={t('research.contextSources')} empty={t('research.noContextSources')}>
                {context.sources.map((source) => <li key={source.recordName} className="rounded-md bg-secondary/50 px-2.5 py-2 text-xs">{source.title || t('sourcePicker.untitled')}</li>)}
              </ContextSection>
              <section className="border-t border-border pt-4">
                <h2 className="text-sm font-semibold">{t('research.researchLog', { count: journal.length })}</h2>
                <label htmlFor="research-log-draft" className="sr-only">{t('research.logPlaceholder')}</label>
                <textarea id="research-log-draft" value={journalDraft} onChange={(event) => setJournalDraft(event.target.value)} placeholder={t('research.logPlaceholder')} className="mt-2 min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-xs" />
                <button type="button" onClick={addJournalEntry} disabled={!journalDraft.trim()} className="mt-2 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs disabled:opacity-50">{t('research.addLogEntry')}</button>
                <ul className="mt-3 space-y-2">
                  {journal.slice(0, 5).map((entry) => <li key={entry.id} className="text-xs"><div className="text-2xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString(localization?.locale || 'en')}</div><div className="whitespace-pre-wrap">{entry.text}</div></li>)}
                </ul>
              </section>
            </div>
          )}
        </aside>
      </div>

      {placePickerOpen && <PlacePickerSheet onClose={() => setPlacePickerOpen(false)} onSelect={choosePlace} />}
      {sourcePickerOpen && selected && <SourcePickerSheet target={{ recordName: selected.personId, recordType: 'Person', label: selected.personName }} onClose={() => setSourcePickerOpen(false)} onLinked={() => completeWithMessage(selected, t('research.sourceAttached'))} />}
      {todoQuestion && <ResearchToDoSheet question={todoQuestion} title={t(`research.questionNames.${todoQuestion.kind}`)} text={questionText(todoQuestion, t)} onClose={() => setTodoQuestion(null)} onCreated={() => { mark(todoQuestion, 'done', t('research.todoCreated')); setMessage(t('research.todoCreated')); }} />}
    </div>
  );
}

function GenerationOptions({ options, smartFilters, groups, onChange, onReset, onRestoreIgnored, t }) {
  return (
    <div className="mt-3 rounded-md border border-border bg-background p-3">
      <fieldset>
        <legend className="text-xs font-semibold">{t('research.generateCategories')}</legend>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          {RESEARCH_CATEGORIES.map((category) => (
            <label key={category} className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={options.categories[category]} onChange={(event) => onChange({ categories: { ...options.categories, [category]: event.target.checked } })} />
              {t(`research.categories.${category}`)}
            </label>
          ))}
        </div>
      </fieldset>
      {!options.targetPersonId && (
        <fieldset className="mt-3 border-t border-border pt-3">
          <legend className="text-xs font-semibold">{t('research.generationScope')}</legend>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {['all', 'smartFilter', 'personGroup'].map((mode) => <label key={mode} className="flex items-center gap-1.5 text-xs"><input type="radio" name="research-scope" checked={options.scopeMode === mode} onChange={() => onChange({ scopeMode: mode })} />{t(`research.scopes.${mode}`)}</label>)}
            {options.scopeMode === 'smartFilter' && <select aria-label={t('research.selectSmartFilter')} value={options.smartFilterId} onChange={(event) => onChange({ smartFilterId: event.target.value })} className="h-8 min-w-48 rounded-md border border-border bg-background px-2 text-xs"><option value="">{t('research.selectSmartFilter')}</option>{smartFilters.map((filter) => <option key={filter.id} value={filter.id}>{filter.name}</option>)}</select>}
            {options.scopeMode === 'personGroup' && <select aria-label={t('research.selectPersonGroup')} value={options.personGroupId} onChange={(event) => onChange({ personGroupId: event.target.value })} className="h-8 min-w-48 rounded-md border border-border bg-background px-2 text-xs"><option value="">{t('research.selectPersonGroup')}</option>{groups.map((group) => <option key={group.recordName} value={group.recordName}>{group.fields?.name?.value || group.fields?.title?.value || group.recordName}</option>)}</select>}
          </div>
        </fieldset>
      )}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
        <button type="button" onClick={onRestoreIgnored} className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs">{t('research.restoreIgnored')}</button>
        <button type="button" onClick={onReset} className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs">{t('research.resetQuestions')}</button>
      </div>
    </div>
  );
}

function ContextSection({ title, empty, children }) {
  const items = React.Children.toArray(children);
  return <section><h2 className="mb-2 text-sm font-semibold">{title}</h2>{items.length === 0 ? <p className="text-xs text-muted-foreground">{empty}</p> : <ul className="space-y-1.5">{items}</ul>}</section>;
}

function buildContext(question, data) {
  const personFamilies = data.families.filter((family) => [readRef(family.fields?.man), readRef(family.fields?.woman)].includes(question.personId));
  const familyIds = new Set(personFamilies.map((family) => family.recordName));
  const events = [
    ...data.personEvents.filter((event) => readRef(event.fields?.person) === question.personId),
    ...data.familyEvents.filter((event) => familyIds.has(readRef(event.fields?.family))),
  ];
  const relatives = [];
  const seen = new Set();
  const addRelative = (id, type) => {
    if (!id || id === question.personId || seen.has(`${id}:${type}`)) return;
    seen.add(`${id}:${type}`);
    relatives.push({ recordName: `${id}:${type}`, name: personSummary(data.personById.get(id))?.fullName || id, type });
  };
  for (const relation of data.childRelations.filter((row) => readRef(row.fields?.child) === question.personId)) {
    const family = data.familyById.get(readRef(relation.fields?.family));
    addRelative(readRef(family?.fields?.man), 'parent');
    addRelative(readRef(family?.fields?.woman), 'parent');
  }
  for (const family of personFamilies) {
    addRelative([readRef(family.fields?.man), readRef(family.fields?.woman)].find((id) => id && id !== question.personId), 'partner');
    for (const relation of data.childRelations.filter((row) => readRef(row.fields?.family) === family.recordName)) addRelative(readRef(relation.fields?.child), 'child');
  }
  const relevantTargetIds = new Set([question.personId, ...events.map((event) => event.recordName)]);
  const sourceMatches = data.sourceRelations
    .filter((relation) => relevantTargetIds.has(readRef(relation.fields?.target)))
    .map((relation) => data.sourceById.get(readRef(relation.fields?.source)))
    .filter(Boolean);
  const sources = [...new Map(sourceMatches.map((source) => [source.recordName, source])).values()];
  return {
    events,
    relatives,
    sources,
    placeLabel: (event) => {
      const place = data.placeById.get(readRef(event.fields?.place || event.fields?.assignedPlace));
      return place?.displayName || place?.name || '';
    },
  };
}
