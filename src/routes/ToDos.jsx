import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';
import { getAppDataClient } from '../lib/data/AppDataClient.js';
import { generateId } from '../lib/ids.js';
import { logRecordDeleted } from '../lib/changeLog.js';
import { readRef, writeRef } from '../lib/schema.js';
import { applyValuesToRecord, createWithChangeLog, deleteWithChangeLog, stringField } from '../lib/recordWrite.js';
import { personSummary, sourceSummary, placeSummary } from '../models/index.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow } from '../components/editors/FieldRow.jsx';
import { formClasses } from '../components/ui/formClasses.js';
import { DatePicker } from '../components/ui/DatePicker.jsx';
import { ToDoWizardSheet } from '../components/ToDoWizardSheet.jsx';
import { useModal } from '../contexts/ModalContext.jsx';
import { listCustomTypes, saveCustomType, mergeWithBuiltins, TODO_STATUS_BUILTINS, TODO_PRIORITY_BUILTINS } from '../lib/customTypes.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { isRecordLocked } from '../lib/recordLock.js';
import { SaveStatus } from '../components/editors/SaveStatus.jsx';
import { RecordLockButton } from '../components/editors/RecordLockButton.jsx';
import { useRecordEditor } from '../components/editors/useRecordEditor.js';
import { useRecords } from '../lib/data/useRecords.js';
import { useListSelection } from '../components/lists/useListSelection.js';
import { RecordBulkBar } from '../components/lists/RecordBulkBar.jsx';

const TARGET_TYPES = ['Person', 'Family', 'Source', 'Place', 'PersonEvent', 'FamilyEvent', 'MediaPicture', 'MediaPDF', 'MediaURL'];
const TODO_FIELDS = ['title', 'type', 'status', 'priority', 'dueDate'];
const TODO_TYPE_BUILTINS = [
  { id: 'Research', label: 'Research' },
  { id: 'Verify', label: 'Verify' },
  { id: 'Source', label: 'Source' },
  { id: 'Media', label: 'Media' },
  { id: 'Cleanup', label: 'Cleanup' },
];
const COMPLETED_STATUSES = new Set(['done', 'completed', 'complete', 'closed']);

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

function toTodoValues(record) {
  return {
    title: record.fields?.title?.value || '',
    type: record.fields?.type?.value || 'Research',
    status: record.fields?.status?.value || 'Open',
    priority: record.fields?.priority?.value || 'Normal',
    dueDate: record.fields?.dueDate?.value || '',
    description: record.fields?.description?.value || record.fields?.text?.value || '',
  };
}

function applyTodoValues(record, values) {
  const next = applyValuesToRecord(record, values, { fields: TODO_FIELDS });
  const description = stringField(values.description);
  if (description) {
    next.fields.description = description;
    next.fields.text = { ...description };
  } else {
    delete next.fields.description;
    delete next.fields.text;
  }
  return next;
}

