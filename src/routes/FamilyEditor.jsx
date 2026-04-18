/**
 * Family editor — /family/:id. Full field set:
 *   • Man panel (left) — inline name/title/suffix + parents row
 *   • Woman panel (right) — same
 *   • Children list with reorder + edit shortcut
 *   • Family events (typed sub-list)
 *   • Media, Notes, Source Citations, Influential Persons
 *   • Labels, Reference Numbers, Bookmarks, Private, Last Edited
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { saveWithChangeLog, logRecordCreated, logRecordDeleted } from '../lib/changeLog.js';
import { refToRecordName, refValue } from '../lib/recordRef.js';
import { readRef } from '../lib/schema.js';
import { listAllPersons } from '../lib/treeQuery.js';
import { personSummary, familySummary, lifeSpanLabel } from '../models/index.js';
import { PersonPicker } from '../components/charts/PersonPicker.jsx';
import { Section } from '../components/editors/Section.jsx';
import { EditSwitch } from '../components/editors/EditSwitch.jsx';
import { TypePicker } from '../components/editors/TypePicker.jsx';
import { AssociateRelationsEditor, MediaRelationsEditor, SourceCitationsEditor } from '../components/editors/RelatedRecordEditors.jsx';
import {
  FAMILY_EVENT_TYPES,
  INFLUENTIAL_PERSON_TYPES_FAMILY,
  LABELS,
  REFERENCE_NUMBER_FIELDS,
  formatTimestamp,
} from '../lib/catalogs.js';

function uuid(p) {
  return `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const ACCENTS = {
  man: 'rgb(179 204 255)',
  woman: 'rgb(255 204 179)',
  children: 'rgb(77 128 230)',
  events: 'rgb(0 217 115)',
  media: 'rgb(77 128 230)',
  notes: 'rgb(217 217 0)',
  sources: 'rgb(51 0 255)',
  influential: 'rgb(0 77 179)',
  labels: 'rgb(255 0 128)',
  ref: 'rgb(128 217 77)',
  bookmarks: 'rgb(128 51 255)',
  private: 'rgb(255 0 0)',
  edited: 'rgb(191 128 64)',
};

const inputClass = 'w-full bg-background text-foreground border border-border rounded-md px-2.5 py-2 text-sm outline-none focus:border-primary';

function Field({ label, children }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function FamilyEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [family, setFamily] = useState(null);
  const [persons, setPersons] = useState([]);
  const [manId, setManId] = useState(null);
  const [womanId, setWomanId] = useState(null);
  const [marriageDate, setMarriageDate] = useState('');
  const [children, setChildren] = useState([]);
  const [events, setEvents] = useState([]);
  const [notes, setNotes] = useState([]);
  const [labels, setLabels] = useState({});
  const [related, setRelated] = useState({ media: [], sources: [], todos: [], stories: [] });
  const [refNumbers, setRefNumbers] = useState({});
  const [bookmarked, setBookmarked] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const reload = useCallback(async () => {
    const db = getLocalDatabase();
    const f = await db.getRecord(id);
    if (!f) { setNotFound(true); return; }
    setFamily(f);
    setManId(refToRecordName(f.fields?.man?.value));
    setWomanId(refToRecordName(f.fields?.woman?.value));
    setMarriageDate(f.fields?.cached_marriageDate?.value || '');
    setBookmarked(!!f.fields?.isBookmarked?.value);
    setIsPrivate(!!f.fields?.isPrivate?.value);

    const refs = {};
    for (const fd of REFERENCE_NUMBER_FIELDS) refs[fd.id] = f.fields?.[fd.id]?.value ?? '';
    setRefNumbers(refs);

    const [cr, ev, note, lbl] = await Promise.all([
      db.query('ChildRelation', { referenceField: 'family', referenceValue: id, limit: 500 }),
      db.query('FamilyEvent', { referenceField: 'family', referenceValue: id, limit: 500 }),
      db.query('Note', { referenceField: 'family', referenceValue: id, limit: 500 }),
      db.query('LabelRelation', { referenceField: 'targetFamily', referenceValue: id, limit: 500 }),
    ]);

    const hydrated = [];
    for (const rel of cr.records) {
      const childRef = refToRecordName(rel.fields?.child?.value);
      if (!childRef) continue;
      const c = await db.getRecord(childRef);
      hydrated.push({
        childRelationName: rel.recordName,
        childRecordName: childRef,
        summary: personSummary(c),
        order: rel.fields?.order?.value ?? 0,
      });
    }
    hydrated.sort((a, b) => a.order - b.order);
    setChildren(hydrated);
    setEvents(ev.records);
    setNotes(note.records.map((n) => ({ recordName: n.recordName, text: n.fields?.text?.value || '' })));

    const labelMap = new Map(lbl.records.map((r) => [refToRecordName(r.fields?.label?.value), r.recordName]));
    const lblState = {};
    for (const def of LABELS) lblState[def.id] = labelMap.has(def.id);
    setLabels(lblState);

    const [mediaRels, sourceRels, todoRels, storyRels] = await Promise.all([
      db.query('MediaRelation', { referenceField: 'target', referenceValue: id, limit: 500 }),
      db.query('SourceRelation', { referenceField: 'target', referenceValue: id, limit: 500 }),
      db.query('ToDoRelation', { referenceField: 'target', referenceValue: id, limit: 500 }),
      db.query('StoryRelation', { referenceField: 'target', referenceValue: id, limit: 500 }),
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
    });

    if (persons.length === 0) setPersons(await listAllPersons({ includePrivate: true }));
  }, [id, persons.length]);

  useEffect(() => { reload(); }, [reload]);

  const moveChild = (i, dir) => {
    setChildren((arr) => {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const next = [...arr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const removeChild = (i) => setChildren((arr) => arr.filter((_, j) => j !== i));
  const addChild = (recordName) => {
    if (!recordName || children.some((c) => c.childRecordName === recordName)) return;
    const sum = persons.find((p) => p.recordName === recordName);
    if (!sum) return;
    setChildren((arr) => [...arr, { childRelationName: null, childRecordName: recordName, summary: sum, order: arr.length }]);
  };

  const onSave = useCallback(async () => {
    if (!family) return;
    setSaving(true);
    const db = getLocalDatabase();

    // Family record
    const nextFields = { ...family.fields };
    if (manId) nextFields.man = { value: refValue(manId, 'Person'), type: 'REFERENCE' };
    else delete nextFields.man;
    if (womanId) nextFields.woman = { value: refValue(womanId, 'Person'), type: 'REFERENCE' };
    else delete nextFields.woman;
    if (marriageDate) nextFields.cached_marriageDate = { value: marriageDate, type: 'STRING' };
    else delete nextFields.cached_marriageDate;
    nextFields.isBookmarked = { value: !!bookmarked, type: 'BOOLEAN' };
    nextFields.isPrivate = { value: !!isPrivate, type: 'BOOLEAN' };
    for (const f of REFERENCE_NUMBER_FIELDS) {
      const v = refNumbers[f.id];
      if (v == null || v === '') delete nextFields[f.id];
      else nextFields[f.id] = { value: v, type: 'STRING' };
    }
    await saveWithChangeLog({ ...family, fields: nextFields });

    // Children reconcile
    const existingRels = (await db.query('ChildRelation', { referenceField: 'family', referenceValue: id, limit: 500 })).records;
    const existingByChild = new Map(existingRels.map((r) => [refToRecordName(r.fields?.child?.value), r]));
    const keep = new Set();
    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      const existing = existingByChild.get(c.childRecordName);
      if (existing) {
        keep.add(existing.recordName);
        if ((existing.fields?.order?.value ?? 0) !== i) {
          await saveWithChangeLog({ ...existing, fields: { ...existing.fields, order: { value: i, type: 'NUMBER' } } });
        }
      } else {
        const rec = {
          recordName: uuid('cr'),
          recordType: 'ChildRelation',
          fields: {
            family: { value: refValue(id, 'Family'), type: 'REFERENCE' },
            child: { value: refValue(c.childRecordName, 'Person'), type: 'REFERENCE' },
            order: { value: i, type: 'NUMBER' },
          },
        };
        await db.saveRecord(rec);
        await logRecordCreated(rec);
        keep.add(rec.recordName);
      }
    }
    for (const rel of existingRels) {
      if (!keep.has(rel.recordName)) {
        await db.deleteRecord(rel.recordName);
        await logRecordDeleted(rel.recordName, 'ChildRelation');
      }
    }

    // Notes reconcile
    const existingNotes = (await db.query('Note', { referenceField: 'family', referenceValue: id, limit: 500 })).records;
    const keepN = new Set();
    for (const n of notes) {
      if (!n.text) continue;
      if (n.recordName) {
        keepN.add(n.recordName);
        const prev = existingNotes.find((r) => r.recordName === n.recordName);
        if (prev) {
          await saveWithChangeLog({ ...prev, fields: { ...prev.fields, text: { value: n.text, type: 'STRING' } } });
        }
      } else {
        const rec = {
          recordName: uuid('note'),
          recordType: 'Note',
          fields: {
            family: { value: refValue(id, 'Family'), type: 'REFERENCE' },
            text: { value: n.text, type: 'STRING' },
          },
        };
        await db.saveRecord(rec);
        await logRecordCreated(rec);
        keepN.add(rec.recordName);
      }
    }
    for (const prev of existingNotes) {
      if (!keepN.has(prev.recordName)) {
        await db.deleteRecord(prev.recordName);
        await logRecordDeleted(prev.recordName, 'Note');
      }
    }

    // Labels reconcile
    const existingLbl = (await db.query('LabelRelation', { referenceField: 'targetFamily', referenceValue: id, limit: 500 })).records;
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
            targetFamily: { value: refValue(id, 'Family'), type: 'REFERENCE' },
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
  }, [family, manId, womanId, marriageDate, children, notes, labels, refNumbers, bookmarked, isPrivate, id, reload]);

  if (notFound) return <div className="p-10 text-muted-foreground">Family not found.</div>;
  if (!family) return <div className="p-10 text-muted-foreground">Loading…</div>;

  const man = persons.find((p) => p.recordName === manId);
  const woman = persons.find((p) => p.recordName === womanId);
  const summary = familySummary(family);

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <button onClick={() => navigate(-1)} className="text-xs text-muted-foreground border border-border rounded-md px-3 py-1.5 hover:bg-accent">← Back</button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate">
            Family · {summary?.familyName || [man?.fullName, woman?.fullName].filter(Boolean).join(' & ') || family.recordName}
          </h1>
        </div>
        {status && <span className="text-emerald-500 text-xs">{status}</span>}
        <button disabled={saving} onClick={onSave} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-60">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </header>

      <main className="flex-1 overflow-auto bg-background">
        <div className="max-w-6xl mx-auto p-5">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Section title="Man" accent={ACCENTS.man}>
              <Field label="Partner">
                <PersonPicker persons={persons} value={manId} onChange={setManId} />
              </Field>
              {man && <div className="mt-2 text-xs text-muted-foreground">{man.fullName} {lifeSpanLabel(man) && `· ${lifeSpanLabel(man)}`}</div>}
              <button onClick={() => manId && navigate(`/person/${manId}`)} disabled={!manId}
                className="mt-3 text-xs text-primary hover:underline disabled:opacity-50">
                Open person editor →
              </button>
            </Section>
            <Section title="Woman" accent={ACCENTS.woman}>
              <Field label="Partner">
                <PersonPicker persons={persons} value={womanId} onChange={setWomanId} />
              </Field>
              {woman && <div className="mt-2 text-xs text-muted-foreground">{woman.fullName} {lifeSpanLabel(woman) && `· ${lifeSpanLabel(woman)}`}</div>}
              <button onClick={() => womanId && navigate(`/person/${womanId}`)} disabled={!womanId}
                className="mt-3 text-xs text-primary hover:underline disabled:opacity-50">
                Open person editor →
              </button>
            </Section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
            <div className="min-w-0">
              <Section title={`Children · ${children.length}`} accent={ACCENTS.children}
                controls={
                  <div className="max-w-[260px]">
                    <PersonPicker persons={persons} value={null} onChange={addChild} />
                  </div>
                }
              >
                {children.length === 0 ? (
                  <Empty title="No children recorded" hint="Use the picker above to add a child." />
                ) : (
                  <div className="space-y-1.5">
                    {children.map((c, i) => (
                      <div key={c.childRecordName} className="flex items-center gap-2 p-2 bg-secondary/30 rounded-md">
                        <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                        <span className="text-sm flex-1 truncate">
                          {c.summary?.fullName || c.childRecordName}
                          {lifeSpanLabel(c.summary) && <span className="text-muted-foreground ml-2 text-xs">{lifeSpanLabel(c.summary)}</span>}
                        </span>
                        <button disabled={i === 0} onClick={() => moveChild(i, -1)} className="text-xs text-muted-foreground border border-border rounded-md w-7 h-7 hover:bg-accent disabled:opacity-30">↑</button>
                        <button disabled={i === children.length - 1} onClick={() => moveChild(i, 1)} className="text-xs text-muted-foreground border border-border rounded-md w-7 h-7 hover:bg-accent disabled:opacity-30">↓</button>
                        <button onClick={() => navigate(`/person/${c.childRecordName}`)} className="text-xs text-primary border border-border rounded-md px-2 py-1 hover:bg-accent">edit</button>
                        <button onClick={() => removeChild(i)} className="text-destructive border border-border rounded-md w-7 h-7 text-xs hover:bg-destructive/10">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Family Events" accent={ACCENTS.events}
                controls={<TypePicker placeholder="Add Event" options={FAMILY_EVENT_TYPES}
                  onPick={async (t) => {
                    const db = getLocalDatabase();
                    const rec = {
                      recordName: uuid('fe'),
                      recordType: 'FamilyEvent',
                      fields: {
                        family: { value: refValue(id, 'Family'), type: 'REFERENCE' },
                        conclusionType: { value: refValue(t, 'ConclusionFamilyEventType'), type: 'REFERENCE' },
                      },
                    };
                    await db.saveRecord(rec);
                    await logRecordCreated(rec);
                    await reload();
                  }} />}
              >
                <Field label="Marriage date">
                  <input value={marriageDate} onChange={(e) => setMarriageDate(e.target.value)} placeholder="YYYY or YYYY-MM-DD" className={inputClass} />
                </Field>
                {events.length === 0 ? (
                  <div className="mt-3">
                    <Empty title="No family events" hint="Use the menu above to add one." />
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {events.map((e) => {
                      const typeId = refToRecordName(e.fields?.conclusionType?.value) || '';
                      const label = FAMILY_EVENT_TYPES.find((t) => t.id === typeId)?.label || typeId || 'Event';
                      const date = e.fields?.date?.value || '';
                      return (
                        <div key={e.recordName} className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-md">
                          <span className="text-sm">{label}{date && <span className="text-muted-foreground"> · {date}</span>}</span>
                          <button onClick={() => navigate(`/events?eventId=${encodeURIComponent(e.recordName)}`)} className="text-xs text-primary hover:underline">open in Events</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>

              <Section title="Media" accent={ACCENTS.media}
                controls={<button onClick={() => navigate(`/views/media-gallery?targetId=${encodeURIComponent(id)}&targetType=Family`)} className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5">Open Gallery</button>}>
                <MediaRelationsEditor ownerRecordName={id} ownerRecordType="Family" onChanged={reload} />
              </Section>

              <Section title="Notes" accent={ACCENTS.notes}
                controls={<button onClick={() => setNotes((a) => [...a, { text: '' }])}
                  className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5">Add Note</button>}>
                {notes.length === 0 ? (
                  <Empty title="No notes present" hint="Use the button above to add one." />
                ) : notes.map((n, i) => (
                  <div key={n.recordName || i} className="mb-3">
                    <textarea value={n.text} rows={3}
                      onChange={(e) => setNotes((a) => a.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                      className={inputClass + ' resize-y'} />
                    <div className="text-right">
                      <button onClick={() => setNotes((a) => a.filter((_, j) => j !== i))}
                        className="text-destructive border border-border rounded-md w-7 h-7 text-xs hover:bg-destructive/10 mt-1">×</button>
                    </div>
                  </div>
                ))}
              </Section>

              <Section title="Source Citations" accent={ACCENTS.sources}
                controls={<button onClick={() => navigate('/sources')} className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5">Open Sources</button>}>
                <SourceCitationsEditor ownerRecordName={id} ownerRecordType="Family" ownerRole="target" onChanged={reload} />
              </Section>

              <Section title="Influential Persons" accent={ACCENTS.influential}>
                <AssociateRelationsEditor ownerRecordName={id} ownerRecordType="Family" relationTypes={INFLUENTIAL_PERSON_TYPES_FAMILY} onChanged={reload} />
              </Section>
            </div>

            <div>
              <Section title="Labels" accent={ACCENTS.labels}>
                <div className="space-y-1">
                  {LABELS.map((def) => (
                    <EditSwitch key={def.id} label={def.label} color={def.color}
                      checked={!!labels[def.id]}
                      onChange={(v) => setLabels((s) => ({ ...s, [def.id]: v }))} />
                  ))}
                </div>
              </Section>

              <Section title="Reference Numbers" accent={ACCENTS.ref}>
                <div className="grid grid-cols-1 gap-3">
                  {REFERENCE_NUMBER_FIELDS.filter((f) => f.id !== 'familySearchID').map((f) => (
                    <Field key={f.id} label={f.label}>
                      <input value={refNumbers[f.id] ?? ''} onChange={(e) => setRefNumbers((s) => ({ ...s, [f.id]: e.target.value }))} className={inputClass} />
                    </Field>
                  ))}
                </div>
              </Section>

              <Section title="Bookmarks" accent={ACCENTS.bookmarks}>
                <EditSwitch label="Bookmarked" checked={bookmarked} onChange={setBookmarked} />
              </Section>

              <Section title="Private" accent={ACCENTS.private}>
                <EditSwitch label="Marked as Private" checked={isPrivate} onChange={setIsPrivate} />
                <p className="text-[11px] text-muted-foreground mt-2">Hidden from charts and reports when set.</p>
              </Section>

              <Section title="Last Edited" accent={ACCENTS.edited}>
                <ReadOnly label="Change Date" value={formatTimestamp(family.fields?.mft_changeDate?.value || family.modified?.timestamp)} />
                <ReadOnly label="Creation Date" value={formatTimestamp(family.fields?.mft_creationDate?.value || family.created?.timestamp)} />
              </Section>
            </div>
          </div>

        </div>
      </main>
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

function RelatedList({ items, emptyTitle, emptyHint }) {
  if (!items?.length) return <Empty title={emptyTitle} hint={emptyHint} />;
  return (
    <div className="space-y-2">
      {items.map(({ rel, target, type }) => (
        <div key={rel.recordName} className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-md">
          <span className="text-sm truncate">
            <span className="text-xs text-muted-foreground mr-2">{type}</span>
            {target?.fields?.cached_fullName?.value || target?.fields?.title?.value || target?.fields?.name?.value || target?.recordName || readRef(rel.fields?.target)}
          </span>
        </div>
      ))}
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
