/**
 * Person editor — /person/:id. Full field set:
 *   • Name & gender
 *   • Additional names (typed sub-list)
 *   • Person events (typed sub-list, links to /events for advanced editing)
 *   • Person facts (typed sub-list)
 *   • Notes (multi)
 *   • Source citations (links)
 *   • Influential persons (associate relations)
 *   • Labels (toggle list)
 *   • Reference numbers (4 IDs)
 *   • Bookmarks + start-person + private flags
 *   • Last edited (read-only)
 *   • Parents read-only inline
 *   • Partner / family quick-edit links
 *
 * Every save appends a ChangeLogEntry via saveWithChangeLog().
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';
import { getAppDataClient } from '../lib/data/AppDataClient.js';
import { generateId } from '../lib/ids.js';
import { saveWithChangeLog } from '../lib/changeLog.js';
import { createWithChangeLog, deleteWithChangeLog } from '../lib/recordWrite.js';
import { refToRecordName, refValue } from '../lib/recordRef.js';
import { readConclusionType } from '../lib/schema.js';
import { Gender, lifeSpanLabel } from '../models/index.js';
import {
  ADDITIONAL_NAME_TYPES,
  PERSON_EVENT_TYPES,
  PERSON_FACT_TYPES,
  INFLUENTIAL_PERSON_TYPES_PERSON,
  LABELS,
  REFERENCE_NUMBER_FIELDS,
  formatTimestamp,
  labelForCatalogType,
  localizeTypeOptions,
} from '../lib/catalogs.js';
import { listCustomTypes, mergeWithBuiltins } from '../lib/customTypes.js';
import { Section } from '../components/editors/Section.jsx';
import { EditSwitch } from '../components/editors/EditSwitch.jsx';
import { TypePicker } from '../components/editors/TypePicker.jsx';
import { AssociateRelationsEditor, MediaRelationsEditor, SourceCitationsEditor } from '../components/editors/RelatedRecordEditors.jsx';
import { SourcePickerSheet } from '../components/editors/SourcePickerSheet.jsx';
import { OldestAncestorsWidget } from '../components/editors/OldestAncestorsWidget.jsx';
import { isRecordLocked } from '../lib/recordLock.js';
import { confirmUnsavedChanges, useDirtyBaseline } from '../lib/editorState.js';
import { useSaveShortcut } from '../lib/useSaveShortcut.js';
import { EditorSectionNavProvider, EditorSectionNavBar } from '../components/editors/EditorSectionNav.jsx';
import { useRecordLock } from '../lib/useRecordLock.js';
import { RecordLockButton } from '../components/editors/RecordLockButton.jsx';
import { PersonPicker } from '../components/charts/PersonPicker.jsx';
import { linkExistingRelative } from '../lib/relativeLinks.js';
import { affiliationLevelLabel } from '../lib/tribalAffiliations.js';
import { NAME_FIELDS, loadPersonEditorModel } from '../lib/personEditorQuery.js';
import {
  Field,
  Empty,
  ReadOnly,
  RemoveBtn,
  RelatedList,
  EvidenceMetric,
  EvidenceBadge,
  inputClass,
  toneClass,
  borderToneClass,
} from '../components/personEditor/uiPrimitives.jsx';
import { ParentsBlock } from '../components/personEditor/ParentsBlock.jsx';
import { MilkKinshipEditor, emptyMilkKinship } from '../components/personEditor/MilkKinshipEditor.jsx';
import { DatePicker } from '../components/ui/DatePicker.jsx';
import { useModal } from '../contexts/ModalContext.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { BdiText, LtrText } from '../components/BdiText.jsx';
import {
  reconcileMilkKinships,
  reconcileSubRecords,
  writeOptionalStringField,
} from '../components/personEditor/persistence.js';

function uuid(prefix) {
  return generateId(prefix);
}

const ACCENTS = {
  parents: 'rgb(128 128 230)',
  name: 'rgb(255 128 0)',
  additional: 'rgb(77 128 230)',
  events: 'rgb(0 217 115)',
  media: 'rgb(77 128 230)',
  facts: 'rgb(217 0 115)',
  tribal: 'rgb(20 120 120)',
  milk: 'rgb(20 184 166)',
  grave: 'rgb(107 114 128)',
  notes: 'rgb(217 217 0)',
  sources: 'rgb(51 0 255)',
  influential: 'rgb(0 77 179)',
  labels: 'rgb(255 0 128)',
  ref: 'rgb(128 217 77)',
  bookmarks: 'rgb(128 51 255)',
  private: 'rgb(255 0 0)',
  outside: 'rgb(168 85 247)',
  edited: 'rgb(191 128 64)',
  partners: 'rgb(230 128 128)',
};

// Stable DOM id for the Source Citations section so "Unsourced" evidence
// badges can scroll the user straight to where they attach a source.
const SOURCE_CITATIONS_ANCHOR = 'person-source-citations';
// Stable anchors for deep links arriving from the interactive tree's context
// menu (e.g. "Select Existing Person as Father", "Add/Edit Influential Persons").
const RELATIVES_ANCHOR = 'person-parents-relatives';
const INFLUENTIAL_ANCHOR = 'person-influential';

// Map the tree's `?addRelative=existing*` intent onto the inline
// "Link relative" picker's relation type, so arriving there preselects the
// right kind of link and points the user at the picker.
const ADD_RELATIVE_TO_TYPE = {
  existingFather: 'parent',
  existingMother: 'parent',
  existingParent: 'parent',
  existingPartner: 'spouse',
  existingSpouse: 'spouse',
  existingChild: 'child',
  existingSibling: 'sibling',
};

const DEEP_LINK_HINTS = {
  parent: ['editor.person.linkHint.parent', 'Pick an existing person below to link as a parent.'],
  spouse: ['editor.person.linkHint.spouse', 'Pick an existing person below to link as a partner.'],
  child: ['editor.person.linkHint.child', 'Pick an existing person below to link as a child.'],
  sibling: ['editor.person.linkHint.sibling', 'Pick an existing person below to link as a sibling.'],
};

export default function PersonEditor() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addRelativeParam = searchParams.get('addRelative');
  const sectionParam = searchParams.get('section');
  const [record, setRecord] = useState(null);
  const [context, setContext] = useState(null);
  const [values, setValues] = useState({});
  const [additionalNames, setAdditionalNames] = useState([]);
  const [events, setEvents] = useState([]);
  const [facts, setFacts] = useState([]);
  const [grave, setGrave] = useState({ cemetery: '', cemeteryLocation: '', graveNumber: '' });
  const [milkKinships, setMilkKinships] = useState([]);
  const [notes, setNotes] = useState([]);
  const [associates, setAssociates] = useState([]);
  const [related, setRelated] = useState({ media: [], sources: [], todos: [], stories: [], groups: [] });
  const [tribalMemberships, setTribalMemberships] = useState([]);
  const [evidence, setEvidence] = useState(null);
  const [sourceTarget, setSourceTarget] = useState(null);
  const [allPersons, setAllPersons] = useState([]);
  const [relativeType, setRelativeType] = useState(() => ADD_RELATIVE_TO_TYPE[addRelativeParam] || 'parent');
  const [relativeId, setRelativeId] = useState('');
  const [showDeepLinkHint, setShowDeepLinkHint] = useState(() => !!ADD_RELATIVE_TO_TYPE[addRelativeParam]);
  const deepLinkHintEntry = DEEP_LINK_HINTS[ADD_RELATIVE_TO_TYPE[addRelativeParam]];
  const deepLinkHint = showDeepLinkHint && deepLinkHintEntry
    ? t(deepLinkHintEntry[0], { defaultValue: deepLinkHintEntry[1] })
    : null;
  // /person/new redirects here with ?linkFailed=1 when it created the person
  // but could not attach the relationship. Say so where the relatives are.
  const linkFailed = searchParams.get('linkFailed') === '1';
  const [labels, setLabels] = useState({}); // labelId -> bool
  const [labelDefs, setLabelDefs] = useState(LABELS);
  const [refNumbers, setRefNumbers] = useState({});
  const [bookmarked, setBookmarked] = useState(false);
  const [isStartPerson, setIsStartPerson] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isDeceased, setIsDeceased] = useState(false);
  const [outsideFamily, setOutsideFamily] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loadSeq, setLoadSeq] = useState(0);
  const [eventTypes, setEventTypes] = useState(PERSON_EVENT_TYPES);
  const [factTypes, setFactTypes] = useState(PERSON_FACT_TYPES);
  const [nameTypes, setNameTypes] = useState(ADDITIONAL_NAME_TYPES);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ev, ft, an] = await Promise.all([
        listCustomTypes('event'),
        listCustomTypes('fact'),
        listCustomTypes('additionalName'),
      ]);
      if (cancelled) return;
      setEventTypes(mergeWithBuiltins(PERSON_EVENT_TYPES, ev));
      setFactTypes(mergeWithBuiltins(PERSON_FACT_TYPES, ft));
      setNameTypes(mergeWithBuiltins(ADDITIONAL_NAME_TYPES, an));
    })();
    return () => { cancelled = true; };
  }, []);

  const reload = useCallback(async () => {
    const model = await loadPersonEditorModel(id);
    if (!model) { setNotFound(true); return; }
    setRecord(model.record);
    setContext(model.context);
    setValues(model.values);
    setBookmarked(model.bookmarked);
    setIsStartPerson(model.isStartPerson);
    setIsPrivate(model.isPrivate);
    setIsDeceased(model.isDeceased);
    setOutsideFamily(model.outsideFamily);
    setGrave(model.grave);
    setRefNumbers(model.refNumbers);
    setLabelDefs(model.labelDefs);
    setEvidence(model.evidence);
    setAllPersons(model.allPersons);
    setMilkKinships(model.milkKinships);
    setAdditionalNames(model.additionalNames);
    setFacts(model.facts);
    setNotes(model.notes);
    setEvents(model.events);
    setAssociates(model.associates);
    setRelated(model.related);
    setTribalMemberships(model.tribalMemberships);
    setLabels(model.labels);
    // Signal that a full hydration finished so the dirty baseline can be
    // captured against the complete record (see the loadSeq effect below).
    setLoadSeq((n) => n + 1);
  }, [id]);

  const onLinkRelative = useCallback(async () => {
    if (!relativeId) return;
    try {
      await linkExistingRelative(id, relativeId, relativeType);
      setRelativeId('');
      setShowDeepLinkHint(false);
      await reload();
      setStatus(t('editor.person.relativeLinked', { defaultValue: 'Relative linked' }));
      setTimeout(() => setStatus(null), 1500);
    } catch (error) {
      setStatus(error.message);
    }
  }, [id, relativeId, relativeType, reload, t]);

  useEffect(() => { reload(); }, [reload]);

  // Deep-link intents from the interactive tree's context menu. Once the record
  // has hydrated (so the target sections exist in the DOM), scroll to the
  // relevant section: the inline relative picker for "Select Existing Person
  // as …", or the Influential Persons section for "Add/Edit Influential …".
  const deepLinkApplied = useRef(false);
  useEffect(() => {
    if (deepLinkApplied.current || !loadSeq) return undefined;
    if (!addRelativeParam && !sectionParam) return undefined;
    deepLinkApplied.current = true;
    const anchor = sectionParam === 'influential'
      ? INFLUENTIAL_ANCHOR
      : addRelativeParam ? RELATIVES_ANCHOR : null;
    if (!anchor) return undefined;
    const timer = setTimeout(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => clearTimeout(timer);
  }, [loadSeq, addRelativeParam, sectionParam]);

  const editableSnapshot = useMemo(() => ({
    recordFields: record?.fields || {},
    values,
    additionalNames,
    facts,
    grave,
    milkKinships,
    notes,
    labels,
    refNumbers,
    bookmarked,
    isStartPerson,
    isPrivate,
    isDeceased,
    outsideFamily,
  }), [record, values, additionalNames, facts, grave, milkKinships, notes, labels, refNumbers, bookmarked, isStartPerson, isPrivate, isDeceased, outsideFamily]);
  const dirty = useDirtyBaseline(editableSnapshot, {
    recordKey: record?.recordName,
    reloadKey: loadSeq,
    enabled: !!record && !saving,
  });
  const modal = useModal();
  const onToggleLock = useRecordLock({ record, setRecord, setSaving, setStatus, reload });
  const guardedNavigate = useCallback(async (to, options) => {
    if (await confirmUnsavedChanges(dirty, modal)) navigate(to, options);
  }, [dirty, modal, navigate]);

  // Jump to the Source Citations section (the "Unsourced" badges call this).
  const scrollToSourceCitations = useCallback(() => {
    const el = document.getElementById(SOURCE_CITATIONS_ANCHOR);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const onSave = useCallback(async () => {
    if (!record) return;
    setSaving(true);
    const data = getAppDataClient();
    // reconcileSubRecords/reconcileMilkKinships still speak the raw database
    // dialect (query/saveRecord/deleteRecord); adapt the facade for them.
    const db = {
      query: (type, options) => data.records.query(type, options),
      saveRecord: (rec) => data.records.save(rec),
      deleteRecord: (recordName) => data.records.delete(recordName),
    };

    // ── Person record itself
    const next = { ...record, fields: { ...record.fields } };
    for (const f of NAME_FIELDS) {
      const v = values[f.id];
      if (v == null || v === '') delete next.fields[f.id];
      else next.fields[f.id] = { value: v, type: 'STRING' };
    }
    const fullName = `${values.firstName || ''} ${values.lastName || ''}`.trim();
    if (fullName) next.fields.cached_fullName = { value: fullName, type: 'STRING' };
    next.fields.isBookmarked = { value: !!bookmarked, type: 'BOOLEAN' };
    next.fields.isStartPerson = { value: !!isStartPerson, type: 'BOOLEAN' };
    next.fields.isPrivate = { value: !!isPrivate, type: 'BOOLEAN' };
    next.fields.isDeceased = { value: !!isDeceased, type: 'BOOLEAN' };
    next.fields.fromOutsideFamily = { value: !!outsideFamily, type: 'BOOLEAN' };
    writeOptionalStringField(next, 'cemetery', grave.cemetery);
    writeOptionalStringField(next, 'cemeteryLocation', grave.cemeteryLocation);
    writeOptionalStringField(next, 'graveNumber', grave.graveNumber);
    for (const f of REFERENCE_NUMBER_FIELDS) {
      const v = refNumbers[f.id];
      if (v == null || v === '') delete next.fields[f.id];
      else next.fields[f.id] = { value: v, type: 'STRING' };
    }
    await saveWithChangeLog(next);

    // ── Reconcile sub-records (additional names, facts, notes)
    await reconcileSubRecords(db, id, 'AdditionalName', 'person', additionalNames, (item) => ({
      conclusionType: { value: refValue(item.type, 'ConclusionAdditionalNameType'), type: 'REFERENCE' },
      name: { value: item.value || '', type: 'STRING' },
    }), (item) => !!item.value);

    await reconcileSubRecords(db, id, 'PersonFact', 'person', facts, (item) => ({
      conclusionType: { value: refValue(item.type, 'ConclusionPersonFactType'), type: 'REFERENCE' },
      description: { value: item.value || '', type: 'STRING' },
      date: { value: item.date || '', type: 'STRING' },
    }), (item) => !!(item.type || item.value));

    await reconcileSubRecords(db, id, 'Note', 'person', notes, (item) => ({
      text: { value: item.text || '', type: 'STRING' },
    }), (item) => !!item.text);

    await reconcileMilkKinships(db, id, milkKinships);

    // ── Labels — LabelRelation rows keyed by label id (1:1 per person/label)
    const existingLbl = (await data.records.query('LabelRelation', { referenceField: 'targetPerson', referenceValue: id, limit: 500 })).records;
    const existingByLabel = new Map(existingLbl.map((r) => [refToRecordName(r.fields?.label?.value), r]));
    for (const def of LABELS) {
      const want = !!labels[def.id];
      const existing = existingByLabel.get(def.id);
      if (want && !existing) {
        const rec = {
          recordName: uuid('lbr'),
          recordType: 'LabelRelation',
          fields: {
            label: { value: refValue(def.id, 'Label'), type: 'REFERENCE' },
            targetPerson: { value: refValue(id, 'Person'), type: 'REFERENCE' },
          },
        };
        await createWithChangeLog(rec);
      } else if (!want && existing) {
        await deleteWithChangeLog(existing.recordName, 'LabelRelation');
      }
    }

    await reload();
    setSaving(false);
    setStatus(t('common.saved', { defaultValue: 'Saved' }));
    // Baseline is re-captured by the loadSeq effect after reload() hydrates.
    setTimeout(() => setStatus(null), 1500);
  }, [record, values, refNumbers, bookmarked, isStartPerson, isPrivate, isDeceased, outsideFamily, grave, additionalNames, facts, notes, milkKinships, labels, id, reload, t]);

  const locked = !!record && isRecordLocked(record);
  useSaveShortcut(onSave, { enabled: !saving && !locked && dirty });

  if (notFound) return <div className="p-10 text-muted-foreground">{t('editor.person.notFound', { defaultValue: 'Person not found.' })}</div>;
  if (!record) return <div className="p-10 text-muted-foreground">{t('common.loading', { defaultValue: 'Loading…' })}</div>;

  const headerLabel = record.fields?.cached_fullName?.value || record.recordName;
  const subtitle = lifeSpanLabel({
    birthDate: record.fields?.cached_birthDate?.value,
    deathDate: record.fields?.cached_deathDate?.value,
  });

  return (
    <EditorSectionNavProvider>
    <div className="flex flex-col h-full">
      <header className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <button onClick={() => guardedNavigate(-1)} className="text-xs text-muted-foreground border border-border rounded-md px-3 py-1.5 hover:bg-accent">
          {t('common.back', { defaultValue: 'Back' })}
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold truncate"><BdiText>{headerLabel}</BdiText></h2>
          {subtitle && <div className="text-xs text-muted-foreground"><LtrText>{subtitle}</LtrText></div>}
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto sm:ms-auto">
          {status ? (
            <span className="text-success-text text-xs">{status}</span>
          ) : dirty ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-warning-text">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
              {t('editor.unsavedChanges', { defaultValue: 'Unsaved changes' })}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t('editor.allChangesSaved', { defaultValue: 'All changes saved' })}</span>
          )}
          <RecordLockButton record={record} saving={saving} onToggle={onToggleLock} />
          <Button variant="primary" size="md" disabled={saving || locked || !dirty} onClick={onSave} title={t('editor.saveShortcut', { defaultValue: 'Save (⌘/Ctrl+S)' })}>
            {saving ? t('common.saving', { defaultValue: 'Saving…' }) : t('editor.saveChanges', { defaultValue: 'Save changes' })}
          </Button>
        </div>
      </header>
      <EditorSectionNavBar />

      <div className="flex-1 overflow-auto bg-background">
        <div className="max-w-6xl mx-auto p-5">

          {context && (
            <Section title={t('editor.person.parentsRelatives', { defaultValue: 'Parents & Relatives' })} accent={ACCENTS.parents} domId={RELATIVES_ANCHOR}>
              <ParentsBlock context={context} onPick={(rn) => guardedNavigate(`/person/${rn}`)} />
              {linkFailed && (
                <div className="mt-3 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-warning-text" dir="auto">
                  {t('editor.person.linkFailed', { defaultValue: 'This person was created, but the relationship could not be added automatically. Link them below.' })}
                </div>
              )}
              {deepLinkHint && (
                <div className="mt-3 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-foreground">
                  {deepLinkHint}
                </div>
              )}
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[130px_1fr_auto]">
                <select
                  value={relativeType}
                  onChange={(event) => setRelativeType(event.target.value)}
                  aria-label={t('editor.person.relationType', { defaultValue: 'Relationship' })}
                  className={inputClass()}
                >
                  <option value="parent">{t('editor.person.relation.parent', { defaultValue: 'Parent' })}</option>
                  <option value="spouse">{t('editor.person.relation.spouse', { defaultValue: 'Spouse' })}</option>
                  <option value="child">{t('editor.person.relation.child', { defaultValue: 'Child' })}</option>
                  <option value="sibling">{t('editor.person.relation.sibling', { defaultValue: 'Sibling' })}</option>
                </select>
                <PersonPicker persons={allPersons.filter((person) => person.recordName !== id)} value={relativeId} onChange={setRelativeId} />
                <button type="button" onClick={onLinkRelative} disabled={!relativeId} className="w-full sm:w-auto bg-secondary border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50">
                  {t('editor.person.link', { defaultValue: 'Link' })}
                </button>
              </div>
            </Section>
          )}
          {record?.recordName && (
            <Section title={t('editor.person.oldestAncestors', { defaultValue: 'Oldest Ancestors' })} accent={ACCENTS.parents} collapsible defaultCollapsed persistKey="person">
              <OldestAncestorsWidget recordName={record.recordName} />
            </Section>
          )}
          {evidence?.row && (
            <Section title={t('editor.person.evidenceSummary', { defaultValue: 'Evidence Summary' })} accent={ACCENTS.sources} collapsible defaultCollapsed persistKey="person">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <EvidenceMetric
                  label={t('editor.evidence.sourceState', { defaultValue: 'Source state' })}
                  value={t(`editor.evidence.state.${evidence.row.sourceState}`, { defaultValue: evidence.row.sourceState })}
                  tone={evidence.row.sourceState}
                />
                <EvidenceMetric label={t('editor.evidence.sourceLinks', { defaultValue: 'Source links' })} value={evidence.row.sourceCount} />
                <EvidenceMetric label={t('editor.evidence.unplacedEvents', { defaultValue: 'Unplaced events' })} value={evidence.row.unplacedEvents} tone={evidence.row.unplacedEvents ? 'Weak' : 'Supported'} />
                <EvidenceMetric
                  label={t('editor.evidence.duplicateRisk', { defaultValue: 'Duplicate risk' })}
                  value={t(`editor.evidence.level.${evidence.row.duplicateRisk}`, { defaultValue: evidence.row.duplicateRisk })}
                  tone={evidence.row.duplicateRisk === 'Low' ? 'Supported' : 'Weak'}
                />
                <EvidenceMetric
                  label={t('editor.evidence.researchPriority', { defaultValue: 'Research priority' })}
                  value={t(`editor.evidence.level.${evidence.row.researchPriority}`, { defaultValue: evidence.row.researchPriority })}
                  tone={evidence.row.researchPriority === 'Low' ? 'Supported' : evidence.row.researchPriority === 'Medium' ? 'Weak' : 'Unsourced'}
                />
              </div>
            </Section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
            <div className="min-w-0">

              <Section title={t('editor.person.nameGender', { defaultValue: 'Name & Gender' })} accent={ACCENTS.name}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {NAME_FIELDS.map((f) => (
                    <Field key={f.id} label={t(`editor.person.field.${f.id}`, { defaultValue: f.label })}>
                      <input
                        value={values[f.id] ?? ''}
                        onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
                        dir="auto"
                        className={inputClass()}
                      />
                    </Field>
                  ))}
                  <Field label={t('editor.person.field.gender', { defaultValue: 'Gender' })}>
                    <select
                      value={record.fields?.gender?.value ?? Gender.UnknownGender}
                      onChange={(e) => {
                        const v = +e.target.value;
                        setRecord((r) => ({ ...r, fields: { ...r.fields, gender: { value: v, type: 'NUMBER' } } }));
                      }}
                      className={inputClass()}
                    >
                      <option value={Gender.Male}>{t('gender.male', { defaultValue: 'Male' })}</option>
                      <option value={Gender.Female}>{t('gender.female', { defaultValue: 'Female' })}</option>
                      <option value={Gender.UnknownGender}>{t('gender.unknown', { defaultValue: 'Unknown Gender' })}</option>
                      <option value={Gender.Intersex}>{t('gender.intersex', { defaultValue: 'Intersex' })}</option>
                    </select>
                  </Field>
                </div>
              </Section>

              <Section
                title={t('editor.person.additionalNames', { defaultValue: 'Additional Names' })}
                accent={ACCENTS.additional}
                controls={<TypePicker placeholder={t('editor.person.addName', { defaultValue: 'Add Name' })} options={nameTypes}
                  onPick={(type) => setAdditionalNames((a) => [...a, { type, value: '' }])} />}
              >
                {additionalNames.length === 0 ? (
                  <Empty
                    title={t('editor.person.noAdditionalNames', { defaultValue: 'No Additional Name present' })}
                    hint={t('editor.useMenuAbove', { defaultValue: 'Use the menu above to add one.' })}
                  />
                ) : additionalNames.map((it, i) => (
                  <div key={it.recordName || i} className="flex items-center gap-2 mb-2">
                    <select
                      value={it.type}
                      aria-label={t('editor.person.nameType', { defaultValue: 'Name type' })}
                      onChange={(e) => setAdditionalNames((a) => a.map((x, j) => j === i ? { ...x, type: e.target.value } : x))}
                      className={inputClass() + ' max-w-[180px]'}
                    >
                      {localizeTypeOptions(nameTypes).map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                    </select>
                    <input
                      value={it.value}
                      placeholder={t('editor.person.namePlaceholder', { defaultValue: 'Name' })}
                      aria-label={t('editor.person.namePlaceholder', { defaultValue: 'Name' })}
                      dir="auto"
                      onChange={(e) => setAdditionalNames((a) => a.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                      className={inputClass() + ' flex-1'}
                    />
                    <RemoveBtn label={t('common.remove', { defaultValue: 'Remove' })} onClick={() => setAdditionalNames((a) => a.filter((_, j) => j !== i))} />
                  </div>
                ))}
              </Section>

              <Section
                title={t('editor.person.events', { defaultValue: 'Events' })}
                accent={ACCENTS.events}
                controls={<TypePicker placeholder={t('editor.person.addEvent', { defaultValue: 'Add Event' })} options={eventTypes}
                  onPick={async (type) => {
                    const rec = {
                      recordName: uuid('pe'),
                      recordType: 'PersonEvent',
                      fields: {
                        person: { value: refValue(id, 'Person'), type: 'REFERENCE' },
                        conclusionType: { value: refValue(type, 'ConclusionPersonEventType'), type: 'REFERENCE' },
                      },
                    };
                    await createWithChangeLog(rec);
                    await reload();
                  }} />}
              >
                {events.length === 0 ? (
                  <Empty
                    title={t('editor.person.noEvents', { defaultValue: 'No events' })}
                    hint={t('editor.person.noEventsHint', { defaultValue: 'Use the menu above to add one, or open the Events page for advanced editing.' })}
                  />
                ) : (
                  <div className="space-y-2">
                    {events.map((e) => {
                      const rawType = e.fields?.conclusionType?.value || e.fields?.eventType?.value || '';
                      const label = labelForCatalogType(eventTypes, rawType, readConclusionType(e) || t('editor.person.event', { defaultValue: 'Event' }));
                      const date = e.fields?.date?.value || '';
                      const time = e.fields?.time?.value || '';
                      const extendedDetails = [
                        e.fields?.address?.value ? `${t('eventEditor.address')}: ${e.fields.address.value}` : '',
                        (e.fields?.agency?.value || e.fields?.authority?.value) ? `${t('eventEditor.agency')}: ${e.fields?.agency?.value || e.fields?.authority?.value}` : '',
                        e.fields?.cause?.value ? `${t('eventEditor.cause')}: ${e.fields.cause.value}` : '',
                      ].filter(Boolean);
                      return (
                        <div key={e.recordName} className="flex items-start justify-between gap-3 p-2.5 bg-secondary/30 rounded-md">
                          <div className="min-w-0">
                            <span className="text-sm">{label}{date && <span className="text-muted-foreground"> · {date}</span>}{time && <span className="text-muted-foreground"> · {time}</span>}</span>
                            {extendedDetails.length > 0 && <div className="mt-1 text-xs text-muted-foreground" dir="auto">{extendedDetails.join(' · ')}</div>}
                          </div>
                          <EvidenceBadge evidence={evidence?.byRecord?.get(e.recordName)} onClick={() => setSourceTarget({ recordName: e.recordName, recordType: 'PersonEvent', label })} />
                          <button onClick={() => guardedNavigate(`/events?eventId=${encodeURIComponent(e.recordName)}`)} className="text-xs text-interactive hover:underline">
                            {t('common.edit', { defaultValue: 'Edit' })}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>

              <Section title={t('editor.person.media', { defaultValue: 'Media' })} accent={ACCENTS.media}
                controls={<button onClick={() => guardedNavigate(`/views/media-gallery?targetId=${encodeURIComponent(id)}&targetType=Person`)} className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5">{t('editor.person.openGallery', { defaultValue: 'Open Gallery' })}</button>}
              >
                <MediaRelationsEditor ownerRecordName={id} ownerRecordType="Person" onChanged={reload} />
              </Section>

              <Section
                title={t('editor.person.facts', { defaultValue: 'Facts' })}
                accent={ACCENTS.facts}
                controls={<TypePicker placeholder={t('editor.person.addFact', { defaultValue: 'Add Fact' })} options={factTypes}
                  onPick={(type) => setFacts((a) => [...a, { type, value: '', date: '' }])} />}
              >
                {facts.length === 0 ? (
                  <Empty
                    title={t('editor.person.noFacts', { defaultValue: 'No facts' })}
                    hint={t('editor.useMenuAbove', { defaultValue: 'Use the menu above to add one.' })}
                  />
                ) : facts.map((it, i) => {
                  const label = labelForCatalogType(factTypes, it.type, it.type || t('editor.person.fact', { defaultValue: 'Fact' }));
                  return (
                    <div key={it.recordName || i} className="flex flex-wrap gap-2 mb-2 items-center">
                      <span className="text-xs font-medium w-[140px] shrink-0">{label}</span>
                      <input value={it.value} placeholder={t('common.value', { defaultValue: 'Value' })} dir="auto"
                        aria-label={`${label} — ${t('common.value', { defaultValue: 'Value' })}`}
                        onChange={(e) => setFacts((a) => a.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                        className={inputClass() + ' flex-1 min-w-[120px]'}
                      />
                      <DatePicker
                        value={it.date}
                        onChange={(date) => setFacts((a) => a.map((x, j) => j === i ? { ...x, date } : x))}
                        placeholder={t('common.date', { defaultValue: 'Date' })}
                        className="w-full sm:w-[180px] shrink-0"
                      />
                      <div className="flex items-center gap-2 ms-auto shrink-0">
                        <EvidenceBadge evidence={it.recordName ? evidence?.byRecord?.get(it.recordName) : null} onClick={() => it.recordName && setSourceTarget({ recordName: it.recordName, recordType: 'PersonFact', label })} />
                        <RemoveBtn label={t('common.remove', { defaultValue: 'Remove' })} onClick={() => setFacts((a) => a.filter((_, j) => j !== i))} />
                      </div>
                    </div>
                  );
                })}
              </Section>

              <Section title={t('editor.person.tribalAffiliations', { defaultValue: 'Tribal Affiliations' })} accent={ACCENTS.tribal}
                collapsible defaultCollapsed persistKey="person"
                controls={<button type="button" onClick={() => guardedNavigate('/tribal-affiliations')} className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5">{t('common.open', { defaultValue: 'Open' })}</button>}
              >
                {tribalMemberships.length === 0 ? (
                  <Empty
                    title={t('editor.person.noTribalAffiliations', { defaultValue: 'No tribal affiliations' })}
                    hint={t('editor.person.noTribalAffiliationsHint', { defaultValue: 'Add clan, tribe, branch, or house membership from the Tribal Affiliations page.' })}
                  />
                ) : (
                  <div className="space-y-2">
                    {tribalMemberships.map((membership) => (
                      <div key={membership.relation.recordName} className="flex items-center gap-2 p-2.5 bg-secondary/30 rounded-md">
                        <span className="text-sm flex-1 min-w-0 truncate">
                          {membership.affiliation.name}
                          <span className="text-muted-foreground"> · {affiliationLevelLabel(membership.affiliation.level)}</span>
                        </span>
                        {membership.virtual && <span className="text-xs text-muted-foreground">{t('editor.person.importedFact', { defaultValue: 'imported fact' })}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section title={t('editor.person.milkKinship', { defaultValue: 'Milk Kinship / الرضاعة' })} accent={ACCENTS.milk}
                collapsible defaultCollapsed persistKey="person"
                controls={<button type="button" onClick={() => setMilkKinships((rows) => [...rows, emptyMilkKinship(id)])}
                  className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5">{t('editor.person.addMilkKinship', { defaultValue: 'Add Milk Kinship' })}</button>}
              >
                {milkKinships.length === 0 ? (
                  <Empty
                    title={t('editor.person.noMilkKinship', { defaultValue: 'No milk kinship recorded' })}
                    hint={t('editor.person.noMilkKinshipHint', { defaultValue: 'Record nursing mother, milk father, and child without changing biological parent links.' })}
                  />
                ) : (
                  <div className="space-y-3">
                    {milkKinships.map((it, i) => (
                      <MilkKinshipEditor
                        key={it.recordName || i}
                        item={it}
                        persons={allPersons}
                        currentPersonId={id}
                        onChange={(nextItem) => setMilkKinships((rows) => rows.map((row, j) => j === i ? nextItem : row))}
                        onRemove={() => setMilkKinships((rows) => rows.filter((_, j) => j !== i))}
                      />
                    ))}
                  </div>
                )}
              </Section>

              <Section title={t('editor.person.grave', { defaultValue: 'Grave & Cemetery' })} accent={ACCENTS.grave} collapsible defaultCollapsed persistKey="person">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label={t('editor.person.cemetery', { defaultValue: 'Cemetery' })}>
                    <input value={grave.cemetery} onChange={(event) => setGrave((g) => ({ ...g, cemetery: event.target.value }))} className={inputClass()} />
                  </Field>
                  <Field label={t('editor.person.cemeteryLocation', { defaultValue: 'Cemetery location / map link' })}>
                    <input value={grave.cemeteryLocation} onChange={(event) => setGrave((g) => ({ ...g, cemeteryLocation: event.target.value }))} className={inputClass()} />
                  </Field>
                  <Field label={t('editor.person.graveNumber', { defaultValue: 'Grave number' })}>
                    <input value={grave.graveNumber} onChange={(event) => setGrave((g) => ({ ...g, graveNumber: event.target.value }))} className={inputClass()} />
                  </Field>
                </div>
              </Section>

              <Section
                title={t('editor.person.notes', { defaultValue: 'Notes' })}
                accent={ACCENTS.notes}
                controls={<button onClick={() => setNotes((a) => [...a, { text: '' }])}
                  className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5">{t('editor.person.addNote', { defaultValue: 'Add Note' })}</button>}
              >
                {notes.length === 0 ? (
                  <Empty
                    title={t('editor.person.noNotes', { defaultValue: 'No Notes present' })}
                    hint={t('editor.person.noNotesHint', { defaultValue: 'Use the button above to add a new note.' })}
                  />
                ) : notes.map((n, i) => (
                  <div key={n.recordName || i} className="mb-3">
                    <textarea
                      value={n.text}
                      aria-label={t('editor.person.note', { defaultValue: 'Note' })}
                      onChange={(e) => setNotes((a) => a.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                      rows={3}
                      dir="auto"
                      className={inputClass() + ' resize-y'}
                    />
                    <div className="text-end">
                      <RemoveBtn label={t('common.remove', { defaultValue: 'Remove' })} onClick={() => setNotes((a) => a.filter((_, j) => j !== i))} />
                    </div>
                  </div>
                ))}
              </Section>

              <Section title={t('editor.person.sourceCitations', { defaultValue: 'Source Citations' })} accent={ACCENTS.sources} domId={SOURCE_CITATIONS_ANCHOR}
                controls={<button onClick={() => guardedNavigate('/sources')} className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5">{t('editor.person.openSources', { defaultValue: 'Open Sources' })}</button>}>
                <SourceCitationsEditor ownerRecordName={id} ownerRecordType="Person" ownerRole="target" onChanged={reload} />
              </Section>

              <Section title={t('editor.person.todosStoriesGroups', { defaultValue: 'ToDos, Stories & Groups' })} accent={ACCENTS.sources} collapsible defaultCollapsed persistKey="person">
                <RelatedList
                  items={[...related.todos, ...related.stories, ...related.groups]}
                  emptyTitle={t('editor.person.noRelatedRecords', { defaultValue: 'No related records' })}
                  emptyHint={t('editor.person.noRelatedRecordsHint', { defaultValue: 'Imported ToDos, stories, and groups linked to this person appear here.' })}
                />
              </Section>

              <Section title={t('editor.person.influentialPersons', { defaultValue: 'Influential Persons' })} accent={ACCENTS.influential} collapsible defaultCollapsed persistKey="person"
                domId={INFLUENTIAL_ANCHOR} forceExpand={sectionParam === 'influential'}>
                <AssociateRelationsEditor ownerRecordName={id} ownerRecordType="Person" relationTypes={INFLUENTIAL_PERSON_TYPES_PERSON} onChanged={reload} />
              </Section>

            </div>

            {/* Right column */}
            <div>
              <Section title={t('editor.person.labels', { defaultValue: 'Labels' })} accent={ACCENTS.labels}>
                <div className="space-y-1">
                  {labelDefs.map((def) => (
                    <EditSwitch
                      key={def.id}
                      label={t(`labels.${def.id}`, { defaultValue: def.label })}
                      color={def.color}
                      checked={!!labels[def.id]}
                      onChange={(v) => setLabels((s) => ({ ...s, [def.id]: v }))}
                    />
                  ))}
                </div>
              </Section>

              <Section title={t('editor.person.referenceNumbers', { defaultValue: 'Reference Numbers' })} accent={ACCENTS.ref} collapsible defaultCollapsed persistKey="person">
                <div className="grid grid-cols-1 gap-3">
                  {REFERENCE_NUMBER_FIELDS.map((f) => (
                    <Field key={f.id} label={t(`editor.person.refField.${f.id}`, { defaultValue: f.label })}>
                      <input
                        value={refNumbers[f.id] ?? ''}
                        onChange={(e) => setRefNumbers((s) => ({ ...s, [f.id]: e.target.value }))}
                        className={inputClass()}
                      />
                    </Field>
                  ))}
                </div>
              </Section>

              <Section title={t('editor.person.bookmarks', { defaultValue: 'Bookmarks' })} accent={ACCENTS.bookmarks}>
                <EditSwitch label={t('editor.person.bookmarked', { defaultValue: 'Bookmarked' })} checked={bookmarked} onChange={setBookmarked} />
                <EditSwitch label={t('editor.person.startPerson', { defaultValue: 'Marked as Start Person' })} checked={isStartPerson} onChange={setIsStartPerson} />
              </Section>

              <Section title={t('editor.person.private', { defaultValue: 'Private' })} accent={ACCENTS.private}>
                <EditSwitch label={t('editor.person.markedPrivate', { defaultValue: 'Marked as Private' })} checked={isPrivate} onChange={setIsPrivate} />
                <p className="text-2xs text-muted-foreground mt-2" dir="auto">
                  {t('editor.person.privateHint', { defaultValue: "If selected, this person won't appear in charts or reports." })}
                </p>
              </Section>

              <Section title={t('editor.person.vitalStatus', { defaultValue: 'Vital Status' })} accent={ACCENTS.grave}>
                <EditSwitch label={t('editor.person.deceased', { defaultValue: 'Deceased (no further information)' })} checked={isDeceased} onChange={setIsDeceased} />
                <p className="text-2xs text-muted-foreground mt-2" dir="auto">
                  {t('editor.person.deceasedHint', { defaultValue: 'Confirms the person has died even without a death date — keeps them out of "living person" privacy filters and exports as 1 DEAT Y.' })}
                </p>
              </Section>

              <Section title={t('editor.person.familyScope', { defaultValue: 'Family Scope' })} accent={ACCENTS.outside}>
                <EditSwitch label={t('editor.person.outsideFamily', { defaultValue: 'Outside main family' })} checked={outsideFamily} onChange={setOutsideFamily} />
                <p className="text-2xs text-muted-foreground mt-2" dir="auto">
                  {t('editor.person.outsideFamilyHint', { defaultValue: 'Use for spouses, milk relatives, friends, and invitees who should remain searchable without being treated as a core descendant branch.' })}
                </p>
              </Section>

              <Section title={t('editor.person.lastEdited', { defaultValue: 'Last Edited' })} accent={ACCENTS.edited} collapsible defaultCollapsed persistKey="person">
                <ReadOnly label={t('editor.person.changeDate', { defaultValue: 'Change Date' })} value={formatTimestamp(record.fields?.mft_changeDate?.value || record.modified?.timestamp)} />
                <ReadOnly label={t('editor.person.creationDate', { defaultValue: 'Creation Date' })} value={formatTimestamp(record.fields?.mft_creationDate?.value || record.created?.timestamp)} />
              </Section>
            </div>
          </div>

          {context && context.families.length > 0 && (
            <Section title={t('editor.person.partners', { defaultValue: 'Partners' })} accent={ACCENTS.partners}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {context.families.map((fam) => (
                  <button
                    key={fam.family.recordName}
                    onClick={() => guardedNavigate(`/family/${fam.family.recordName}`)}
                    className="text-start p-3 rounded-md border border-border bg-secondary/30 hover:bg-secondary"
                  >
                    <div className="text-xs text-muted-foreground mb-1">{t('editor.person.family', { defaultValue: 'Family' })}</div>
                    <div className="text-sm font-medium">
                      {fam.partner?.fullName ? <BdiText>{fam.partner.fullName}</BdiText> : t('editor.person.unknownPartner', { defaultValue: 'Unknown partner' })}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t('editor.person.childCount', { count: fam.children.length, defaultValue: `${fam.children.length} children` })}
                    </div>
                  </button>
                ))}
              </div>
            </Section>
          )}

        </div>
      </div>
    </div>
    {sourceTarget && (
      <SourcePickerSheet
        target={sourceTarget}
        onClose={() => setSourceTarget(null)}
        onLinked={reload}
        onManageAll={scrollToSourceCitations}
      />
    )}
    </EditorSectionNavProvider>
  );
}
