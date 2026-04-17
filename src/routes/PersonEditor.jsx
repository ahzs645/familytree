/**
 * Person editor — /person/:id. Edit names, gender, life dates; save writes
 * field changes to IndexedDB and appends a ChangeLogEntry.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { saveWithChangeLog } from '../lib/changeLog.js';
import { Gender } from '../models/index.js';
import { FieldRow, editorInput, editorTextarea } from '../components/editors/FieldRow.jsx';

const PERSON_FIELDS = [
  { id: 'firstName', label: 'First name' },
  { id: 'nameMiddle', label: 'Middle name' },
  { id: 'lastName', label: 'Last name' },
  { id: 'namePrefix', label: 'Prefix' },
  { id: 'nameSuffix', label: 'Suffix' },
  { id: 'cached_birthDate', label: 'Birth date', hint: 'Any recognizable date string; YYYY-MM-DD preferred.' },
  { id: 'cached_deathDate', label: 'Death date' },
];

export default function PersonEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const db = getLocalDatabase();
      const r = await db.getRecord(id);
      if (cancel) return;
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
    })();
    return () => {
      cancel = true;
    };
  }, [id]);

  const onSave = useCallback(async () => {
    if (!record) return;
    setSaving(true);
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

    const updated = { ...record, fields: nextFields };
    await saveWithChangeLog(updated);
    setSaving(false);
    setStatus('Saved');
    setTimeout(() => setStatus(null), 1500);
  }, [record, values]);

  if (notFound) {
    return (
      <div style={pad}>
        Person not found. <a href="#" onClick={() => navigate('/tree')} style={{ color: '#6c8aff' }}>Back to Tree</a>.
      </div>
    );
  }
  if (!record) return <div style={pad}>Loading…</div>;

  return (
    <div style={shell}>
      <header style={header}>
        <button onClick={() => navigate(-1)} style={backBtn}>← Back</button>
        <h1 style={{ fontSize: 18, color: '#e2e4eb', margin: 0, fontWeight: 600 }}>
          Edit Person · {record.fields?.cached_fullName?.value || record.recordName}
        </h1>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {status && <span style={{ color: '#4ade80', fontSize: 12 }}>{status}</span>}
          <button disabled={saving} onClick={onSave} style={saveBtn}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </header>

      <main style={main}>
        <div style={grid}>
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

        <FieldRow label="Note">
          <textarea
            value={values.note ?? ''}
            onChange={(e) => setValues({ ...values, note: e.target.value })}
            style={editorTextarea}
            rows={4}
          />
        </FieldRow>

        <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
          <button onClick={() => navigate(`/charts?type=ancestor`)} style={ghostBtn}>Ancestor chart</button>
          <button onClick={() => navigate(`/charts?type=descendant`)} style={ghostBtn}>Descendant chart</button>
        </div>
      </main>
    </div>
  );
}

const shell = { display: 'flex', flexDirection: 'column', height: '100%' };
const header = { display: 'flex', gap: 12, alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #2e3345', background: '#161926' };
const main = { flex: 1, overflow: 'auto', padding: '24px 28px', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 };
const pad = { padding: 40, color: '#8b90a0' };
const backBtn = { background: 'transparent', color: '#8b90a0', border: '1px solid #2e3345', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' };
const saveBtn = { background: '#3b6db8', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600 };
const ghostBtn = { background: 'transparent', color: '#6c8aff', border: '1px solid #2e3345', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' };
