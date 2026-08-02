import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { getAppDataClient } from '../../lib/data/AppDataClient.js';
import { ENTRY_IMAGE_TARGET_TYPES } from '../../lib/mediaManagement.js';
import { readRef } from '../../lib/schema.js';
import { recordDisplayLabel } from '../editors/RelatedRecordEditors.jsx';
import { Button } from '../ui/Button.jsx';
import { Sheet } from '../ui/Sheet.jsx';
import { formClasses } from '../ui/formClasses.js';

const ADD_TARGET_GROUPS = [
  { id: 'Person', types: ['Person'] },
  { id: 'Family', types: ['Family'] },
  { id: 'Event', types: ['PersonEvent', 'FamilyEvent'] },
  { id: 'Source', types: ['Source'] },
  { id: 'Place', types: ['Place'] },
];

function useSheetBehavior(dialogRef, onCancel) {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const focusable = () => [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
    (dialog.querySelector('[autofocus]') || focusable()[0])?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = focusable();
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener('keydown', onKeyDown);
    return () => dialog.removeEventListener('keydown', onKeyDown);
  }, [dialogRef, onCancel]);
}

async function loadTargets(types) {
  const rows = await Promise.all(types.map((type) => getAppDataClient().records.query(type, { limit: 100000 })));
  return rows.flatMap(({ records }) => records).sort((a, b) => recordDisplayLabel(a).localeCompare(recordDisplayLabel(b)));
}

