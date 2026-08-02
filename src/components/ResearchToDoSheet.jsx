import React, { useEffect, useRef, useState } from 'react';
import { Sheet } from './ui/Sheet.jsx';
import { Button } from './ui/Button.jsx';
import { DatePicker } from './ui/DatePicker.jsx';
import { formClasses } from './ui/formClasses.js';
import { createRecordEnvelope, createWithChangeLog } from '../lib/recordWrite.js';
import { writeRef } from '../lib/schema.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

const TYPES = ['Research', 'Verify', 'Source', 'Media', 'Cleanup'];
const PRIORITIES = ['Low', 'Normal', 'High'];
const STATUSES = ['Open', 'InProgress', 'Blocked', 'Done'];

/** Prefilled, editable ToDo form opened from a Research Assistant question. */
export function ResearchToDoSheet({ question, title, text, onClose, onCreated }) {
  const { t } = useTranslation();
  const [values, setValues] = useState({
    title: title || '',
    type: question?.category === 'sources' ? 'Source' : 'Research',
    priority: 'Normal',
    status: 'Open',
    dueDate: '',
    text: text || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const openerRef = useRef(document.activeElement);

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openerRef.current?.focus?.();
    };
  }, [onClose]);

  const set = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const create = async () => {
    if (!values.title.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const todo = createRecordEnvelope('ToDo', 'todo', {
        title: values.title.trim(),
        type: values.type,
        status: values.status,
        priority: values.priority,
        dueDate: values.dueDate,
        description: values.text.trim(),
        text: values.text.trim(),
      });
      const relation = createRecordEnvelope('ToDoRelation', 'tdr');
      relation.fields.todo = writeRef(todo.recordName, 'ToDo');
      relation.fields.target = writeRef(question.personId, 'Person');
      relation.fields.targetType = { value: 'Person', type: 'STRING' };
      await createWithChangeLog(todo);
      await createWithChangeLog(relation);
      onCreated?.(todo);
      onClose?.();
    } catch (cause) {
      setError(t('research.todoFailed', { message: cause?.message || '' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={t('research.todoForm.title')}
      subtitle={t('research.todoForm.subtitle')}
      ariaLabel={t('research.todoForm.title')}
      maxWidth="max-w-lg"
      scroll="card"
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md border border-border px-3 py-1.5 text-xs">{t('common.cancel')}</button>
          <Button variant="primary" size="sm" onClick={create} disabled={busy || !values.title.trim()}>{busy ? t('research.creating') : t('research.createTodo')}</Button>
        </>
      )}
    >
      <label className="block text-xs font-medium" htmlFor="research-todo-title">{t('todosPage.field.title')}</label>
      <input id="research-todo-title" autoFocus value={values.title} onChange={(event) => set('title', event.target.value)} className={formClasses.input} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium">{t('todosPage.field.type')}
          <select value={values.type} onChange={(event) => set('type', event.target.value)} className={`${formClasses.input} mt-1`}>
            {TYPES.map((value) => <option key={value} value={value}>{t(`todosPage.todoType.${value}`)}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium">{t('todosPage.field.priority')}
          <select value={values.priority} onChange={(event) => set('priority', event.target.value)} className={`${formClasses.input} mt-1`}>
            {PRIORITIES.map((value) => <option key={value} value={value}>{t(`todosPage.priority.${value}`)}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium">{t('todosPage.field.status')}
          <select value={values.status} onChange={(event) => set('status', event.target.value)} className={`${formClasses.input} mt-1`}>
            {STATUSES.map((value) => <option key={value} value={value}>{t(`todosPage.status.${value}`)}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium">{t('todosPage.field.dueDate')}
          <DatePicker value={values.dueDate} onChange={(value) => set('dueDate', value)} ariaLabel={t('todosPage.field.dueDate')} className="mt-1" />
        </label>
      </div>
      <label className="block text-xs font-medium" htmlFor="research-todo-text">{t('research.todoForm.text')}</label>
      <textarea id="research-todo-text" value={values.text} onChange={(event) => set('text', event.target.value)} className={formClasses.textarea} />
      {error && <p role="alert" className="text-xs text-destructive-text">{error}</p>}
    </Sheet>
  );
}

export default ResearchToDoSheet;
