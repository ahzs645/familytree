import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { PageTitle } from '../components/ui/PageTitle.jsx';
import { DictationButton } from '../components/ui/DictationButton.jsx';
import { MediaPreview } from '../components/media/MediaPreview.jsx';
import { loadAssetsForMedia } from '../lib/mediaManagement.js';
import { getAppDataClient } from '../lib/data/AppDataClient.js';
import { readConclusionType } from '../lib/schema.js';

const TARGET_TYPES = ['Person', 'Family', 'PersonEvent', 'FamilyEvent', 'Source', 'MediaPicture', 'MediaPDF', 'MediaURL', 'MediaAudio', 'MediaVideo'];
const MEDIA_TYPES = ['MediaPicture', 'MediaPDF', 'MediaURL', 'MediaAudio', 'MediaVideo'];
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
  const [searchParams, setSearchParams] = useSearchParams();
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
  const { records: sectionRelationRecords } = useRecords('StorySectionRelation');
  const targetsByType = {
    Person: useSortedTargets('Person'),
    Family: useSortedTargets('Family'),
    PersonEvent: useSortedTargets('PersonEvent'),
    FamilyEvent: useSortedTargets('FamilyEvent'),
    Source: useSortedTargets('Source'),
    MediaPicture: useSortedTargets('MediaPicture'),
    MediaPDF: useSortedTargets('MediaPDF'),
    MediaURL: useSortedTargets('MediaURL'),
    MediaAudio: useSortedTargets('MediaAudio'),
    MediaVideo: useSortedTargets('MediaVideo'),
  };
  const [targetType, setTargetType] = useState('Person');
  const [targetId, setTargetId] = useState('');
  const [assetsByMedia, setAssetsByMedia] = useState({});
  const [draggedSectionId, setDraggedSectionId] = useState('');
  const eventStoryApplied = useRef(false);

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
  const sectionRelations = useMemo(
    () => sectionRelationRecords.filter((relation) => storySections.some((section) => section.recordName === readRef(relation.fields?.storySection))),
    [sectionRelationRecords, storySections],
  );
  const mediaRecords = useMemo(() => MEDIA_TYPES.flatMap((type) => targetsByType[type] || []), [
    targetsByType.MediaPicture,
    targetsByType.MediaPDF,
    targetsByType.MediaURL,
    targetsByType.MediaAudio,
    targetsByType.MediaVideo,
  ]);

  useEffect(() => {
    let cancelled = false;
    loadAssetsForMedia(mediaRecords).then((loaded) => { if (!cancelled) setAssetsByMedia(loaded); });
    return () => { cancelled = true; };
  }, [mediaRecords]);

  useEffect(() => {
    const eventId = searchParams.get('eventId');
    if (!eventId || searchParams.get('createFromEvent') !== '1' || eventStoryApplied.current) return;
    eventStoryApplied.current = true;
    (async () => {
      const event = await getAppDataClient().records.get(eventId);
      if (!event || !['PersonEvent', 'FamilyEvent'].includes(event.recordType)) {
        setStatus(t('stories.eventMissing'));
        return;
      }
      const eventLabel = readConclusionType(event) || targetLabel(event) || t('stories.eventFallback');
      const story = {
        recordName: generateId('story'),
        recordType: 'Story',
        fields: { title: { value: t('stories.eventStoryTitle', { event: eventLabel }), type: 'STRING' } },
      };
      const section = {
        recordName: generateId('section'),
        recordType: 'StorySection',
        fields: {
          story: writeRef(story.recordName, 'Story'),
          title: { value: eventLabel, type: 'STRING' },
          text: { value: eventSectionText(event), type: 'STRING' },
          order: { value: 0, type: 'NUMBER' },
        },
      };
      const relation = {
        recordName: generateId('str'),
        recordType: 'StoryRelation',
        fields: {
          story: writeRef(story.recordName, 'Story'),
          target: writeRef(event.recordName, event.recordType),
          targetType: { value: event.recordType, type: 'STRING' },
        },
      };
      await createWithChangeLog(story);
      await createWithChangeLog(section);
      await createWithChangeLog(relation);
      setActiveId(story.recordName);
      const next = new URLSearchParams(searchParams);
      next.delete('eventId');
      next.delete('createFromEvent');
      next.set('storyId', story.recordName);
      setSearchParams(next, { replace: true });
    })();
  }, [searchParams, setSearchParams, setActiveId, setStatus, t]);

  const onDelete = async () => {
    if (!active) return;
    if (isRecordLocked(active)) {
      setStatus('Unlock this story before deleting.');
      return;
    }
    if (!(await modal.confirm(t('stories.deleteConfirm'), { title: t('stories.deleteTitle'), okLabel: t('stories.deleteOk'), destructive: true }))) return;
    for (const section of storySections) await deleteWithChangeLog(section.recordName, 'StorySection');
    for (const relation of storyRelations) await deleteWithChangeLog(relation.recordName, 'StoryRelation');
    for (const relation of sectionRelations) await deleteWithChangeLog(relation.recordName, 'StorySectionRelation');
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
    for (const relation of sectionRelations.filter((item) => readRef(item.fields?.storySection) === section.recordName)) {
      await deleteWithChangeLog(relation.recordName, 'StorySectionRelation');
    }
    await deleteWithChangeLog(section.recordName, 'StorySection');
  };

  const reorderSections = async (fromId, toId) => {
    if (!fromId || !toId || fromId === toId || isRecordLocked(active)) return;
    const ordered = [...storySections];
    const from = ordered.findIndex((section) => section.recordName === fromId);
    const to = ordered.findIndex((section) => section.recordName === toId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    for (let index = 0; index < ordered.length; index += 1) {
      if (Number(ordered[index].fields?.order?.value) !== index) await updateSection(ordered[index], { order: index });
    }
  };

  const moveSection = async (section, delta) => {
    const index = storySections.findIndex((item) => item.recordName === section.recordName);
    const target = storySections[index + delta];
    if (target) await reorderSections(section.recordName, target.recordName);
  };

  const addSectionRelation = async (section, target) => {
    if (!activeId || !target || isRecordLocked(active)) return;
    const duplicate = sectionRelations.some((relation) => readRef(relation.fields?.storySection) === section.recordName && readRef(relation.fields?.target) === target.recordName);
    if (duplicate) return;
    await createWithChangeLog({
      recordName: generateId('ssr'),
      recordType: 'StorySectionRelation',
      fields: {
        storySection: writeRef(section.recordName, 'StorySection'),
        target: writeRef(target.recordName, target.recordType),
        targetType: { value: target.recordType, type: 'STRING' },
      },
    });
  };

  const removeSectionRelation = async (relation) => {
    if (isRecordLocked(active)) return;
    await deleteWithChangeLog(relation.recordName, 'StorySectionRelation');
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
    <div className="max-w-4xl p-3 xl:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 flex-1 basis-full break-words text-base font-semibold xl:basis-auto">{storyTitle(active, t('stories.fallbackTitle'))}</h2>
        <span className="xl:ms-auto"><SaveStatus status={status} dirty={dirty} /></span>
        <RecordLockButton record={active} saving={saving} onToggle={onToggleLock} />
        <button onClick={onDelete} disabled={isRecordLocked(active)} className="text-destructive-text border border-border rounded-md px-3 py-1.5 text-xs hover:bg-destructive/10 disabled:opacity-50">{t('stories.delete')}</button>
        <Button variant="primary" size="md" onClick={onSave} disabled={saving || isRecordLocked(active) || !dirty} title="Save (⌘/Ctrl+S)">{saving ? t('stories.saving') : t('stories.save')}</Button>
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
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
      <FieldRow label={t('stories.field.text')}>
        <textarea rows={10} value={values.text || ''} onChange={(e) => setValues({ ...values, text: e.target.value })} className={formClasses.textarea} />
        <div className="mt-1.5 text-end"><DictationButton value={values.text || ''} onChange={(text) => setValues({ ...values, text })} /></div>
      </FieldRow>

      <section className="mt-6 border border-border rounded-md p-3 bg-card">
        <div className="flex items-center mb-3">
          <h3 className="text-sm font-semibold">{t('stories.sections')} · {storySections.length}</h3>
          <button onClick={addSection} className="ms-auto bg-secondary border border-border rounded-md px-3 py-1.5 text-xs">{t('stories.addSection')}</button>
        </div>
        <div className="space-y-3">
          {storySections.map((section, sectionIndex) => {
            const relations = sectionRelations.filter((relation) => readRef(relation.fields?.storySection) === section.recordName);
            const attachedMedia = relations.map((relation) => mediaRecords.find((media) => media.recordName === readRef(relation.fields?.target))).filter(Boolean);
            const attachedSources = relations.map((relation) => targetsByType.Source.find((source) => source.recordName === readRef(relation.fields?.target))).filter(Boolean);
            return (
            <div
              key={section.recordName}
              draggable={!isRecordLocked(active)}
              onDragStart={() => setDraggedSectionId(section.recordName)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => { reorderSections(draggedSectionId, section.recordName); setDraggedSectionId(''); }}
              className="bg-secondary/30 rounded-md p-3"
            >
              <div className="mb-2 flex min-w-0 flex-wrap gap-2">
                <span className="cursor-grab self-center text-muted-foreground" aria-hidden>⋮⋮</span>
                <input aria-label={t('stories.sectionTitle')} value={section.fields?.title?.value || ''} onChange={(e) => updateSection(section, { title: e.target.value })} className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
                <button type="button" onClick={() => moveSection(section, -1)} disabled={sectionIndex === 0} aria-label={t('stories.moveUp')} title={t('stories.moveUp')} className="rounded border border-border px-2 text-xs disabled:opacity-40">↑</button>
                <button type="button" onClick={() => moveSection(section, 1)} disabled={sectionIndex === storySections.length - 1} aria-label={t('stories.moveDown')} title={t('stories.moveDown')} className="rounded border border-border px-2 text-xs disabled:opacity-40">↓</button>
                <button onClick={() => deleteSection(section)} className="text-xs text-destructive-text">{t('stories.deleteSection')}</button>
              </div>
              <textarea aria-label={t('stories.sectionText')} rows={4} value={section.fields?.text?.value || ''} onChange={(e) => updateSection(section, { text: e.target.value })} className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm" />
              <div className="mt-1.5 text-end"><DictationButton value={section.fields?.text?.value || ''} onChange={(text) => updateSection(section, { text })} /></div>

              {attachedMedia.length > 0 && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {attachedMedia.map((media) => {
                    const relation = relations.find((item) => readRef(item.fields?.target) === media.recordName);
                    return (
                      <div key={media.recordName} className="rounded-md border border-border bg-background p-2">
                        <MediaPreview record={media} assets={assetsByMedia[media.recordName] || []} />
                        <div className="mt-1 flex items-center gap-2 text-xs"><span className="min-w-0 flex-1 truncate">{targetLabel(media)}</span><button type="button" onClick={() => removeSectionRelation(relation)} className="text-destructive-text">{t('stories.removeAttachment')}</button></div>
                      </div>
                    );
                  })}
                </div>
              )}
              {attachedSources.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs">
                  {attachedSources.map((source) => {
                    const relation = relations.find((item) => readRef(item.fields?.target) === source.recordName);
                    return <li key={source.recordName} className="flex items-center gap-2 rounded border border-border bg-background px-2 py-1.5"><span className="min-w-0 flex-1 truncate">{targetLabel(source)}</span><button type="button" onClick={() => removeSectionRelation(relation)} className="text-destructive-text">{t('stories.removeSource')}</button></li>;
                  })}
                </ul>
              )}
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-xs text-muted-foreground">{t('stories.attachMedia')}
                  <select defaultValue="" onChange={(event) => { const media = mediaRecords.find((item) => item.recordName === event.target.value); if (media) addSectionRelation(section, media); event.target.value = ''; }} className="min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-sm">
                    <option value="">{t('stories.selectMedia')}</option>
                    {mediaRecords.map((media) => <option key={media.recordName} value={media.recordName}>{targetLabel(media)}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs text-muted-foreground">{t('stories.attachSource')}
                  <select defaultValue="" onChange={(event) => { const source = targetsByType.Source.find((item) => item.recordName === event.target.value); if (source) addSectionRelation(section, source); event.target.value = ''; }} className="min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-sm">
                    <option value="">{t('stories.selectSource')}</option>
                    {targetsByType.Source.map((source) => <option key={source.recordName} value={source.recordName}>{targetLabel(source)}</option>)}
                  </select>
                </label>
              </div>
            </div>
            );
          })}
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
                <button onClick={() => removeRelation(rel)} className="text-xs text-destructive-text">{t('stories.removeRelation')}</button>
              </div>
            );
          })}
          {storyRelations.length === 0 && <div className="text-sm text-muted-foreground">{t('stories.noRelatedEntries')}</div>}
        </div>
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-[140px_minmax(0,1fr)_auto]">
          <select value={targetType} onChange={(e) => { setTargetType(e.target.value); setTargetId(''); }} className="min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-sm">
            {TARGET_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-sm">
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
      <header className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <PageTitle className="text-base font-semibold">{t('stories.title')}</PageTitle>
        <span className="text-xs text-muted-foreground">{stories.length}</span>
        <Button variant="primary" size="sm" onClick={onCreate} className="ms-auto">{t('stories.newButton')}</Button>
      </header>
      <div className="flex-1 min-h-0">
        <MasterDetailList items={stories} activeId={activeId} onPick={setActiveId} renderRow={(s) => <div className="text-sm">{storyTitle(s, t('stories.fallbackTitle'))}</div>} placeholder={t('stories.searchPlaceholder')} detail={detail} emptyTitle={t('stories.emptyTitle')} emptyHint={t('stories.emptyHint')} />
      </div>
    </div>
  );
}

function eventSectionText(event) {
  return [
    event.fields?.date?.value,
    event.fields?.description?.value || event.fields?.userDescription?.value,
    event.fields?.address?.value,
  ].filter(Boolean).join('\n\n');
}
