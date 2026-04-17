/**
 * Sources list + editor. Edit title, author, date, text, bookmark status.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { saveWithChangeLog } from '../lib/changeLog.js';
import { sourceSummary } from '../models/index.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow, editorInput, editorTextarea } from '../components/editors/FieldRow.jsx';

const SOURCE_FIELDS = [
  { id: 'title', label: 'Title' },
  { id: 'cached_title', label: 'Cached title' },
  { id: 'author', label: 'Author' },
  { id: 'cached_date', label: 'Date' },
];

export default function Sources() {
  const [sources, setSources] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [values, setValues] = useState({});
  const [text, setText] = useState('');
  const [bookmarked, setBookmarked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const reload = useCallback(async () => {
    const db = getLocalDatabase();
    const { records } = await db.query('Source', { limit: 100000 });
    const sorted = records.sort((a, b) => {
      const an = (a.fields?.cached_title?.value || a.fields?.title?.value || '').toLowerCase();
      const bn = (b.fields?.cached_title?.value || b.fields?.title?.value || '').toLowerCase();
      return an.localeCompare(bn);
    });
    setSources(sorted);
    if (sorted.length > 0 && !activeId) setActiveId(sorted[0].recordName);
  }, [activeId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!activeId) return;
    const record = sources.find((s) => s.recordName === activeId);
    if (!record) return;
    const v = {};
    for (const f of SOURCE_FIELDS) v[f.id] = record.fields?.[f.id]?.value ?? '';
    setValues(v);
    setText(record.fields?.text?.value || '');
    setBookmarked(!!record.fields?.isBookmarked?.value);
  }, [activeId, sources]);

  const onSave = useCallback(async () => {
    const record = sources.find((s) => s.recordName === activeId);
    if (!record) return;
    setSaving(true);
    const nextFields = { ...record.fields };
    for (const f of SOURCE_FIELDS) {
      const v = values[f.id];
      if (v === '' || v == null) delete nextFields[f.id];
      else nextFields[f.id] = { ...(nextFields[f.id] || { type: 'STRING' }), value: v };
    }
    if (text) nextFields.text = { value: text, type: 'STRING' };
    else delete nextFields.text;
    nextFields.isBookmarked = { value: !!bookmarked, type: 'BOOLEAN' };

    await saveWithChangeLog({ ...record, fields: nextFields });
    await reload();
    setSaving(false);
    setStatus('Saved');
    setTimeout(() => setStatus(null), 1500);
  }, [activeId, sources, values, text, bookmarked, reload]);

  const renderRow = (r) => {
    const s = sourceSummary(r);
    return (
      <div>
        <div style={{ color: '#e2e4eb', fontSize: 13 }}>
          {s?.bookmarked ? '★ ' : ''}{s?.title || r.recordName}
        </div>
        {s?.date && <div style={{ color: '#5b6072', fontSize: 11 }}>{s.date}</div>}
      </div>
    );
  };

  const active = sources.find((s) => s.recordName === activeId);
  const detail = active ? (
    <div style={detailStyle}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, color: '#e2e4eb', margin: 0, fontWeight: 600 }}>
          {sourceSummary(active)?.title || active.recordName}
        </h2>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {status && <span style={{ color: '#4ade80', fontSize: 12 }}>{status}</span>}
          <button onClick={onSave} disabled={saving} style={saveBtn}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      <div style={grid}>
        {SOURCE_FIELDS.map((f) => (
          <FieldRow key={f.id} label={f.label}>
            <input
              value={values[f.id] ?? ''}
              onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
              style={editorInput}
            />
          </FieldRow>
        ))}
      </div>
      <FieldRow label="Bookmarked">
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#e2e4eb', fontSize: 13, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={bookmarked}
            onChange={(e) => setBookmarked(e.target.checked)}
          />
          Mark this source as a favorite
        </label>
      </FieldRow>
      <FieldRow label="Text">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ ...editorTextarea, minHeight: 200 }}
          rows={10}
        />
      </FieldRow>
    </div>
  ) : (
    <div style={{ color: '#5b6072', padding: 40 }}>No source selected.</div>
  );

  if (sources.length === 0) {
    return <div style={{ padding: 40, color: '#8b90a0' }}>No sources in this tree yet.</div>;
  }

  return (
    <MasterDetailList
      items={sources}
      activeId={activeId}
      onPick={setActiveId}
      renderRow={renderRow}
      placeholder="Search sources…"
      detail={detail}
    />
  );
}

const detailStyle = { padding: 28, maxWidth: 860 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 };
const saveBtn = { background: '#3b6db8', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600 };
