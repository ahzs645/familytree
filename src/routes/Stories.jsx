import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';
import { generateId } from '../lib/ids.js';
import { saveWithChangeLog } from '../lib/changeLog.js';
import { createWithChangeLog, deleteWithChangeLog } from '../lib/recordWrite.js';
import { readRef, writeRef } from '../lib/schema.js';
import { personSummary } from '../models/index.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow } from '../components/editors/FieldRow.jsx';
import { formClasses } from '../components/ui/formClasses.js';
import { DatePicker } from '../components/ui/DatePicker.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { useModal } from '../contexts/ModalContext.jsx';
import { isRecordLocked } from '../lib/recordLock.js';
import { SaveStatus } from '../components/editors/SaveStatus.jsx';
import { RecordLockButton } from '../components/editors/RecordLockButton.jsx';
import { useRecordEditor } from '../components/editors/useRecordEditor.js';
import { useRecords } from '../lib/data/useRecords.js';

const TARGET_TYPES = ['Person', 'Family', 'PersonEvent', 'FamilyEvent', 'MediaPicture', 'MediaPDF', 'MediaURL'];
const STORY_FIELDS = ['title', 'subtitle', 'author', 'date', 'text'];

function storyTitle(record, fallback = 'Story') {
  return record?.fields?.title?.value || record?.fields?.name?.value || record?.recordName || fallback;
}

function targetLabel(record) {
  if (!record) return '';
  if (record.recordType === 'Person') return personSummary(record)?.fullName || record.recordName;
  return record.fields?.title?.value || record.fields?.cached_familyName?.value || record.fields?.eventType?.value || record.recordName;
}

function useSortedTargets(type) {
  const { records } = useRecords(type);
  return useMemo(() => [...records].sort((a, b) => targetLabel(a).localeCompare(targetLabel(b))), [records]);
}

