import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet } from '../ui/Sheet.jsx';
import { Button } from '../ui/Button.jsx';
import { useRecords } from '../../lib/data/useRecords.js';
import { placeSummary } from '../../models/index.js';
import { createRecordEnvelope, createWithChangeLog } from '../../lib/recordWrite.js';
import { matchesSearchText } from '../../lib/i18n.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

/** Searchable reusable picker for choosing or quickly creating a Place. */
export function PlacePickerSheet({ onClose, onSelect }) {
  const { t } = useTranslation();
  const { records, loading } = useRecords('Place');
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const openerRef = useRef(document.activeElement);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openerRef.current?.focus?.();
    };
  }, [onClose]);

  const places = useMemo(() => records
    .map((record) => ({ record, summary: placeSummary(record) }))
    .filter(({ summary }) => summary && (!search.trim() || matchesSearchText(`${summary.displayName} ${summary.name}`, search)))
    .sort((a, b) => String(a.summary.displayName || a.summary.name).localeCompare(String(b.summary.displayName || b.summary.name))), [records, search]);

  const choose = (record) => {
    onSelect?.(record);
    onClose?.();
  };

  const createAndChoose = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const record = createRecordEnvelope('Place', 'place', {
        placeName: name,
        cached_normallocationString: name,
      });
      await createWithChangeLog(record);
      choose(record);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={t('placePicker.title')}
      subtitle={t('placePicker.subtitle')}
      ariaLabel={t('placePicker.title')}
      maxWidth="max-w-md"
      scroll="card"
      footer={<button type="button" onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs">{t('common.cancel')}</button>}
    >
      <label className="block text-xs font-medium" htmlFor="place-picker-search">{t('placePicker.searchLabel')}</label>
      <input
        id="place-picker-search"
        autoFocus
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('placePicker.searchPlaceholder')}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <div role="listbox" aria-label={t('placePicker.results')} className="max-h-[40vh] overflow-y-auto rounded-md border border-border divide-y divide-border">
        {loading ? (
          <p className="p-3 text-xs text-muted-foreground">{t('placePicker.loading')}</p>
        ) : places.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">{t('placePicker.noMatches')}</p>
        ) : places.map(({ record, summary }) => (
          <button
            key={record.recordName}
            type="button"
            role="option"
            aria-selected="false"
            onClick={() => choose(record)}
            className="block w-full px-3 py-2 text-start text-sm hover:bg-accent"
          >
            {summary.displayName || summary.name || t('placePicker.untitled')}
          </button>
        ))}
      </div>
      <div className="border-t border-border pt-3">
        <label className="block text-xs font-medium mb-1" htmlFor="place-picker-new">{t('placePicker.newPlace')}</label>
        <div className="flex items-center gap-2">
          <input
            id="place-picker-new"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') createAndChoose(); }}
            placeholder={t('placePicker.newPlaceholder')}
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <Button variant="primary" size="md" disabled={busy || !newName.trim()} onClick={createAndChoose}>
            {t('placePicker.createAndSelect')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

export default PlacePickerSheet;
