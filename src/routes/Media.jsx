/**
 * Media viewer + editor — gallery view of MediaPicture / MediaPDF / MediaURL /
 * MediaAudio / MediaVideo records. Filter by type. Edit caption/description.
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getAppDataClient } from '../lib/data/AppDataClient.js';
import { saveWithChangeLog } from '../lib/changeLog.js';
import { BulkLabelMenu } from '../components/lists/BulkLabelMenu.jsx';
import { readRef } from '../lib/schema.js';
import {
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
import { editedFilename, loadImage } from '../components/media/mediaHelpers.js';
import { isRecordLocked } from '../lib/recordLock.js';
import { useDirtyBaseline } from '../lib/editorState.js';
import { useSaveShortcut } from '../lib/useSaveShortcut.js';
import { SaveStatus } from '../components/editors/SaveStatus.jsx';
import { useRecordLock } from '../lib/useRecordLock.js';
import { RecordLockButton } from '../components/editors/RecordLockButton.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { getAppPreferences, patchAppPreferences } from '../lib/appPreferences.js';
import {
  DEFAULT_MEDIA_GALLERY_PREFERENCES,
  assetToBlob,
  attachMediaToTarget,
  buildMediaExportZip,
  deleteMediaEverywhere,
  detachMediaFromTarget,
  findMediaReferences,
  groupMediaRecords,
  loadAssetsForMedia,
  normalizeMediaGalleryPreferences,
  setMediaAsEntryImage,
} from '../lib/mediaManagement.js';
import { AddMediaSheet, DeleteMediaSheet, EntryImageSheet } from '../components/media/MediaWorkflowSheets.jsx';

const MEDIA_TYPES = ['all', 'MediaPicture', 'MediaPDF', 'MediaURL', 'MediaAudio', 'MediaVideo'];

function iconFor(type) {
  return { MediaPicture: '🖼', MediaPDF: '📄', MediaURL: '🔗', MediaAudio: '🎵', MediaVideo: '🎬' }[type] || '📎';
}

function routeForRecord(record) {
  if (!record) return null;
  if (record.recordType === 'Person') return `/person/${record.recordName}`;
  if (record.recordType === 'Family') return `/family/${record.recordName}`;
  if (record.recordType === 'Place') return `/places?placeId=${encodeURIComponent(record.recordName)}`;
  if (record.recordType === 'Source') return `/sources?sourceId=${encodeURIComponent(record.recordName)}`;
  if (record.recordType === 'PersonEvent' || record.recordType === 'FamilyEvent') return `/events?eventId=${encodeURIComponent(record.recordName)}`;
  if (record.recordType?.startsWith('Media')) return `/views/media-gallery?mediaId=${encodeURIComponent(record.recordName)}`;
  return null;
}

export default function Media() {
  const { t, localization } = useTranslation();
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
  const replaceFileRef = React.useRef(null);
  const workflowReturnFocusRef = useRef(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [entryImageOpen, setEntryImageOpen] = useState(false);
  const [deleteRequest, setDeleteRequest] = useState(null);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [galleryPrefs, setGalleryPrefs] = useState(DEFAULT_MEDIA_GALLERY_PREFERENCES);
  const [loadSeq, setLoadSeq] = useState(0);

  const reload = useCallback(async () => {
    const data = getAppDataClient();
    const all = [];
    for (const type of MEDIA_TYPES.slice(1)) {
      const { records } = await data.records.query(type, { limit: 100000 });
      all.push(...records);
    }
    setMedia(all);
    setLoadSeq((n) => n + 1);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    getAppPreferences().then((preferences) => {
      if (!cancelled) setGalleryPrefs(normalizeMediaGalleryPreferences(preferences.media?.gallery));
    });
    return () => { cancelled = true; };
  }, []);

  const updateGalleryPrefs = useCallback((patch) => {
    setGalleryPrefs((current) => {
      const next = normalizeMediaGalleryPreferences({ ...current, ...patch });
      patchAppPreferences('media.gallery', next);
      return next;
    });
  }, []);

  const openWorkflow = useCallback((setter) => {
    workflowReturnFocusRef.current = document.activeElement;
    setter(true);
  }, []);

  const closeWorkflow = useCallback((setter) => {
    setter(false);
    requestAnimationFrame(() => workflowReturnFocusRef.current?.focus?.());
  }, []);

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
      setStatus(t('mediaManager.status.unlockSave'));
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
    setStatus(t('mediaManager.status.saved'));
    setTimeout(() => setStatus(null), 1500);
  }, [activeId, media, values, reload, t]);

  const hydrateReferences = useCallback(async (records) => {
    const relations = await findMediaReferences(records.map((record) => record.recordName));
    return Promise.all(relations.map(async (rel) => ({
      rel,
      target: await getAppDataClient().records.get(readRef(rel.fields?.target)),
    })));
  }, []);

  const requestDelete = useCallback(async (records) => {
    const deletable = records.filter((record) => record && !isRecordLocked(record));
    if (!deletable.length) {
      setStatus(t('mediaManager.status.unlockDelete'));
      return;
    }
    workflowReturnFocusRef.current = document.activeElement;
    setDeleteRequest({ records: deletable, references: await hydrateReferences(deletable) });
  }, [hydrateReferences, t]);

  const onConfirmDelete = useCallback(async (mode, detachTargetId) => {
    if (!deleteRequest) return;
    setWorkflowBusy(true);
    try {
      if (mode === 'detach') {
        const count = await detachMediaFromTarget(deleteRequest.records, detachTargetId);
        setStatus(t('mediaManager.status.detached', { count }));
      } else {
        const result = await deleteMediaEverywhere(deleteRequest.records);
        setSelectedIds((current) => current.filter((id) => !deleteRequest.records.some((record) => record.recordName === id)));
        if (deleteRequest.records.some((record) => record.recordName === activeId)) setActiveId(null);
        setStatus(t('mediaManager.status.deleted', { count: result.deleted }));
      }
      setDeleteRequest(null);
      await reload();
    } catch (error) {
      setStatus(t('mediaManager.status.operationFailed', { message: error.message }));
    } finally {
      setWorkflowBusy(false);
      requestAnimationFrame(() => workflowReturnFocusRef.current?.focus?.());
    }
  }, [activeId, deleteRequest, reload, t]);

  const onMatchFolder = useCallback(async (files) => {
    if (!files?.length) return;
    setStatus(t('mediaManager.status.matching'));
    try {
      const result = await matchMediaFiles([...files]);
      await reload();
      setStatus(t('mediaManager.status.matched', { count: result.matched }));
    } catch (error) {
      setStatus(error.message);
    }
  }, [reload, t]);

  const onAddFiles = useCallback(async (files, target) => {
    if (!files?.length || !target) return;
    setWorkflowBusy(true);
    setStatus(t('mediaManager.status.adding'));
    try {
      const result = await createMediaRecordsFromFiles([...files]);
      for (const record of result.records) await attachMediaToTarget(record, target);
      await reload();
      setActiveId(result.records[0]?.recordName || null);
      setStatus(t('mediaManager.status.added', { count: result.created, name: recordDisplayLabel(target) }));
      closeWorkflow(setAddSheetOpen);
    } catch (error) {
      setStatus(t('mediaManager.status.operationFailed', { message: error.message }));
    } finally {
      setWorkflowBusy(false);
    }
  }, [closeWorkflow, reload, t]);

  const onAddURL = useCallback(async () => {
    const url = await modal.prompt(t('mediaManager.addUrl.prompt'), '', { title: t('mediaManager.addUrl.title'), placeholder: 'https://…' });
    if (!url) return;
    setStatus(t('mediaManager.status.addingUrl'));
    try {
      const record = await createMediaURLRecord(url);
      await reload();
      setActiveId(record.recordName);
      setStatus(t('mediaManager.status.addedUrl'));
    } catch (error) {
      setStatus(error.message);
    }
  }, [reload, modal, t]);

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
      setStatus(t('mediaManager.status.unlockReplace'));
      return;
    }
    setStatus(t('mediaManager.status.replacing'));
    try {
      const next = await replaceMediaRecordAsset(m, file);
      await reload();
      setActiveId(next.recordName);
      setStatus(t('mediaManager.status.replaced'));
    } catch (error) {
      setStatus(error.message);
    } finally {
      if (replaceFileRef.current) replaceFileRef.current.value = '';
    }
  }, [activeId, media, reload, t]);


  const onEditImage = useCallback(async (operation) => {
    if (!active || active.recordType !== 'MediaPicture') return;
    if (isRecordLocked(active)) {
      setStatus(t('mediaManager.status.unlockEdit'));
      return;
    }
    const asset = activeAssets[0];
    if (!asset?.dataBase64) {
      setStatus(t('mediaManager.status.noLocalAsset'));
      return;
    }
    setStatus(operation === 'rotate' ? t('mediaManager.status.rotating') : t('mediaManager.status.cropping'));
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
      setStatus(operation === 'rotate' ? t('mediaManager.status.rotated') : t('mediaManager.status.cropped'));
    } catch (error) {
      setStatus(t('mediaManager.status.imageEditFailed', { message: error.message }));
    }
  }, [active, activeAssets, reload, values.caption, values.filename, t]);

  const onOpenImageEditor = useCallback(() => {
    if (!active || active.recordType !== 'MediaPicture') return;
    if (isRecordLocked(active)) {
      setStatus(t('mediaManager.status.unlockEdit'));
      return;
    }
    const asset = activeAssets[0];
    if (!asset?.dataBase64) {
      setStatus(t('mediaManager.status.noLocalAsset'));
      return;
    }
    setImageEditorSrc(`data:${asset.mimeType || 'image/png'};base64,${asset.dataBase64}`);
  }, [active, activeAssets, t]);

  const onApplyImageEdit = useCallback(async (dataUrl) => {
    if (!active) return;
    const dataBase64 = String(dataUrl || '').split(',')[1] || '';
    if (!dataBase64) {
      setStatus(t('mediaManager.status.editReadFailed'));
      setImageEditorSrc(null);
      return;
    }
    setStatus(t('mediaManager.status.savingEdit'));
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
      setStatus(t('mediaManager.status.imageUpdated'));
    } catch (error) {
      setStatus(t('mediaManager.status.imageEditFailed', { message: error.message }));
    } finally {
      setImageEditorSrc(null);
    }
  }, [active, activeAssets, reload, values.caption, values.filename, t]);

  const filtered = useMemo(() => {
    const byType = filter === 'all' ? media : media.filter((m) => m.recordType === filter);
    if (!relatedMediaIds) return byType;
    return byType.filter((m) => relatedMediaIds.has(m.recordName));
  }, [filter, media, relatedMediaIds]);
  const mediaGroups = useMemo(
    () => groupMediaRecords(filtered, galleryPrefs, localization.locale),
    [filtered, galleryPrefs, localization.locale]
  );
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

  const onExportSelected = useCallback(async () => {
    const records = selectedIds.map((id) => media.find((record) => record.recordName === id)).filter(Boolean);
    if (!records.length) return;
    setStatus(t('mediaManager.status.exporting'));
    try {
      const assets = await loadAssetsForMedia(records);
      const result = await buildMediaExportZip(records, assets);
      if (!result.fileCount) {
        setStatus(t('mediaManager.status.noExportableFiles'));
        return;
      }
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = t('mediaManager.export.filename');
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(t('mediaManager.status.exported', { count: result.fileCount }));
    } catch (error) {
      setStatus(t('mediaManager.status.operationFailed', { message: error.message }));
    }
  }, [media, selectedIds, t]);

  const onOpenMedia = useCallback(() => {
    if (!active) return;
    if (active.recordType === 'MediaURL') {
      const url = active.fields?.url?.value;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      else setStatus(t('mediaManager.status.noLocalAsset'));
      return;
    }
    const blob = assetToBlob(activeAssets[0]);
    if (!blob) {
      setStatus(t('mediaManager.status.noLocalAsset'));
      return;
    }
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }, [active, activeAssets, t]);

  const onApplyEntryImage = useCallback(async (target) => {
    if (!active || !target) return;
    setWorkflowBusy(true);
    try {
      await setMediaAsEntryImage(active, target);
      setStatus(t('mediaManager.status.entryImageSet', { name: recordDisplayLabel(target) }));
      closeWorkflow(setEntryImageOpen);
      const references = await hydrateReferences([active]);
      setActiveRelations(references);
    } catch (error) {
      setStatus(t('mediaManager.status.operationFailed', { message: error.message }));
    } finally {
      setWorkflowBusy(false);
    }
  }, [active, closeWorkflow, hydrateReferences, t]);

  useEffect(() => {
    const allIds = new Set(media.map((m) => m.recordName));
    setSelectedIds((current) => current.filter((id) => allIds.has(id)));
  }, [media]);

  const mediaTypeFor = useCallback(
    (id) => media.find((m) => m.recordName === id)?.recordType || 'MediaPicture',
    [media]
  );

  const onDeleteSelected = useCallback(() => {
    const deletable = selectedIds.filter((id) => {
      const record = media.find((m) => m.recordName === id);
      return record && !isRecordLocked(record);
    }).map((id) => media.find((record) => record.recordName === id));
    if (!deletable.length) return;
    requestDelete(deletable);
  }, [media, requestDelete, selectedIds]);

  useEffect(() => {
    if (mediaIdParam && filtered.some((m) => m.recordName === mediaIdParam)) {
      setActiveId(mediaIdParam);
      return;
    }
    if (activeId && filtered.some((m) => m.recordName === activeId)) return;
    setActiveId(filtered[0]?.recordName || null);
  }, [activeId, filtered, mediaIdParam]);

  const mediaTypeLabel = useCallback((type) => t(`mediaManager.types.${type || 'unknown'}`), [t]);
  const groupLabel = useCallback((group) => {
    if (group.kind === 'type') return mediaTypeLabel(group.value);
    if (group.value === 'unknown') return t('mediaManager.grouping.unknownDate');
    if (group.kind === 'decade') return t('mediaManager.grouping.decadeLabel', { year: group.value });
    return new Intl.NumberFormat(localization.locale, { useGrouping: false }).format(group.value);
  }, [localization.locale, mediaTypeLabel, t]);
  const thumbnailGridClass = {
    small: 'grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2',
    medium: 'grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3',
    large: 'grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4',
  }[galleryPrefs.thumbnailSize];
  const thumbnailCardClass = {
    small: 'min-h-[86px] p-2.5',
    medium: 'min-h-[110px] p-3.5',
    large: 'min-h-[160px] p-5',
  }[galleryPrefs.thumbnailSize];
  const thumbnailIconClass = {
    small: 'text-[28px]',
    medium: 'text-[38px]',
    large: 'text-[56px]',
  }[galleryPrefs.thumbnailSize];

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-2.5 px-5 py-2.5 border-b border-border bg-card text-card-foreground flex-wrap">
        <div className="min-w-[160px]">
          <div className="text-sm font-bold text-foreground">{t('mediaManager.title')}</div>
          {targetId ? (
            <div className="text-xs text-muted-foreground">
              {readOnlyGallery ? t('mediaManager.readOnlyGallery') : t('mediaManager.editor')} · {t('mediaManager.filteredBy', { name: subjectLabel || targetId })}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              {readOnlyGallery ? t('mediaManager.readOnlyReport') : t('mediaManager.subtitle')}
            </div>
          )}
        </div>
        <Select
          value={filter}
          onChange={setFilter}
          options={MEDIA_TYPES.map((type) => ({ value: type, label: mediaTypeLabel(type) }))}
          ariaLabel={t('mediaManager.filterAria')}
          className="w-32"
        />
        <GroupingStylePopover preferences={galleryPrefs} onChange={updateGalleryPrefs} />
        <span className="ms-auto text-muted-foreground text-xs">
          {t('mediaManager.itemCount', { count: filtered.length })}
          {selectedIds.length ? ` · ${t('mediaManager.selectedVisible', { visible: selectedVisibleCount, count: selectedIds.length })}` : ''}
        </span>
        <input
          ref={folderRef}
          type="file"
          multiple
          webkitdirectory=""
          className="hidden"
          aria-label={t('mediaManager.actions.matchFolder')}
          onChange={(e) => onMatchFolder(e.target.files)}
        />
        <input
          ref={replaceFileRef}
          type="file"
          accept="image/*,application/pdf,audio/*,video/*"
          className="hidden"
          aria-label={t('mediaManager.actions.replace')}
          onChange={(e) => onReplaceFile(e.target.files)}
        />
        {targetId && (
          <Button onClick={clearSubject}>{t('mediaManager.actions.clearSubject')}</Button>
        )}
        <Button onClick={selectVisible} disabled={!filtered.length}>{t('mediaManager.actions.selectVisible')}</Button>
        <Button onClick={clearSelection} disabled={!selectedIds.length}>{t('mediaManager.actions.clearSelection')}</Button>
        {!readOnlyGallery && selectedIds.length > 0 && (
          <>
            <BulkLabelMenu
              selectedIds={selectedIds}
              recordType={mediaTypeFor}
              onAssigned={clearSelection}
            />
            <Button variant="destructiveOutline" onClick={onDeleteSelected}>
              {t('mediaManager.actions.deleteSelected')}
            </Button>
          </>
        )}
        {!readOnlyGallery && <Button onClick={() => openWorkflow(setAddSheetOpen)}>{t('mediaManager.actions.addMedia')}</Button>}
        <MoreMenu
          items={[
            {
              label: selectedIds.length ? t('mediaManager.actions.slideshowCount', { count: selectedIds.length }) : t('mediaManager.actions.slideshow'),
              onClick: startSlideshow,
              disabled: !selectedIds.length && !activeId,
            },
            {
              label: t('mediaManager.actions.exportSelected'),
              onClick: onExportSelected,
              disabled: !selectedIds.length,
            },
            {
              label: readOnlyGallery ? t('mediaManager.actions.editRecords') : t('mediaManager.actions.galleryReport'),
              onClick: () => setMode(readOnlyGallery ? 'editor' : 'gallery'),
            },
            !readOnlyGallery && { label: t('mediaManager.actions.addUrl'), onClick: onAddURL },
            !readOnlyGallery && { label: t('mediaManager.actions.camera'), onClick: onStartCamera },
            !readOnlyGallery && { label: t('mediaManager.actions.recordAudio'), onClick: onStartAudioRecording },
            !readOnlyGallery && { label: t('mediaManager.actions.recordVideo'), onClick: onStartVideoRecording },
            !readOnlyGallery && { label: t('mediaManager.actions.matchFolder'), onClick: () => folderRef.current?.click() },
          ]}
        />
      </header>

      <div className={cn('flex-1 flex overflow-hidden', isMobile && 'flex-col')}>
        {(!isMobile || !active) && (
        <div className="flex-1 overflow-auto p-5">
          {filtered.length === 0 && (
            <div className="text-muted-foreground p-10 text-center">
              {targetId
                ? filter === 'all'
                  ? t('mediaManager.empty.related', { name: subjectLabel || targetId })
                  : t('mediaManager.empty.relatedType', { type: mediaTypeLabel(filter), name: subjectLabel || targetId })
                : filter !== 'all' ? t('mediaManager.empty.type', { type: mediaTypeLabel(filter) }) : t('mediaManager.empty.tree')}
            </div>
          )}
          {mediaGroups.map((group) => (
            <section key={group.key} className="mb-5 last:mb-0" aria-labelledby={`media-group-${group.key}`}>
              {group.kind !== 'none' && (
                <h2 id={`media-group-${group.key}`} className="mb-2 text-xs font-semibold text-muted-foreground">
                  {groupLabel(group)} <span className="font-normal">({group.records.length})</span>
                </h2>
              )}
              <div className={cn('grid content-start', readOnlyGallery ? 'grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3.5' : thumbnailGridClass)}>
          {group.records.map((m) => {
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
                  'relative border rounded-md cursor-pointer transition-colors',
                  readOnlyGallery ? 'min-h-[150px] flex flex-col justify-center p-3.5' : thumbnailCardClass,
                  isActive ? 'border-primary bg-accent' : 'border-border bg-card',
                )}
              >
                <label
                  aria-label={t('mediaManager.selectItem', { name: m.fields?.caption?.value || m.recordName })}
                  onClick={(event) => event.stopPropagation()}
                  className="absolute top-2 end-2 grid place-items-center w-6 h-6 rounded-md bg-background/85 border border-border cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelected(m.recordName)}
                  />
                </label>
                <div className={cn(thumbnailIconClass, 'leading-none mb-1.5')}>{iconFor(m.recordType)}</div>
                <div className="text-xs text-foreground font-semibold mb-0.5 break-words">
                  {m.fields?.caption?.value || m.fields?.filename?.value || m.fields?.fileName?.value || m.fields?.url?.value || m.recordName}
                </div>
                <div className="text-xs text-muted-foreground">{mediaTypeLabel(m.recordType)}</div>
              </div>
            );
          })}
              </div>
            </section>
          ))}
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
                <Button variant="destructiveOutline" onClick={() => setActiveId(null)} aria-label={t('mediaManager.actions.backToGallery')}>← {t('mediaManager.actions.back')}</Button>
              )}
              <h2 className="text-sm text-foreground m-0 font-semibold">
                {iconFor(active.recordType)} {mediaTypeLabel(active.recordType)}
              </h2>
              <div className="ms-auto flex gap-1.5 flex-wrap">
                <SaveStatus status={status} dirty={dirty} />
                <RecordLockButton record={active} saving={saving} onToggle={onToggleLock} />
                <Button onClick={onOpenMedia}>{t('mediaManager.actions.openMedia')}</Button>
                {active.recordType === 'MediaPicture' && <Button onClick={() => openWorkflow(setEntryImageOpen)}>{t('mediaManager.actions.useEntryImage')}</Button>}
                {active.recordType !== 'MediaURL' && <Button variant="destructiveOutline" onClick={() => replaceFileRef.current?.click()} disabled={isRecordLocked(active)}>{t('mediaManager.actions.replace')}</Button>}
                {active.recordType === 'MediaPicture' && <Button variant="destructiveOutline" onClick={() => onEditImage('rotate')} disabled={isRecordLocked(active)}>{t('mediaManager.actions.rotate')}</Button>}
                {active.recordType === 'MediaPicture' && <Button variant="destructiveOutline" onClick={() => onEditImage('crop-square')} disabled={isRecordLocked(active)}>{t('mediaManager.actions.crop')}</Button>}
                {active.recordType === 'MediaPicture' && <Button variant="destructiveOutline" onClick={onOpenImageEditor} disabled={isRecordLocked(active)}>{t('mediaManager.actions.editEnhance')}</Button>}
                <Button variant="destructiveOutline" onClick={() => requestDelete([active])} disabled={isRecordLocked(active)}>{t('mediaManager.actions.delete')}</Button>
                <Button variant="primary" onClick={onSave} disabled={saving || isRecordLocked(active) || !dirty} title={t('mediaManager.actions.saveShortcut')}>{saving ? t('mediaManager.actions.saving') : t('mediaManager.actions.save')}</Button>
              </div>
            </div>
            <FieldRow label={t('mediaManager.fields.caption')}>
              <Input value={values.caption ?? ''} onChange={(e) => setValues({ ...values, caption: e.target.value })} />
            </FieldRow>
            {active.recordType === 'MediaURL' && (
              <FieldRow label={t('mediaManager.fields.url')}>
                <Input value={values.url ?? ''} onChange={(e) => setValues({ ...values, url: e.target.value })} />
              </FieldRow>
            )}
            {values.filename && (
              <FieldRow label={t('mediaManager.fields.filename')}>
                <div className="text-muted-foreground text-xs font-mono break-all">
                  {values.filename}
                </div>
              </FieldRow>
            )}
            <FieldRow label={t('mediaManager.fields.description')}>
              <Textarea
                value={values.description ?? ''}
                onChange={(e) => setValues({ ...values, description: e.target.value })}
                className="min-h-[80px] resize-y"
                rows={6}
              />
            </FieldRow>
            <FieldRow label={t('mediaManager.fields.preview')}>
              <MediaPreview record={active} assets={activeAssets} />
            </FieldRow>
            <FieldRow label={t('mediaManager.fields.relatedEntries')}>
              {activeRelations.length === 0 ? (
                <div className="text-muted-foreground text-xs">{t('mediaManager.empty.relatedEntries')}</div>
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
                      <span className="text-muted-foreground me-1.5">{rel.fields?.targetType?.value || target?.recordType || t('mediaManager.targets.record')}</span>
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
                {captureMode === 'camera' ? t('mediaManager.capture.camera') : captureMode === 'video' ? t('mediaManager.capture.video') : t('mediaManager.capture.audio')}
              </h2>
              <Button variant="destructiveOutline" onClick={onCancelCapture} className="ms-auto">{t('mediaManager.actions.cancel')}</Button>
            </div>
            {captureMode === 'camera' ? (
              <>
                <video ref={videoRef} muted playsInline className="w-full max-h-[62vh] bg-black rounded-md border border-border" />
                <div className="flex justify-end gap-2 mt-3">
                  <Button variant="primary" onClick={onCapturePhoto}>{t('mediaManager.capture.photo')}</Button>
                </div>
              </>
            ) : captureMode === 'video' ? (
              <>
                <video ref={videoRef} muted playsInline className="w-full max-h-[62vh] bg-black rounded-md border border-border" />
                <div className="flex items-center gap-2.5 mt-3">
                  <div className="w-5 h-5 rounded-full bg-destructive ring-8 ring-destructive/15" />
                  <span className="text-xs text-muted-foreground">
                    {recording ? t('mediaManager.capture.recordingVideo') : t('mediaManager.capture.preparing')}
                  </span>
                  <Button variant="primary" onClick={onStopVideoRecording} disabled={!recording} className="ms-auto">{t('mediaManager.capture.stopSave')}</Button>
                </div>
              </>
            ) : (
              <>
                <div className="min-h-[160px] border border-border rounded-md bg-background grid place-items-center gap-3 p-5">
                  <div className="text-xs text-muted-foreground">
                    {recording ? t('mediaManager.capture.recordingAudio') : t('mediaManager.capture.audioReady')}
                  </div>
                  <div className="w-5 h-5 rounded-full bg-destructive ring-8 ring-destructive/15" />
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <Button variant="primary" onClick={onStopAudioRecording} disabled={!recording}>{t('mediaManager.capture.stopSave')}</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {imageEditorSrc && (
        <ImageEditingSheet
          src={imageEditorSrc}
          title={t('mediaManager.imageEditorTitle')}
          onCancel={() => setImageEditorSrc(null)}
          onApply={onApplyImageEdit}
        />
      )}

      {addSheetOpen && (
        <AddMediaSheet
          initialTarget={subject}
          busy={workflowBusy}
          onCancel={() => closeWorkflow(setAddSheetOpen)}
          onAdd={onAddFiles}
        />
      )}

      {entryImageOpen && active && (
        <EntryImageSheet
          attachedTargets={activeRelations.map(({ target }) => target).filter(Boolean)}
          busy={workflowBusy}
          onCancel={() => closeWorkflow(setEntryImageOpen)}
          onApply={onApplyEntryImage}
        />
      )}

      {deleteRequest && (
        <DeleteMediaSheet
          mediaRecords={deleteRequest.records}
          references={deleteRequest.references}
          initialTargetId={targetId}
          busy={workflowBusy}
          onCancel={() => { setDeleteRequest(null); requestAnimationFrame(() => workflowReturnFocusRef.current?.focus?.()); }}
          onConfirm={onConfirmDelete}
        />
      )}
    </div>
  );
}

function MoreMenu({ items }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    ref.current?.querySelector('[role="menuitem"]')?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
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
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {t('mediaManager.actions.more')} <span aria-hidden="true">▾</span>
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

function GroupingStylePopover({ preferences, onChange }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const thumbnailSizes = ['small', 'medium', 'large'];

  useEffect(() => {
    if (!open) return undefined;
    rootRef.current?.querySelector('input')?.focus();
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button ref={buttonRef} onClick={() => setOpen((value) => !value)} aria-haspopup="dialog" aria-expanded={open}>
        {t('mediaManager.grouping.button')} <span aria-hidden="true">▾</span>
      </Button>
      {open && (
        <div role="dialog" aria-label={t('mediaManager.grouping.button')} className="absolute start-0 top-full z-30 mt-1 w-72 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-lg">
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold">{t('mediaManager.grouping.sort')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {['title', 'date'].map((value) => (
                <label key={value} className="flex items-center gap-2 text-xs">
                  <input type="radio" name="media-sort" checked={preferences.sortBy === value} onChange={() => onChange({ sortBy: value })} />
                  {t(`mediaManager.grouping.sort${value[0].toUpperCase()}${value.slice(1)}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-3 border-t border-border pt-3">
            <legend className="mb-1.5 text-xs font-semibold">{t('mediaManager.grouping.group')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {['none', 'type', 'year', 'decade'].map((value) => (
                <label key={value} className="flex items-center gap-2 text-xs">
                  <input type="radio" name="media-group" checked={preferences.groupBy === value} onChange={() => onChange({ groupBy: value })} />
                  {t(`mediaManager.grouping.group${value[0].toUpperCase()}${value.slice(1)}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="mt-3 block border-t border-border pt-3 text-xs font-semibold">
            <span className="flex justify-between gap-3">
              <span>{t('mediaManager.grouping.thumbnailSize')}</span>
              <span className="font-normal text-muted-foreground">{t(`mediaManager.grouping.size${preferences.thumbnailSize[0].toUpperCase()}${preferences.thumbnailSize.slice(1)}`)}</span>
            </span>
            <input
              type="range"
              min="0"
              max="2"
              step="1"
              value={thumbnailSizes.indexOf(preferences.thumbnailSize)}
              onChange={(event) => onChange({ thumbnailSize: thumbnailSizes[Number(event.target.value)] })}
              className="mt-2 w-full accent-primary"
            />
          </label>
        </div>
      )}
    </div>
  );
}
