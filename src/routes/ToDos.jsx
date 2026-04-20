import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { saveWithChangeLog, logRecordCreated, logRecordDeleted } from '../lib/changeLog.js';
import { readRef, writeRef } from '../lib/schema.js';
import { personSummary, sourceSummary, placeSummary } from '../models/index.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow, editorInput, editorTextarea } from '../components/editors/FieldRow.jsx';
import { ToDoWizardSheet } from '../components/ToDoWizardSheet.jsx';

const TARGET_TYPES = ['Person', 'Family', 'Source', 'Place', 'PersonEvent', 'FamilyEvent', 'MediaPicture', 'MediaPDF', 'MediaURL'];

function uuid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function todoTitle(record) {
  return record?.fields?.title?.value || record?.fields?.name?.value || record?.recordName || 'ToDo';
}

function targetLabel(record) {
  if (!record) return '';
  if (record.recordType === 'Person') return personSummary(record)?.fullName || record.recordName;
  if (record.recordType === 'Source') return sourceSummary(record)?.title || record.recordName;
  if (record.recordType === 'Place') return placeSummary(record)?.displayName || record.recordName;
  return record.fields?.title?.value || record.fields?.cached_familyName?.value || record.fields?.eventType?.value || record.recordName;
}

export default function ToDos() {
  const [todos, setTodos] = useState([]);
  const [relations, setRelations] = useState([]);
  const [targetsByType, setTargetsByType] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [values, setValues] = useState({});
  const [targetType, setTargetType] = useState('Person');
  const [targetId, setTargetId] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const reload = useCallback(async () => {
    const db = getLocalDatabase();
    const [todoRows, relRows, ...targetRows] = await Promise.all([
      db.query('ToDo', { limit: 100000 }),
      db.query('ToDoRelation', { limit: 100000 }),
      ...TARGET_TYPES.map((type) => db.query(type, { limit: 100000 })),
    ]);
    const sorted = todoRows.records.sort((a, b) => todoTitle(a).localeCompare(todoTitle(b)));
    setTodos(sorted);
    setRelations(relRows.records);
    const nextTargets = {};
    TARGET_TYPES.forEach((type, index) => {
      nextTargets[type] = targetRows[index].records.sort((a, b) => targetLabel(a).localeCompare(targetLabel(b)));
    });
    setTargetsByType(nextTargets);
    if (!activeId && sorted.length) setActiveId(sorted[0].recordName);
  }, [activeId]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const todo = todos.find((r) => r.recordName === activeId);
    if (!todo) return;
    setValues({
      title: todo.fields?.title?.value || '',
      status: todo.fields?.status?.value || 'Open',
      priority: todo.fields?.priority?.value || 'Normal',
      dueDate: todo.fields?.dueDate?.value || '',
      description: todo.fields?.description?.value || todo.fields?.text?.value || '',
    });
  }, [activeId, todos]);

  const active = todos.find((r) => r.recordName === activeId);
  const activeRelations = useMemo(() => relations.filter((r) => readRef(r.fields?.todo) === activeId), [relations, activeId]);

  const onCreate = async () => {
    const db = getLocalDatabase();
    const rec = {
      recordName: uuid('todo'),
      recordType: 'ToDo',
      fields: {
        title: { value: 'New ToDo', type: 'STRING' },
        status: { value: 'Open', type: 'STRING' },
        priority: { value: 'Normal', type: 'STRING' },
      },
    };
    await db.saveRecord(rec);
    await logRecordCreated(rec);
    await reload();
    setActiveId(rec.recordName);
  };

  const onDelete = async () => {
    if (!active || !confirm('Delete this ToDo?')) return;
    const db = getLocalDatabase();
    const deleteNames = [active.recordName, ...activeRelations.map((r) => r.recordName)];
    await db.applyRecordTransaction({ deleteRecordNames: deleteNames });
    await logRecordDeleted(active.recordName, 'ToDo');
    setActiveId(null);
    await reload();
  };

  const onSave = async () => {
    if (!active) return;
    setSaving(true);
    const next = { ...active, fields: { ...active.fields } };
    for (const key of ['title', 'status', 'priority', 'dueDate']) {
      const value = values[key];
      if (value) next.fields[key] = { value, type: 'STRING' };
      else delete next.fields[key];
    }
    if (values.description) {
      next.fields.description = { value: values.description, type: 'STRING' };
      next.fields.text = { value: values.description, type: 'STRING' };
    } else {
      delete next.fields.description;
      delete next.fields.text;
    }
    await saveWithChangeLog(next);
    await reload();
    setSaving(false);
    setStatus('Saved');
    setTimeout(() => setStatus(null), 1500);
  };

  const addRelation = async () => {
    if (!activeId || !targetId) return;
    const db = getLocalDatabase();
    const rec = {
      recordName: uuid('tdr'),
      recordType: 'ToDoRelation',
      fields: {
        todo: writeRef(activeId, 'ToDo'),
        target: writeRef(targetId, targetType),
        targetType: { value: targetType, type: 'STRING' },
      },
    };
    await db.saveRecord(rec);
    await logRecordCreated(rec);
    setTargetId('');
    await reload();
  };

  const removeRelation = async (relation) => {
    const db = getLocalDatabase();
    await db.deleteRecord(relation.recordName);
    await logRecordDeleted(relation.recordName, 'ToDoRelation');
    await reload();
  };

  const renderRow = (record) => (
    <div>
      <div className="text-sm text-foreground truncate">{todoTitle(record)}</div>
      <div className="text-xs text-muted-foreground">{record.fields?.status?.value || 'Open'} · {record.fields?.priority?.value || 'Normal'}</div>
    </div>
  );

  const detail = active ? (
    <div className="p-5 max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-semibold">{todoTitle(active)}</h2>
        {status && <span className="ms-auto text-xs text-emerald-500">{status}</span>}
        <button onClick={onDelete} className="ms-auto text-destructive border border-border rounded-md px-3 py-1.5 text-xs hover:bg-destructive/10">Delete</button>
        <button onClick={onSave} disabled={saving} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-60">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label="Title"><input value={values.title || ''} onChange={(e) => setValues({ ...values, title: e.target.value })} style={editorInput} /></FieldRow>
        <FieldRow label="Due date"><input value={values.dueDate || ''} onChange={(e) => setValues({ ...values, dueDate: e.target.value })} style={editorInput} /></FieldRow>
        <FieldRow label="Status">
          <select value={values.status || 'Open'} onChange={(e) => setValues({ ...values, status: e.target.value })} style={editorInput}>
            {['Open', 'InProgress', 'Done', 'Blocked'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Priority">
          <select value={values.priority || 'Normal'} onChange={(e) => setValues({ ...values, priority: e.target.value })} style={editorInput}>
            {['Low', 'Normal', 'High'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </FieldRow>
      </div>
      <FieldRow label="Description">
        <textarea value={values.description || ''} rows={6} onChange={(e) => setValues({ ...values, description: e.target.value })} style={editorTextarea} />
      </FieldRow>

      <section className="mt-6 border border-border rounded-md p-3 bg-card">
        <h3 className="text-sm font-semibold mb-3">Related Entries</h3>
        <div className="space-y-2 mb-3">
          {activeRelations.length === 0 ? <div className="text-sm text-muted-foreground">No related entries.</div> : activeRelations.map((rel) => {
            const type = rel.fields?.targetType?.value || '';
            const id = readRef(rel.fields?.target);
            const target = (targetsByType[type] || []).find((r) => r.recordName === id);
            return (
              <div key={rel.recordName} className="flex items-center gap-2 bg-secondary/40 rounded-md p-2">
                <span className="text-xs text-muted-foreground w-24">{type || 'Record'}</span>
                <span className="text-sm flex-1 truncate">{targetLabel(target) || id}</span>
                <button onClick={() => removeRelation(rel)} className="text-xs text-destructive">Remove</button>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-[140px_1fr_auto] gap-2">
          <select value={targetType} onChange={(e) => { setTargetType(e.target.value); setTargetId(''); }} className="bg-background border border-border rounded-md px-2 py-1.5 text-sm">
            {TARGET_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="bg-background border border-border rounded-md px-2 py-1.5 text-sm">
            <option value="">Select target...</option>
            {(targetsByType[targetType] || []).map((target) => <option key={target.recordName} value={target.recordName}>{targetLabel(target)}</option>)}
          </select>
          <button onClick={addRelation} className="bg-secondary border border-border rounded-md px-3 py-1.5 text-xs">Add</button>
        </div>
      </section>
    </div>
  ) : <div className="p-10 text-muted-foreground">No ToDo selected.</div>;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">ToDos</h1>
        <span className="text-xs text-muted-foreground">{todos.length}</span>
        <button onClick={() => setWizardOpen(true)} className="ms-auto border border-border bg-secondary rounded-md px-3 py-1.5 text-xs">
          ToDo Wizard…
        </button>
        <button onClick={onCreate} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold">+ New</button>
      </header>
      <ToDoWizardSheet
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={() => reload()}
      />
      <div className="flex-1 min-h-0">
        <MasterDetailList items={todos} activeId={activeId} onPick={setActiveId} renderRow={renderRow} placeholder="Search todos..." detail={detail} />
      </div>
    </div>
  );
}
