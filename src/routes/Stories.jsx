import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { saveWithChangeLog, logRecordCreated, logRecordDeleted } from '../lib/changeLog.js';
import { readRef, writeRef } from '../lib/schema.js';
import { personSummary } from '../models/index.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow, editorInput, editorTextarea } from '../components/editors/FieldRow.jsx';
import { DatePicker } from '../components/ui/DatePicker.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { isRecordLocked } from '../lib/recordLock.js';
import { useDirtyBaseline } from '../lib/editorState.js';
import { useRecordLock } from '../lib/useRecordLock.js';
import { RecordLockButton } from '../components/editors/RecordLockButton.jsx';

const TARGET_TYPES = ['Person', 'Family', 'PersonEvent', 'FamilyEvent', 'MediaPicture', 'MediaPDF', 'MediaURL'];

function uuid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function storyTitle(record, fallback = 'Story') {
  return record?.fields?.title?.value || record?.fields?.name?.value || record?.recordName || fallback;
}

function targetLabel(record) {
  if (!record) return '';
  if (record.recordType === 'Person') return personSummary(record)?.fullName || record.recordName;
  return record.fields?.title?.value || record.fields?.cached_familyName?.value || record.fields?.eventType?.value || record.recordName;
}

export default function Stories() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const queryStoryId = searchParams.get('storyId');
  const [stories, setStories] = useState([]);
  const [sections, setSections] = useState([]);
  const [relations, setRelations] = useState([]);
  const [targetsByType, setTargetsByType] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [values, setValues] = useState({});
  const [targetType, setTargetType] = useState('Person');
  const [targetId, setTargetId] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [loadSeq, setLoadSeq] = useState(0);

  const reload = useCallback(async () => {
    const db = getLocalDatabase();
    const [storyRows, sectionRows, relationRows, ...targetRows] = await Promise.all([
      db.query('Story', { limit: 100000 }),
      db.query('StorySection', { limit: 100000 }),
      db.query('StoryRelation', { limit: 100000 }),
      ...TARGET_TYPES.map((type) => db.query(type, { limit: 100000 })),
    ]);
    const sorted = storyRows.records.sort((a, b) => storyTitle(a).localeCompare(storyTitle(b)));
    setStories(sorted);
    setSections(sectionRows.records);
    setRelations(relationRows.records);
    const nextTargets = {};
    TARGET_TYPES.forEach((type, index) => {
      nextTargets[type] = targetRows[index].records.sort((a, b) => targetLabel(a).localeCompare(targetLabel(b)));
    });
    setTargetsByType(nextTargets);
    if (!activeId && sorted.length) setActiveId(sorted[0].recordName);
    setLoadSeq((n) => n + 1);
  }, [activeId]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (!queryStoryId || stories.length === 0) return;
    if (stories.some((story) => story.recordName === queryStoryId)) setActiveId(queryStoryId);
  }, [queryStoryId, stories]);
  useEffect(() => {
    const story = stories.find((s) => s.recordName === activeId);
    if (!story) return;
    setValues({
      title: story.fields?.title?.value || '',
      subtitle: story.fields?.subtitle?.value || '',
      author: story.fields?.author?.value || '',
      date: story.fields?.date?.value || '',
      text: story.fields?.text?.value || '',
    });
  }, [stories, activeId]);

  const active = stories.find((s) => s.recordName === activeId);
  const storySections = useMemo(() => sections.filter((s) => readRef(s.fields?.story) === activeId).sort((a, b) => (a.fields?.order?.value || 0) - (b.fields?.order?.value || 0)), [sections, activeId]);
  const storyRelations = useMemo(() => relations.filter((r) => readRef(r.fields?.story) === activeId), [relations, activeId]);

  const create = async () => {
    const db = getLocalDatabase();
    const rec = { recordName: uuid('story'), recordType: 'Story', fields: { title: { value: t('stories.newTitle'), type: 'STRING' } } };
    await db.saveRecord(rec);
    await logRecordCreated(rec);
    await reload();
    setActiveId(rec.recordName);
  };

  const save = async () => {
    if (!active) return;
    if (isRecordLocked(active)) {
      setStatus('Unlock this story before saving.');
      return;
    }
    setSaving(true);
    const next = { ...active, fields: { ...active.fields } };
    for (const key of ['title', 'subtitle', 'author', 'date', 'text']) {
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

  const addSection = async () => {
    if (isRecordLocked(active)) {
      setStatus('Unlock this story before editing sections.');
      return;
    }
    if (!activeId) return;
    const db = getLocalDatabase();
    const rec = {
      recordName: uuid('section'),
      recordType: 'StorySection',
      fields: {
        story: writeRef(activeId, 'Story'),
        title: { value: t('stories.newSection'), type: 'STRING' },
        text: { value: '', type: 'STRING' },
        order: { value: storySections.length, type: 'NUMBER' },
      },
    };
    await db.saveRecord(rec);
    await logRecordCreated(rec);
    await reload();
  };

  const updateSection = async (section, patch) => {
    if (isRecordLocked(active)) {
      setStatus('Unlock this story before editing sections.');
      return;
    }
    const next = { ...section, fields: { ...section.fields } };
    for (const [key, value] of Object.entries(patch)) next.fields[key] = { value, type: key === 'order' ? 'NUMBER' : 'STRING' };
    await saveWithChangeLog(next);
    await reload();
  };

  const deleteSection = async (section) => {
    if (isRecordLocked(active)) {
      setStatus('Unlock this story before editing sections.');
      return;
    }
    const db = getLocalDatabase();
    await db.deleteRecord(section.recordName);
    await logRecordDeleted(section.recordName, 'StorySection');
    await reload();
  };

  const addRelation = async () => {
    if (isRecordLocked(active)) {
      setStatus('Unlock this story before editing relations.');
      return;
    }
    if (!activeId || !targetId) return;
    const db = getLocalDatabase();
    const rec = {
      recordName: uuid('str'),
      recordType: 'StoryRelation',
      fields: {
        story: writeRef(activeId, 'Story'),
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
    if (isRecordLocked(active)) {
      setStatus('Unlock this story before editing relations.');
      return;
    }
    const db = getLocalDatabase();
    await db.deleteRecord(relation.recordName);
    await logRecordDeleted(relation.recordName, 'StoryRelation');
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
    setRecord: (next) => setStories((rows) => rows.map((row) => row.recordName === next.recordName ? next : row)),
    setSaving,
    setStatus,
    reload,
  });

  const detail = active ? (
    <div className="p-5 max-w-4xl">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-semibold">{storyTitle(active, t('stories.fallbackTitle'))}</h2>
        {status && <span className="ms-auto text-xs text-emerald-500">{status}</span>}
        <RecordLockButton record={active} saving={saving} onToggle={onToggleLock} />
        <button onClick={save} disabled={saving || isRecordLocked(active)} className="ms-auto bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-60">{saving ? t('stories.saving') : t('stories.save')}</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldRow label={t('stories.field.title')}><input value={values.title || ''} onChange={(e) => setValues({ ...values, title: e.target.value })} style={editorInput} /></FieldRow>
        <FieldRow label={t('stories.field.subtitle')}><input value={values.subtitle || ''} onChange={(e) => setValues({ ...values, subtitle: e.target.value })} style={editorInput} /></FieldRow>
        <FieldRow label={t('stories.field.author')}><input value={values.author || ''} onChange={(e) => setValues({ ...values, author: e.target.value })} style={editorInput} /></FieldRow>
        <FieldRow label={t('stories.field.date')}>
          <DatePicker
            value={values.date || ''}
            onChange={(value) => setValues({ ...values, date: value })}
            placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
          />
        </FieldRow>
      </div>
      <FieldRow label={t('stories.field.text')}><textarea rows={10} value={values.text || ''} onChange={(e) => setValues({ ...values, text: e.target.value })} style={editorTextarea} /></FieldRow>

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
        <button onClick={create} className="ms-auto bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold">{t('stories.newButton')}</button>
      </header>
      <div className="flex-1 min-h-0">
        <MasterDetailList items={stories} activeId={activeId} onPick={setActiveId} renderRow={(s) => <div className="text-sm">{storyTitle(s, t('stories.fallbackTitle'))}</div>} placeholder={t('stories.searchPlaceholder')} detail={detail} emptyTitle={t('stories.emptyTitle')} emptyHint={t('stories.emptyHint')} />
      </div>
    </div>
  );
}
