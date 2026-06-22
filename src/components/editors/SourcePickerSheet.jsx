import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Sheet } from '../ui/Sheet.jsx';
import { getLocalDatabase } from '../../lib/LocalDatabase.js';
import { sourceSummary } from '../../models/index.js';
import { BdiText } from '../BdiText.jsx';
import { attachSourceRelation, attachedSourceIdsForTarget, createQuickSource } from '../../lib/citationLinks.js';

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
  const [sources, setSources] = useState([]);
  const [attachedIds, setAttachedIds] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!target?.recordName) return;
    setLoading(true);
    const db = getLocalDatabase();
    const [rows, attached] = await Promise.all([
      db.query('Source', { limit: 100000 }),
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
        <button type="button" onClick={() => { onClose?.(); onManageAll(); }} className="me-auto text-xs text-primary hover:underline">
          Manage all citations…
        </button>
      )}
      <button type="button" onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs">
        Cancel
      </button>
    </>
  );

  return (
    <Sheet
      title="Add a source citation"
      subtitle={target?.label ? `Cite a source for "${target.label}"` : 'Choose an existing source or create a new one.'}
      footer={footer}
      maxWidth="max-w-md"
      scroll="card"
      ariaLabel="Add a source citation"
    >
      <input
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search sources…"
        dir="auto"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />

      <div className="rounded-md border border-border divide-y divide-border max-h-[40vh] overflow-y-auto">
        {loading ? (
          <p className="p-3 text-xs text-muted-foreground">Loading sources…</p>
        ) : filtered.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">
            {sources.length === 0 ? 'No sources yet — create one below.' : 'No matching sources.'}
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
              <BdiText className="flex-1 truncate">{s.title || 'Untitled source'}</BdiText>
              {already
                ? <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 shrink-0">Cited</span>
                : <span className="text-[10px] font-bold uppercase tracking-wide text-primary shrink-0">Cite</span>}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') createAndLink(); }}
          placeholder="New source title…"
          dir="auto"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={createAndLink}
          disabled={busy || !newTitle.trim()}
          className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          Create &amp; cite
        </button>
      </div>
    </Sheet>
  );
}

export default SourcePickerSheet;
