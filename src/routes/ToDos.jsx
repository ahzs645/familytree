import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { saveWithChangeLog, logRecordCreated, logRecordDeleted } from '../lib/changeLog.js';
import { readRef, writeRef } from '../lib/schema.js';
import { personSummary, sourceSummary, placeSummary } from '../models/index.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow, editorInput, editorTextarea } from '../components/editors/FieldRow.jsx';
import { ToDoWizardSheet } from '../components/ToDoWizardSheet.jsx';
import { useModal } from '../contexts/ModalContext.jsx';
import { listCustomTypes, saveCustomType, mergeWithBuiltins } from '../lib/customTypes.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { isRecordLocked } from '../lib/recordLock.js';
import { useUnsavedChanges, stableStringify, useDirtySnapshot } from '../lib/editorState.js';
import { useRecordLock } from '../lib/useRecordLock.js';
import { RecordLockButton } from '../components/editors/RecordLockButton.jsx';

const TARGET_TYPES = ['Person', 'Family', 'Source', 'Place', 'PersonEvent', 'FamilyEvent', 'MediaPicture', 'MediaPDF', 'MediaURL'];
const TODO_TYPE_BUILTINS = [
  { id: 'Research', label: 'Research' },
  { id: 'Verify', label: 'Verify' },
  { id: 'Source', label: 'Source' },
  { id: 'Media', label: 'Media' },
  { id: 'Cleanup', label: 'Cleanup' },
];
const TODO_STATUS_OPTIONS = ['Open', 'InProgress', 'Done', 'Blocked'];
const TODO_PRIORITY_OPTIONS = ['Low', 'Normal', 'High'];
const COMPLETED_STATUSES = new Set(['done', 'completed', 'complete', 'closed']);

function uuid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function todoTitle(record, fallback = 'ToDo') {
  return record?.fields?.title?.value || record?.fields?.name?.value || record?.recordName || fallback;
}

function targetLabel(record) {
  if (!record) return '';
  if (record.recordType === 'Person') return personSummary(record)?.fullName || record.recordName;
  if (record.recordType === 'Source') return sourceSummary(record)?.title || record.recordName;
  if (record.recordType === 'Place') return placeSummary(record)?.displayName || record.recordName;
  return record.fields?.title?.value || record.fields?.cached_familyName?.value || record.fields?.eventType?.value || record.recordName;
}

