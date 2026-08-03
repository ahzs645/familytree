import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet } from './ui/Sheet.jsx';
import { Button } from './ui/Button.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

const RELATIONSHIPS = ['unrelated', 'spouse', 'child', 'parent', 'father', 'mother', 'sibling', 'in-law'];

export function ContactImportSheet({ entries, persons, initialAnchorId = '', onImport, onClose }) {
  const { t } = useTranslation();
  const [anchorPersonId, setAnchorPersonId] = useState(initialAnchorId || persons[0]?.recordName || '');
  const [relationshipByContact, setRelationshipByContact] = useState(() => Object.fromEntries(entries.map((entry) => [entry.record.recordName, 'unrelated'])));
  const [saving, setSaving] = useState(false);
  const cancelRef = useRef(null);
  const dialogRef = useRef(null);
  const needsAnchor = useMemo(() => Object.values(relationshipByContact).some((relationship) => relationship !== 'unrelated'), [relationshipByContact]);

  useEffect(() => {
    requestAnimationFrame(() => cancelRef.current?.focus());
    const onKey = (event) => {
      if (event.key === 'Escape' && !saving) onClose();
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const submit = async () => {
    setSaving(true);
    try { await onImport({ anchorPersonId, relationshipByContact }); } finally { setSaving(false); }
  };

  return (
    <Sheet
      title={t('contactImport.title')}
      subtitle={t('contactImport.subtitle', { count: entries.length })}
      ariaLabel={t('contactImport.title')}
      dialogRef={dialogRef}
      maxWidth="max-w-2xl"
      scroll="card"
      footer={<><Button ref={cancelRef} variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button><Button variant="primary" onClick={submit} disabled={saving || (needsAnchor && !anchorPersonId)}>{saving ? t('contactImport.importing') : t('contactImport.import')}</Button></>}
    >
      <label className="grid gap-1 text-xs text-muted-foreground">
        {t('contactImport.anchor')}
        <select value={anchorPersonId} onChange={(event) => setAnchorPersonId(event.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground">
          <option value="">{t('contactImport.selectAnchor')}</option>
          {persons.map((person) => <option key={person.recordName} value={person.recordName}>{person.fullName || person.recordName}</option>)}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">{t('contactImport.help')}</p>
      <ul className="space-y-2">
        {entries.map((entry) => {
          const id = entry.record.recordName;
          const name = entry.record.fields?.cached_fullName?.value || id;
          return (
            <li key={id} className="grid grid-cols-1 items-center gap-2 rounded-md border border-border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_220px]">
              <div className="min-w-0"><div className="truncate text-sm font-medium" dir="auto">{name}</div><div className="truncate text-xs text-muted-foreground" dir="auto">{entry.record.fields?.email?.value || entry.record.fields?.phone?.value || ''}</div></div>
              <label className="grid gap-1 text-xs text-muted-foreground">{t('contactImport.relationshipTo', { name })}
                <select value={relationshipByContact[id]} onChange={(event) => setRelationshipByContact((current) => ({ ...current, [id]: event.target.value }))} className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground">
                  {RELATIONSHIPS.map((relationship) => <option key={relationship} value={relationship}>{t(`contactImport.relationships.${relationship}`)}</option>)}
                </select>
              </label>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

export default ContactImportSheet;
