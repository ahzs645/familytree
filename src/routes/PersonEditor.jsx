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
import { useParams, useNavigate } from 'react-router-dom';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { saveWithChangeLog, logRecordCreated, logRecordDeleted } from '../lib/changeLog.js';
import { refToRecordName, refValue } from '../lib/recordRef.js';
import { readConclusionType, readRef } from '../lib/schema.js';
import { Gender, lifeSpanLabel, personSummary } from '../models/index.js';
import { buildPersonContext } from '../lib/personContext.js';
import {
  ADDITIONAL_NAME_TYPES,
  PERSON_EVENT_TYPES,
  PERSON_FACT_TYPES,
  INFLUENTIAL_PERSON_TYPES_PERSON,
  LABELS,
  REFERENCE_NUMBER_FIELDS,
  formatTimestamp,
  labelForCatalogType,
  normalizeConclusionTypeId,
} from '../lib/catalogs.js';
import { Section } from '../components/editors/Section.jsx';
import { EditSwitch } from '../components/editors/EditSwitch.jsx';
import { TypePicker } from '../components/editors/TypePicker.jsx';
import { AssociateRelationsEditor, MediaRelationsEditor, SourceCitationsEditor } from '../components/editors/RelatedRecordEditors.jsx';
import { OldestAncestorsWidget } from '../components/editors/OldestAncestorsWidget.jsx';
import { isRecordLocked } from '../lib/recordLock.js';
import { confirmUnsavedChanges, useDirtySnapshot, useUnsavedChanges, stableStringify } from '../lib/editorState.js';
import { useRecordLock } from '../lib/useRecordLock.js';
import { RecordLockButton } from '../components/editors/RecordLockButton.jsx';
import { listAllPersons } from '../lib/treeQuery.js';
import { PersonPicker } from '../components/charts/PersonPicker.jsx';
import { linkExistingRelative } from '../lib/relativeLinks.js';
import { evidenceStateForRecord, loadResearchCompleteness } from '../lib/researchCompleteness.js';
import { MILK_KINSHIP_RECORD_TYPE, milkKinshipSummary, roleForMilkKinship } from '../lib/milkKinship.js';
import { affiliationLevelLabel, loadTribalAffiliationModel } from '../lib/tribalAffiliations.js';
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
import {
  queryMilkKinshipsForPerson,
  reconcileMilkKinships,
  reconcileSubRecords,
  writeOptionalStringField,
} from '../components/personEditor/persistence.js';

function uuid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const NAME_FIELDS = [
  { id: 'firstName', label: 'First Name' },
  { id: 'lastName', label: 'Last Name' },
  { id: 'nameMiddle', label: 'Middle Name' },
  { id: 'namePrefix', label: 'Title' },
  { id: 'nameSuffix', label: 'Suffix' },
];

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