export default function ToDos() {
  const modal = useModal();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const queryTodoId = searchParams.get('todoId');
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
  const [todoTypes, setTodoTypes] = useState(TODO_TYPE_BUILTINS);
  const baselineRef = React.useRef(null);

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
    if (!sorted.some((record) => record.recordName === activeId)) setActiveId(sorted[0]?.recordName || null);
  }, [activeId]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (!queryTodoId || todos.length === 0) return;
    if (todos.some((todo) => todo.recordName === queryTodoId)) setActiveId(queryTodoId);
  }, [queryTodoId, todos]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const custom = await listCustomTypes('todo');
      if (!cancelled) setTodoTypes(mergeWithBuiltins(TODO_TYPE_BUILTINS, custom));
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const todo = todos.find((r) => r.recordName === activeId);
    if (!todo) return;
    setValues({
      title: todo.fields?.title?.value || '',
      type: todo.fields?.type?.value || 'Research',
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
        title: { value: t('todosPage.newTitle'), type: 'STRING' },
        type: { value: 'Research', type: 'STRING' },
        status: { value: 'Open', type: 'STRING' },
        priority: { value: 'Normal', type: 'STRING' },
      },
    };
    await db.saveRecord(rec);
    await logRecordCreated(rec);
    await reload();
    setActiveId(rec.recordName);
  };

  const onDeleteCompleted = async () => {
    const completed = todos.filter((todo) => COMPLETED_STATUSES.has(String(todo.fields?.status?.value || '').toLowerCase()));
    if (completed.length === 0) {
      setStatus(t('todosPage.noCompleted'));
      setTimeout(() => setStatus(null), 1800);
      return;
    }
    if (!(await modal.confirm(t('todosPage.deleteCompletedConfirm', { count: completed.length }), {
      title: t('todosPage.deleteCompletedTitle'),
      okLabel: t('todosPage.deleteCompletedOk'),
      destructive: true,
    }))) return;
    const completedIds = new Set(completed.map((todo) => todo.recordName));
    const completedRelations = relations.filter((relation) => completedIds.has(readRef(relation.fields?.todo)));
    const db = getLocalDatabase();
    await db.applyRecordTransaction({
      deleteRecordNames: [...completedIds, ...completedRelations.map((relation) => relation.recordName)],
    });
    for (const todo of completed) await logRecordDeleted(todo.recordName, 'ToDo');
    setStatus(t('todosPage.deletedCompleted', { count: completed.length }));
    if (completedIds.has(activeId)) setActiveId(null);
    await reload();
    setTimeout(() => setStatus(null), 1800);
  };

  const onDelete = async () => {
    if (!active) return;
    if (isRecordLocked(active)) {
      setStatus('Unlock this ToDo before deleting.');
      return;
    }
    if (!(await modal.confirm(t('todosPage.deleteConfirm'), { title: t('todosPage.deleteTitle'), okLabel: t('todosPage.deleteOk'), destructive: true }))) return;
    const db = getLocalDatabase();
    const deleteNames = [active.recordName, ...activeRelations.map((r) => r.recordName)];
    await db.applyRecordTransaction({ deleteRecordNames: deleteNames });
    await logRecordDeleted(active.recordName, 'ToDo');
    setActiveId(null);
    await reload();
  };

  const onSave = async () => {
    if (!active) return;
    if (isRecordLocked(active)) {
      setStatus('Unlock this ToDo before saving.');
      return;
    }
    setSaving(true);
    const next = { ...active, fields: { ...active.fields } };
    for (const key of ['title', 'type', 'status', 'priority', 'dueDate']) {
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
    setStatus(t('todosPage.saved'));
    setTimeout(() => setStatus(null), 1500);
  };

  const addCustomTodoType = async () => {
    const label = await modal.prompt(t('todosPage.addTypePrompt'), '', { title: t('todosPage.addTypeTitle'), placeholder: t('todosPage.addTypePlaceholder') });
    const trimmed = label?.trim();
    if (!trimmed) return;
    const saved = await saveCustomType('todo', { label: trimmed });
    const custom = await listCustomTypes('todo');
    setTodoTypes(mergeWithBuiltins(TODO_TYPE_BUILTINS, custom));
    setValues((prev) => ({ ...prev, type: saved.label }));
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

  const todoTypeLabel = (type) => t(`todosPage.todoType.${type.id || type.label}`, { defaultValue: type.label });
  const statusLabel = (key) => t(`todosPage.status.${key}`, { defaultValue: key });
  const priorityLabel = (key) => t(`todosPage.priority.${key}`, { defaultValue: key });

  const renderRow = (record) => (
    <div>
      <div className="text-sm text-foreground truncate">{todoTitle(record, t('todosPage.fallbackTitle'))}</div>
      <div className="text-xs text-muted-foreground">{statusLabel(record.fields?.status?.value || 'Open')} · {priorityLabel(record.fields?.priority?.value || 'Normal')}</div>
    </div>
  );

  const editableSnapshot = useMemo(() => ({ activeFields: active?.fields || {}, values }), [active, values]);
  useEffect(() => {
    if (!active || saving) return;
    if (baselineRef.current == null || status === t('todosPage.saved') || status === 'Locked' || status === 'Unlocked') baselineRef.current = stableStringify(editableSnapshot);
  }, [active, editableSnapshot, saving, status, t]);
  const dirty = useDirtySnapshot(editableSnapshot, baselineRef.current, !!active && !saving);
  useUnsavedChanges(dirty);
  const onToggleLock = useRecordLock({
    record: active,
    setRecord: (next) => setTodos((rows) => rows.map((row) => row.recordName === next.recordName ? next : row)),
    setSaving,
    setStatus,
    reload,
  });

  const detail = active ? (
    <div className="p-5 max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-semibold">{todoTitle(active, t('todosPage.fallbackTitle'))}</h2>
        {status && <span className="ms-auto text-xs text-emerald-500">{status}</span>}
        <RecordLockButton record={active} saving={saving} onToggle={onToggleLock} />
        <button onClick={onDelete} disabled={isRecordLocked(active)} className="ms-auto text-destructive border border-border rounded-md px-3 py-1.5 text-xs hover:bg-destructive/10 disabled:opacity-50">{t('todosPage.delete')}</button>
        <button onClick={onSave} disabled={saving || isRecordLocked(active)} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-60">
          {saving ? t('todosPage.saving') : t('todosPage.save')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label={t('todosPage.field.title')}><input value={values.title || ''} onChange={(e) => setValues({ ...values, title: e.target.value })} style={editorInput} /></FieldRow>
        <FieldRow label={t('todosPage.field.dueDate')}><input value={values.dueDate || ''} onChange={(e) => setValues({ ...values, dueDate: e.target.value })} style={editorInput} /></FieldRow>
        <FieldRow label={t('todosPage.field.type')}>
          <div className="flex gap-2">
            <select value={values.type || 'Research'} onChange={(e) => setValues({ ...values, type: e.target.value })} style={editorInput}>
              {todoTypes.map((type) => <option key={type.id || type.label} value={type.label}>{todoTypeLabel(type)}</option>)}
            </select>
            <button type="button" onClick={addCustomTodoType} className="bg-secondary border border-border rounded-md px-2.5 py-1.5 text-xs whitespace-nowrap">{t('todosPage.addType')}</button>
          </div>
        </FieldRow>
        <FieldRow label={t('todosPage.field.status')}>
          <select value={values.status || 'Open'} onChange={(e) => setValues({ ...values, status: e.target.value })} style={editorInput}>
            {TODO_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </FieldRow>
        <FieldRow label={t('todosPage.field.priority')}>
          <select value={values.priority || 'Normal'} onChange={(e) => setValues({ ...values, priority: e.target.value })} style={editorInput}>
            {TODO_PRIORITY_OPTIONS.map((s) => <option key={s} value={s}>{priorityLabel(s)}</option>)}
          </select>
        </FieldRow>
      </div>
      <FieldRow label={t('todosPage.field.description')}>
        <textarea value={values.description || ''} rows={6} onChange={(e) => setValues({ ...values, description: e.target.value })} style={editorTextarea} />
      </FieldRow>

      <section className="mt-6 border border-border rounded-md p-3 bg-card">
        <h3 className="text-sm font-semibold mb-3">{t('todosPage.relatedEntries')}</h3>
        <div className="space-y-2 mb-3">
          {activeRelations.length === 0 ? <div className="text-sm text-muted-foreground">{t('todosPage.noRelatedEntries')}</div> : activeRelations.map((rel) => {
            const type = rel.fields?.targetType?.value || '';
            const id = readRef(rel.fields?.target);
            const target = (targetsByType[type] || []).find((r) => r.recordName === id);
            return (
              <div key={rel.recordName} className="flex items-center gap-2 bg-secondary/40 rounded-md p-2">
                <span className="text-xs text-muted-foreground w-24">{type || t('todosPage.recordType')}</span>
                <span className="text-sm flex-1 truncate">{targetLabel(target) || id}</span>
                <button onClick={() => removeRelation(rel)} className="text-xs text-destructive">{t('todosPage.removeRelation')}</button>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-[140px_1fr_auto] gap-2">
          <select value={targetType} onChange={(e) => { setTargetType(e.target.value); setTargetId(''); }} className="bg-background border border-border rounded-md px-2 py-1.5 text-sm">
            {TARGET_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="bg-background border border-border rounded-md px-2 py-1.5 text-sm">
            <option value="">{t('todosPage.selectTarget')}</option>
            {(targetsByType[targetType] || []).map((target) => <option key={target.recordName} value={target.recordName}>{targetLabel(target)}</option>)}
          </select>
          <button onClick={addRelation} className="bg-secondary border border-border rounded-md px-3 py-1.5 text-xs">{t('todosPage.addRelation')}</button>
        </div>
      </section>
    </div>
  ) : <div className="p-10 text-muted-foreground">{t('todosPage.noTodoSelected')}</div>;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">{t('todosPage.title')}</h1>
        <span className="text-xs text-muted-foreground">{todos.length}</span>
        {status && <span className="text-xs text-muted-foreground">{status}</span>}
        <button onClick={onDeleteCompleted} className="ms-auto border border-border bg-secondary rounded-md px-3 py-1.5 text-xs">
          {t('todosPage.deleteCompleted')}
        </button>
        <button onClick={() => setWizardOpen(true)} className="border border-border bg-secondary rounded-md px-3 py-1.5 text-xs">
          {t('todosPage.wizardButton')}
        </button>
        <button onClick={onCreate} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold">{t('todosPage.newButton')}</button>
      </header>
      <ToDoWizardSheet
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={() => reload()}
      />
      <div className="flex-1 min-h-0">
        <MasterDetailList items={todos} activeId={activeId} onPick={setActiveId} renderRow={renderRow} placeholder={t('todosPage.searchPlaceholder')} detail={detail} />
      </div>
    </div>
  );
}
