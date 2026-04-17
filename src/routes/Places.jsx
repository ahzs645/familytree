/**
 * Places list + editor. Edit place name, short name, coordinates, GeoName ID.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { saveWithChangeLog } from '../lib/changeLog.js';
import { placeSummary } from '../models/index.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow, editorInput } from '../components/editors/FieldRow.jsx';

const PLACE_FIELDS = [
  { id: 'placeName', label: 'Place name' },
  { id: 'cached_normallocationString', label: 'Normalized name' },
  { id: 'cached_shortLocationString', label: 'Short name' },
  { id: 'cached_standardizedLocationString', label: 'Standardized name' },
  { id: 'geonameID', label: 'GeoName ID' },
  { id: 'latitude', label: 'Latitude' },
  { id: 'longitude', label: 'Longitude' },
];

export default function Places() {
  const [places, setPlaces] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [values, setValues] = useState({});
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const db = getLocalDatabase();
    const { records } = await db.query('Place', { limit: 100000 });
    const sorted = records.sort((a, b) => {
      const an = (a.fields?.placeName?.value || a.fields?.cached_normallocationString?.value || '').toLowerCase();
      const bn = (b.fields?.placeName?.value || b.fields?.cached_normallocationString?.value || '').toLowerCase();
      return an.localeCompare(bn);
    });
    setPlaces(sorted);
    if (sorted.length > 0 && !activeId) setActiveId(sorted[0].recordName);
  }, [activeId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!activeId) return;
    const record = places.find((p) => p.recordName === activeId);
    if (!record) return;
    const v = {};
    for (const f of PLACE_FIELDS) v[f.id] = record.fields?.[f.id]?.value ?? '';
    setValues(v);
  }, [activeId, places]);

  const onSave = useCallback(async () => {
    const record = places.find((p) => p.recordName === activeId);
    if (!record) return;
    setSaving(true);
    const nextFields = { ...record.fields };
    for (const f of PLACE_FIELDS) {
      const v = values[f.id];
      if (v === '' || v == null) delete nextFields[f.id];
      else nextFields[f.id] = { ...(nextFields[f.id] || { type: 'STRING' }), value: v };
    }
    await saveWithChangeLog({ ...record, fields: nextFields });
    await reload();
    setSaving(false);
    setStatus('Saved');
    setTimeout(() => setStatus(null), 1500);
  }, [activeId, places, values, reload]);

  const renderRow = (r) => {
    const s = placeSummary(r);
    return (
      <div>
        <div style={{ color: '#e2e4eb', fontSize: 13 }}>{s?.displayName || s?.name || r.recordName}</div>
        {s?.geonameID && <div style={{ color: '#5b6072', fontSize: 11 }}>GeoName #{s.geonameID}</div>}
      </div>
    );
  };

  const active = places.find((p) => p.recordName === activeId);
  const detail = active ? (
    <div style={detailStyle}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, color: '#e2e4eb', margin: 0, fontWeight: 600 }}>
          {placeSummary(active)?.displayName || active.recordName}
        </h2>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {status && <span style={{ color: '#4ade80', fontSize: 12 }}>{status}</span>}
          <button onClick={onSave} disabled={saving} style={saveBtn}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      <div style={grid}>
        {PLACE_FIELDS.map((f) => (
          <FieldRow key={f.id} label={f.label}>
            <input
              value={values[f.id] ?? ''}
              onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
              style={editorInput}
            />
          </FieldRow>
        ))}
      </div>
    </div>
  ) : (
    <div style={{ color: '#5b6072', padding: 40 }}>No place selected.</div>
  );

  if (places.length === 0) {
    return <div style={{ padding: 40, color: '#8b90a0' }}>No places in this tree yet.</div>;
  }

  return (
    <MasterDetailList
      items={places}
      activeId={activeId}
      onPick={setActiveId}
      renderRow={renderRow}
      placeholder="Search places…"
      detail={detail}
    />
  );
}

const detailStyle = { padding: 28, maxWidth: 760 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 };
const saveBtn = { background: '#3b6db8', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600 };