export default function PersonEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
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
  const [allPersons, setAllPersons] = useState([]);
  const [relativeType, setRelativeType] = useState('parent');
  const [relativeId, setRelativeId] = useState('');
  const [labels, setLabels] = useState({}); // labelId -> bool
  const [refNumbers, setRefNumbers] = useState({});
  const [bookmarked, setBookmarked] = useState(false);
  const [isStartPerson, setIsStartPerson] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [outsideFamily, setOutsideFamily] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const baselineRef = useRef(null);

  const reload = useCallback(async () => {
    const db = getLocalDatabase();
    const r = await db.getRecord(id);
    if (!r) { setNotFound(true); return; }
    setRecord(r);
    setContext(await buildPersonContext(id));

    const v = {};
    for (const f of NAME_FIELDS) v[f.id] = r.fields?.[f.id]?.value ?? '';
    setValues(v);
    setBookmarked(!!r.fields?.isBookmarked?.value);
    setIsStartPerson(!!r.fields?.isStartPerson?.value);
    setIsPrivate(!!r.fields?.isPrivate?.value);
    setOutsideFamily(!!r.fields?.fromOutsideFamily?.value);
    setGrave({
      cemetery: r.fields?.cemetery?.value || '',
      cemeteryLocation: r.fields?.cemeteryLocation?.value || '',
      graveNumber: r.fields?.graveNumber?.value || '',
    });

    const refs = {};
    for (const f of REFERENCE_NUMBER_FIELDS) refs[f.id] = r.fields?.[f.id]?.value ?? '';
    setRefNumbers(refs);

    const [an, fact, note, lbl, ev, ar, analysis, allPersonRows] = await Promise.all([
      db.query('AdditionalName', { referenceField: 'person', referenceValue: id, limit: 500 }),
      db.query('PersonFact', { referenceField: 'person', referenceValue: id, limit: 500 }),
      db.query('Note', { referenceField: 'person', referenceValue: id, limit: 500 }),
      db.query('LabelRelation', { referenceField: 'targetPerson', referenceValue: id, limit: 500 }),
      db.query('PersonEvent', { referenceField: 'person', referenceValue: id, limit: 500 }),
      db.query('AssociateRelation', { referenceField: 'sourcePerson', referenceValue: id, limit: 500 }),
      loadResearchCompleteness(),
      db.query('Person', { limit: 100000 }),
    ]);
    const personEvidence = analysis.rowsByPerson.get(id);
    setEvidence({
      row: personEvidence,
      byRecord: new Map([...ev.records, ...fact.records].map((item) => [item.recordName, evidenceStateForRecord(item.recordName, analysis)])),
    });
    setAllPersons(await listAllPersons({ includePrivate: true }));
    const personById = new Map(allPersonRows.records.map((person) => [person.recordName, personSummary(person)]));
    const milkRows = await queryMilkKinshipsForPerson(db, id);
    setMilkKinships(milkRows.map((milk) => {
      const summary = milkKinshipSummary(milk, personById);
      return {
        ...summary,
        role: roleForMilkKinship(summary, id),
      };
    }));

    setAdditionalNames(an.records.map((a) => ({
      recordName: a.recordName,
      type: normalizeConclusionTypeId(refToRecordName(a.fields?.conclusionType?.value) || a.fields?.type?.value || ''),
      value: a.fields?.name?.value || a.fields?.value?.value || '',
    })));
    setFacts(fact.records.map((f) => ({
      recordName: f.recordName,
      type: normalizeConclusionTypeId(refToRecordName(f.fields?.conclusionType?.value) || ''),
      value: f.fields?.description?.value || '',
      date: f.fields?.date?.value || '',
    })));
    setNotes(note.records.map((n) => ({
      recordName: n.recordName,
      text: n.fields?.text?.value || n.fields?.note?.value || '',
    })));
    setEvents(ev.records);
    setAssociates(ar.records.map((a) => ({
      recordName: a.recordName,
      type: refToRecordName(a.fields?.relationType?.value) || a.fields?.type?.value || '',
      targetPersonRef: refToRecordName(a.fields?.targetPerson?.value) || '',
      targetName: a.fields?.cached_targetName?.value || '',
    })));

    const [mediaRels, sourceRels, todoRels, storyRels, groupRels] = await Promise.all([
      db.query('MediaRelation', { referenceField: 'target', referenceValue: id, limit: 500 }),
      db.query('SourceRelation', { referenceField: 'target', referenceValue: id, limit: 500 }),
      db.query('ToDoRelation', { referenceField: 'target', referenceValue: id, limit: 500 }),
      db.query('StoryRelation', { referenceField: 'target', referenceValue: id, limit: 500 }),
      db.query('PersonGroupRelation', { referenceField: 'person', referenceValue: id, limit: 500 }),
    ]);
    async function hydrate(rels, fieldName, fallbackType) {
      const out = [];
      for (const rel of rels.records) {
        const targetId = readRef(rel.fields?.[fieldName]);
        const target = targetId ? await db.getRecord(targetId) : null;
        out.push({ rel, target, type: target?.recordType || fallbackType });
      }
      return out;
    }
    setRelated({
      media: await hydrate(mediaRels, 'media', 'Media'),
      sources: await hydrate(sourceRels, 'source', 'Source'),
      todos: await hydrate(todoRels, 'todo', 'ToDo'),
      stories: await hydrate(storyRels, 'story', 'Story'),
      groups: await hydrate(groupRels, 'personGroup', 'PersonGroup'),
    });
    const tribalModel = await loadTribalAffiliationModel(db);
    const affiliationsById = new Map(tribalModel.affiliations.map((affiliation) => [affiliation.recordName, affiliation]));
    setTribalMemberships(
      tribalModel.memberships
        .filter((membership) => membership.personId === id)
        .map((membership) => ({ ...membership, affiliation: affiliationsById.get(membership.affiliationId) }))
        .filter((membership) => membership.affiliation)
    );

    const labelMap = {};
    for (const lr of lbl.records) {
      const labelRef = refToRecordName(lr.fields?.label?.value) || '';
      labelMap[labelRef] = lr.recordName;
    }
    const lblState = {};
    for (const def of LABELS) lblState[def.id] = !!labelMap[def.id];
    setLabels(lblState);
  }, [id]);

  const onLinkRelative = useCallback(async () => {
    if (!relativeId) return;
    try {
      await linkExistingRelative(id, relativeId, relativeType);
      setRelativeId('');
      await reload();
      setStatus('Relative linked');
      setTimeout(() => setStatus(null), 1500);
    } catch (error) {
      setStatus(error.message);
    }
  }, [id, relativeId, relativeType, reload]);

  useEffect(() => { reload(); }, [reload]);

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
    outsideFamily,
  }), [record, values, additionalNames, facts, grave, milkKinships, notes, labels, refNumbers, bookmarked, isStartPerson, isPrivate, outsideFamily]);
  useEffect(() => {
    if (!record || saving) return;
    const next = stableStringify(editableSnapshot);
    if (baselineRef.current == null || status === 'Saved' || status === 'Locked' || status === 'Unlocked') baselineRef.current = next;
  }, [editableSnapshot, record, saving, status]);
  const dirty = useDirtySnapshot(editableSnapshot, baselineRef.current, !!record && !saving);
  useUnsavedChanges(dirty);
  const onToggleLock = useRecordLock({ record, setRecord, setSaving, setStatus, reload });
  const guardedNavigate = useCallback((to, options) => {
    if (confirmUnsavedChanges(dirty)) navigate(to, options);
  }, [dirty, navigate]);

  const onSave = useCallback(async () => {
    if (!record) return;
    setSaving(true);
    const db = getLocalDatabase();

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
    const existingLbl = (await db.query('LabelRelation', { referenceField: 'targetPerson', referenceValue: id, limit: 500 })).records;
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
        await db.saveRecord(rec);
        await logRecordCreated(rec);
      } else if (!want && existing) {
        await db.deleteRecord(existing.recordName);
        await logRecordDeleted(existing.recordName, 'LabelRelation');
      }
    }

    await reload();
    setSaving(false);
    setStatus('Saved');
    baselineRef.current = stableStringify(editableSnapshot);
    setTimeout(() => setStatus(null), 1500);
  }, [record, values, refNumbers, bookmarked, isStartPerson, isPrivate, outsideFamily, grave, additionalNames, facts, notes, milkKinships, labels, id, reload]);

  if (notFound) return <div className="p-10 text-muted-foreground">Person not found.</div>;
  if (!record) return <div className="p-10 text-muted-foreground">Loading…</div>;

  const headerLabel = record.fields?.cached_fullName?.value || record.recordName;
  const subtitle = lifeSpanLabel({
    birthDate: record.fields?.cached_birthDate?.value,
    deathDate: record.fields?.cached_deathDate?.value,
  });

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <button onClick={() => guardedNavigate(-1)} className="text-xs text-muted-foreground border border-border rounded-md px-3 py-1.5 hover:bg-accent">
          ← Back
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate">{headerLabel}</h1>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
        {status && <span className="text-emerald-500 text-xs">{status}</span>}
        <RecordLockButton record={record} saving={saving} onToggle={onToggleLock} />
        <button disabled={saving || (record && isRecordLocked(record))} onClick={onSave} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-60">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </header>

      <main className="flex-1 overflow-auto bg-background">
        <div className="max-w-6xl mx-auto p-5">

          {context && (
            <Section title="Parents & Relatives" accent={ACCENTS.parents}>
              <ParentsBlock context={context} onPick={(rn) => guardedNavigate(`/person/${rn}`)} />
              <div className="mt-4 grid grid-cols-[130px_1fr_auto] gap-2">
                <select value={relativeType} onChange={(event) => setRelativeType(event.target.value)} className={inputClass()}>
                  <option value="parent">Parent</option>
                  <option value="spouse">Spouse</option>
                  <option value="child">Child</option>
                  <option value="sibling">Sibling</option>
                </select>
                <PersonPicker persons={allPersons.filter((person) => person.recordName !== id)} value={relativeId} onChange={setRelativeId} />
                <button type="button" onClick={onLinkRelative} disabled={!relativeId} className="bg-secondary border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50">
                  Link
                </button>
              </div>
            </Section>
          )}
          {record?.recordName && (
            <Section title="Oldest Ancestors" accent={ACCENTS.parents} collapsible defaultCollapsed persistKey="person">
              <OldestAncestorsWidget recordName={record.recordName} />
            </Section>
          )}
          {evidence?.row && (
            <Section title="Evidence Summary" accent={ACCENTS.sources} collapsible defaultCollapsed persistKey="person">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <EvidenceMetric label="Source state" value={evidence.row.sourceState} tone={evidence.row.sourceState} />
                <EvidenceMetric label="Source links" value={evidence.row.sourceCount} />
                <EvidenceMetric label="Unplaced events" value={evidence.row.unplacedEvents} tone={evidence.row.unplacedEvents ? 'Weak' : 'Supported'} />
                <EvidenceMetric label="Duplicate risk" value={evidence.row.duplicateRisk} tone={evidence.row.duplicateRisk === 'Low' ? 'Supported' : 'Weak'} />
                <EvidenceMetric label="Research priority" value={evidence.row.researchPriority} tone={evidence.row.researchPriority === 'Low' ? 'Supported' : evidence.row.researchPriority === 'Medium' ? 'Weak' : 'Unsourced'} />
              </div>
            </Section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
            <div className="min-w-0">

              <Section title="Name & Gender" accent={ACCENTS.name}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {NAME_FIELDS.map((f) => (
                    <Field key={f.id} label={f.label}>
                      <input
                        value={values[f.id] ?? ''}
                        onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
                        className={inputClass()}
                      />
                    </Field>
                  ))}
                  <Field label="Gender">
                    <select
                      value={record.fields?.gender?.value ?? Gender.UnknownGender}
                      onChange={(e) => {
                        const v = +e.target.value;
                        setRecord((r) => ({ ...r, fields: { ...r.fields, gender: { value: v, type: 'NUMBER' } } }));
                      }}
                      className={inputClass()}
                    >
                      <option value={Gender.Male}>Male</option>
                      <option value={Gender.Female}>Female</option>
                      <option value={Gender.UnknownGender}>Unknown Gender</option>
                      <option value={Gender.Intersex}>Intersex</option>
                    </select>
                  </Field>
                </div>
              </Section>

              <Section
                title="Additional Names"
                accent={ACCENTS.additional}
                controls={<TypePicker placeholder="Add Name" options={ADDITIONAL_NAME_TYPES}
                  onPick={(t) => setAdditionalNames((a) => [...a, { type: t, value: '' }])} />}
              >
                {additionalNames.length === 0 ? (
                  <Empty title="No Additional Name present" hint="Use the menu above to add one." />
                ) : additionalNames.map((it, i) => (
                  <div key={it.recordName || i} className="flex items-center gap-2 mb-2">
                    <select
                      value={it.type}
                      onChange={(e) => setAdditionalNames((a) => a.map((x, j) => j === i ? { ...x, type: e.target.value } : x))}
                      className={inputClass() + ' max-w-[180px]'}
                    >
                      {ADDITIONAL_NAME_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                    <input
                      value={it.value}
                      placeholder="Name"
                      onChange={(e) => setAdditionalNames((a) => a.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                      className={inputClass() + ' flex-1'}
                    />
                    <RemoveBtn onClick={() => setAdditionalNames((a) => a.filter((_, j) => j !== i))} />
                  </div>
                ))}
              </Section>

              <Section
                title="Events"
                accent={ACCENTS.events}
                controls={<TypePicker placeholder="Add Event" options={PERSON_EVENT_TYPES}
                  onPick={async (t) => {
                    const db = getLocalDatabase();
                    const rec = {
                      recordName: uuid('pe'),
                      recordType: 'PersonEvent',
                      fields: {
                        person: { value: refValue(id, 'Person'), type: 'REFERENCE' },
                        conclusionType: { value: refValue(t, 'ConclusionPersonEventType'), type: 'REFERENCE' },
                      },
                    };
                    await db.saveRecord(rec);
                    await logRecordCreated(rec);
                    await reload();
                  }} />}
              >
                {events.length === 0 ? (
                  <Empty title="No events" hint="Use the menu above to add one, or open the Events page for advanced editing." />
                ) : (
                  <div className="space-y-2">
                    {events.map((e) => {
                      const rawType = e.fields?.conclusionType?.value || e.fields?.eventType?.value || '';
                      const label = labelForCatalogType(PERSON_EVENT_TYPES, rawType, readConclusionType(e) || 'Event');
                      const date = e.fields?.date?.value || '';
                      return (
                        <div key={e.recordName} className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-md">
                          <span className="text-sm">{label}{date && <span className="text-muted-foreground"> · {date}</span>}</span>
                          <EvidenceBadge evidence={evidence?.byRecord?.get(e.recordName)} />
                          <button onClick={() => guardedNavigate(`/events?eventId=${encodeURIComponent(e.recordName)}`)} className="text-xs text-primary hover:underline">edit</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>

              <Section title="Media" accent={ACCENTS.media}
                controls={<button onClick={() => guardedNavigate(`/views/media-gallery?targetId=${encodeURIComponent(id)}&targetType=Person`)} className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5">Open Gallery</button>}
              >
                <MediaRelationsEditor ownerRecordName={id} ownerRecordType="Person" onChanged={reload} />
              </Section>

              <Section
                title="Facts"
                accent={ACCENTS.facts}
                controls={<TypePicker placeholder="Add Fact" options={PERSON_FACT_TYPES}
                  onPick={(t) => setFacts((a) => [...a, { type: t, value: '', date: '' }])} />}
              >
                {facts.length === 0 ? (
                  <Empty title="No facts" hint="Use the menu above to add one." />
                ) : facts.map((it, i) => {
                  const label = labelForCatalogType(PERSON_FACT_TYPES, it.type, it.type || 'Fact');
                  return (
                    <div key={it.recordName || i} className="flex flex-wrap gap-2 mb-2 items-center">
                      <span className="text-xs font-medium w-[140px] shrink-0">{label}</span>
                      <input value={it.value} placeholder="Value"
                        onChange={(e) => setFacts((a) => a.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                        className={inputClass() + ' flex-1 min-w-[120px]'}
                      />
                      <input value={it.date} placeholder="Date (optional)"
                        onChange={(e) => setFacts((a) => a.map((x, j) => j === i ? { ...x, date: e.target.value } : x))}
                        className={inputClass() + ' w-[120px] shrink-0'}
                      />
                      <EvidenceBadge evidence={it.recordName ? evidence?.byRecord?.get(it.recordName) : null} />
                      <RemoveBtn onClick={() => setFacts((a) => a.filter((_, j) => j !== i))} />
                    </div>
                  );
                })}
              </Section>

              <Section title="Tribal Affiliations" accent={ACCENTS.tribal}
                collapsible defaultCollapsed persistKey="person"
                controls={<button type="button" onClick={() => guardedNavigate('/tribal-affiliations')} className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5">Open</button>}
              >
                {tribalMemberships.length === 0 ? (
                  <Empty title="No tribal affiliations" hint="Add clan, tribe, branch, or house membership from the Tribal Affiliations page." />
                ) : (
                  <div className="space-y-2">
                    {tribalMemberships.map((membership) => (
                      <div key={membership.relation.recordName} className="flex items-center gap-2 p-2.5 bg-secondary/30 rounded-md">
                        <span className="text-sm flex-1 min-w-0 truncate">
                          {membership.affiliation.name}
                          <span className="text-muted-foreground"> · {affiliationLevelLabel(membership.affiliation.level)}</span>
                        </span>
                        {membership.virtual && <span className="text-xs text-muted-foreground">imported fact</span>}
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Milk Kinship / الرضاعة" accent={ACCENTS.milk}
                collapsible defaultCollapsed persistKey="person"
                controls={<button type="button" onClick={() => setMilkKinships((rows) => [...rows, emptyMilkKinship(id)])}
                  className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5">Add Milk Kinship</button>}
              >
                {milkKinships.length === 0 ? (
                  <Empty title="No milk kinship recorded" hint="Record nursing mother, milk father, and child without changing biological parent links." />
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

              <Section title="Grave & Cemetery" accent={ACCENTS.grave} collapsible defaultCollapsed persistKey="person">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Cemetery">
                    <input value={grave.cemetery} onChange={(event) => setGrave((g) => ({ ...g, cemetery: event.target.value }))} className={inputClass()} />
                  </Field>
                  <Field label="Cemetery location / map link">
                    <input value={grave.cemeteryLocation} onChange={(event) => setGrave((g) => ({ ...g, cemeteryLocation: event.target.value }))} className={inputClass()} />
                  </Field>
                  <Field label="Grave number">
                    <input value={grave.graveNumber} onChange={(event) => setGrave((g) => ({ ...g, graveNumber: event.target.value }))} className={inputClass()} />
                  </Field>
                </div>
              </Section>

              <Section
                title="Notes"
                accent={ACCENTS.notes}
                controls={<button onClick={() => setNotes((a) => [...a, { text: '' }])}
                  className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5">Add Note</button>}
              >
                {notes.length === 0 ? (
                  <Empty title="No Notes present" hint="Use the button above to add a new note." />
                ) : notes.map((n, i) => (
                  <div key={n.recordName || i} className="mb-3">
                    <textarea
                      value={n.text}
                      onChange={(e) => setNotes((a) => a.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                      rows={3}
                      className={inputClass() + ' resize-y'}
                    />
                    <div className="text-right">
                      <RemoveBtn onClick={() => setNotes((a) => a.filter((_, j) => j !== i))} />
                    </div>
                  </div>
                ))}
              </Section>

              <Section title="Source Citations" accent={ACCENTS.sources}
                controls={<button onClick={() => guardedNavigate('/sources')} className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5">Open Sources</button>}>
                <SourceCitationsEditor ownerRecordName={id} ownerRecordType="Person" ownerRole="target" onChanged={reload} />
              </Section>

              <Section title="ToDos, Stories & Groups" accent={ACCENTS.sources} collapsible defaultCollapsed persistKey="person">
                <RelatedList items={[...related.todos, ...related.stories, ...related.groups]} emptyTitle="No related records" emptyHint="Imported ToDos, stories, and groups linked to this person appear here." />
              </Section>

              <Section title="Influential Persons" accent={ACCENTS.influential} collapsible defaultCollapsed persistKey="person">
                <AssociateRelationsEditor ownerRecordName={id} ownerRecordType="Person" relationTypes={INFLUENTIAL_PERSON_TYPES_PERSON} onChanged={reload} />
              </Section>

            </div>

            {/* Right column */}
            <div>
              <Section title="Labels" accent={ACCENTS.labels}>
                <div className="space-y-1">
                  {LABELS.map((def) => (
                    <EditSwitch
                      key={def.id}
                      label={def.label}
                      color={def.color}
                      checked={!!labels[def.id]}
                      onChange={(v) => setLabels((s) => ({ ...s, [def.id]: v }))}
                    />
                  ))}
                </div>
              </Section>

              <Section title="Reference Numbers" accent={ACCENTS.ref} collapsible defaultCollapsed persistKey="person">
                <div className="grid grid-cols-1 gap-3">
                  {REFERENCE_NUMBER_FIELDS.map((f) => (
                    <Field key={f.id} label={f.label}>
                      <input
                        value={refNumbers[f.id] ?? ''}
                        onChange={(e) => setRefNumbers((s) => ({ ...s, [f.id]: e.target.value }))}
                        className={inputClass()}
                      />
                    </Field>
                  ))}
                </div>
              </Section>

              <Section title="Bookmarks" accent={ACCENTS.bookmarks}>
                <EditSwitch label="Bookmarked" checked={bookmarked} onChange={setBookmarked} />
                <EditSwitch label="Marked as Start Person" checked={isStartPerson} onChange={setIsStartPerson} />
              </Section>

              <Section title="Private" accent={ACCENTS.private}>
                <EditSwitch label="Marked as Private" checked={isPrivate} onChange={setIsPrivate} />
                <p className="text-[11px] text-muted-foreground mt-2">If selected, this person won't appear in charts or reports.</p>
              </Section>

              <Section title="Family Scope" accent={ACCENTS.outside}>
                <EditSwitch label="Outside main family" checked={outsideFamily} onChange={setOutsideFamily} />
                <p className="text-[11px] text-muted-foreground mt-2">Use for spouses, milk relatives, friends, and invitees who should remain searchable without being treated as a core descendant branch.</p>
              </Section>

              <Section title="Last Edited" accent={ACCENTS.edited} collapsible defaultCollapsed persistKey="person">
                <ReadOnly label="Change Date" value={formatTimestamp(record.fields?.mft_changeDate?.value || record.modified?.timestamp)} />
                <ReadOnly label="Creation Date" value={formatTimestamp(record.fields?.mft_creationDate?.value || record.created?.timestamp)} />
              </Section>
            </div>
          </div>

          {context && context.families.length > 0 && (
            <Section title="Partners" accent={ACCENTS.partners}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {context.families.map((fam) => (
                  <button
                    key={fam.family.recordName}
                    onClick={() => guardedNavigate(`/family/${fam.family.recordName}`)}
                    className="text-start p-3 rounded-md border border-border bg-secondary/30 hover:bg-secondary"
                  >
                    <div className="text-xs text-muted-foreground mb-1">Family</div>
                    <div className="text-sm font-medium">{fam.partner?.fullName || 'Unknown partner'}</div>
                    <div className="text-xs text-muted-foreground mt-1">{fam.children.length} child{fam.children.length === 1 ? '' : 'ren'}</div>
                  </button>
                ))}
              </div>
            </Section>
          )}

        </div>
      </main>
    </div>
  );
}
