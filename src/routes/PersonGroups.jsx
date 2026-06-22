import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { generateId } from '../lib/ids.js';
import { saveWithChangeLog, logRecordCreated, logRecordDeleted } from '../lib/changeLog.js';
import { readRef, writeRef } from '../lib/schema.js';
import { collectRelatives } from '../lib/relationshipPath.js';
import { personSummary } from '../models/index.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow, editorInput, editorTextarea } from '../components/editors/FieldRow.jsx';
import { isRecordLocked } from '../lib/recordLock.js';
import { useDirtyBaseline } from '../lib/editorState.js';
import { useRecordLock } from '../lib/useRecordLock.js';
import { RecordLockButton } from '../components/editors/RecordLockButton.jsx';

function uuid(prefix) {
  return generateId(prefix);
}

function groupName(record) {
  return record?.fields?.name?.value || record?.fields?.title?.value || record?.recordName || 'Group';
}

export default function PersonGroups() {
  const [searchParams] = useSearchParams();
  const queryGroupId = searchParams.get('groupId');
  const [groups, setGroups] = useState([]);
  const [relations, setRelations] = useState([]);
  const [persons, setPersons] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [values, setValues] = useState({});
  const [personId, setPersonId] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [loadSeq, setLoadSeq] = useState(0);

  const reload = useCallback(async () => {
    const db = getLocalDatabase();
    const [g, r, p] = await Promise.all([
      db.query('PersonGroup', { limit: 100000 }),
      db.query('PersonGroupRelation', { limit: 100000 }),
      db.query('Person', { limit: 100000 }),
    ]);
    setGroups(g.records.sort((a, b) => groupName(a).localeCompare(groupName(b))));
    setRelations(r.records);
    setPersons(p.records.map((rec) => ({ rec, summary: personSummary(rec) })).filter((x) => x.summary).sort((a, b) => a.summary.fullName.localeCompare(b.summary.fullName)));
    if (!activeId && g.records.length) setActiveId(g.records[0].recordName);
    setLoadSeq((n) => n + 1);
  }, [activeId]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (!queryGroupId || groups.length === 0) return;
    if (groups.some((group) => group.recordName === queryGroupId)) setActiveId(queryGroupId);
  }, [queryGroupId, groups]);
  useEffect(() => {
    const group = groups.find((g) => g.recordName === activeId);
    if (!group) return;
    setValues({
      name: group.fields?.name?.value || '',
      description: group.fields?.description?.value || group.fields?.userDescription?.value || '',
      color: group.fields?.color?.value || '',
    });
  }, [groups, activeId]);

  const active = groups.find((g) => g.recordName === activeId);
  const memberRelations = useMemo(() => relations.filter((r) => readRef(r.fields?.personGroup) === activeId), [relations, activeId]);
  const members = memberRelations.map((rel) => {
    const id = readRef(rel.fields?.person);
    return { rel, person: persons.find((p) => p.rec.recordName === id) };
  });

  const save = async () => {
    if (!active) return;
    if (isRecordLocked(active)) {
      setStatus('Unlock this group before saving.');
      return;
    }
    setSaving(true);
    const next = { ...active, fields: { ...active.fields } };
    for (const key of ['name', 'description', 'color']) {
      const value = values[key];
      if (value) next.fields[key] = { value, type: 'STRING' };
      else delete next.fields[key];
    }
    await saveWithChangeLog(next);
    await reload();
    setSaving(false);
    setStatus('Saved');
    setTimeout(() => setStatus(null), 1500);
  };

  const create = async () => {
    const db = getLocalDatabase();
    const rec = { recordName: uuid('grp'), recordType: 'PersonGroup', fields: { name: { value: 'New Group', type: 'STRING' } } };
    await db.saveRecord(rec);
    await logRecordCreated(rec);
    await reload();
    setActiveId(rec.recordName);
  };

  const addRelatives = async (direction) => {
    if (isRecordLocked(active)) {
      setStatus('Unlock this group before editing members.');
      return;
    }
    if (!activeId || !personId) {
      setStatus('Pick a person first.');
      return;
    }
    setStatus(`Collecting ${direction}…`);
    try {
      const relatives = await collectRelatives(personId, { includeSpouses: false });
      const existing = new Set(memberRelations.map((r) => readRef(r.fields?.person)).filter(Boolean));
      existing.add(personId);
      const wanted = relatives.filter((rel) => {
        const edges = rel.steps.slice(1).map((step) => step.edgeFromPrev);
        if (edges.length === 0) return false;
        return direction === 'ancestors' ? edges.every((e) => e === 'parent') : edges.every((e) => e === 'child');
      });
      const db = getLocalDatabase();
      let added = 0;
      for (const rel of wanted) {
        if (existing.has(rel.id)) continue;
        existing.add(rel.id);
        const rec = { recordName: uuid('pgr'), recordType: 'PersonGroupRelation', fields: { personGroup: writeRef(activeId, 'PersonGroup'), person: writeRef(rel.id, 'Person') } };
        await db.saveRecord(rec);
        await logRecordCreated(rec);
        added += 1;
      }
      await reload();
      setStatus(`Added ${added} ${direction}.`);
    } catch (error) {
      setStatus(error.message);
    }
  };

  const addMember = async () => {
    if (isRecordLocked(active)) {
      setStatus('Unlock this group before editing members.');
      return;
    }
    if (!activeId || !personId || memberRelations.some((r) => readRef(r.fields?.person) === personId)) return;
    const db = getLocalDatabase();
    const rec = {
      recordName: uuid('pgr'),
      recordType: 'PersonGroupRelation',
      fields: {
        personGroup: writeRef(activeId, 'PersonGroup'),
        person: writeRef(personId, 'Person'),
      },
    };
    await db.saveRecord(rec);
    await logRecordCreated(rec);
    setPersonId('');
    await reload();
  };

  const removeMember = async (rel) => {
    if (isRecordLocked(active)) {
      setStatus('Unlock this group before editing members.');
      return;
    }
    const db = getLocalDatabase();
    await db.deleteRecord(rel.recordName);
    await logRecordDeleted(rel.recordName, 'PersonGroupRelation');
    await reload();
  };

  const editableSnapshot = useMemo(() => ({ activeFields: active?.fields || {}, values }), [active, values]);
  const dirty = useDirtyBaseline(editableSnapshot, {
    recordKey: active?.recordName,
    reloadKey: loadSeq,
    enabled: !!active && !saving,
  });
  const onToggleLock = useRecordLock({
    record: active,
    setRecord: (next) => setGroups((rows) => rows.map((row) => row.recordName === next.recordName ? next : row)),
    setSaving,
    setStatus,
    reload,
  });

  const detail = active ? (
    <div className="p-5 max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-semibold">{groupName(active)}</h2>
        {status && <span className="ms-auto text-xs text-emerald-500">{status}</span>}
        <RecordLockButton record={active} saving={saving} onToggle={onToggleLock} />
        <button onClick={save} disabled={saving || isRecordLocked(active)} className="ms-auto bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
      </div>
      <FieldRow label="Group name"><input value={values.name || ''} onChange={(e) => setValues({ ...values, name: e.target.value })} style={editorInput} /></FieldRow>
      <FieldRow label="Color"><input value={values.color || ''} onChange={(e) => setValues({ ...values, color: e.target.value })} style={editorInput} /></FieldRow>
      <FieldRow label="Description"><textarea rows={4} value={values.description || ''} onChange={(e) => setValues({ ...values, description: e.target.value })} style={editorTextarea} /></FieldRow>

      <section className="mt-6 border border-border rounded-md p-3 bg-card">
        <h3 className="text-sm font-semibold mb-3">Members · {members.length}</h3>
        <div className="space-y-2 mb-3">
          {members.length === 0 ? <div className="text-sm text-muted-foreground">No members.</div> : members.map(({ rel, person }) => (
            <div key={rel.recordName} className="flex items-center gap-2 bg-secondary/40 rounded-md p-2">
              <span className="text-sm flex-1">{person?.summary.fullName || readRef(rel.fields?.person)}</span>
              <button onClick={() => removeMember(rel)} className="text-xs text-destructive">Remove now</button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="bg-background border border-border rounded-md px-2 py-1.5 text-sm" aria-label="Group member person">
            <option value="">Select person...</option>
            {persons.map(({ rec, summary }) => <option key={rec.recordName} value={rec.recordName}>{summary.fullName}</option>)}
          </select>
          <button onClick={addMember} className="bg-secondary border border-border rounded-md px-3 py-1.5 text-xs">Add now</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => addRelatives('ancestors')} disabled={!personId} className="bg-secondary border border-border rounded-md px-3 py-1.5 text-xs disabled:opacity-50">Add ancestors of selected</button>
          <button onClick={() => addRelatives('descendants')} disabled={!personId} className="bg-secondary border border-border rounded-md px-3 py-1.5 text-xs disabled:opacity-50">Add descendants of selected</button>
        </div>
      </section>
    </div>
  ) : <div className="p-10 text-muted-foreground">No group selected.</div>;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">Person Groups</h1>
        <span className="text-xs text-muted-foreground">{groups.length}</span>
        <button onClick={create} className="ms-auto bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold">+ New</button>
      </header>
      <div className="flex-1 min-h-0">
        <MasterDetailList items={groups} activeId={activeId} onPick={setActiveId} renderRow={(g) => <div className="text-sm">{groupName(g)}</div>} placeholder="Search groups..." detail={detail} emptyTitle="No groups yet" emptyHint="Tap + New to create a group." />
      </div>
    </div>
  );
}
