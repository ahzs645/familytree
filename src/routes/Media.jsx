/**
 * Media viewer + editor — gallery view of MediaPicture / MediaPDF / MediaURL /
 * MediaAudio / MediaVideo records. Filter by type. Edit caption/description.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { saveWithChangeLog, logRecordDeleted } from '../lib/changeLog.js';
import { readRef } from '../lib/schema.js';
import { matchMediaFiles } from '../lib/mediaFolderMatch.js';
import { FieldRow, editorInput, editorTextarea } from '../components/editors/FieldRow.jsx';

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

export default function Media() {
  const [media, setMedia] = useState([]);
  const [filter, setFilter] = useState('all');
  const [activeId, setActiveId] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [activeAssets, setActiveAssets] = useState([]);
  const [activeRelations, setActiveRelations] = useState([]);
  const folderRef = React.useRef(null);

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

  const filtered = filter === 'all' ? media : media.filter((m) => m.recordType === filter);
  const active = media.find((m) => m.recordName === activeId);

  return (
    <div style={shell}>
      <header style={header}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={select}>
          {MEDIA_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <span style={{ marginLeft: 'auto', color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>
          {filtered.length} item{filtered.length === 1 ? '' : 's'}
        </span>
        <input ref={folderRef} type="file" multiple webkitdirectory="" className="hidden" onChange={(e) => onMatchFolder(e.target.files)} />
        <button onClick={() => folderRef.current?.click()} style={select}>Match media folder</button>
      </header>

      <div style={body}>
        <div style={gallery}>
          {filtered.length === 0 && (
            <div style={{ color: 'hsl(var(--muted-foreground))', padding: 40, gridColumn: '1 / -1', textAlign: 'center' }}>
              {filter !== 'all' ? `No media of type "${filter}" in this tree.` : 'No media in this tree.'}
            </div>
          )}
          {filtered.map((m) => {
            const isActive = m.recordName === activeId;
            return (
              <div
                key={m.recordName}
                onClick={() => setActiveId(m.recordName)}
                style={{
                  ...tile,
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

        {active && (
          <aside style={detail}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 14, color: 'hsl(var(--foreground))', margin: 0, fontWeight: 600 }}>
                {iconFor(active.recordType)} {active.recordType.replace('Media', '')}
              </h2>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {status && <span style={{ color: '#4ade80', fontSize: 12, marginRight: 6 }}>{status}</span>}
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
                    <div key={rel.recordName} style={{ fontSize: 12, color: 'hsl(var(--foreground))', background: 'hsl(var(--secondary))', borderRadius: 6, padding: 8 }}>
                      <span style={{ color: 'hsl(var(--muted-foreground))', marginRight: 6 }}>{rel.fields?.targetType?.value || target?.recordType || 'Record'}</span>
                      {target?.fields?.cached_fullName?.value || target?.fields?.title?.value || target?.fields?.cached_familyName?.value || target?.recordName || readRef(rel.fields?.target)}
                    </div>
                  ))}
                </div>
              )}
            </FieldRow>
          </aside>
        )}
      </div>
    </div>
  );
}

const shell = { display: 'flex', flexDirection: 'column', height: '100%' };
const header = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' };
const select = { background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: 6, padding: '6px 10px', fontSize: 12 };
const body = { flex: 1, display: 'flex', overflow: 'hidden' };
const gallery = { flex: 1, overflow: 'auto', padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 };
const tile = { padding: 14, border: '1px solid hsl(var(--border))', borderRadius: 8, cursor: 'pointer', minHeight: 110, transition: 'border-color 0.15s, background 0.15s' };
const detail = { width: 360, borderLeft: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', padding: 20, overflow: 'auto' };
const saveBtn = { background: 'hsl(var(--primary))', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 };
const deleteBtn = { background: 'transparent', color: 'hsl(var(--destructive))', border: '1px solid #3a2d30', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' };

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
