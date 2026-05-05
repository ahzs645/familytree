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
import React, { useEffect, useState, useCallback } from 'react';
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
import { isRecordLocked, setRecordLocked } from '../lib/recordLock.js';
import { listAllPersons } from '../lib/treeQuery.js';
import { PersonPicker } from '../components/charts/PersonPicker.jsx';
import { linkExistingRelative } from '../lib/relativeLinks.js';
import { evidenceStateForRecord, loadResearchCompleteness } from '../lib/researchCompleteness.js';
import { MILK_KINSHIP_RECORD_TYPE, milkKinshipSummary, roleForMilkKinship } from '../lib/milkKinship.js';

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

function inputClass() {
  return 'w-full bg-background text-foreground border border-border rounded-md px-2.5 py-2 text-sm outline-none focus:border-primary';
}

function Field({ label, children, hint }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function EvidenceMetric({ label, value, tone }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <div className={`text-sm font-semibold ${toneClass(tone)}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function EvidenceBadge({ evidence }) {
  if (!evidence) return null;
  return (
    <span className={`ms-auto shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${toneClass(evidence.state)} ${borderToneClass(evidence.state)}`}>
      {evidence.state}
    </span>
  );
}

function toneClass(tone) {
  if (tone === 'Supported') return 'text-emerald-600';
  if (tone === 'Weak' || tone === 'Medium') return 'text-amber-500';
  if (tone === 'Unsourced' || tone === 'High') return 'text-destructive';
  return 'text-foreground';
}

function borderToneClass(tone) {
  if (tone === 'Supported') return 'border-emerald-600/40';
  if (tone === 'Weak') return 'border-amber-500/40';
  return 'border-destructive/40';
}

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
        <button onClick={() => navigate(-1)} className="text-xs text-muted-foreground border border-border rounded-md px-3 py-1.5 hover:bg-accent">
          ← Back
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate">{headerLabel}</h1>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
        {status && <span className="text-emerald-500 text-xs">{status}</span>}
        {record ? (
          <button
            type="button"
            onClick={() => setRecord((r) => setRecordLocked(r, !isRecordLocked(r)))}
            className={`border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent ${isRecordLocked(record) ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : ''}`}
            aria-pressed={isRecordLocked(record)}
            title={isRecordLocked(record) ? 'Record is locked — editing is prevented until you unlock it.' : 'Lock this record to prevent accidental edits.'}
          >
            {isRecordLocked(record) ? '🔒 Locked' : '🔓 Unlocked'}
          </button>
        ) : null}
        <button disabled={saving || (record && isRecordLocked(record))} onClick={onSave} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-60">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </header>

      <main className="flex-1 overflow-auto bg-background">
        <div className="max-w-6xl mx-auto p-5">

          {context && (
            <Section title="Parents & Relatives" accent={ACCENTS.parents}>
              <ParentsBlock context={context} onPick={(rn) => navigate(`/person/${rn}`)} />
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
            <Section title="Oldest Ancestors" accent={ACCENTS.parents}>
              <OldestAncestorsWidget recordName={record.recordName} />
            </Section>
          )}
          {evidence?.row && (
            <Section title="Evidence Summary" accent={ACCENTS.sources}>
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
                          <button onClick={() => navigate(`/events?eventId=${encodeURIComponent(e.recordName)}`)} className="text-xs text-primary hover:underline">edit</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>

              <Section title="Media" accent={ACCENTS.media}
                controls={<button onClick={() => navigate(`/views/media-gallery?targetId=${encodeURIComponent(id)}&targetType=Person`)} className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5">Open Gallery</button>}
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

              <Section title="Milk Kinship / الرضاعة" accent={ACCENTS.milk}
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

              <Section title="Grave & Cemetery" accent={ACCENTS.grave}>
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
                controls={<button onClick={() => navigate('/sources')} className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5">Open Sources</button>}>
                <SourceCitationsEditor ownerRecordName={id} ownerRecordType="Person" ownerRole="target" onChanged={reload} />
              </Section>

              <Section title="ToDos, Stories & Groups" accent={ACCENTS.sources}>
                <RelatedList items={[...related.todos, ...related.stories, ...related.groups]} emptyTitle="No related records" emptyHint="Imported ToDos, stories, and groups linked to this person appear here." />
              </Section>

              <Section title="Influential Persons" accent={ACCENTS.influential}>
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

              <Section title="Reference Numbers" accent={ACCENTS.ref}>
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

              <Section title="Last Edited" accent={ACCENTS.edited}>
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
                    onClick={() => navigate(`/family/${fam.family.recordName}`)}
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

function ParentsBlock({ context, onPick }) {
  if (!context.parents || context.parents.length === 0) {
    return <Empty title="No parents recorded" hint="Add parents via the family editor." />;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {context.parents.flatMap((fam) => [fam.man, fam.woman])
        .filter(Boolean)
        .map((p) => (
          <button key={p.recordName} onClick={() => onPick(p.recordName)}
            className="text-start p-3 rounded-md border border-border bg-secondary/30 hover:bg-secondary">
            <div className="text-sm font-medium">{p.fullName}</div>
            <div className="text-xs text-muted-foreground">{lifeSpanLabel(p) || '—'}</div>
          </button>
        ))}
    </div>
  );
}

function Empty({ title, hint }) {
  return (
    <div className="text-center py-6">
      <div className="text-sm text-foreground">{title}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function ReadOnly({ label, value }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function RemoveBtn({ onClick }) {
  return (
    <button onClick={onClick} className="text-destructive border border-border rounded-md w-7 h-7 text-xs hover:bg-destructive/10">×</button>
  );
}

function RelatedList({ items, emptyTitle, emptyHint }) {
  if (!items?.length) return <Empty title={emptyTitle} hint={emptyHint} />;
  return (
    <div className="space-y-2">
      {items.map(({ rel, target, type }) => (
        <div key={rel.recordName} className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-md">
          <span className="text-sm truncate">
            <span className="text-xs text-muted-foreground me-2">{type}</span>
            {target?.fields?.cached_fullName?.value || target?.fields?.title?.value || target?.fields?.name?.value || target?.recordName || readRef(rel.fields?.target)}
          </span>
        </div>
      ))}
    </div>
  );
}

function emptyMilkKinship(currentPersonId) {
  return {
    role: 'child',
    childId: currentPersonId,
    nursingMotherId: '',
    milkFatherId: '',
    startDate: '',
    endDate: '',
    notes: '',
    isActive: true,
  };
}

function MilkKinshipEditor({ item, persons, currentPersonId, onChange, onRemove }) {
  const updateRole = (role) => {
    const next = { ...item, role };
    if (item.role === 'child' && next.childId === currentPersonId) next.childId = '';
    if (item.role === 'nursingMother' && next.nursingMotherId === currentPersonId) next.nursingMotherId = '';
    if (item.role === 'milkFather' && next.milkFatherId === currentPersonId) next.milkFatherId = '';
    if (role === 'child') next.childId = currentPersonId;
    if (role === 'nursingMother') next.nursingMotherId = currentPersonId;
    if (role === 'milkFather') next.milkFatherId = currentPersonId;
    onChange(next);
  };
  const role = item.role || 'child';
  const showMother = role !== 'nursingMother';
  const showFather = role !== 'milkFather';
  const showChild = role !== 'child';
  return (
    <div className="rounded-md border border-border bg-secondary/20 p-3">
      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-2 items-end">
        <Field label="This person is">
          <select value={role} onChange={(event) => updateRole(event.target.value)} className={inputClass()}>
            <option value="child">Breastfed child</option>
            <option value="nursingMother">Nursing mother</option>
            <option value="milkFather">Milk father</option>
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {showMother ? (
            <Field label="Nursing mother">
              <PersonPicker persons={persons.filter((p) => p.recordName !== currentPersonId)} value={item.nursingMotherId || ''} onChange={(value) => onChange({ ...item, nursingMotherId: value })} />
            </Field>
          ) : null}
          {showFather ? (
            <Field label="Milk father">
              <PersonPicker persons={persons.filter((p) => p.recordName !== currentPersonId)} value={item.milkFatherId || ''} onChange={(value) => onChange({ ...item, milkFatherId: value })} />
            </Field>
          ) : null}
          {showChild ? (
            <Field label="Breastfed child">
              <PersonPicker persons={persons.filter((p) => p.recordName !== currentPersonId)} value={item.childId || ''} onChange={(value) => onChange({ ...item, childId: value })} />
            </Field>
          ) : null}
        </div>
        <RemoveBtn onClick={onRemove} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_120px] gap-2 mt-3">
        <Field label="Start date">
          <input value={item.startDate || ''} onChange={(event) => onChange({ ...item, startDate: event.target.value })} className={inputClass()} />
        </Field>
        <Field label="End date">
          <input value={item.endDate || ''} onChange={(event) => onChange({ ...item, endDate: event.target.value })} className={inputClass()} />
        </Field>
        <Field label="Active">
          <select value={item.isActive === false ? 'no' : 'yes'} onChange={(event) => onChange({ ...item, isActive: event.target.value === 'yes' })} className={inputClass()}>
            <option value="yes">Active</option>
            <option value="no">Inactive</option>
          </select>
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Notes">
          <textarea value={item.notes || ''} onChange={(event) => onChange({ ...item, notes: event.target.value })} rows={2} className={inputClass() + ' resize-y'} />
        </Field>
      </div>
    </div>
  );
}

async function queryMilkKinshipsForPerson(db, personId) {
  const rows = await Promise.all([
    db.query(MILK_KINSHIP_RECORD_TYPE, { referenceField: 'child', referenceValue: personId, limit: 1000 }),
    db.query(MILK_KINSHIP_RECORD_TYPE, { referenceField: 'nursingMother', referenceValue: personId, limit: 1000 }),
    db.query(MILK_KINSHIP_RECORD_TYPE, { referenceField: 'milkFather', referenceValue: personId, limit: 1000 }),
  ]);
  const byId = new Map();
  for (const row of rows) {
    for (const record of row.records) byId.set(record.recordName, record);
  }
  return [...byId.values()];
}

function milkKinshipFields(item, currentPersonId) {
  const role = item.role || 'child';
  const childId = role === 'child' ? currentPersonId : item.childId;
  const nursingMotherId = role === 'nursingMother' ? currentPersonId : item.nursingMotherId;
  const milkFatherId = role === 'milkFather' ? currentPersonId : item.milkFatherId;
  const fields = {};
  if (childId) fields.child = { value: refValue(childId, 'Person'), type: 'REFERENCE' };
  if (nursingMotherId) fields.nursingMother = { value: refValue(nursingMotherId, 'Person'), type: 'REFERENCE' };
  if (milkFatherId) fields.milkFather = { value: refValue(milkFatherId, 'Person'), type: 'REFERENCE' };
  fields.isActive = { value: item.isActive !== false, type: 'BOOLEAN' };
  if (item.startDate) fields.startDate = { value: item.startDate, type: 'STRING' };
  if (item.endDate) fields.endDate = { value: item.endDate, type: 'STRING' };
  if (item.notes) fields.notes = { value: item.notes, type: 'STRING' };
  return fields;
}

async function reconcileMilkKinships(db, currentPersonId, items) {
  const existing = await queryMilkKinshipsForPerson(db, currentPersonId);
  const keep = new Set();
  for (const item of items) {
    const fields = milkKinshipFields(item, currentPersonId);
    if (!fields.child || !fields.nursingMother) continue;
    if (item.recordName) {
      keep.add(item.recordName);
      const prev = existing.find((record) => record.recordName === item.recordName);
      if (prev) await saveWithChangeLog({ ...prev, fields });
    } else {
      const rec = { recordName: uuid('milk'), recordType: MILK_KINSHIP_RECORD_TYPE, fields };
      await db.saveRecord(rec);
      await logRecordCreated(rec);
      keep.add(rec.recordName);
    }
  }
  for (const prev of existing) {
    if (!keep.has(prev.recordName)) {
      await db.deleteRecord(prev.recordName);
      await logRecordDeleted(prev.recordName, MILK_KINSHIP_RECORD_TYPE);
    }
  }
}

function writeOptionalStringField(record, fieldName, value) {
  const clean = String(value || '').trim();
  if (clean) record.fields[fieldName] = { value: clean, type: 'STRING' };
  else delete record.fields[fieldName];
}

/**
 * Reconcile a list of UI items against existing sub-records of `subType` whose
 * `parentField` references the parent. Adds, updates, deletes accordingly.
 */
async function reconcileSubRecords(db, parentId, subType, parentField, items, fieldsBuilder, isValid) {
  const existing = (await db.query(subType, { referenceField: parentField, referenceValue: parentId, limit: 500 })).records;
  const keep = new Set();
  for (const item of items) {
    if (!isValid(item)) continue;
    if (item.recordName) {
      keep.add(item.recordName);
      const prev = existing.find((r) => r.recordName === item.recordName);
      if (prev) {
        await saveWithChangeLog({
          ...prev,
          fields: { ...prev.fields, ...fieldsBuilder(item), [parentField]: { value: refValue(parentId, 'Person'), type: 'REFERENCE' } },
        });
      }
    } else {
      const rec = {
        recordName: uuid(subType.toLowerCase().slice(0, 3)),
        recordType: subType,
        fields: { ...fieldsBuilder(item), [parentField]: { value: refValue(parentId, 'Person'), type: 'REFERENCE' } },
      };
      await db.saveRecord(rec);
      await logRecordCreated(rec);
      keep.add(rec.recordName);
    }
  }
  for (const prev of existing) {
    if (!keep.has(prev.recordName)) {
      await db.deleteRecord(prev.recordName);
      await logRecordDeleted(prev.recordName, subType);
    }
  }
}
