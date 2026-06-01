/**
 * Media viewer + editor — gallery view of MediaPicture / MediaPDF / MediaURL /
 * MediaAudio / MediaVideo records. Filter by type. Edit caption/description.
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { saveWithChangeLog, logRecordDeleted } from '../lib/changeLog.js';
import { readRef } from '../lib/schema.js';
import {
  createMediaRecordFromBlob,
  createMediaRecordsFromFiles,
  createMediaURLRecord,
  matchMediaFiles,
  replaceMediaRecordAsset,
  replaceMediaRecordImageData,
} from '../lib/mediaFolderMatch.js';
import { FieldRow, editorInput, editorTextarea } from '../components/editors/FieldRow.jsx';
import { recordDisplayLabel } from '../components/editors/RelatedRecordEditors.jsx';
import { useModal } from '../contexts/ModalContext.jsx';
import { buildMediaSlideshowSearchParams } from '../lib/mediaPresentation.js';
import { useIsMobile } from '../lib/useIsMobile.js';
import { GalleryDetail } from '../components/media/GalleryDetail.jsx';
import { MediaPreview } from '../components/media/MediaPreview.jsx';
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
    const db = getLocalDatabase();
    const all = [];
    for (const t of MEDIA_TYPES.slice(1)) {
      const { records } = await db.query(t.id, { limit: 100000 });
      all.push(...records);
    }
    setMedia(all);
    setLoadSeq((n) => n + 1);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const {
    captureMode,
    recording,
    videoRef,
    onStartCamera,
    onCapturePhoto,
    onStartAudioRecording,
    onStopAudioRecording,
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
      const db = getLocalDatabase();
      const [rels, target] = await Promise.all([
        db.query('MediaRelation', { referenceField: 'target', referenceValue: targetId, limit: 100000 }),
        db.getRecord(targetId),
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
      const db = getLocalDatabase();
      const ids = m.fields?.assetIds?.value || [];
      const storedAssets = ids.length ? (await Promise.all(ids.map((id) => db.getAsset(id)))).filter(Boolean) : await db.listAssetsForRecord(m.recordName);
      setActiveAssets(storedAssets);
      const rels = await db.query('MediaRelation', { limit: 100000 });
      const related = [];
      for (const rel of rels.records.filter((r) => readRef(r.fields?.media) === m.recordName)) {
        const targetId = readRef(rel.fields?.target);
        const target = targetId ? await db.getRecord(targetId) : null;
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
    const db = getLocalDatabase();
    await db.deleteRecord(m.recordName);
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

  useEffect(() => {
    if (mediaIdParam && filtered.some((m) => m.recordName === mediaIdParam)) {
      setActiveId(mediaIdParam);
      return;
    }
    if (activeId && filtered.some((m) => m.recordName === activeId)) return;
    setActiveId(filtered[0]?.recordName || null);
  }, [activeId, filtered, mediaIdParam]);

  return (
    <div style={shell}>
      <header style={header}>
        <div style={{ minWidth: 160 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--foreground))' }}>Media Gallery</div>
          {targetId ? (
            <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
              {readOnlyGallery ? 'Read-only gallery' : 'Editor'} · filtered by {subjectLabel || targetId}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
              {readOnlyGallery ? 'Read-only gallery report' : 'Browse and edit media records'}
            </div>
          )}
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={select}>
          {MEDIA_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <span style={{ marginLeft: 'auto', color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>
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
          <button onClick={clearSubject} style={select}>Clear subject</button>
        )}
        <button onClick={selectVisible} disabled={!filtered.length} style={select}>Select visible</button>
        <button onClick={clearSelection} disabled={!selectedIds.length} style={select}>Clear selection</button>
        {!readOnlyGallery && <button onClick={() => addFilesRef.current?.click()} style={select}>Add files</button>}
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
            !readOnlyGallery && { label: 'Match media folder', onClick: () => folderRef.current?.click() },
          ]}
        />
      </header>

      <div style={isMobile ? bodyMobile : body}>
        {(!isMobile || !active) && (
        <div style={readOnlyGallery ? galleryReport : gallery}>
          {filtered.length === 0 && (
            <div style={{ color: 'hsl(var(--muted-foreground))', padding: 40, gridColumn: '1 / -1', textAlign: 'center' }}>
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
                style={{
                  ...(readOnlyGallery ? reportTile : tile),
                  borderColor: isActive ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                  background: isActive ? 'hsl(var(--accent))' : 'hsl(var(--card))',
                  position: 'relative',
                }}
              >
                <label
                  aria-label={`Select ${m.fields?.caption?.value || m.recordName}`}
                  onClick={(event) => event.stopPropagation()}
                  style={selectionControl}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelected(m.recordName)}
                  />
                </label>
                <div style={{ fontSize: 38, lineHeight: 1, marginBottom: 6 }}>{iconFor(m.recordType)}</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 2, wordBreak: 'break-word' }}>
                  {m.fields?.caption?.value || m.fields?.filename?.value || m.fields?.fileName?.value || m.fields?.url?.value || m.recordName}
                </div>
                <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{m.recordType.replace('Media', '')}</div>
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
          <aside style={isMobile ? detailMobile : detail}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
              {isMobile && (
                <button onClick={() => setActiveId(null)} style={deleteBtn} aria-label="Back to gallery">← Back</button>
              )}
              <h2 style={{ fontSize: 14, color: 'hsl(var(--foreground))', margin: 0, fontWeight: 600 }}>
                {iconFor(active.recordType)} {active.recordType.replace('Media', '')}
              </h2>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <SaveStatus status={status} dirty={dirty} />
                <RecordLockButton record={active} saving={saving} onToggle={onToggleLock} />
                {active.recordType !== 'MediaURL' && <button onClick={() => replaceFileRef.current?.click()} disabled={isRecordLocked(active)} style={deleteBtn}>Replace</button>}
                {active.recordType === 'MediaPicture' && <button onClick={() => onEditImage('rotate')} disabled={isRecordLocked(active)} style={deleteBtn}>Rotate</button>}
                {active.recordType === 'MediaPicture' && <button onClick={() => onEditImage('crop-square')} disabled={isRecordLocked(active)} style={deleteBtn}>Crop</button>}
                <button onClick={onDelete} disabled={isRecordLocked(active)} style={deleteBtn}>Delete</button>
                <button onClick={onSave} disabled={saving || isRecordLocked(active) || !dirty} title="Save (⌘/Ctrl+S)" style={saveBtn}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
            <FieldRow label="Caption">
              <input value={values.caption ?? ''} onChange={(e) => setValues({ ...values, caption: e.target.value })} style={editorInput} />
            </FieldRow>
            {active.recordType === 'MediaURL' && (
              <FieldRow label="URL">
                <input value={values.url ?? ''} onChange={(e) => setValues({ ...values, url: e.target.value })} style={editorInput} />
              </FieldRow>
            )}
            {values.filename && (
              <FieldRow label="Filename">
                <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12, fontFamily: '"SF Mono", Consolas, monospace' }}>
                  {values.filename}
                </div>
              </FieldRow>
            )}
            <FieldRow label="Description">
              <textarea
                value={values.description ?? ''}
                onChange={(e) => setValues({ ...values, description: e.target.value })}
                style={editorTextarea}
                rows={6}
              />
            </FieldRow>
            <FieldRow label="Preview">
              <MediaPreview record={active} assets={activeAssets} />
            </FieldRow>
            <FieldRow label="Related Entries">
              {activeRelations.length === 0 ? (
                <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>No related entries.</div>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {activeRelations.map(({ rel, target }) => (
                    <button
                      key={rel.recordName}
                      type="button"
                      onClick={() => {
                        const route = routeForRecord(target);
                        if (route) navigate(route);
                      }}
                      style={{ fontSize: 12, color: 'hsl(var(--foreground))', background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))', borderRadius: 6, padding: 8, textAlign: 'left', cursor: routeForRecord(target) ? 'pointer' : 'default' }}
                    >
                      <span style={{ color: 'hsl(var(--muted-foreground))', marginRight: 6 }}>{rel.fields?.targetType?.value || target?.recordType || 'Record'}</span>
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
        <div style={modalBackdrop}>
          <div style={modal}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                {captureMode === 'camera' ? 'Camera capture' : 'Audio recording'}
              </h2>
              <button onClick={onCancelCapture} style={{ ...deleteBtn, marginLeft: 'auto' }}>Cancel</button>
            </div>
            {captureMode === 'camera' ? (
              <>
                <video ref={videoRef} muted playsInline style={videoPreview} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button onClick={onCapturePhoto} style={saveBtn}>Capture photo</button>
                </div>
              </>
            ) : (
              <>
                <div style={audioCapturePanel}>
                  <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                    {recording ? 'Recording from the selected microphone.' : 'Audio recorder is ready.'}
                  </div>
                  <div style={recordingDot} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button onClick={onStopAudioRecording} disabled={!recording} style={saveBtn}>Stop and save</button>
                </div>
              </>
            )}
          </div>
        </div>
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
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={select}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        More <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div role="menu" style={moreMenuPanel}>
          {visible.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => { setOpen(false); item.onClick(); }}
              style={moreMenuItem}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const shell = { display: 'flex', flexDirection: 'column', height: '100%' };
const header = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', flexWrap: 'wrap' };
const select = { background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: 6, padding: '6px 10px', fontSize: 12 };
const moreMenuPanel = { position: 'absolute', insetInlineEnd: 0, top: '100%', zIndex: 20, marginTop: 4, minWidth: 180, background: 'hsl(var(--popover, var(--card)))', color: 'hsl(var(--popover-foreground, var(--foreground)))', border: '1px solid hsl(var(--border))', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.35)', padding: 4, display: 'flex', flexDirection: 'column' };
const moreMenuItem = { width: '100%', textAlign: 'start', background: 'transparent', color: 'inherit', border: 'none', borderRadius: 6, padding: '8px 10px', fontSize: 13, cursor: 'pointer' };
const body = { flex: 1, display: 'flex', overflow: 'hidden' };
const bodyMobile = { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const gallery = { flex: 1, overflow: 'auto', padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 };
const galleryReport = { flex: 1, overflow: 'auto', padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14, alignContent: 'start' };
const tile = { padding: 14, border: '1px solid hsl(var(--border))', borderRadius: 8, cursor: 'pointer', minHeight: 110, transition: 'border-color 0.15s, background 0.15s' };
const reportTile = { ...tile, minHeight: 150, display: 'flex', flexDirection: 'column', justifyContent: 'center' };
const selectionControl = { position: 'absolute', top: 8, right: 8, display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: 6, background: 'hsl(var(--background) / 0.86)', border: '1px solid hsl(var(--border))', cursor: 'pointer' };
const detail = { width: 360, borderInlineStart: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', padding: 20, overflow: 'auto' };
const detailMobile = { width: '100%', flex: 1, background: 'hsl(var(--card))', padding: 16, overflow: 'auto' };
const saveBtn = { background: 'hsl(var(--primary))', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 };
const deleteBtn = { background: 'transparent', color: 'hsl(var(--destructive))', border: '1px solid #3a2d30', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' };
const modalBackdrop = { position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.62)', display: 'grid', placeItems: 'center', padding: 20 };
const modal = { width: 'min(720px, 94vw)', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.45)' };
const videoPreview = { width: '100%', maxHeight: '62vh', background: '#000', borderRadius: 8, border: '1px solid hsl(var(--border))' };
const audioCapturePanel = { minHeight: 160, border: '1px solid hsl(var(--border))', borderRadius: 8, background: 'hsl(var(--background))', display: 'grid', placeItems: 'center', gap: 12, padding: 20 };
const recordingDot = { width: 22, height: 22, borderRadius: 999, background: '#ef4444', boxShadow: '0 0 0 8px rgba(239,68,68,0.16)' };