export function AddMediaSheet({ initialTarget, onAdd, onCancel, busy = false }) {
  const { t } = useTranslation();
  const dialogRef = useRef(null);
  const initialGroup = ADD_TARGET_GROUPS.find((group) => group.types.includes(initialTarget?.recordType))?.id || 'Person';
  const [targetGroup, setTargetGroup] = useState(initialGroup);
  const [targets, setTargets] = useState([]);
  const [targetId, setTargetId] = useState(initialTarget?.recordName || '');
  const [files, setFiles] = useState([]);
  useSheetBehavior(dialogRef, onCancel);

  useEffect(() => {
    let cancelled = false;
    const group = ADD_TARGET_GROUPS.find((candidate) => candidate.id === targetGroup) || ADD_TARGET_GROUPS[0];
    loadTargets(group.types).then((records) => {
      if (cancelled) return;
      setTargets(records);
      setTargetId((current) => records.some((record) => record.recordName === current) ? current : '');
    });
    return () => { cancelled = true; };
  }, [targetGroup]);

  const target = targets.find((record) => record.recordName === targetId) || (initialTarget?.recordName === targetId ? initialTarget : null);
  return (
    <Sheet
      dialogRef={dialogRef}
      title={t('mediaManager.add.title')}
      subtitle={target ? t('mediaManager.add.selected', { name: recordDisplayLabel(target) }) : t('mediaManager.add.subtitle')}
      ariaLabel={t('mediaManager.add.title')}
      maxWidth="max-w-xl"
      footer={(
        <>
          <Button onClick={onCancel} disabled={busy}>{t('mediaManager.actions.cancel')}</Button>
          <Button variant="primary" onClick={() => onAdd(files, target)} disabled={busy || !target || !files.length}>
            {busy ? t('mediaManager.add.adding') : t('mediaManager.add.addButton', { count: files.length })}
          </Button>
        </>
      )}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium">
          {t('mediaManager.add.containerType')}
          <select autoFocus value={targetGroup} onChange={(event) => setTargetGroup(event.target.value)} className={`${formClasses.input} mt-1`}>
            {ADD_TARGET_GROUPS.map((group) => <option key={group.id} value={group.id}>{t(`mediaManager.targets.${group.id.toLowerCase()}`)}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium">
          {t('mediaManager.add.container')}
          <select value={targetId} onChange={(event) => setTargetId(event.target.value)} className={`${formClasses.input} mt-1`} dir="auto">
            <option value="">{t('mediaManager.add.chooseContainer')}</option>
            {targets.map((record) => <option key={record.recordName} value={record.recordName}>{recordDisplayLabel(record)}</option>)}
          </select>
        </label>
      </div>
      <label className={`block rounded-md border border-dashed p-5 text-center ${target ? 'border-border cursor-pointer hover:bg-accent' : 'border-border opacity-50 cursor-not-allowed'}`}>
        <span className="block text-sm font-medium">{t('mediaManager.add.dropMessage')}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{files.length ? t('mediaManager.add.filesChosen', { count: files.length }) : t('mediaManager.add.fileTypes')}</span>
        <input
          type="file"
          multiple
          accept="image/*,application/pdf,audio/*,video/*"
          className="sr-only"
          disabled={!target}
          onChange={(event) => setFiles([...event.target.files])}
        />
      </label>
    </Sheet>
  );
}

export function EntryImageSheet({ attachedTargets = [], onApply, onCancel, busy = false }) {
  const { t } = useTranslation();
  const dialogRef = useRef(null);
  const [targets, setTargets] = useState(attachedTargets.filter((record) => ENTRY_IMAGE_TARGET_TYPES.includes(record?.recordType)));
  const [targetId, setTargetId] = useState(targets[0]?.recordName || '');
  useSheetBehavior(dialogRef, onCancel);

  useEffect(() => {
    let cancelled = false;
    loadTargets(ENTRY_IMAGE_TARGET_TYPES).then((all) => {
      if (cancelled) return;
      const attachedIds = new Set(attachedTargets.map((record) => record?.recordName));
      const ordered = [...all].sort((a, b) => Number(attachedIds.has(b.recordName)) - Number(attachedIds.has(a.recordName)));
      setTargets(ordered);
      setTargetId((current) => current || ordered[0]?.recordName || '');
    });
    return () => { cancelled = true; };
  }, [attachedTargets]);

  const target = targets.find((record) => record.recordName === targetId);
  const attachedIds = useMemo(() => new Set(attachedTargets.map((record) => record?.recordName)), [attachedTargets]);
  return (
    <Sheet
      dialogRef={dialogRef}
      title={t('mediaManager.entryImage.title')}
      subtitle={t('mediaManager.entryImage.subtitle')}
      ariaLabel={t('mediaManager.entryImage.title')}
      footer={(
        <>
          <Button onClick={onCancel} disabled={busy}>{t('mediaManager.actions.cancel')}</Button>
          <Button variant="primary" onClick={() => onApply(target)} disabled={busy || !target}>
            {busy ? t('mediaManager.entryImage.applying') : t('mediaManager.entryImage.apply')}
          </Button>
        </>
      )}
    >
      <label className="block text-xs font-medium">
        {t('mediaManager.entryImage.target')}
        <select autoFocus value={targetId} onChange={(event) => setTargetId(event.target.value)} className={`${formClasses.input} mt-1`} dir="auto">
          <option value="">{t('mediaManager.entryImage.chooseTarget')}</option>
          {targets.map((record) => (
            <option key={record.recordName} value={record.recordName}>
              {attachedIds.has(record.recordName) ? `${t('mediaManager.entryImage.attached')} — ` : ''}{recordDisplayLabel(record)}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">{t('mediaManager.entryImage.attachHint')}</p>
    </Sheet>
  );
}

export function DeleteMediaSheet({ mediaRecords, references = [], initialTargetId = '', onConfirm, onCancel, busy = false }) {
  const { t } = useTranslation();
  const dialogRef = useRef(null);
  const targetMap = new Map(references.map(({ rel, target }) => [target?.recordName || readRef(rel?.fields?.target), target]).filter(([id]) => id));
  const targets = [...targetMap.entries()];
  const [mode, setMode] = useState(references.length ? 'detach' : 'delete');
  const [targetId, setTargetId] = useState(initialTargetId && targetMap.has(initialTargetId) ? initialTargetId : targets[0]?.[0] || '');
  useSheetBehavior(dialogRef, onCancel);

  return (
    <Sheet
      dialogRef={dialogRef}
      title={t('mediaManager.delete.title')}
      subtitle={t('mediaManager.delete.summary', { mediaCount: mediaRecords.length, referenceCount: references.length })}
      ariaLabel={t('mediaManager.delete.title')}
      footer={(
        <>
          <Button onClick={onCancel} disabled={busy}>{t('mediaManager.actions.cancel')}</Button>
          <Button variant={mode === 'delete' ? 'destructive' : 'primary'} onClick={() => onConfirm(mode, targetId)} disabled={busy || (mode === 'detach' && !targetId)}>
            {busy ? t('mediaManager.delete.working') : mode === 'detach' ? t('mediaManager.delete.detachButton') : t('mediaManager.delete.deleteButton')}
          </Button>
        </>
      )}
    >
      <fieldset className="space-y-2">
        <legend className="sr-only">{t('mediaManager.delete.choice')}</legend>
        {references.length > 0 && (
          <label className="flex items-start gap-2 rounded-md border border-border p-3 cursor-pointer">
            <input autoFocus type="radio" name="media-delete-mode" value="detach" checked={mode === 'detach'} onChange={() => setMode('detach')} className="mt-0.5" />
            <span><span className="block text-sm font-medium">{t('mediaManager.delete.detach')}</span><span className="block text-xs text-muted-foreground">{t('mediaManager.delete.detachHint')}</span></span>
          </label>
        )}
        <label className="flex items-start gap-2 rounded-md border border-destructive/40 p-3 cursor-pointer">
          <input autoFocus={!references.length} type="radio" name="media-delete-mode" value="delete" checked={mode === 'delete'} onChange={() => setMode('delete')} className="mt-0.5" />
          <span><span className="block text-sm font-medium text-destructive-text">{t('mediaManager.delete.everywhere')}</span><span className="block text-xs text-muted-foreground">{t('mediaManager.delete.everywhereHint')}</span></span>
        </label>
      </fieldset>
      {mode === 'detach' && (
        <label className="block text-xs font-medium">
          {t('mediaManager.delete.fromRecord')}
          <select value={targetId} onChange={(event) => setTargetId(event.target.value)} className={`${formClasses.input} mt-1`} dir="auto">
            {targets.map(([id, target]) => <option key={id} value={id}>{recordDisplayLabel(target) || id}</option>)}
          </select>
        </label>
      )}
    </Sheet>
  );
}
