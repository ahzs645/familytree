/**
 * Media viewer + editor — gallery view of MediaPicture / MediaPDF / MediaURL /
 * MediaAudio / MediaVideo records. Filter by type. Edit caption/description.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  const [subject, setSubject] = useState(null);
  const [captureMode, setCaptureMode] = useState(null);
  const [captureStream, setCaptureStream] = useState(null);
  const [recording, setRecording] = useState(false);
  const folderRef = React.useRef(null);
  const addFilesRef = React.useRef(null);
  const replaceFileRef = React.useRef(null);
  const videoRef = React.useRef(null);
  const mediaRecorderRef = React.useRef(null);
  const recorderChunksRef = React.useRef([]);
  const audioCanceledRef = React.useRef(false);

  const reload = useCallback(async () => {
    const db = getLocalDatabase();
    const all = [];
    for (const t of MEDIA_TYPES.slice(1)) {
      const { records } = await db.query(t.id, { limit: 100000 });
      all.push(...records);
    }
    setMedia(all);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (captureMode !== 'camera' || !videoRef.current || !captureStream) return;
    videoRef.current.srcObject = captureStream;
    videoRef.current.play().catch(() => {});
  }, [captureMode, captureStream]);

  useEffect(() => () => {
    stopStream(captureStream);
  }, [captureStream]);

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
    if (!confirm('Delete this media record?')) return;
    const db = getLocalDatabase();
    await db.deleteRecord(m.recordName);
    await logRecordDeleted(m.recordName, m.recordType);
    await reload();
    setActiveId(null);
  }, [activeId, media, reload]);

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
    const url = prompt('Media URL:');
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
  }, [reload]);

  const active = media.find((m) => m.recordName === activeId);

  const onReplaceFile = useCallback(async (files) => {
    const file = files?.[0];
    const m = media.find((r) => r.recordName === activeId);
    if (!file || !m) return;
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

  const onStartCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Camera capture is not available in this browser.');
      return;
    }
    setStatus('Starting camera…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setCaptureStream(stream);
      setCaptureMode('camera');
      setStatus('Camera ready.');
    } catch (error) {
      setStatus(`Camera failed: ${error.message}`);
    }
  }, []);

  const onCapturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      setStatus('Camera preview is not ready yet.');
      return;
    }
    setStatus('Capturing photo…');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToBlob(canvas, 'image/png');
      const record = await createMediaRecordFromBlob(blob, {
        filename: `camera-${new Date().toISOString().replace(/[:.]/g, '-')}.png`,
        caption: 'Camera capture',
        recordType: 'MediaPicture',
      });
      stopStream(captureStream);
      setCaptureStream(null);
      setCaptureMode(null);
      await reload();
      setActiveId(record.recordName);
      setStatus('Photo captured.');
    } catch (error) {
      setStatus(`Photo capture failed: ${error.message}`);
    }
  }, [captureStream, reload]);

  const onStartAudioRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setStatus('Audio recording is not available in this browser.');
      return;
    }
    setStatus('Starting audio recorder…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const recorder = new MediaRecorder(stream);
      recorderChunksRef.current = [];
      audioCanceledRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data?.size) recorderChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const canceled = audioCanceledRef.current;
        stopStream(stream);
        setCaptureStream(null);
        setCaptureMode(null);
        setRecording(false);
        if (canceled) {
          setStatus('Audio recording canceled.');
          return;
        }
        try {
          const type = recorder.mimeType || 'audio/webm';
          const blob = new Blob(recorderChunksRef.current, { type });
          const extension = type.includes('mp4') || type.includes('m4a') ? 'm4a' : type.includes('mpeg') ? 'mp3' : 'webm';
          const record = await createMediaRecordFromBlob(blob, {
            filename: `recording-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`,
            caption: 'Audio recording',
            recordType: 'MediaAudio',
          });
          await reload();
          setActiveId(record.recordName);
          setStatus('Audio recording saved.');
        } catch (error) {
          setStatus(`Audio save failed: ${error.message}`);
        }
      };
      mediaRecorderRef.current = recorder;
      setCaptureStream(stream);
      setCaptureMode('audio');
      setRecording(true);
      recorder.start();
      setStatus('Recording audio…');
    } catch (error) {
      setStatus(`Audio recording failed: ${error.message}`);
    }
  }, [reload]);

  const onStopAudioRecording = useCallback(() => {
    audioCanceledRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
  }, []);

  const onCancelCapture = useCallback(() => {
    audioCanceledRef.current = true;
    if (mediaRecorderRef.current?.state && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      return;
    }
    stopStream(captureStream);
    setCaptureStream(null);
    setCaptureMode(null);
    setRecording(false);
    setStatus('Capture canceled.');
  }, [captureStream]);

  const onEditImage = useCallback(async (operation) => {
    if (!active || active.recordType !== 'MediaPicture') return;
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
        <button onClick={() => setMode(readOnlyGallery ? 'editor' : 'gallery')} style={select}>
          {readOnlyGallery ? 'Edit records' : 'Gallery report'}
        </button>
        {!readOnlyGallery && <button onClick={() => addFilesRef.current?.click()} style={select}>Add files</button>}
        {!readOnlyGallery && <button onClick={onAddURL} style={select}>Add URL</button>}
        {!readOnlyGallery && <button onClick={onStartCamera} style={select}>Camera</button>}
        {!readOnlyGallery && <button onClick={onStartAudioRecording} style={select}>Record audio</button>}
        {!readOnlyGallery && <button onClick={() => folderRef.current?.click()} style={select}>Match media folder</button>}
      </header>

      <div style={body}>
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
                }}
              >
                <div style={{ fontSize: 38, lineHeight: 1, marginBottom: 6 }}>{iconFor(m.recordType)}</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 2, wordBreak: 'break-word' }}>
                  {m.fields?.caption?.value || m.fields?.filename?.value || m.fields?.fileName?.value || m.fields?.url?.value || m.recordName}
                </div>
                <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{m.recordType.replace('Media', '')}</div>
              </div>
            );
          })}
        </div>

        {active && (readOnlyGallery ? (
          <GalleryDetail
            record={active}
            assets={activeAssets}
            relations={activeRelations}
            onOpenRelated={(target) => {
              const route = routeForRecord(target);
              if (route) navigate(route);
            }}
          />
        ) : (
          <aside style={detail}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 14, color: 'hsl(var(--foreground))', margin: 0, fontWeight: 600 }}>
                {iconFor(active.recordType)} {active.recordType.replace('Media', '')}
              </h2>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {status && <span style={{ color: '#4ade80', fontSize: 12, marginRight: 6 }}>{status}</span>}
                {active.recordType !== 'MediaURL' && <button onClick={() => replaceFileRef.current?.click()} style={deleteBtn}>Replace</button>}
                {active.recordType === 'MediaPicture' && <button onClick={() => onEditImage('rotate')} style={deleteBtn}>Rotate</button>}
                {active.recordType === 'MediaPicture' && <button onClick={() => onEditImage('crop-square')} style={deleteBtn}>Crop</button>}
                <button onClick={onDelete} style={deleteBtn}>Delete</button>
                <button onClick={onSave} disabled={saving} style={saveBtn}>{saving ? 'Saving…' : 'Save'}</button>
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

const shell = { display: 'flex', flexDirection: 'column', height: '100%' };
const header = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' };
const select = { background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: 6, padding: '6px 10px', fontSize: 12 };
const body = { flex: 1, display: 'flex', overflow: 'hidden' };
const gallery = { flex: 1, overflow: 'auto', padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 };
const galleryReport = { flex: 1, overflow: 'auto', padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14, alignContent: 'start' };
const tile = { padding: 14, border: '1px solid hsl(var(--border))', borderRadius: 8, cursor: 'pointer', minHeight: 110, transition: 'border-color 0.15s, background 0.15s' };
const reportTile = { ...tile, minHeight: 150, display: 'flex', flexDirection: 'column', justifyContent: 'center' };
const detail = { width: 360, borderLeft: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', padding: 20, overflow: 'auto' };
const saveBtn = { background: 'hsl(var(--primary))', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 };
const deleteBtn = { background: 'transparent', color: 'hsl(var(--destructive))', border: '1px solid #3a2d30', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' };
const modalBackdrop = { position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.62)', display: 'grid', placeItems: 'center', padding: 20 };
const modal = { width: 'min(720px, 94vw)', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.45)' };
const videoPreview = { width: '100%', maxHeight: '62vh', background: '#000', borderRadius: 8, border: '1px solid hsl(var(--border))' };
const audioCapturePanel = { minHeight: 160, border: '1px solid hsl(var(--border))', borderRadius: 8, background: 'hsl(var(--background))', display: 'grid', placeItems: 'center', gap: 12, padding: 20 };
const recordingDot = { width: 22, height: 22, borderRadius: 999, background: '#ef4444', boxShadow: '0 0 0 8px rgba(239,68,68,0.16)' };

function stopStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

function canvasToBlob(canvas, type) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not encode this image.'));
    }, type);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The stored image could not be decoded.'));
    image.src = src;
  });
}

function editedFilename(fileName, operation, mimeType) {
  const ext = mimeType === 'image/jpeg' ? '.jpg' : '.png';
  const base = String(fileName || 'image').replace(/\.[^.]+$/, '');
  return `${base}-${operation}${ext}`;
}

function GalleryDetail({ record, assets, relations, onOpenRelated }) {
  const title = record.fields?.caption?.value || record.fields?.filename?.value || record.fields?.fileName?.value || record.fields?.url?.value || record.recordName;
  const description = record.fields?.description?.value || record.fields?.userDescription?.value || '';

  return (
    <aside style={{ ...detail, width: 420 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>{record.recordType.replace('Media', '')}</div>
        <h2 style={{ fontSize: 16, color: 'hsl(var(--foreground))', margin: '4px 0 0', fontWeight: 700, lineHeight: 1.25 }}>{title}</h2>
      </div>
      <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 10, background: 'hsl(var(--background))', marginBottom: 14 }}>
        <MediaPreview record={record} assets={assets} />
      </div>
      {description && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>Description</div>
          <div style={{ color: 'hsl(var(--foreground))', fontSize: 13, lineHeight: 1.55 }}>{description}</div>
        </div>
      )}
      <div>
        <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Related Entries</div>
        {relations.length === 0 ? (
          <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>No related entries.</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {relations.map(({ rel, target }) => (
              <button
                key={rel.recordName}
                type="button"
                onClick={() => onOpenRelated(target)}
                style={{ fontSize: 12, color: 'hsl(var(--foreground))', background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))', borderRadius: 6, padding: 8, textAlign: 'left', cursor: routeForRecord(target) ? 'pointer' : 'default' }}
              >
                <span style={{ color: 'hsl(var(--muted-foreground))', marginRight: 6 }}>{rel.fields?.targetType?.value || target?.recordType || 'Record'}</span>
                {recordDisplayLabel(target) || target?.recordName || readRef(rel.fields?.target)}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function MediaPreview({ record, assets }) {
  const asset = assets[0];
  if (record.recordType === 'MediaURL' && record.fields?.url?.value) {
    return <a href={record.fields.url.value} target="_blank" rel="noreferrer" style={{ color: 'hsl(var(--primary))', fontSize: 12 }}>{record.fields.url.value}</a>;
  }
  if (!asset?.dataBase64) {
    return <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>No local asset stored for this media record.</div>;
  }
  const src = `data:${asset.mimeType || 'application/octet-stream'};base64,${asset.dataBase64}`;
  if (record.recordType === 'MediaPicture') return <img src={src} alt="" style={{ maxWidth: '100%', borderRadius: 6, border: '1px solid hsl(var(--border))' }} />;
  if (record.recordType === 'MediaPDF') return <iframe title={asset.filename || record.recordName} src={src} style={{ width: '100%', height: 280, border: '1px solid hsl(var(--border))', borderRadius: 6 }} />;
  if (record.recordType === 'MediaAudio') return <audio controls src={src} style={{ width: '100%' }} />;
  if (record.recordType === 'MediaVideo') return <video controls src={src} style={{ width: '100%', borderRadius: 6 }} />;
  return <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>{asset.filename || asset.assetId}</div>;
}
