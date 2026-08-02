import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { resolveRelativeSelection, RELATION_SET_IDS } from '../../lib/relativeSelection.js';
import { useRecords } from '../../lib/data/useRecords.js';
import { personSummary } from '../../models/index.js';
import { PersonPicker } from '../charts/PersonPicker.jsx';
import { Sheet } from '../ui/Sheet.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';

export function RelativesSelectionSheet({ open, onClose, onApply, persons: suppliedPersons = null, initialPersonId = '', initialRelationSet = 'ancestors', initialGenerations = 5 }) {
  const { t } = useTranslation();
  const { records } = useRecords('Person');
  const persons = useMemo(() => suppliedPersons || records.map(personSummary).filter(Boolean), [records, suppliedPersons]);
  const [personId, setPersonId] = useState(initialPersonId || '');
  const [relationSet, setRelationSet] = useState(initialRelationSet);
  const [generations, setGenerations] = useState(initialGenerations);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const previousFocus = useRef(null);
  const headingRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    setPersonId(initialPersonId || persons[0]?.recordName || '');
    setRelationSet(initialRelationSet);
    setGenerations(initialGenerations);
    setError('');
    requestAnimationFrame(() => headingRef.current?.focus?.());
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
  }, [initialGenerations, initialPersonId, initialRelationSet, onClose, open, persons]);

  if (!open) return null;

  const apply = async () => {
    if (!personId) {
      setError(t('relativeSelection.pickPersonError'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const ids = await resolveRelativeSelection(personId, { relationSet, generations, includeRoot: true });
      await onApply?.(ids, { personId, relationSet, generations });
      onClose?.();
    } catch (caught) {
      setError(t('relativeSelection.failed', { message: caught?.message || String(caught) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={t('relativeSelection.title')}
      subtitle={t('relativeSelection.subtitle')}
      ariaLabel={t('relativeSelection.title')}
      maxWidth="max-w-xl"
      footer={(
        <>
          <Button variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" size="sm" disabled={busy || !personId} onClick={apply}>
            {busy ? t('relativeSelection.collecting') : t('relativeSelection.choose')}
          </Button>
        </>
      )}
    >
      <div ref={headingRef} tabIndex={-1} className="sr-only">{t('relativeSelection.title')}</div>
      <label className="block text-xs font-medium">
        <span className="mb-1 block">{t('relativeSelection.person')}</span>
        <PersonPicker persons={persons} value={personId} onChange={setPersonId} ariaLabel={t('relativeSelection.person')} />
      </label>
      <label className="block text-xs font-medium">
        <span className="mb-1 block">{t('relativeSelection.relationSet')}</span>
        <select value={relationSet} onChange={(event) => setRelationSet(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
          {RELATION_SET_IDS.map((id) => <option key={id} value={id}>{t(`relativeSelection.set.${id}`)}</option>)}
        </select>
      </label>
      <label className="block text-xs font-medium">
        <span className="mb-1 block">{t('relativeSelection.generations')}</span>
        <Input type="number" min={1} max={15} value={generations} onChange={(event) => setGenerations(Math.max(1, Math.min(15, Number(event.target.value) || 1)))} />
      </label>
      {error ? <p role="alert" className="text-xs text-destructive-text">{error}</p> : null}
    </Sheet>
  );
}

export default RelativesSelectionSheet;
