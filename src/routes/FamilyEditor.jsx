/**
 * Family editor — /family/:id. Edit marriage date, swap partners,
 * add/remove/reorder children. Every save appends a ChangeLogEntry.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { saveWithChangeLog, logRecordCreated, logRecordDeleted } from '../lib/changeLog.js';
import { refValue, refToRecordName as refValueToName } from '../lib/recordRef.js';
import { listAllPersons } from '../lib/treeQuery.js';
import { personSummary, familySummary, lifeSpanLabel } from '../models/index.js';
import { PersonPicker } from '../components/charts/PersonPicker.jsx';
import { FieldRow, editorInput, editorTextarea } from '../components/editors/FieldRow.jsx';

function uuid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function FamilyEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [family, setFamily] = useState(null);
  const [persons, setPersons] = useState([]);
  const [manId, setManId] = useState(null);
  const [womanId, setWomanId] = useState(null);
  const [marriageDate, setMarriageDate] = useState('');
  const [note, setNote] = useState('');
  const [familyEvents, setFamilyEvents] = useState([]);
  const [children, setChildren] = useState([]); // [{ childRelationName, childRecordName, summary }]
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const db = getLocalDatabase();
    const f = await db.getRecord(id);
    if (!f) {
      setNotFound(true);
      return;
    }
    setFamily(f);
    setManId(refValueToName(f.fields?.man?.value));
    setWomanId(refValueToName(f.fields?.woman?.value));
    setMarriageDate(f.fields?.cached_marriageDate?.value || '');
    setNote(f.fields?.note?.value || '');

    const { records: fevents } = await db.query('FamilyEvent', {
      referenceField: 'family',
      referenceValue: id,
      limit: 500,
    });
    setFamilyEvents(fevents);

    const { records: rels } = await db.query('ChildRelation', {
      referenceField: 'family',
      referenceValue: id,
      limit: 500,
    });
    const hydrated = [];
    for (const cr of rels) {
      const childRef = refValueToName(cr.fields?.child?.value);
      if (!childRef) continue;
      const child = await db.getRecord(childRef);
      const sum = personSummary(child);
      hydrated.push({
        childRelationName: cr.recordName,
        childRecordName: childRef,
        summary: sum,
        order: cr.fields?.order?.value ?? 0,
      });
    }
    hydrated.sort((a, b) => a.order - b.order);
    setChildren(hydrated);

    if (persons.length === 0) setPersons(await listAllPersons());
  }, [id, persons.length]);

  useEffect(() => {
    load();
  }, [load]);

  const moveChild = (i, dir) => {
    setChildren((arr) => {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const next = [...arr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const removeChild = (i) => {
    setChildren((arr) => arr.filter((_, j) => j !== i));
  };

  const addChild = (recordName) => {
    if (!recordName) return;
    if (children.some((c) => c.childRecordName === recordName)) return;
    const sum = persons.find((p) => p.recordName === recordName);
    if (!sum) return;
    setChildren((arr) => [
      ...arr,
      { childRelationName: null, childRecordName: recordName, summary: sum, order: arr.length },
    ]);
  };

  const onSave = useCallback(async () => {
    if (!family) return;
    setSaving(true);
    const db = getLocalDatabase();

    const nextFields = { ...family.fields };
    if (manId) nextFields.man = { value: refValue(manId, 'Person'), type: 'REFERENCE' };
    else delete nextFields.man;
    if (womanId) nextFields.woman = { value: refValue(womanId, 'Person'), type: 'REFERENCE' };
    else delete nextFields.woman;
    if (marriageDate) nextFields.cached_marriageDate = { value: marriageDate, type: 'STRING' };
    else delete nextFields.cached_marriageDate;
    if (note) nextFields.note = { value: note, type: 'STRING' };
    else delete nextFields.note;

    const updated = { ...family, fields: nextFields };
    await saveWithChangeLog(updated);

    // Reconcile children: existing rels keep their recordName, new ones are created,
    // removed ones get deleted.
    const { records: existingRels } = await db.query('ChildRelation', {
      referenceField: 'family',
      referenceValue: id,
      limit: 500,
    });
    const existingByChild = new Map(
      existingRels.map((r) => [refValueToName(r.fields?.child?.value), r])
    );
    const keepRelNames = new Set();

    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      const existing = existingByChild.get(c.childRecordName);
      if (existing) {
        keepRelNames.add(existing.recordName);
        if ((existing.fields?.order?.value ?? 0) !== i) {
          const rel = {
            ...existing,
            fields: { ...existing.fields, order: { value: i, type: 'NUMBER' } },
          };
          await saveWithChangeLog(rel);
        }
      } else {
        const rel = {
          recordName: uuid('cr'),
          recordType: 'ChildRelation',
          fields: {
            family: { value: refValue(id, 'Family'), type: 'REFERENCE' },
            child: { value: refValue(c.childRecordName, 'Person'), type: 'REFERENCE' },
            order: { value: i, type: 'NUMBER' },
          },
        };
        await db.saveRecord(rel);
        await logRecordCreated(rel);
        keepRelNames.add(rel.recordName);
      }
    }

    for (const rel of existingRels) {
      if (!keepRelNames.has(rel.recordName)) {
        await db.deleteRecord(rel.recordName);
        await logRecordDeleted(rel.recordName, 'ChildRelation');
      }
    }

    await load();
    setSaving(false);
    setStatus('Saved');
    setTimeout(() => setStatus(null), 1500);
  }, [family, manId, womanId, marriageDate, note, children, id, load]);

  if (notFound) return <div style={pad}>Family not found.</div>;
  if (!family) return <div style={pad}>Loading…</div>;

  const summary = familySummary(family);
  const man = persons.find((p) => p.recordName === manId);
  const woman = persons.find((p) => p.recordName === womanId);

  return (
    <div style={shell}>
      <header style={header}>
        <button onClick={() => navigate(-1)} style={backBtn}>← Back</button>
        <h1 style={{ fontSize: 18, color: '#e2e4eb', margin: 0, fontWeight: 600 }}>
          Edit Family · {summary?.familyName || family.recordName}
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
          <FieldRow label="Partner (male)">
            <PersonPicker persons={persons} value={manId} onChange={setManId} />
            {man && <div style={partnerHint}>{man.fullName} {lifeSpanLabel(man) && `· ${lifeSpanLabel(man)}`}</div>}
          </FieldRow>
          <FieldRow label="Partner (female)">
            <PersonPicker persons={persons} value={womanId} onChange={setWomanId} />
            {woman && <div style={partnerHint}>{woman.fullName} {lifeSpanLabel(woman) && `· ${lifeSpanLabel(woman)}`}</div>}
          </FieldRow>
          <FieldRow label="Marriage date">
            <input
              value={marriageDate}
              onChange={(e) => setMarriageDate(e.target.value)}
              placeholder="YYYY or YYYY-MM-DD"
              style={editorInput}
            />
          </FieldRow>
        </div>

        <FieldRow label="Family note">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={editorTextarea}
            rows={3}
          />
        </FieldRow>

        <FieldRow label={`Family events · ${familyEvents.length}`} hint="Open the Events page to add or edit family events.">
          {familyEvents.length === 0 ? (
            <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 13, fontStyle: 'italic' }}>
              No family events recorded.
            </div>
          ) : (
            <div>
              {familyEvents.map((e) => (
                <div
                  key={e.recordName}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    padding: '8px 10px',
                    marginBottom: 4,
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                  }}
                >
                  <span style={{ color: 'hsl(var(--foreground))', fontSize: 13, flex: 1 }}>
                    {e.fields?.conclusionType?.value || e.fields?.eventType?.value || 'Event'}
                    {e.fields?.date?.value && (
                      <span style={{ color: 'hsl(var(--muted-foreground))', marginLeft: 8, fontSize: 11 }}>
                        {e.fields.date.value}
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => navigate('/events')}
                    style={{ ...tinyBtn, color: 'hsl(var(--primary))' }}
                  >
                    open in Events
                  </button>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/events')} style={{ ...tinyBtn, marginTop: 8 }}>
            + Add family event (opens Events)
          </button>
        </FieldRow>

        <FieldRow label={`Children · ${children.length}`}>
          {children.length === 0 && (
            <div style={{ color: '#5b6072', fontSize: 13, marginBottom: 8 }}>No children yet.</div>
          )}
          {children.map((c, i) => (
            <div key={c.childRecordName} style={childRow}>
              <span style={{ color: '#5b6072', fontSize: 11, minWidth: 28 }}>{i + 1}.</span>
              <span style={{ color: '#e2e4eb', fontSize: 13, flex: 1 }}>
                {c.summary?.fullName || c.childRecordName}
                {lifeSpanLabel(c.summary) && <span style={{ color: '#8b90a0', marginLeft: 8, fontSize: 11 }}>{lifeSpanLabel(c.summary)}</span>}
              </span>
              <button disabled={i === 0} onClick={() => moveChild(i, -1)} style={tinyBtn}>↑</button>
              <button disabled={i === children.length - 1} onClick={() => moveChild(i, 1)} style={tinyBtn}>↓</button>
              <button onClick={() => navigate(`/person/${c.childRecordName}`)} style={tinyBtn}>edit</button>
              <button onClick={() => removeChild(i)} style={{ ...tinyBtn, color: '#f87171' }}>remove</button>
            </div>
          ))}
          <div style={{ marginTop: 10, maxWidth: 320 }}>
            <PersonPicker persons={persons} value={null} onChange={addChild} />
            <div style={{ color: '#5b6072', fontSize: 11, marginTop: 4 }}>Pick a person to add as a child.</div>
          </div>
        </FieldRow>
      </main>
    </div>
  );
}

const shell = { display: 'flex', flexDirection: 'column', height: '100%' };
const header = { display: 'flex', gap: 12, alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #2e3345', background: '#161926' };
const main = { flex: 1, overflow: 'auto', padding: '24px 28px', maxWidth: 900, margin: '0 auto', width: '100%', boxSizing: 'border-box' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 12 };
const partnerHint = { color: '#8b90a0', fontSize: 11, marginTop: 4 };
const childRow = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: '#13161f', border: '1px solid #2e3345', borderRadius: 6, marginBottom: 6 };
const pad = { padding: 40, color: '#8b90a0' };
const backBtn = { background: 'transparent', color: '#8b90a0', border: '1px solid #2e3345', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' };
const saveBtn = { background: '#3b6db8', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600 };
const tinyBtn = { background: 'transparent', color: '#8b90a0', border: '1px solid #2e3345', borderRadius: 4, padding: '3px 7px', fontSize: 11, cursor: 'pointer' };