export default function ToDos() {
  const modal = useModal();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const queryTodoId = searchParams.get('todoId');
  const {
    rows: todos, active, activeId, setActiveId, values, setValues,
    dirty, saving, status, setStatus, flashStatus, onCreate, onSave: saveTodo, onToggleLock,
  } = useRecordEditor({
    recordType: 'ToDo',
    noun: 'ToDo',
    idPrefix: 'todo',
    fields: TODO_FIELDS,
    labelOf: todoTitle,
    createValues: () => ({ title: t('todosPage.newTitle'), type: 'Research', status: 'Open', priority: 'Normal' }),
    toValues: toTodoValues,
    applyValues: applyTodoValues,
    savedMessage: t('todosPage.saved'),
  });
  const { records: relations } = useRecords('ToDoRelation');
  const [targetType, setTargetType] = useState('Person');
  const [targetId, setTargetId] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [todoTypes, setTodoTypes] = useState(TODO_TYPE_BUILTINS);
  const [todoStatuses, setTodoStatuses] = useState(TODO_STATUS_BUILTINS);
  const [todoPriorities, setTodoPriorities] = useState(TODO_PRIORITY_BUILTINS);

  const targetRecords = {
    Person: useRecords('Person').records,
    Family: useRecords('Family').records,
    Source: useRecords('Source').records,
    Place: useRecords('Place').records,
    PersonEvent: useRecords('PersonEvent').records,
    FamilyEvent: useRecords('FamilyEvent').records,
    MediaPicture: useRecords('MediaPicture').records,
    MediaPDF: useRecords('MediaPDF').records,
    MediaURL: useRecords('MediaURL').records,
  };
  const targetsByType = useMemo(() => {
    const next = {};
    for (const type of TARGET_TYPES) {
      next[type] = [...targetRecords[type]].sort((a, b) => targetLabel(a).localeCompare(targetLabel(b)));
    }
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, TARGET_TYPES.map((type) => targetRecords[type]));

  const todoIds = useMemo(() => todos.map((todo) => todo.recordName), [todos]);
  const selection = useListSelection(todoIds);

  const bulkDeleteTodos = async (ids) => {
    const idSet = new Set(ids);
    const ownedRelations = relations.filter((relation) => idSet.has(readRef(relation.fields?.todo)));
    await getAppDataClient().records.transaction({
      deleteRecordNames: [...ids, ...ownedRelations.map((relation) => relation.recordName)],
    });
    for (const id of ids) await logRecordDeleted(id, 'ToDo');
  };

  useEffect(() => {
    if (!queryTodoId || todos.length === 0) return;
    if (todos.some((todo) => todo.recordName === queryTodoId)) setActiveId(queryTodoId);
  }, [queryTodoId, todos, setActiveId]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [customTypes, customStatuses, customPriorities] = await Promise.all([
        listCustomTypes('todo'),
        listCustomTypes('todoStatus'),
        listCustomTypes('todoPriority'),
      ]);
      if (cancelled) return;
      setTodoTypes(mergeWithBuiltins(TODO_TYPE_BUILTINS, customTypes));
      setTodoStatuses(mergeWithBuiltins(TODO_STATUS_BUILTINS, customStatuses));
      setTodoPriorities(mergeWithBuiltins(TODO_PRIORITY_BUILTINS, customPriorities));
    })();
    return () => { cancelled = true; };
  }, []);

  const activeRelations = useMemo(() => relations.filter((r) => readRef(r.fields?.todo) === activeId), [relations, activeId]);

  const onSave = useCallback(async () => {
    const savable = !!active && !isRecordLocked(active);
    await saveTodo();
    if (savable) flashStatus(t('todosPage.saved'));
  }, [active, saveTodo, flashStatus, t]);

  const onDeleteCompleted = async () => {
    const completed = todos.filter((todo) => COMPLETED_STATUSES.has(String(todo.fields?.status?.value || '').toLowerCase()));
    if (completed.length === 0) {
      flashStatus(t('todosPage.noCompleted'));
      return;
    }
    if (!(await modal.confirm(t('todosPage.deleteCompletedConfirm', { count: completed.length }), {
      title: t('todosPage.deleteCompletedTitle'),
      okLabel: t('todosPage.deleteCompletedOk'),
      destructive: true,
    }))) return;
    const completedIds = new Set(completed.map((todo) => todo.recordName));
    const completedRelations = relations.filter((relation) => completedIds.has(readRef(relation.fields?.todo)));
    await getAppDataClient().records.transaction({
      deleteRecordNames: [...completedIds, ...completedRelations.map((relation) => relation.recordName)],
    });
    for (const todo of completed) await logRecordDeleted(todo.recordName, 'ToDo');
    flashStatus(t('todosPage.deletedCompleted', { count: completed.length }));
  };

  const onDelete = async () => {
    if (!active) return;
    if (isRecordLocked(active)) {
      setStatus('Unlock this ToDo before deleting.');
      return;
    }
    if (!(await modal.confirm(t('todosPage.deleteConfirm'), { title: t('todosPage.deleteTitle'), okLabel: t('todosPage.deleteOk'), destructive: true }))) return;
    await getAppDataClient().records.transaction({
      deleteRecordNames: [active.recordName, ...activeRelations.map((r) => r.recordName)],
    });
    await logRecordDeleted(active.recordName, 'ToDo');
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

  const addCustomTodoStatus = async () => {
    const label = await modal.prompt(t('todosPage.addStatusPrompt', { defaultValue: 'New status label' }), '', { title: t('todosPage.addStatusTitle', { defaultValue: 'Add ToDo status' }) });
    const trimmed = label?.trim();
    if (!trimmed) return;
    const saved = await saveCustomType('todoStatus', { label: trimmed });
    const custom = await listCustomTypes('todoStatus');
    setTodoStatuses(mergeWithBuiltins(TODO_STATUS_BUILTINS, custom));
    setValues((prev) => ({ ...prev, status: saved.id || saved.label }));
  };

  const addCustomTodoPriority = async () => {
    const label = await modal.prompt(t('todosPage.addPriorityPrompt', { defaultValue: 'New priority label' }), '', { title: t('todosPage.addPriorityTitle', { defaultValue: 'Add ToDo priority' }) });
    const trimmed = label?.trim();
    if (!trimmed) return;
    const saved = await saveCustomType('todoPriority', { label: trimmed });
    const custom = await listCustomTypes('todoPriority');
    setTodoPriorities(mergeWithBuiltins(TODO_PRIORITY_BUILTINS, custom));
    setValues((prev) => ({ ...prev, priority: saved.id || saved.label }));
  };

  const addRelation = async () => {
    if (!activeId || !targetId) return;
    await createWithChangeLog({
      recordName: generateId('tdr'),
      recordType: 'ToDoRelation',
      fields: {
        todo: writeRef(activeId, 'ToDo'),
        target: writeRef(targetId, targetType),
        targetType: { value: targetType, type: 'STRING' },
      },
    });
    setTargetId('');
  };

  const removeRelation = async (relation) => {
    await deleteWithChangeLog(relation.recordName, 'ToDoRelation');
  };

  const todoTypeLabel = (type) => t(`todosPage.todoType.${type.id || type.label}`, { defaultValue: type.label });
  // Resolve either a raw stored value (e.g. 'InProgress' from renderRow) or a
  // catalog entry object ({ id, label }) to a display label, preferring the
  // catalog label for built-ins/custom entries and falling back to the locale.
  const catalogLabel = (catalog, ns) => (entry) => {
    const key = typeof entry === 'object' ? (entry.id || entry.label) : entry;
    const match = typeof entry === 'object' ? entry : catalog.find((item) => (item.id || item.label) === entry);
    return t(`todosPage.${ns}.${key}`, { defaultValue: match?.label || key });
  };
  const statusLabel = catalogLabel(todoStatuses, 'status');
  const priorityLabel = catalogLabel(todoPriorities, 'priority');

  const renderRow = (record) => (
    <div>
      <div className="text-sm text-foreground truncate">{todoTitle(record, t('todosPage.fallbackTitle'))}</div>
      <div className="text-xs text-muted-foreground">{statusLabel(record.fields?.status?.value || 'Open')} · {priorityLabel(record.fields?.priority?.value || 'Normal')}</div>
    </div>
  );

  const detail = active ? (
    <div className="max-w-3xl p-3 xl:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 flex-1 basis-full break-words text-base font-semibold xl:basis-auto">{todoTitle(active, t('todosPage.fallbackTitle'))}</h2>
        <span className="xl:ms-auto"><SaveStatus status={status} dirty={dirty} /></span>
        <RecordLockButton record={active} saving={saving} onToggle={onToggleLock} />
        <button onClick={onDelete} disabled={isRecordLocked(active)} className="text-destructive-text border border-border rounded-md px-3 py-1.5 text-xs hover:bg-destructive/10 disabled:opacity-50">{t('todosPage.delete')}</button>
        <Button variant="primary" size="md" onClick={onSave} disabled={saving || isRecordLocked(active) || !dirty} title="Save (⌘/Ctrl+S)">
          {saving ? t('todosPage.saving') : t('todosPage.save')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <FieldRow label={t('todosPage.field.title')}><input value={values.title || ''} onChange={(e) => setValues({ ...values, title: e.target.value })} className={formClasses.input} /></FieldRow>
        <FieldRow label={t('todosPage.field.dueDate')}>
          <DatePicker
            value={values.dueDate || ''}
            onChange={(value) => setValues({ ...values, dueDate: value })}
            placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
          />
        </FieldRow>
        <FieldRow label={t('todosPage.field.type')}>
          <div className="flex min-w-0 flex-wrap gap-2">
            <select value={values.type || 'Research'} onChange={(e) => setValues({ ...values, type: e.target.value })} className={`${formClasses.input} min-w-0 flex-1`}>
              {todoTypes.map((type) => <option key={type.id || type.label} value={type.label}>{todoTypeLabel(type)}</option>)}
            </select>
            <button type="button" onClick={addCustomTodoType} className="bg-secondary border border-border rounded-md px-2.5 py-1.5 text-xs whitespace-nowrap">{t('todosPage.addType')}</button>
          </div>
        </FieldRow>
        <FieldRow label={t('todosPage.field.status')}>
          <div className="flex min-w-0 flex-wrap gap-2">
            <select value={values.status || 'Open'} onChange={(e) => setValues({ ...values, status: e.target.value })} className={`${formClasses.input} min-w-0 flex-1`}>
              {todoStatuses.map((s) => <option key={s.id || s.label} value={s.id || s.label}>{statusLabel(s)}</option>)}
            </select>
            <button type="button" onClick={addCustomTodoStatus} className="bg-secondary border border-border rounded-md px-2.5 py-1.5 text-xs whitespace-nowrap">{t('todosPage.addType')}</button>
          </div>
        </FieldRow>
        <FieldRow label={t('todosPage.field.priority')}>
          <div className="flex min-w-0 flex-wrap gap-2">
            <select value={values.priority || 'Normal'} onChange={(e) => setValues({ ...values, priority: e.target.value })} className={`${formClasses.input} min-w-0 flex-1`}>
              {todoPriorities.map((s) => <option key={s.id || s.label} value={s.id || s.label}>{priorityLabel(s)}</option>)}
            </select>
            <button type="button" onClick={addCustomTodoPriority} className="bg-secondary border border-border rounded-md px-2.5 py-1.5 text-xs whitespace-nowrap">{t('todosPage.addType')}</button>
          </div>
        </FieldRow>
      </div>
      <FieldRow label={t('todosPage.field.description')}>
        <textarea value={values.description || ''} rows={6} onChange={(e) => setValues({ ...values, description: e.target.value })} className={formClasses.textarea} />
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
                <button onClick={() => removeRelation(rel)} className="text-xs text-destructive-text">{t('todosPage.removeRelation')}</button>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-[140px_minmax(0,1fr)_auto]">
          <select aria-label={t('todosPage.relationType', { defaultValue: 'Record type' })} value={targetType} onChange={(e) => { setTargetType(e.target.value); setTargetId(''); }} className="min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-sm">
            {TARGET_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select aria-label={t('todosPage.selectTarget')} value={targetId} onChange={(e) => setTargetId(e.target.value)} className="min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-sm">
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
      <header className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h2 className="text-base font-semibold">{t('todosPage.title')}</h2>
        <span className="text-xs text-muted-foreground">{todos.length}</span>
        {status && <span className="text-xs text-muted-foreground">{status}</span>}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <button onClick={onDeleteCompleted} className="border border-border bg-secondary rounded-md px-3 py-1.5 text-xs">
            {t('todosPage.deleteCompleted')}
          </button>
          <button onClick={() => setWizardOpen(true)} className="border border-border bg-secondary rounded-md px-3 py-1.5 text-xs">
            {t('todosPage.wizardButton')}
          </button>
          <Button variant="primary" size="sm" onClick={onCreate}>{t('todosPage.newButton')}</Button>
        </div>
      </header>
      <ToDoWizardSheet
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />
      <div className="flex-1 min-h-0">
        <MasterDetailList
          items={todos}
          activeId={activeId}
          onPick={setActiveId}
          renderRow={renderRow}
          placeholder={t('todosPage.searchPlaceholder')}
          detail={detail}
          selection={selection}
          bulkBar={(
            <RecordBulkBar
              selection={selection}
              recordType="ToDo"
              onDelete={bulkDeleteTodos}
            />
          )}
        />
      </div>
    </div>
  );
}
