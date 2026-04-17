/**
 * Places list + editor. Edit place name, short name, coordinates, GeoName ID.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { saveWithChangeLog, logRecordCreated, logRecordDeleted } from '../lib/changeLog.js';
import { refToRecordName, refValue } from '../lib/recordRef.js';
import { placeSummary } from '../models/index.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow, editorInput } from '../components/editors/FieldRow.jsx';
import { SubRecordList } from '../components/editors/SubRecordList.jsx';
import { Map } from '../components/ui/Map.jsx';

function uuid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

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
  const [templates, setTemplates] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [values, setValues] = useState({});
  const [templateId, setTemplateId] = useState('');
  const [keyValues, setKeyValues] = useState([]);
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
    const { records: tpls } = await db.query('PlaceTemplate', { limit: 10000 });
    setTemplates(tpls);
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
    setTemplateId(refToRecordName(record.fields?.placeTemplate?.value) || '');
    // Fetch key/values linked to this place
    (async () => {
      const db = getLocalDatabase();
      const { records: kvs } = await db.query('PlaceKeyValue', {
        referenceField: 'place',
        referenceValue: activeId,
        limit: 500,
      });
      setKeyValues(
        kvs.map((r) => ({
          recordName: r.recordName,
          key: r.fields?.key?.value || r.fields?.keyName?.value || '',
          value: r.fields?.value?.value || '',
        }))
      );
    })();
  }, [activeId, places]);

  const onSave = useCallback(async () => {
    const record = places.find((p) => p.recordName === activeId);
    if (!record) return;
    setSaving(true);
    const db = getLocalDatabase();
    const nextFields = { ...record.fields };
    for (const f of PLACE_FIELDS) {
      const v = values[f.id];
      if (v === '' || v == null) delete nextFields[f.id];
      else nextFields[f.id] = { ...(nextFields[f.id] || { type: 'STRING' }), value: v };
    }
    if (templateId) {
      nextFields.placeTemplate = { value: refValue(templateId, 'PlaceTemplate'), type: 'REFERENCE' };
    } else {
      delete nextFields.placeTemplate;
    }
    await saveWithChangeLog({ ...record, fields: nextFields });

    // Reconcile PlaceKeyValue records
    const existing = (
      await db.query('PlaceKeyValue', { referenceField: 'place', referenceValue: activeId, limit: 500 })
    ).records;
    const keep = new Set();
    for (const kv of keyValues) {
      if (!kv.key && !kv.value) continue;
      if (kv.recordName) {
        keep.add(kv.recordName);
        const prev = existing.find((r) => r.recordName === kv.recordName);
        if (prev) {
          await saveWithChangeLog({
            ...prev,
            fields: {
              ...prev.fields,
              key: { value: kv.key || '', type: 'STRING' },
              value: { value: kv.value || '', type: 'STRING' },
              place: { value: refValue(activeId, 'Place'), type: 'REFERENCE' },
            },
          });
        }
      } else {
        const rec = {
          recordName: uuid('pkv'),
          recordType: 'PlaceKeyValue',
          fields: {
            key: { value: kv.key || '', type: 'STRING' },
            value: { value: kv.value || '', type: 'STRING' },
            place: { value: refValue(activeId, 'Place'), type: 'REFERENCE' },
          },
        };
        await db.saveRecord(rec);
        await logRecordCreated(rec);
        keep.add(rec.recordName);
      }
    }
    for (const prev of existing) {
      if (!keep.has(prev.recordName)) {
        await db.deleteRecord(prev.recordName);
        await logRecordDeleted(prev.recordName, 'PlaceKeyValue');
      }
    }

    await reload();
    setSaving(false);
    setStatus('Saved');
    setTimeout(() => setStatus(null), 1500);
  }, [activeId, places, values, templateId, keyValues, reload]);

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
      <FieldRow label="Place template">
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          style={editorInput}
        >
          <option value="">— no template —</option>
          {templates.map((t) => (
            <option key={t.recordName} value={t.recordName}>
              {t.fields?.name?.value || t.fields?.title?.value || t.recordName}
            </option>
          ))}
        </select>
      </FieldRow>

      <div style={{ marginTop: 16 }}>
        <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>
          Template key/value pairs · {keyValues.length}
        </div>
        <SubRecordList
          items={keyValues}
          fields={[
            { id: 'key', label: 'Key' },
            { id: 'value', label: 'Value' },
          ]}
          onUpdate={(i, next) => setKeyValues((a) => a.map((x, j) => (j === i ? next : x)))}
          onAdd={() => setKeyValues((a) => [...a, { key: '', value: '' }])}
          onDelete={(i) => setKeyValues((a) => a.filter((_, j) => j !== i))}
          addLabel="+ Add key/value"
          empty="No key/value pairs."
        />
      </div>

      <div style={{ marginTop: 16, height: 320, borderRadius: 8, overflow: 'hidden', border: '1px solid hsl(var(--border))' }}>
        {(() => {
          const lat = parseFloat(values.latitude);
          const lng = parseFloat(values.longitude);
          const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);
          const center = hasPoint ? [lng, lat] : [0, 20];
          const markers = hasPoint
            ? [{ id: 'self', lat, lng, draggable: true, onDragEnd: ({ lng: nl, lat: nL }) => setValues((v) => ({ ...v, latitude: nL.toFixed(6), longitude: nl.toFixed(6) })) }]
            : [];
          return (
            <Map
              center={center}
              zoom={hasPoint ? 8 : 1.5}
              markers={markers}
              onClick={({ lng: nl, lat: nL }) => setValues((v) => ({ ...v, latitude: nL.toFixed(6), longitude: nl.toFixed(6) }))}
            />
          );
        })()}
      </div>
      <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginTop: 6 }}>
        Click anywhere on the map to set coordinates, or drag the marker to fine-tune.
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
