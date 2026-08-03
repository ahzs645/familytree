import React, { useEffect, useRef, useState } from 'react';
import { Heart, Shield, Sparkles, Trees } from 'lucide-react';
import { Sheet } from './ui/Sheet.jsx';
import { Button } from './ui/Button.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { getTreeArtworkMedia, normalizeTreeArtwork, setTreeSnapshotArtwork } from '../lib/treeLibrary.js';

const GRID_CLASSES = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };
const CRESTS = { tree: Trees, shield: Shield, heart: Heart, star: Sparkles };

export function TreeArtwork({ snapshot, className = 'h-12 w-12' }) {
  const artwork = normalizeTreeArtwork(snapshot?.artwork);
  const images = snapshot?.artworkImages || [];
  if ((artwork.mode === 'single' || artwork.mode === 'mosaic') && images.length) {
    const visible = artwork.mode === 'single' ? images.slice(0, 1) : images.slice(0, artwork.gridSize ** 2);
    return (
      <span className={`${className} grid shrink-0 overflow-hidden rounded-lg border border-border bg-secondary ${GRID_CLASSES[artwork.mode === 'single' ? 1 : artwork.gridSize]}`} aria-hidden>
        {visible.map((src, index) => <img key={`${index}-${src.slice(-16)}`} src={src} alt="" className="h-full min-h-0 w-full object-cover" />)}
      </span>
    );
  }
  const Crest = CRESTS[artwork.crest] || Trees;
  return <span className={`${className} inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-primary/10 text-interactive`} aria-hidden><Crest className="h-1/2 w-1/2" /></span>;
}

export function TreeArtworkEditorSheet({ snapshot, onClose, onSaved }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => normalizeTreeArtwork(snapshot?.artwork));
  const [media, setMedia] = useState([]);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getTreeArtworkMedia(snapshot.id).then((items) => { if (!cancelled) setMedia(items); });
    requestAnimationFrame(() => cancelRef.current?.focus());
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { cancelled = true; document.removeEventListener('keydown', onKey); };
  }, [snapshot.id, onClose]);

  const chooseMedia = (id) => {
    if (draft.mode === 'single') setDraft((current) => ({ ...current, mediaIds: [id] }));
    else setDraft((current) => ({ ...current, mediaIds: current.mediaIds.includes(id) ? current.mediaIds.filter((item) => item !== id) : [...current.mediaIds, id].slice(0, 16) }));
  };

  const save = async () => {
    setSaving(true);
    await setTreeSnapshotArtwork(snapshot.id, draft);
    await onSaved?.();
    onClose();
  };

  return (
    <Sheet
      title={t('treeArtwork.title')}
      subtitle={snapshot.name}
      ariaLabel={t('treeArtwork.title')}
      dialogRef={dialogRef}
      scroll="card"
      maxWidth="max-w-xl"
      footer={<><Button ref={cancelRef} variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={save} disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button></>}
    >
      <fieldset>
        <legend className="mb-2 text-xs font-semibold text-muted-foreground">{t('treeArtwork.mode')}</legend>
        <div className="grid grid-cols-3 gap-2">
          {['crest', 'single', 'mosaic'].map((mode) => <label key={mode} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm"><input type="radio" name="artwork-mode" value={mode} checked={draft.mode === mode} onChange={() => setDraft((current) => ({ ...current, mode }))} />{t(`treeArtwork.modes.${mode}`)}</label>)}
        </div>
      </fieldset>
      {draft.mode === 'crest' ? (
        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-muted-foreground">{t('treeArtwork.crest')}</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CRESTS).map(([id, Icon]) => <label key={id} className={`inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-md border ${draft.crest === id ? 'border-primary bg-primary/10 text-interactive' : 'border-border bg-secondary'}`}><input type="radio" name="crest" value={id} checked={draft.crest === id} onChange={() => setDraft((current) => ({ ...current, crest: id }))} className="sr-only" /><Icon aria-label={t(`treeArtwork.crests.${id}`)} /></label>)}
          </div>
        </fieldset>
      ) : (
        <>
          {draft.mode === 'mosaic' && <label className="grid gap-1 text-xs text-muted-foreground">{t('treeArtwork.gridSize')}<select value={draft.gridSize} onChange={(event) => setDraft((current) => ({ ...current, gridSize: Number(event.target.value) }))} className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground">{[1, 2, 3, 4].map((size) => <option key={size} value={size}>{size} × {size}</option>)}</select></label>}
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-muted-foreground">{t('treeArtwork.pictures')}</legend>
            {media.length === 0 ? <p className="text-sm text-muted-foreground">{t('treeArtwork.noPictures')}</p> : <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{media.map((item) => {
              const checked = draft.mediaIds.includes(item.id);
              return <label key={item.id} className={`cursor-pointer overflow-hidden rounded-md border p-1 ${checked ? 'border-primary ring-1 ring-primary' : 'border-border'}`}><input type={draft.mode === 'single' ? 'radio' : 'checkbox'} name="tree-picture" checked={checked} onChange={() => chooseMedia(item.id)} className="sr-only" /><img src={item.src} alt="" className="aspect-square w-full rounded object-cover" /><span className="mt-1 block truncate text-xs">{item.label}</span></label>;
            })}</div>}
          </fieldset>
        </>
      )}
    </Sheet>
  );
}

export default TreeArtwork;
