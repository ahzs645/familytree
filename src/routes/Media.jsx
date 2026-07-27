/**
 * Media viewer + editor — gallery view of MediaPicture / MediaPDF / MediaURL /
 * MediaAudio / MediaVideo records. Filter by type. Edit caption/description.
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getAppDataClient } from '../lib/data/AppDataClient.js';
import { saveWithChangeLog, logRecordDeleted } from '../lib/changeLog.js';
import { deleteRecordsWithLog } from '../lib/bulkActions.js';
import { BulkLabelMenu } from '../components/lists/BulkLabelMenu.jsx';
import { readRef } from '../lib/schema.js';
import {
  createMediaRecordFromBlob,
  createMediaRecordsFromFiles,
  createMediaURLRecord,
  matchMediaFiles,
  replaceMediaRecordAsset,
  replaceMediaRecordImageData,
} from '../lib/mediaFolderMatch.js';
import { FieldRow } from '../components/editors/FieldRow.jsx';
import { recordDisplayLabel } from '../components/editors/RelatedRecordEditors.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, Textarea } from '../components/ui/Input.jsx';
import { Select } from '../components/ui/Select.jsx';
import { cn } from '../lib/utils.js';
import { useModal } from '../contexts/ModalContext.jsx';
import { buildMediaSlideshowSearchParams } from '../lib/mediaPresentation.js';
import { useIsMobile } from '../lib/useIsMobile.js';
import { GalleryDetail } from '../components/media/GalleryDetail.jsx';
import { MediaPreview } from '../components/media/MediaPreview.jsx';
import { ImageEditingSheet } from '../components/ImageEditingSheet.jsx';
import { useMediaCapture } from '../components/media/useMediaCapture.js';
import { canvasToBlob, editedFilename, loadImage } from '../components/media/mediaHelpers.js';
import { isRecordLocked } from '../lib/recordLock.js';
import { useDirtyBaseline } from '../lib/editorState.js';
import { useSaveShortcut } from '../lib/useSaveShortcut.js';
import { SaveStatus } from '../components/editors/SaveStatus.jsx';
import { useRecordLock } from '../lib/useRecordLock.js';
import { RecordLockButton } from '../components/editors/RecordLockButton.jsx';

const MEDIA_TYPES = [
  { id: 'all', label: 'All', match: null },
  { id: 'MediaPicture', label: 'Pictures' },
  { id: 'MediaPDF', label: 'PDFs' },
  { id: 'MediaURL', label: 'URLs' },
  { id: 'MediaAudio', label: 'Audio' },
  { id: 'MediaVideo', label: 'Video' },
];

function iconFor(type) {
  return { MediaPicture: '🖼', MediaPDF: '📄', MediaURL: '🔗', MediaAudio: '🎵', MediaVideo: '🎬' }[type] || '📎';
}

function routeForRecord(record) {
  if (!record) return null;
  if (record.recordType === 'Person') return `/person/${record.recordName}`;
  if (record.recordType === 'Family') return `/family/${record.recordName}`;
  if (record.recordType === 'Place') return `/places?placeId=${encodeURIComponent(record.recordName)}`;
  if (record.recordType === 'PersonEvent' || record.recordType === 'FamilyEvent') return `/events?eventId=${encodeURIComponent(record.recordName)}`;
  if (record.recordType?.startsWith('Media')) return `/views/media-gallery?mediaId=${encodeURIComponent(record.recordName)}`;
  return null;
}

export default function Media() {
  const navigate = useNavigate();
  const location = useLocation();
  const modal = useModal();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetId = searchParams.get('targetId') || searchParams.get('subjectId') || '';
  const targetType = searchParams.get('targetType') || '';
  const mediaIdParam = searchParams.get('mediaId') || '';
  const explicitMode = searchParams.get('mode');
  const isViewsGallery = location.pathname.startsWith('/views/media-gallery');
  const readOnlyGallery = explicitMode ? explicitMode === 'gallery' : isViewsGallery;
  const [media, setMedia] = useState([]);
  const [filter, setFilter] = useState('all');
  const [activeId, setActiveId] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [activeAssets, setActiveAssets] = useState([]);
  const [activeRelations, setActiveRelations] = useState([]);
  const [relatedMediaIds, setRelatedMediaIds] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [subject, setSubject] = useState(null);
  const folderRef = React.useRef(null);
  const addFilesRef = React.useRef(null);
  const replaceFileRef = React.useRef(null);
  const [loadSeq, setLoadSeq] = useState(0);

  const reload = useCallback(async () => {
    const data = getAppDataClient();
    const all = [];
    for (const t of MEDIA_TYPES.slice(1)) {
      const { records } = await data.records.query(t.id, { limit: 100000 });
      all.push(...records);
    }
    setMedia(all);
    setLoadSeq((n) => n + 1);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const [imageEditorSrc, setImageEditorSrc] = useState(null);
  const {
    captureMode,
    recording,
    videoRef,
    onStartCamera,
    onCapturePhoto,
    onStartAudioRecording,
    onStopAudioRecording,
    onStartVideoRecording,
    onStopVideoRecording,
    onCancelCapture,
  } = useMediaCapture({ setStatus, reload, setActiveId });

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!targetId) {
        setRelatedMediaIds(null);
        setSubject(null);
        return;
      }
      const data = getAppDataClient();
      const [rels, target] = await Promise.all([
        data.records.query('MediaRelation', { referenceField: 'target', referenceValue: targetId, limit: 100000 }),
        data.records.get(targetId),
      ]);
      if (cancel) return;
      setRelatedMediaIds(new Set(rels.records.map((rel) => readRef(rel.fields?.media)).filter(Boolean)));
      setSubject(target || { recordName: targetId, recordType: targetType, fields: {} });
    })();
    return () => { cancel = true; };
  }, [targetId, targetType]);

  useEffect(() => {
    if (!activeId) return;
    const m = media.find((r) => r.recordName === activeId);
    if (!m) return;
    setValues({
      caption: m.fields?.caption?.value || '',
      description: m.fields?.description?.value || m.fields?.userDescription?.value || '',
      url: m.fields?.url?.value || '',
      filename: m.fields?.filename?.value || m.fields?.fileName?.value || '',
    });
    (async () => {
      const data = getAppDataClient();
      const ids = m.fields?.assetIds?.value || [];
      const storedAssets = ids.length ? (await Promise.all(ids.map((id) => data.assets.get(id)))).filter(Boolean) : await data.assets.listForRecord(m.recordName);
      setActiveAssets(storedAssets);
      const rels = await data.records.query('MediaRelation', { limit: 100000 });
      const related = [];
      for (const rel of rels.records.filter((r) => readRef(r.fields?.media) === m.recordName)) {
        const targetId = readRef(rel.fields?.target);
        const target = targetId ? await data.records.get(targetId) : null;
        related.push({ rel, target });
      }
      setActiveRelations(related);
    })();
  }, [activeId, media]);

  const onSave = useCallback(async () => {
    const m = media.find((r) => r.recordName === activeId);
    if (!m) return;
    if (isRecordLocked(m)) {
      setStatus('Unlock this media record before saving.');
      return;
    }
    setSaving(true);
    const next = { ...m, fields: { ...m.fields } };
    if (values.caption) next.fields.caption = { value: values.caption, type: 'STRING' };
    else delete next.fields.caption;
    if (values.description) next.fields.description = { value: values.description, type: 'STRING' };
    else delete next.fields.description;
    if (m.recordType === 'MediaURL' && values.url) {
      next.fields.url = { value: values.url, type: 'STRING' };
    }
    await saveWithChangeLog(next);
    await reload();
    setSaving(false);
    setStatus('Saved');
    setTimeout(() => setStatus(null), 1500);
  }, [activeId, media, values, reload]);

  const onDelete = useCallback(async () => {
    const m = media.find((r) => r.recordName === activeId);
    if (!m) return;
    if (isRecordLocked(m)) {
      setStatus('Unlock this media record before deleting.');
      return;
    }
    if (!(await modal.confirm('Delete this media record?', { title: 'Delete media', okLabel: 'Delete', destructive: true }))) return;
    await getAppDataClient().records.delete(m.recordName);
    await logRecordDeleted(m.recordName, m.recordType);
    await reload();
    setActiveId(null);
  }, [activeId, media, reload, modal]);

  const onMatchFolder = useCallback(async (files) => {
    if (!files?.length) return;
    setStatus('Matching media folder…');
    try {
      const result = await matchMediaFiles([...files]);
      await reload();
      setStatus(`Matched ${result.matched.toLocaleString()} media file${result.matched === 1 ? '' : 's'}.`);
    } catch (error) {
      setStatus(error.message);
    }
  }, [reload]);

  const onAddFiles = useCallback(async (files) => {
    if (!files?.length) return;
    setStatus('Adding media files…');
    try {
      const result = await createMediaRecordsFromFiles([...files]);
      await reload();
      setActiveId(result.records[0]?.recordName || null);
      setStatus(`Added ${result.created.toLocaleString()} media record${result.created === 1 ? '' : 's'}.`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      if (addFilesRef.current) addFilesRef.current.value = '';
    }
  }, [reload]);

  const onAddURL = useCallback(async () => {
    const url = await modal.prompt('Media URL:', '', { title: 'Add media URL', placeholder: 'https://…' });
    if (!url) return;
    setStatus('Adding URL…');
    try {
      const record = await createMediaURLRecord(url);
      await reload();
      setActiveId(record.recordName);
      setStatus('Added URL media record.');
    } catch (error) {
      setStatus(error.message);
    }
  }, [reload, modal]);

  const active = media.find((m) => m.recordName === activeId);
  const editableSnapshot = useMemo(() => ({ activeFields: active?.fields || {}, values }), [active, values]);
  const dirty = useDirtyBaseline(editableSnapshot, {
    recordKey: active?.recordName,
    reloadKey: loadSeq,
    enabled: !!active && !saving && !readOnlyGallery,
  });
  useSaveShortcut(onSave, { enabled: !!active && !saving && !isRecordLocked(active) && !readOnlyGallery && dirty });
  const onToggleLock = useRecordLock({
    record: active,
    setRecord: (next) => setMedia((rows) => rows.map((row) => row.recordName === next.recordName ? next : row)),
    setSaving,
    setStatus,
    reload,
  });

  const onReplaceFile = useCallback(async (files) => {
    const file = files?.[0];
    const m = media.find((r) => r.recordName === activeId);
    if (!file || !m) return;
    if (isRecordLocked(m)) {
      setStatus('Unlock this media record before replacing its file.');
      return;
    }
    setStatus('Replacing media file…');
    try {
      const next = await replaceMediaRecordAsset(m, file);
      await reload();
      setActiveId(next.recordName);
      setStatus('Media file replaced.');
    } catch (error) {
      setStatus(error.message);
    } finally {
      if (replaceFileRef.current) replaceFileRef.current.value = '';
    }
  }, [activeId, media, reload]);


  const onEditImage = useCallback(async (operation) => {
    if (!active || active.recordType !== 'MediaPicture') return;
    if (isRecordLocked(active)) {
      setStatus('Unlock this media record before editing its image.');
      return;
    }
    const asset = activeAssets[0];
    if (!asset?.dataBase64) {
      setStatus('No local image asset is available to edit.');
      return;
    }
    setStatus(operation === 'rotate' ? 'Rotating image…' : 'Cropping image…');
    try {
      const src = `data:${asset.mimeType || 'image/png'};base64,${asset.dataBase64}`;
      const image = await loadImage(src);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (operation === 'rotate') {
        canvas.width = image.naturalHeight;
        canvas.height = image.naturalWidth;
        context.translate(canvas.width / 2, canvas.height / 2);
        context.rotate(Math.PI / 2);
        context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
      } else {
        const size = Math.min(image.naturalWidth, image.naturalHeight);
        const x = Math.floor((image.naturalWidth - size) / 2);
        const y = Math.floor((image.naturalHeight - size) / 2);
        canvas.width = size;
        canvas.height = size;
        context.drawImage(image, x, y, size, size, 0, 0, size, size);
      }
      const mimeType = asset.mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png';
      const dataUrl = canvas.toDataURL(mimeType, 0.92);
      const dataBase64 = dataUrl.split(',')[1] || '';
      const filename = editedFilename(asset.filename || values.filename || active.recordName, operation, mimeType);
      const next = await replaceMediaRecordImageData(active, {
        dataBase64,
        mimeType,
        filename,
        caption: values.caption,
      });
      await reload();
      setActiveId(next.recordName);
      setStatus(operation === 'rotate' ? 'Image rotated.' : 'Image cropped.');
    } catch (error) {
      setStatus(`Image edit failed: ${error.message}`);
    }
  }, [active, activeAssets, reload, values.caption, values.filename]);

  const onOpenImageEditor = useCallback(() => {
    if (!active || active.recordType !== 'MediaPicture') return;
    if (isRecordLocked(active)) {
      setStatus('Unlock this media record before editing its image.');
      return;
    }
    const asset = activeAssets[0];
    if (!asset?.dataBase64) {
      setStatus('No local image asset is available to edit.');
      return;
    }
    setImageEditorSrc(`data:${asset.mimeType || 'image/png'};base64,${asset.dataBase64}`);
  }, [active, activeAssets]);

  const onApplyImageEdit = useCallback(async (dataUrl) => {
    if (!active) return;
    const dataBase64 = String(dataUrl || '').split(',')[1] || '';
    if (!dataBase64) {
      setStatus('Edited image could not be read.');
      setImageEditorSrc(null);
      return;
    }
    setStatus('Saving edited image…');
    try {
      const filename = editedFilename(activeAssets[0]?.filename || values.filename || active.recordName, 'edit', 'image/png');
      const next = await replaceMediaRecordImageData(active, {
        dataBase64,
        mimeType: 'image/png',
        filename,
        caption: values.caption,
      });
      await reload();
      setActiveId(next.recordName);
      setStatus('Image updated.');
    } catch (error) {
      setStatus(`Image edit failed: ${error.message}`);
    } finally {
      setImageEditorSrc(null);
    }
  }, [active, activeAssets, reload, values.caption, values.filename]);

  const filtered = useMemo(() => {
    const byType = filter === 'all' ? media : media.filter((m) => m.recordType === filter);
    if (!relatedMediaIds) return byType;
    return byType.filter((m) => relatedMediaIds.has(m.recordName));
  }, [filter, media, relatedMediaIds]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleIds = useMemo(() => filtered.map((m) => m.recordName), [filtered]);
  const selectedVisibleCount = useMemo(() => visibleIds.filter((id) => selectedSet.has(id)).length, [selectedSet, visibleIds]);
  const subjectLabel = subject ? recordDisplayLabel(subject) || subject.recordName : '';

  const setMode = useCallback((mode) => {
    const next = new URLSearchParams(searchParams);
    next.set('mode', mode);
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const clearSubject = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('targetId');
    next.delete('subjectId');
    next.delete('targetType');
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const toggleSelected = useCallback((recordName) => {
    setSelectedIds((current) => current.includes(recordName)
      ? current.filter((id) => id !== recordName)
      : [...current, recordName]);
  }, []);

  const selectVisible = useCallback(() => {
    setSelectedIds((current) => [...new Set([...current, ...visibleIds])]);
  }, [visibleIds]);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const startSlideshow = useCallback(() => {
    const ids = selectedIds.length ? selectedIds : (activeId ? [activeId] : []);
    const params = buildMediaSlideshowSearchParams({ mediaIds: ids });
    navigate(`/slideshow?${params.toString()}`);
  }, [activeId, navigate, selectedIds]);

  useEffect(() => {
    const allIds = new Set(media.map((m) => m.recordName));
    setSelectedIds((current) => current.filter((id) => allIds.has(id)));
  }, [media]);

  const mediaTypeFor = useCallback(
    (id) => media.find((m) => m.recordName === id)?.recordType || 'MediaPicture',
    [media]
  );

  const onDeleteSelected = useCallback(async () => {
    const deletable = selectedIds.filter((id) => {
      const record = media.find((m) => m.recordName === id);
      return record && !isRecordLocked(record);
    });
    if (!deletable.length) return;
    if (!(await modal.confirm(`Delete ${deletable.length} selected media record(s)?`, { title: 'Delete media', okLabel: 'Delete', destructive: true }))) return;
    await deleteRecordsWithLog(deletable, mediaTypeFor);
    clearSelection();
    if (deletable.includes(activeId)) setActiveId(null);
    await reload();
  }, [activeId, clearSelection, media, mediaTypeFor, modal, reload, selectedIds]);

  useEffect(() => {
    if (mediaIdParam && filtered.some((m) => m.recordName === mediaIdParam)) {
      setActiveId(mediaIdParam);
      return;
    }
    if (activeId && filtered.some((m) => m.recordName === activeId)) return;
    setActiveId(filtered[0]?.recordName || null);
  }, [activeId, filtered, mediaIdParam]);

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-2.5 px-5 py-2.5 border-b border-border bg-card text-card-foreground flex-wrap">
        <div className="min-w-[160px]">
          <div className="text-sm font-bold text-foreground">Media Gallery</div>
          {targetId ? (
            <div className="text-xs text-muted-foreground">
              {readOnlyGallery ? 'Read-only gallery' : 'Editor'} · filtered by {subjectLabel || targetId}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              {readOnlyGallery ? 'Read-only gallery report' : 'Browse and edit media records'}
            </div>
          )}
        </div>
        <Select
          value={filter}
          onChange={setFilter}
          options={MEDIA_TYPES.map((t) => ({ value: t.id, label: t.label }))}
          ariaLabel="Filter media by type"
          className="w-32"
        />
        <span className="ms-auto text-muted-foreground text-xs">
          {filtered.length} item{filtered.length === 1 ? '' : 's'}
          {selectedIds.length ? ` · ${selectedVisibleCount}/${selectedIds.length} selected visible` : ''}
        </span>
        <input ref={folderRef} type="file" multiple webkitdirectory="" className="hidden" onChange={(e) => onMatchFolder(e.target.files)} />
        <input
          ref={addFilesRef}
          type="file"
          multiple
          accept="image/*,application/pdf,audio/*,video/*"
          className="hidden"
          onChange={(e) => onAddFiles(e.target.files)}
        />
        <input
          ref={replaceFileRef}
          type="file"
          accept="image/*,application/pdf,audio/*,video/*"
          className="hidden"
          onChange={(e) => onReplaceFile(e.target.files)}
        />
        {targetId && (
          <Button onClick={clearSubject}>Clear subject</Button>
        )}
        <Button onClick={selectVisible} disabled={!filtered.length}>Select visible</Button>
        <Button onClick={clearSelection} disabled={!selectedIds.length}>Clear selection</Button>
        {!readOnlyGallery && selectedIds.length > 0 && (
          <>
            <BulkLabelMenu
              selectedIds={selectedIds}
              recordType={mediaTypeFor}
              onAssigned={clearSelection}
            />
            <Button variant="destructiveOutline" onClick={onDeleteSelected}>
              Delete selected
            </Button>
          </>
        )}
        {!readOnlyGallery && <Button onClick={() => addFilesRef.current?.click()}>Add files</Button>}
        <MoreMenu
          items={[
            {
              label: `Slideshow${selectedIds.length ? ` (${selectedIds.length})` : ''}`,
              onClick: startSlideshow,
              disabled: !selectedIds.length && !activeId,
            },
            {
              label: readOnlyGallery ? 'Edit records' : 'Gallery report',
              onClick: () => setMode(readOnlyGallery ? 'editor' : 'gallery'),
            },
            !readOnlyGallery && { label: 'Add URL', onClick: onAddURL },
            !readOnlyGallery && { label: 'Camera', onClick: onStartCamera },
            !readOnlyGallery && { label: 'Record audio', onClick: onStartAudioRecording },
            !readOnlyGallery && { label: 'Record video', onClick: onStartVideoRecording },
            !readOnlyGallery && { label: 'Match media folder', onClick: () => folderRef.current?.click() },
          ]}
        />
      </header>

      <div className={cn('flex-1 flex overflow-hidden', isMobile && 'flex-col')}>
        {(!isMobile || !active) && (
        <div
          className={cn(
            'flex-1 overflow-auto p-5 grid',
            readOnlyGallery
              ? 'grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3.5 content-start'
              : 'grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3',
          )}
        >
          {filtered.length === 0 && (
            <div className="text-muted-foreground p-10 col-span-full text-center">
              {targetId
                ? `No related media${filter !== 'all' ? ` of type "${filter}"` : ''} for ${subjectLabel || targetId}.`
                : filter !== 'all' ? `No media of type "${filter}" in this tree.` : 'No media in this tree.'}
            </div>
          )}
          {filtered.map((m) => {
            const isActive = m.recordName === activeId;
            const isSelected = selectedSet.has(m.recordName);
            return (
              <div
                key={m.recordName}
                onClick={() => setActiveId(m.recordName)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setActiveId(m.recordName);
                  }
                }}
                role="button"
                tabIndex={0}
                className={cn(
                  'relative p-3.5 border rounded-md cursor-pointer transition-colors',
                  readOnlyGallery ? 'min-h-[150px] flex flex-col justify-center' : 'min-h-[110px]',
                  isActive ? 'border-primary bg-accent' : 'border-border bg-card',
                )}
              >
                <label
                  aria-label={`Select ${m.fields?.caption?.value || m.recordName}`}
                  onClick={(event) => event.stopPropagation()}
                  className="absolute top-2 end-2 grid place-items-center w-6 h-6 rounded-md bg-background/85 border border-border cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelected(m.recordName)}
                  />
                </label>
                <div className="text-[38px] leading-none mb-1.5">{iconFor(m.recordType)}</div>
                <div className="text-xs text-foreground font-semibold mb-0.5 break-words">
                  {m.fields?.caption?.value || m.fields?.filename?.value || m.fields?.fileName?.value || m.fields?.url?.value || m.recordName}
                </div>
                <div className="text-xs text-muted-foreground">{m.recordType.replace('Media', '')}</div>
              </div>
            );
          })}
        </div>
        )}

        {active && (readOnlyGallery ? (
          <GalleryDetail
            record={active}
            assets={activeAssets}
            relations={activeRelations}
            isMobile={isMobile}
            onClose={() => setActiveId(null)}
            onOpenRelated={(target) => {
              const route = routeForRecord(target);
              if (route) navigate(route);
            }}
          />
        ) : (
          <aside className={cn('bg-card text-card-foreground overflow-auto', isMobile ? 'w-full flex-1 p-4' : 'w-[360px] border-s border-border p-5')}>
            <div className="flex items-center mb-3 flex-wrap gap-1.5">
              {isMobile && (
                <Button variant="destructiveOutline" onClick={() => setActiveId(null)} aria-label="Back to gallery">← Back</Button>
              )}
              <h2 className="text-sm text-foreground m-0 font-semibold">
                {iconFor(active.recordType)} {active.recordType.replace('Media', '')}
              </h2>
              <div className="ms-auto flex gap-1.5 flex-wrap">
                <SaveStatus status={status} dirty={dirty} />
                <RecordLockButton record={active} saving={saving} onToggle={onToggleLock} />
                {active.recordType !== 'MediaURL' && <Button variant="destructiveOutline" onClick={() => replaceFileRef.current?.click()} disabled={isRecordLocked(active)}>Replace</Button>}
                {active.recordType === 'MediaPicture' && <Button variant="destructiveOutline" onClick={() => onEditImage('rotate')} disabled={isRecordLocked(active)}>Rotate</Button>}
                {active.recordType === 'MediaPicture' && <Button variant="destructiveOutline" onClick={() => onEditImage('crop-square')} disabled={isRecordLocked(active)}>Crop</Button>}
                {active.recordType === 'MediaPicture' && <Button variant="destructiveOutline" onClick={onOpenImageEditor} disabled={isRecordLocked(active)}>Edit &amp; Enhance…</Button>}
                <Button variant="destructiveOutline" onClick={onDelete} disabled={isRecordLocked(active)}>Delete</Button>
                <Button variant="primary" onClick={onSave} disabled={saving || isRecordLocked(active) || !dirty} title="Save (⌘/Ctrl+S)">{saving ? 'Saving…' : 'Save'}</Button>
              </div>
            </div>
            <FieldRow label="Caption">
              <Input value={values.caption ?? ''} onChange={(e) => setValues({ ...values, caption: e.target.value })} />
            </FieldRow>
            {active.recordType === 'MediaURL' && (
              <FieldRow label="URL">
                <Input value={values.url ?? ''} onChange={(e) => setValues({ ...values, url: e.target.value })} />
              </FieldRow>
            )}
            {values.filename && (
              <FieldRow label="Filename">
                <div className="text-muted-foreground text-xs font-mono break-all">
                  {values.filename}
                </div>
              </FieldRow>
            )}
            <FieldRow label="Description">
              <Textarea
                value={values.description ?? ''}
                onChange={(e) => setValues({ ...values, description: e.target.value })}
                className="min-h-[80px] resize-y"
                rows={6}
              />
            </FieldRow>
            <FieldRow label="Preview">
              <MediaPreview record={active} assets={activeAssets} />
            </FieldRow>
            <FieldRow label="Related Entries">
              {activeRelations.length === 0 ? (
                <div className="text-muted-foreground text-xs">No related entries.</div>
              ) : (
                <div className="grid gap-1.5">
                  {activeRelations.map(({ rel, target }) => (
                    <button
                      key={rel.recordName}
                      type="button"
                      onClick={() => {
                        const route = routeForRecord(target);
                        if (route) navigate(route);
                      }}
                      className={cn(
                        'text-xs bg-secondary text-secondary-foreground border border-border rounded-md p-2 text-start',
                        routeForRecord(target) ? 'cursor-pointer hover:bg-accent' : 'cursor-default',
                      )}
                    >
                      <span className="text-muted-foreground me-1.5">{rel.fields?.targetType?.value || target?.recordType || 'Record'}</span>
                      {target?.fields?.cached_fullName?.value || target?.fields?.title?.value || target?.fields?.cached_familyName?.value || target?.recordName || readRef(rel.fields?.target)}
                    </button>
                  ))}
                </div>
              )}
            </FieldRow>
          </aside>
        ))}
      </div>

      {captureMode && (
        <div className="fixed inset-0 z-40 bg-black/60 grid place-items-center p-5">
          <div className="w-[min(720px,94vw)] bg-card text-card-foreground border border-border rounded-md p-4 shadow-xl">
            <div className="flex items-center mb-3">
              <h2 className="text-base font-bold m-0">
                {captureMode === 'camera' ? 'Camera capture' : captureMode === 'video' ? 'Video recording' : 'Audio recording'}
              </h2>
              <Button variant="destructiveOutline" onClick={onCancelCapture} className="ms-auto">Cancel</Button>
            </div>
            {captureMode === 'camera' ? (
              <>
                <video ref={videoRef} muted playsInline className="w-full max-h-[62vh] bg-black rounded-md border border-border" />
                <div className="flex justify-end gap-2 mt-3">
                  <Button variant="primary" onClick={onCapturePhoto}>Capture photo</Button>
                </div>
              </>
            ) : captureMode === 'video' ? (
              <>
                <video ref={videoRef} muted playsInline className="w-full max-h-[62vh] bg-black rounded-md border border-border" />
                <div className="flex items-center gap-2.5 mt-3">
                  <div className="w-5 h-5 rounded-full bg-destructive ring-8 ring-destructive/15" />
                  <span className="text-xs text-muted-foreground">
                    {recording ? 'Recording video and audio…' : 'Preparing recorder…'}
                  </span>
                  <Button variant="primary" onClick={onStopVideoRecording} disabled={!recording} className="ms-auto">Stop and save</Button>
                </div>
              </>
            ) : (
              <>
                <div className="min-h-[160px] border border-border rounded-md bg-background grid place-items-center gap-3 p-5">
                  <div className="text-xs text-muted-foreground">
                    {recording ? 'Recording from the selected microphone.' : 'Audio recorder is ready.'}
                  </div>
                  <div className="w-5 h-5 rounded-full bg-destructive ring-8 ring-destructive/15" />
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <Button variant="primary" onClick={onStopAudioRecording} disabled={!recording}>Stop and save</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {imageEditorSrc && (
        <ImageEditingSheet
          src={imageEditorSrc}
          title="Edit & Enhance Picture"
          onCancel={() => setImageEditorSrc(null)}
          onApply={onApplyImageEdit}
        />
      )}
    </div>
  );
}

function MoreMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visible = items.filter(Boolean);
  if (!visible.length) return null;

  return (
    <div ref={ref} className="relative">
      <Button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        More <span aria-hidden="true">▾</span>
      </Button>
      {open ? (
        <div role="menu" className="absolute end-0 top-full z-20 mt-1 min-w-[180px] bg-popover text-popover-foreground border border-border rounded-md shadow-lg p-1 flex flex-col">
          {visible.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => { setOpen(false); item.onClick(); }}
              className="w-full text-start bg-transparent rounded-md px-2.5 py-2 text-sm cursor-pointer hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
