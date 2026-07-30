import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Sheet } from '../ui/Sheet.jsx';
import { Button } from '../ui/Button.jsx';
import { getAppDataClient } from '../../lib/data/AppDataClient.js';
import { sourceSummary } from '../../models/index.js';
import { BdiText } from '../BdiText.jsx';
import { attachSourceRelation, attachedSourceIdsForTarget, createQuickSource } from '../../lib/citationLinks.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

/**
 * SourcePickerSheet — inline "cite a source" modal opened from the Unsourced /
 * evidence badge on any conclusion (a fact, event, person, …).
 *
 * Lets the user pick an existing Source or create a new one in place; either way
 * it creates a lineage-tracked SourceRelation linking the source to `target`,
 * then calls `onLinked` so the caller can refresh its evidence state.
 *
 * Props:
 *   target      — { recordName, recordType, label } the conclusion being cited
 *   onClose     — close the modal
 *   onLinked    — called after a citation is attached (refresh evidence)
 *   onManageAll — optional; "Manage all citations…" affordance (e.g. scroll to the
 *                 full Source Citations editor)
 */
export function SourcePickerSheet({ target, onClose, onLinked, onManageAll }) {
  const { t } = useTranslation();
  const [sources, setSources] = useState([]);
  const [attachedIds, setAttachedIds] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!target?.recordName) return;
    setLoading(true);
    const [rows, attached] = await Promise.all([
      getAppDataClient().records.query('Source', { limit: 100000 }),
      attachedSourceIdsForTarget(target.recordName),
    ]);
    setSources(rows.records.map((r) => sourceSummary(r)).filter(Boolean));
    setAttachedIds(attached);
    setLoading(false);
  }, [target?.recordName]);

  useEffect(() => { reload(); }, [reload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? sources.filter((s) => (s.title || '').toLowerCase().includes(q)) : sources;
    return [...list].sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
  }, [sources, search]);

  const link = useCallback(async (sourceId) => {
    if (!target?.recordName || !sourceId || busy || attachedIds.has(sourceId)) return;
    setBusy(true);
    try {
      await attachSourceRelation({ sourceId, targetId: target.recordName, targetType: target.recordType });
      onLinked?.();
      onClose?.();
    } finally {
      setBusy(false);
    }
  }, [attachedIds, busy, onClose, onLinked, target]);

  const createAndLink = useCallback(async () => {
    const title = newTitle.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      const src = await createQuickSource(title);
      if (src) {
        await attachSourceRelation({ sourceId: src.recordName, targetId: target.recordName, targetType: target.recordType });
        onLinked?.();
      }
      onClose?.();
    } finally {
      setBusy(false);
    }
  }, [busy, newTitle, onClose, onLinked, target]);

  const footer = (
    <>
      {onManageAll && (
        <button type="button" onClick={() => { onClose?.(); onManageAll(); }} className="me-auto text-xs text-interactive hover:underline">
          {t('sourcePicker.manageAll', { defaultValue: 'Manage all citations…' })}
        </button>
      )}
      <button type="button" onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs">
        {t('common.cancel', { defaultValue: 'Cancel' })}
      </button>
    </>
  );

  return (
    <Sheet
      title={t('sourcePicker.title', { defaultValue: 'Add a source citation' })}
      subtitle={target?.label
        ? t('sourcePicker.subtitleFor', { label: target.label, defaultValue: `Cite a source for "${target.label}"` })
        : t('sourcePicker.subtitle', { defaultValue: 'Choose an existing source or create a new one.' })}
      footer={footer}
      maxWidth="max-w-md"
      scroll="card"
      ariaLabel={t('sourcePicker.title', { defaultValue: 'Add a source citation' })}
    >
      <input
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('sourcePicker.search', { defaultValue: 'Search sources…' })}
        aria-label={t('sourcePicker.search', { defaultValue: 'Search sources…' })}
        dir="auto"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />

      <div className="rounded-md border border-border divide-y divide-border max-h-[40vh] overflow-y-auto">
        {loading ? (
          <p className="p-3 text-xs text-muted-foreground">{t('sourcePicker.loading', { defaultValue: 'Loading sources…' })}</p>
        ) : filtered.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">
            {sources.length === 0
              ? t('sourcePicker.empty', { defaultValue: 'No sources yet — create one below.' })
              : t('sourcePicker.noMatches', { defaultValue: 'No matching sources.' })}
          </p>
        ) : filtered.map((s) => {
          const already = attachedIds.has(s.recordName);
          return (
            <button
              key={s.recordName}
              type="button"
              disabled={busy || already}
              onClick={() => link(s.recordName)}
              className="w-full flex items-center gap-2 px-3 py-2 text-start text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              <BdiText className="flex-1 truncate">{s.title || t('sourcePicker.untitled', { defaultValue: 'Untitled source' })}</BdiText>
              {already
                ? <span className="text-2xs font-bold uppercase tracking-wide text-success-text shrink-0">{t('sourcePicker.cited', { defaultValue: 'Cited' })}</span>
                : <span className="text-2xs font-bold uppercase tracking-wide text-interactive shrink-0">{t('sourcePicker.cite', { defaultValue: 'Cite' })}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') createAndLink(); }}
          placeholder={t('sourcePicker.newTitle', { defaultValue: 'New source title…' })}
          aria-label={t('sourcePicker.newTitle', { defaultValue: 'New source title…' })}
          dir="auto"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <Button
          variant="primary"
          size="md"
          onClick={createAndLink}
          disabled={busy || !newTitle.trim()}
        >
          {t('sourcePicker.createAndCite', { defaultValue: 'Create & cite' })}
        </Button>
      </div>
    </Sheet>
  );
}

export default SourcePickerSheet;