export default function Stories() {
  const { t } = useTranslation();
  const modal = useModal();
  const [searchParams] = useSearchParams();
  const queryStoryId = searchParams.get('storyId');
  const {
    rows: stories, active, activeId, setActiveId, values, setValues,
    dirty, saving, status, setStatus, onCreate, onSave, onToggleLock,
  } = useRecordEditor({
    recordType: 'Story',
    noun: 'story',
    idPrefix: 'story',
    fields: STORY_FIELDS,
    labelOf: storyTitle,
    createValues: () => ({ title: t('stories.newTitle') }),
  });
  const { records: sectionRecords } = useRecords('StorySection');
  const { records: relationRecords } = useRecords('StoryRelation');
  const targetsByType = {
    Person: useSortedTargets('Person'),
    Family: useSortedTargets('Family'),
    PersonEvent: useSortedTargets('PersonEvent'),
    FamilyEvent: useSortedTargets('FamilyEvent'),
    MediaPicture: useSortedTargets('MediaPicture'),
    MediaPDF: useSortedTargets('MediaPDF'),
    MediaURL: useSortedTargets('MediaURL'),
  };
  const [targetType, setTargetType] = useState('Person');
  const [targetId, setTargetId] = useState('');

  useEffect(() => {
    if (!queryStoryId || stories.length === 0) return;
    if (stories.some((story) => story.recordName === queryStoryId)) setActiveId(queryStoryId);
  }, [queryStoryId, stories, setActiveId]);

  const storySections = useMemo(
    () => sectionRecords.filter((s) => readRef(s.fields?.story) === activeId).sort((a, b) => (a.fields?.order?.value || 0) - (b.fields?.order?.value || 0)),
    [sectionRecords, activeId],
  );
  const storyRelations = useMemo(
    () => relationRecords.filter((r) => readRef(r.fields?.story) === activeId),
    [relationRecords, activeId],
  );

  const onDelete = async () => {
    if (!active) return;
    if (isRecordLocked(active)) {
      setStatus('Unlock this story before deleting.');
      return;
    }
    if (!(await modal.confirm(t('stories.deleteConfirm'), { title: t('stories.deleteTitle'), okLabel: t('stories.deleteOk'), destructive: true }))) return;
    for (const section of storySections) await deleteWithChangeLog(section.recordName, 'StorySection');
    for (const relation of storyRelations) await deleteWithChangeLog(relation.recordName, 'StoryRelation');
    await deleteWithChangeLog(active.recordName, 'Story');
  };

  const addSection = async () => {
    if (isRecordLocked(active)) {
      setStatus('Unlock this story before editing sections.');
      return;
    }
    if (!activeId) return;
    await createWithChangeLog({
      recordName: generateId('section'),
      recordType: 'StorySection',
      fields: {
        story: writeRef(activeId, 'Story'),
        title: { value: t('stories.newSection'), type: 'STRING' },
        text: { value: '', type: 'STRING' },
        order: { value: storySections.length, type: 'NUMBER' },
      },
    });
  };

  const updateSection = async (section, patch) => {
    if (isRecordLocked(active)) {
      setStatus('Unlock this story before editing sections.');
      return;
    }
    const next = { ...section, fields: { ...section.fields } };
    for (const [key, value] of Object.entries(patch)) next.fields[key] = { value, type: key === 'order' ? 'NUMBER' : 'STRING' };
    await saveWithChangeLog(next);
  };

  const deleteSection = async (section) => {
    if (isRecordLocked(active)) {
      setStatus('Unlock this story before editing sections.');
      return;
    }
    await deleteWithChangeLog(section.recordName, 'StorySection');
  };

  const addRelation = async () => {
    if (isRecordLocked(active)) {
      setStatus('Unlock this story before editing relations.');
      return;
    }
    if (!activeId || !targetId) return;
    await createWithChangeLog({
      recordName: generateId('str'),
      recordType: 'StoryRelation',
      fields: {
        story: writeRef(activeId, 'Story'),
        target: writeRef(targetId, targetType),
        targetType: { value: targetType, type: 'STRING' },
      },
    });
    setTargetId('');
  };

  const removeRelation = async (relation) => {
    if (isRecordLocked(active)) {
      setStatus('Unlock this story before editing relations.');
      return;
    }
    await deleteWithChangeLog(relation.recordName, 'StoryRelation');
  };

  const detail = active ? (
    <div className="p-5 max-w-4xl">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-semibold">{storyTitle(active, t('stories.fallbackTitle'))}</h2>
        <span className="ms-auto"><SaveStatus status={status} dirty={dirty} /></span>
        <RecordLockButton record={active} saving={saving} onToggle={onToggleLock} />
        <button onClick={onDelete} disabled={isRecordLocked(active)} className="text-destructive border border-border rounded-md px-3 py-1.5 text-xs hover:bg-destructive/10 disabled:opacity-50">{t('stories.delete')}</button>
        <Button variant="primary" size="md" onClick={onSave} disabled={saving || isRecordLocked(active) || !dirty} title="Save (⌘/Ctrl+S)">{saving ? t('stories.saving') : t('stories.save')}</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label={t('stories.field.title')}><input value={values.title || ''} onChange={(e) => setValues({ ...values, title: e.target.value })} className={formClasses.input} /></FieldRow>
        <FieldRow label={t('stories.field.subtitle')}><input value={values.subtitle || ''} onChange={(e) => setValues({ ...values, subtitle: e.target.value })} className={formClasses.input} /></FieldRow>
        <FieldRow label={t('stories.field.author')}><input value={values.author || ''} onChange={(e) => setValues({ ...values, author: e.target.value })} className={formClasses.input} /></FieldRow>
        <FieldRow label={t('stories.field.date')}>
          <DatePicker
            value={values.date || ''}
            onChange={(value) => setValues({ ...values, date: value })}
            placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
          />
        </FieldRow>
      </div>
      <FieldRow label={t('stories.field.text')}><textarea rows={10} value={values.text || ''} onChange={(e) => setValues({ ...values, text: e.target.value })} className={formClasses.textarea} /></FieldRow>

      <section className="mt-6 border border-border rounded-md p-3 bg-card">
        <div className="flex items-center mb-3">
          <h3 className="text-sm font-semibold">{t('stories.sections')} · {storySections.length}</h3>
          <button onClick={addSection} className="ms-auto bg-secondary border border-border rounded-md px-3 py-1.5 text-xs">{t('stories.addSection')}</button>
        </div>
        <div className="space-y-3">
          {storySections.map((section) => (
            <div key={section.recordName} className="bg-secondary/30 rounded-md p-3">
              <div className="flex gap-2 mb-2">
                <input value={section.fields?.title?.value || ''} onChange={(e) => updateSection(section, { title: e.target.value })} className="flex-1 bg-background border border-border rounded-md px-2 py-1.5 text-sm" />
                <button onClick={() => deleteSection(section)} className="text-xs text-destructive">{t('stories.deleteSection')}</button>
              </div>
              <textarea rows={4} value={section.fields?.text?.value || ''} onChange={(e) => updateSection(section, { text: e.target.value })} className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm" />
            </div>
          ))}
          {storySections.length === 0 && <div className="text-sm text-muted-foreground">{t('stories.noSections')}</div>}
        </div>
      </section>

      <section className="mt-6 border border-border rounded-md p-3 bg-card">
        <h3 className="text-sm font-semibold mb-3">{t('stories.relatedEntries')} · {storyRelations.length}</h3>
        <div className="space-y-2 mb-3">
          {storyRelations.map((rel) => {
            const type = rel.fields?.targetType?.value || '';
            const id = readRef(rel.fields?.target);
            const target = (targetsByType[type] || []).find((r) => r.recordName === id);
            return (
              <div key={rel.recordName} className="flex items-center gap-2 bg-secondary/40 rounded-md p-2">
                <span className="text-xs text-muted-foreground w-24">{type || t('stories.recordType')}</span>
                <span className="text-sm flex-1 truncate">{targetLabel(target) || id}</span>
                <button onClick={() => removeRelation(rel)} className="text-xs text-destructive">{t('stories.removeRelation')}</button>
              </div>
            );
          })}
          {storyRelations.length === 0 && <div className="text-sm text-muted-foreground">{t('stories.noRelatedEntries')}</div>}
        </div>
        <div className="grid grid-cols-[140px_1fr_auto] gap-2">
          <select value={targetType} onChange={(e) => { setTargetType(e.target.value); setTargetId(''); }} className="bg-background border border-border rounded-md px-2 py-1.5 text-sm">
            {TARGET_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="bg-background border border-border rounded-md px-2 py-1.5 text-sm">
            <option value="">{t('stories.selectTarget')}</option>
            {(targetsByType[targetType] || []).map((target) => <option key={target.recordName} value={target.recordName}>{targetLabel(target)}</option>)}
          </select>
          <button onClick={addRelation} className="bg-secondary border border-border rounded-md px-3 py-1.5 text-xs">{t('stories.addRelation')}</button>
        </div>
      </section>
    </div>
  ) : <div className="p-10 text-muted-foreground">{t('stories.noStorySelected')}</div>;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">{t('stories.title')}</h1>
        <span className="text-xs text-muted-foreground">{stories.length}</span>
        <Button variant="primary" size="sm" onClick={onCreate} className="ms-auto">{t('stories.newButton')}</Button>
      </header>
      <div className="flex-1 min-h-0">
        <MasterDetailList items={stories} activeId={activeId} onPick={setActiveId} renderRow={(s) => <div className="text-sm">{storyTitle(s, t('stories.fallbackTitle'))}</div>} placeholder={t('stories.searchPlaceholder')} detail={detail} emptyTitle={t('stories.emptyTitle')} emptyHint={t('stories.emptyHint')} />
      </div>
    </div>
  );
}
