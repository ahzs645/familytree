import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { saveWithChangeLog, logRecordCreated, logRecordDeleted } from '../lib/changeLog.js';
import { readRef, writeRef } from '../lib/schema.js';
import { personSummary } from '../models/index.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow, editorInput, editorTextarea } from '../components/editors/FieldRow.jsx';

function uuid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function groupName(record) {
  return record?.fields?.name?.value || record?.fields?.title?.value || record?.recordName || 'Group';
}

export default function PersonGroups() {
  const [groups, setGroups] = useState([]);
  const [relations, setRelations] = useState([]);
  const [persons, setPersons] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [values, setValues] = useState({});
  const [personId, setPersonId] = useState('');
  const [saving, setSaving] = useState(false);

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
  }, [activeId]);

  useEffect(() => { reload(); }, [reload]);
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
  };

  const create = async () => {
    const db = getLocalDatabase();
    const rec = { recordName: uuid('grp'), recordType: 'PersonGroup', fields: { name: { value: 'New Group', type: 'STRING' } } };
    await db.saveRecord(rec);
    await logRecordCreated(rec);
    await reload();
    setActiveId(rec.recordName);
  };

  const addMember = async () => {
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
    const db = getLocalDatabase();
    await db.deleteRecord(rel.recordName);
    await logRecordDeleted(rel.recordName, 'PersonGroupRelation');
    await reload();
  };

  const detail = active ? (
    <div className="p-5 max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-semibold">{groupName(active)}</h2>
        <button onClick={save} disabled={saving} className="ms-auto bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-semibold">{saving ? 'Saving...' : 'Save'}</button>
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
              <button onClick={() => removeMember(rel)} className="text-xs text-destructive">Remove</button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="bg-background border border-border rounded-md px-2 py-1.5 text-sm">
            <option value="">Select person...</option>
            {persons.map(({ rec, summary }) => <option key={rec.recordName} value={rec.recordName}>{summary.fullName}</option>)}
          </select>
          <button onClick={addMember} className="bg-secondary border border-border rounded-md px-3 py-1.5 text-xs">Add</button>
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
        <MasterDetailList items={groups} activeId={activeId} onPick={setActiveId} renderRow={(g) => <div className="text-sm">{groupName(g)}</div>} placeholder="Search groups..." detail={detail} />
      </div>
    </div>
  );
}
