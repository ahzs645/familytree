import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { useRecords } from '../../lib/data/useRecords.js';
import { matchesSearchText } from '../../lib/i18n.js';
import { familySummary, personSummary } from '../../models/index.js';
import { Sheet } from '../ui/Sheet.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';

export function familyPickerRows(familyRecords, personRecords) {
  const names = new Map((personRecords || []).map((record) => {
    const summary = record.recordType ? personSummary(record) : record;
    return [record.recordName, summary?.fullName || record.recordName];
  }));
  return (familyRecords || []).map((record) => {
    if (!record.recordType && record.label) return record;
    const summary = familySummary(record);
    const partnerNames = [names.get(summary?.manRecordName), names.get(summary?.womanRecordName)].filter(Boolean);
    return {
      recordName: record.recordName,
      label: partnerNames.join(' & ') || summary?.familyName || record.recordName,
      primaryPersonRecordName: summary?.manRecordName || summary?.womanRecordName || '',
    };
  }).sort((a, b) => a.label.localeCompare(b.label));
}

export function FamilyPickerSheet({ open, onClose, onPick, families: suppliedFamilies = null, persons: suppliedPersons = null, value = '' }) {
  const { t } = useTranslation();
  const { records: familyRecords } = useRecords('Family');
  const { records: personRecords } = useRecords('Person');
  const rows = useMemo(
    () => familyPickerRows(suppliedFamilies || familyRecords, suppliedPersons || personRecords),
    [familyRecords, personRecords, suppliedFamilies, suppliedPersons],
  );
  const [query, setQuery] = useState('');
  const previousFocus = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    setQuery('');
    requestAnimationFrame(() => searchRef.current?.focus?.());
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose?.();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      requestAnimationFrame(() => previousFocus.current?.focus?.());
    };
  }, [onClose, open]);

  const filtered = useMemo(() => rows.filter((row) => !query.trim() || matchesSearchText(row.label, query)), [query, rows]);
  if (!open) return null;

  return (
    <Sheet
      title={t('familyPicker.title')}
      subtitle={t('familyPicker.subtitle')}
      ariaLabel={t('familyPicker.title')}
      maxWidth="max-w-lg"
      scroll="card"
      bodyClassName="min-h-0 p-0"
      footer={<Button variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>}
    >
      <div className="border-b border-border p-3">
        <Input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('familyPicker.search')} aria-label={t('familyPicker.search')} />
      </div>
      <div role="listbox" aria-label={t('familyPicker.results')} className="max-h-[50vh] overflow-auto p-2">
        {filtered.length === 0 ? <div className="p-5 text-center text-sm text-muted-foreground">{t('common.noMatches')}</div> : filtered.map((row) => (
          <button
            key={row.recordName}
            type="button"
            role="option"
            aria-selected={row.recordName === value}
            onClick={() => { onPick?.(row.recordName, row); onClose?.(); }}
            className={`block w-full rounded-md px-3 py-2 text-start text-sm hover:bg-accent ${row.recordName === value ? 'bg-secondary' : ''}`}
          >
            {row.label}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function FamilyPicker({ value, onChange, families = null, persons = null, ariaLabel }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => familyPickerRows(families || [], persons || []), [families, persons]);
  const selected = rows.find((row) => row.recordName === value);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={ariaLabel} className="h-10 w-full max-w-[300px] rounded-md border border-border bg-secondary px-3 text-start text-sm hover:bg-accent">
        <span className={selected ? '' : 'text-muted-foreground'}>{selected?.label || t('familyPicker.choose')}</span>
      </button>
      <FamilyPickerSheet open={open} onClose={() => setOpen(false)} onPick={onChange} families={families} persons={persons} value={value} ariaLabel={ariaLabel} />
    </>
  );
}

export default FamilyPickerSheet;
