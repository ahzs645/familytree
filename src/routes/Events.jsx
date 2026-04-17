/**
 * Events editor — list PersonEvent + FamilyEvent records; edit conclusion type,
 * date, place, and description. Create new events or delete existing ones.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { saveWithChangeLog, logRecordCreated, logRecordDeleted } from '../lib/changeLog.js';
import { refToRecordName, refValue } from '../lib/recordRef.js';
import { personSummary, placeSummary } from '../models/index.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow, editorInput, editorTextarea } from '../components/editors/FieldRow.jsx';

function uuid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const KIND_OPTIONS = [
  { value: 'PersonEvent', label: 'Person Event' },
  { value: 'FamilyEvent', label: 'Family Event' },
];

export default function Events() {
  const [events, setEvents] = useState([]);
  const [types, setTypes] = useState({ Person: [], Family: [] });
  const [persons, setPersons] = useState([]);
  const [families, setFamilies] = useState([]);
  const [places, setPlaces] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [kindFilter, setKindFilter] = useState('all');
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const reload = useCallback(async () => {
    const db = getLocalDatabase();
    const [pe, fe, personRecs, familyRecs, placeRecs, personTypes, familyTypes] = await Promise.all([
      db.query('PersonEvent', { limit: 100000 }),
      db.query('FamilyEvent', { limit: 100000 }),
      db.query('Person', { limit: 100000 }),
      db.query('Family', { limit: 100000 }),
      db.query('Place', { limit: 100000 }),
      db.query('ConclusionPersonEventType', { limit: 1000 }),
      db.query('ConclusionFamilyEventType', { limit: 1000 }),
    ]);
    const merged = [...pe.records, ...fe.records].sort((a, b) => {
      const ad = a.fields?.date?.value || '';
      const bd = b.fields?.date?.value || '';
      return String(bd).localeCompare(String(ad));
    });
    setEvents(merged);
    setPersons(personRecs.records.map(personSummary).filter(Boolean));
    setFamilies(familyRecs.records);
    setPlaces(placeRecs.records);
    setTypes({
      Person: personTypes.records.map((r) => r.fields?.name?.value || r.fields?.title?.value).filter(Boolean),
      Family: familyTypes.records.map((r) => r.fields?.name?.value || r.fields?.title?.value).filter(Boolean),
    });
    if (merged.length > 0 && !activeId) setActiveId(merged[0].recordName);
  }, [activeId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!activeId) return;
    const ev = events.find((e) => e.recordName === activeId);
    if (!ev) return;
    setValues({
      conclusionType: refToRecordName(ev.fields?.conclusionType?.value) || ev.fields?.conclusionType?.value || ev.fields?.eventType?.value || '',
      date: ev.fields?.date?.value || '',
      description: ev.fields?.description?.value || ev.fields?.userDescription?.value || '',
      personRef: refToRecordName(ev.fields?.person?.value) || '',
      familyRef: refToRecordName(ev.fields?.family?.value) || '',
      placeRef:
        refToRecordName(ev.fields?.place?.value) ||
        refToRecordName(ev.fields?.assignedPlace?.value) ||
        '',
    });
  }, [activeId, events]);

  const onSave = useCallback(async () => {
    const ev = events.find((e) => e.recordName === activeId);
    if (!ev) return;
    setSaving(true);
    const next = { ...ev, fields: { ...ev.fields } };
    if (values.conclusionType) next.fields.conclusionType = { value: values.conclusionType, type: 'STRING' };
    else delete next.fields.conclusionType;
    if (values.date) next.fields.date = { value: values.date, type: 'STRING' };
    else delete next.fields.date;
    if (values.description) next.fields.description = { value: values.description, type: 'STRING' };
    else delete next.fields.description;
    if (ev.recordType === 'PersonEvent' && values.personRef) {
      next.fields.person = { value: refValue(values.personRef, 'Person'), type: 'REFERENCE' };
    }
    if (ev.recordType === 'FamilyEvent' && values.familyRef) {
      next.fields.family = { value: refValue(values.familyRef, 'Family'), type: 'REFERENCE' };
    }
    if (values.placeRef) next.fields.place = { value: refValue(values.placeRef, 'Place'), type: 'REFERENCE' };
    else delete next.fields.place;

    await saveWithChangeLog(next);
    await reload();
    setSaving(false);
    setStatus('Saved');
    setTimeout(() => setStatus(null), 1500);
  }, [activeId, events, values, reload]);

  const onCreate = useCallback(async (kind) => {
    const db = getLocalDatabase();
    const record = {
      recordName: uuid(kind === 'PersonEvent' ? 'pe' : 'fe'),
      recordType: kind,
      fields: {
        conclusionType: { value: '', type: 'STRING' },
        date: { value: '', type: 'STRING' },
      },
    };
    await db.saveRecord(record);
    await logRecordCreated(record);
    await reload();
    setActiveId(record.recordName);
  }, [reload]);

  const onDelete = useCallback(async () => {
    const ev = events.find((e) => e.recordName === activeId);
    if (!ev) return;
    if (!confirm('Delete this event?')) return;
    const db = getLocalDatabase();
    await db.deleteRecord(ev.recordName);
    await logRecordDeleted(ev.recordName, ev.recordType);
    await reload();
    setActiveId(null);
  }, [activeId, events, reload]);

  const filtered = events.filter((e) => {
    if (kindFilter === 'all') return true;
    return e.recordType === kindFilter;
  });

  const renderRow = (e) => {
    const t = e.fields?.conclusionType?.value || e.fields?.eventType?.value || 'Event';
    const d = e.fields?.date?.value || '';
    const subjectRef =
      e.fields?.person?.value?.recordName ||
      e.fields?.family?.value?.recordName ||
      '';
    return (
      <div>
        <div style={{ color: 'hsl(var(--foreground))', fontSize: 13 }}>
          {t}{d && <span style={{ color: 'hsl(var(--muted-foreground))' }}> · {d}</span>}
        </div>
        <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}>
          {e.recordType === 'PersonEvent' ? 'Person' : 'Family'} {subjectRef && `· ${subjectRef}`}
        </div>
      </div>
    );
  };

  const active = events.find((e) => e.recordName === activeId);
  const availableTypes = active?.recordType === 'FamilyEvent' ? types.Family : types.Person;

  const detail = active ? (
    <div style={detailStyle}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, color: 'hsl(var(--foreground))', margin: 0, fontWeight: 600 }}>
          {active.recordType === 'PersonEvent' ? 'Person event' : 'Family event'}
        </h2>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {status && <span style={{ color: '#4ade80', fontSize: 12 }}>{status}</span>}
          <button onClick={onDelete} style={deleteBtn}>Delete</button>
          <button onClick={onSave} disabled={saving} style={saveBtn}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>

      <div style={grid}>
        <FieldRow label="Type" hint="Matches your ConclusionType library. Free-text is accepted.">
          <input
            list="event-types"
            value={values.conclusionType ?? ''}
            onChange={(e) => setValues({ ...values, conclusionType: e.target.value })}
            style={editorInput}
          />
          <datalist id="event-types">
            {availableTypes.map((t) => <option key={t} value={t} />)}
          </datalist>
        </FieldRow>
        <FieldRow label="Date" hint="YYYY, YYYY-MM, or YYYY-MM-DD.">
          <input
            value={values.date ?? ''}
            onChange={(e) => setValues({ ...values, date: e.target.value })}
            style={editorInput}
          />
        </FieldRow>
        {active.recordType === 'PersonEvent' ? (
          <FieldRow label="Person">
            <select
              value={values.personRef ?? ''}
              onChange={(e) => setValues({ ...values, personRef: e.target.value })}
              style={editorInput}
            >
              <option value="">—</option>
              {persons.map((p) => (
                <option key={p.recordName} value={p.recordName}>{p.fullName}</option>
              ))}
            </select>
          </FieldRow>
        ) : (
          <FieldRow label="Family">
            <select
              value={values.familyRef ?? ''}
              onChange={(e) => setValues({ ...values, familyRef: e.target.value })}
              style={editorInput}
            >
              <option value="">—</option>
              {families.map((f) => (
                <option key={f.recordName} value={f.recordName}>
                  {f.fields?.cached_familyName?.value || f.recordName}
                </option>
              ))}
            </select>
          </FieldRow>
        )}
        <FieldRow label="Place">
          <select
            value={values.placeRef ?? ''}
            onChange={(e) => setValues({ ...values, placeRef: e.target.value })}
            style={editorInput}
          >
            <option value="">—</option>
            {places.map((p) => {
              const s = placeSummary(p);
              return <option key={p.recordName} value={p.recordName}>{s?.displayName || p.recordName}</option>;
            })}
          </select>
        </FieldRow>
      </div>
      <FieldRow label="Description">
        <textarea
          value={values.description ?? ''}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
          style={editorTextarea}
          rows={4}
        />
      </FieldRow>
    </div>
  ) : (
    <div style={{ color: 'hsl(var(--muted-foreground))', padding: 40 }}>No event selected. Create one from the toolbar.</div>
  );

  const toolbar = (
    <div style={toolbarStyle}>
      <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} style={smallSelect}>
        <option value="all">All events</option>
        <option value="PersonEvent">Person events</option>
        <option value="FamilyEvent">Family events</option>
      </select>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <button onClick={() => onCreate('PersonEvent')} style={smallBtn}>+ Person event</button>
        <button onClick={() => onCreate('FamilyEvent')} style={smallBtn}>+ Family event</button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {toolbar}
      <div style={{ flex: 1, minHeight: 0 }}>
        <MasterDetailList
          items={filtered}
          activeId={activeId}
          onPick={setActiveId}
          renderRow={renderRow}
          placeholder="Search events…"
          detail={detail}
        />
      </div>
    </div>
  );
}

const detailStyle = { padding: 28, maxWidth: 860 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 12 };
const saveBtn = { background: 'hsl(var(--primary))', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600 };
const deleteBtn = { background: 'transparent', color: 'hsl(var(--destructive))', border: '1px solid #3a2d30', borderRadius: 6, padding: '8px 12px', fontSize: 12, cursor: 'pointer' };
const toolbarStyle = { display: 'flex', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' };
const smallSelect = { background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: 6, padding: '6px 10px', fontSize: 12 };
const smallBtn = { background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' };
