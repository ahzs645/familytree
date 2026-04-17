/**
 * Person editor — /person/:id. Edit names, gender, life dates, notes,
 * plus sub-lists of AdditionalName + PersonFact records. Cross-link buttons
 * open the dedicated Events / Media / Sources routes pre-filtered to this person.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { saveWithChangeLog, logRecordCreated, logRecordDeleted } from '../lib/changeLog.js';
import { refToRecordName, refValue } from '../lib/recordRef.js';
import { Gender } from '../models/index.js';
import { FieldRow, editorInput, editorTextarea } from '../components/editors/FieldRow.jsx';
import { SubRecordList } from '../components/editors/SubRecordList.jsx';

function uuid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const PERSON_FIELDS = [
  { id: 'firstName', label: 'First name' },
  { id: 'nameMiddle', label: 'Middle name' },
  { id: 'lastName', label: 'Last name' },
  { id: 'namePrefix', label: 'Prefix' },
  { id: 'nameSuffix', label: 'Suffix' },
  { id: 'cached_birthDate', label: 'Birth date', hint: 'YYYY, YYYY-MM, or YYYY-MM-DD.' },
  { id: 'cached_deathDate', label: 'Death date' },
];

export default function PersonEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [values, setValues] = useState({});
  const [additionalNames, setAdditionalNames] = useState([]);
  const [facts, setFacts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const reload = useCallback(async () => {
    const db = getLocalDatabase();
    const r = await db.getRecord(id);
    if (!r) {
      setNotFound(true);
      return;
    }
    setRecord(r);
    const v = {};
    for (const f of PERSON_FIELDS) v[f.id] = r.fields?.[f.id]?.value ?? '';
    v.gender = r.fields?.gender?.value ?? Gender.UnknownGender;
    v.note = r.fields?.note?.value || '';
    setValues(v);

    const { records: anRecs } = await db.query('AdditionalName', {
      referenceField: 'person',
      referenceValue: id,
      limit: 500,
    });
    setAdditionalNames(
      anRecs.map((a) => ({
        recordName: a.recordName,
        type: a.fields?.type?.value || a.fields?.nameType?.value || '',
        value: a.fields?.name?.value || a.fields?.value?.value || '',
      }))
    );

    const { records: factRecs } = await db.query('PersonFact', {
      referenceField: 'person',
      referenceValue: id,
      limit: 500,
    });
    setFacts(
      factRecs.map((f) => ({
        recordName: f.recordName,
        type: refToRecordName(f.fields?.conclusionType?.value) || f.fields?.conclusionType?.value || f.fields?.factType?.value || '',
        value: f.fields?.description?.value || f.fields?.userDescription?.value || '',
        date: f.fields?.date?.value || '',
      }))
    );
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const onSave = useCallback(async () => {
    if (!record) return;
    setSaving(true);
    const db = getLocalDatabase();

    // Person record itself
    const nextFields = { ...record.fields };
    for (const f of PERSON_FIELDS) {
      const v = values[f.id];
      if (v === '' || v == null) delete nextFields[f.id];
      else nextFields[f.id] = { ...(nextFields[f.id] || { type: 'STRING' }), value: v };
    }
    nextFields.gender = { ...(nextFields.gender || { type: 'NUMBER' }), value: +values.gender };
    const fullName = `${values.firstName || ''} ${values.lastName || ''}`.trim();
    if (fullName) nextFields.cached_fullName = { value: fullName, type: 'STRING' };
    if (values.note) nextFields.note = { value: values.note, type: 'STRING' };
    else delete nextFields.note;
    await saveWithChangeLog({ ...record, fields: nextFields });

    // Reconcile AdditionalName records
    const existingAn = (
      await db.query('AdditionalName', { referenceField: 'person', referenceValue: id, limit: 500 })
    ).records;
    const keepAn = new Set();
    for (const an of additionalNames) {
      if (!an.value) continue; // skip blanks
      if (an.recordName) {
        keepAn.add(an.recordName);
        const existing = existingAn.find((r) => r.recordName === an.recordName);
        if (existing) {
          const updated = {
            ...existing,
            fields: {
              ...existing.fields,
              type: { value: an.type || '', type: 'STRING' },
              name: { value: an.value, type: 'STRING' },
              person: { value: refValue(id, 'Person'), type: 'REFERENCE' },
            },
          };
          await saveWithChangeLog(updated);
        }
      } else {
        const rec = {
          recordName: uuid('an'),
          recordType: 'AdditionalName',
          fields: {
            type: { value: an.type || '', type: 'STRING' },
            name: { value: an.value, type: 'STRING' },
            person: { value: refValue(id, 'Person'), type: 'REFERENCE' },
          },
        };
        await db.saveRecord(rec);
        await logRecordCreated(rec);
        keepAn.add(rec.recordName);
      }
    }
    for (const an of existingAn) {
      if (!keepAn.has(an.recordName)) {
        await db.deleteRecord(an.recordName);
        await logRecordDeleted(an.recordName, 'AdditionalName');
      }
    }

    // Reconcile PersonFact records
    const existingFacts = (
      await db.query('PersonFact', { referenceField: 'person', referenceValue: id, limit: 500 })
    ).records;
    const keepFacts = new Set();
    for (const fact of facts) {
      if (!fact.type && !fact.value) continue;
      if (fact.recordName) {
        keepFacts.add(fact.recordName);
        const existing = existingFacts.find((r) => r.recordName === fact.recordName);
        if (existing) {
          const updated = {
            ...existing,
            fields: {
              ...existing.fields,
              conclusionType: { value: fact.type || '', type: 'STRING' },
              description: { value: fact.value || '', type: 'STRING' },
              date: { value: fact.date || '', type: 'STRING' },
              person: { value: refValue(id, 'Person'), type: 'REFERENCE' },
            },
          };
          await saveWithChangeLog(updated);
        }
      } else {
        const rec = {
          recordName: uuid('pf'),
          recordType: 'PersonFact',
          fields: {
            conclusionType: { value: fact.type || '', type: 'STRING' },
            description: { value: fact.value || '', type: 'STRING' },
            date: { value: fact.date || '', type: 'STRING' },
            person: { value: refValue(id, 'Person'), type: 'REFERENCE' },
          },
        };
        await db.saveRecord(rec);
        await logRecordCreated(rec);
        keepFacts.add(rec.recordName);
      }
    }
    for (const f of existingFacts) {
      if (!keepFacts.has(f.recordName)) {
        await db.deleteRecord(f.recordName);
        await logRecordDeleted(f.recordName, 'PersonFact');
      }
    }

    await reload();
    setSaving(false);
    setStatus('Saved');
    setTimeout(() => setStatus(null), 1500);
  }, [record, values, additionalNames, facts, id, reload]);

  if (notFound) {
    return <div className="p-10 text-muted-foreground">Person not found.</div>;
  }
  if (!record) return <div className="p-10 text-muted-foreground">Loading…</div>;

  return (
    <div className="flex flex-col h-full">
      <header className="flex gap-3 items-center px-5 py-3 border-b border-border bg-card">
        <button onClick={() => navigate(-1)} className="text-xs text-muted-foreground border border-border rounded-md px-3 py-1.5 hover:bg-accent">
          ← Back
        </button>
        <h1 className="text-base font-semibold">
          Edit Person · {record.fields?.cached_fullName?.value || record.recordName}
        </h1>
        <div className="ml-auto flex items-center gap-3">
          {status && <span className="text-emerald-500 text-xs">{status}</span>}
          <button disabled={saving} onClick={onSave} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-60">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto px-7 py-6 max-w-4xl mx-auto w-full">
        <section className="mb-6">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            {PERSON_FIELDS.map((f) => (
              <FieldRow key={f.id} label={f.label} hint={f.hint}>
                <input
                  value={values[f.id] ?? ''}
                  onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
                  style={editorInput}
                />
              </FieldRow>
            ))}
            <FieldRow label="Gender">
              <select
                value={values.gender ?? Gender.UnknownGender}
                onChange={(e) => setValues({ ...values, gender: +e.target.value })}
                style={editorInput}
              >
                <option value={Gender.Male}>Male</option>
                <option value={Gender.Female}>Female</option>
                <option value={Gender.UnknownGender}>Unknown</option>
                <option value={Gender.Intersex}>Intersex</option>
              </select>
            </FieldRow>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Additional names · {additionalNames.length}
          </h2>
          <SubRecordList
            items={additionalNames}
            fields={[
              { id: 'type', label: 'Type (e.g. Nickname, Aka)' },
              { id: 'value', label: 'Name' },
            ]}
            onUpdate={(i, next) => setAdditionalNames((a) => a.map((x, j) => (j === i ? next : x)))}
            onAdd={() => setAdditionalNames((a) => [...a, { type: '', value: '' }])}
            onDelete={(i) => setAdditionalNames((a) => a.filter((_, j) => j !== i))}
            addLabel="+ Add additional name"
            empty="No additional names."
          />
        </section>

        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Facts · {facts.length}
          </h2>
          <SubRecordList
            items={facts}
            fields={[
              { id: 'type', label: 'Type (Occupation, Residence, Description…)' },
              { id: 'value', label: 'Description' },
              { id: 'date', label: 'Date (optional)' },
            ]}
            onUpdate={(i, next) => setFacts((a) => a.map((x, j) => (j === i ? next : x)))}
            onAdd={() => setFacts((a) => [...a, { type: '', value: '', date: '' }])}
            onDelete={(i) => setFacts((a) => a.filter((_, j) => j !== i))}
            addLabel="+ Add fact"
            empty="No facts recorded."
          />
        </section>

        <section className="mb-6">
          <FieldRow label="Note">
            <textarea
              value={values.note ?? ''}
              onChange={(e) => setValues({ ...values, note: e.target.value })}
              style={editorTextarea}
              rows={4}
            />
          </FieldRow>
        </section>

        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Related views</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/charts?type=ancestor')} className="text-xs text-primary border border-border rounded-md px-3 py-1.5 hover:bg-accent">Ancestor chart</button>
            <button onClick={() => navigate('/charts?type=descendant')} className="text-xs text-primary border border-border rounded-md px-3 py-1.5 hover:bg-accent">Descendant chart</button>
            <button onClick={() => navigate('/events')} className="text-xs text-primary border border-border rounded-md px-3 py-1.5 hover:bg-accent">Events</button>
            <button onClick={() => navigate('/media')} className="text-xs text-primary border border-border rounded-md px-3 py-1.5 hover:bg-accent">Media</button>
            <button onClick={() => navigate('/sources')} className="text-xs text-primary border border-border rounded-md px-3 py-1.5 hover:bg-accent">Sources</button>
            <button onClick={() => navigate('/change-log')} className="text-xs text-primary border border-border rounded-md px-3 py-1.5 hover:bg-accent">Change log</button>
          </div>
        </section>
      </main>
    </div>
  );
}
