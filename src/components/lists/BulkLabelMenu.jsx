import React, { useEffect, useRef, useState } from 'react';
import { assignLabelToRecords, listLabels } from '../../lib/bulkActions.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

/**
 * BulkLabelMenu — "Assign label" dropdown for the BulkActionBar. Lists the
 * tree's labels and assigns the picked one to every selected record.
 */
export function BulkLabelMenu({ selectedIds, recordType, onAssigned }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open || labels) return;
    let cancelled = false;
    (async () => {
      const rows = await listLabels();
      if (!cancelled) setLabels(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, labels]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const assign = async (labelId) => {
    setBusy(true);
    try {
      const created = await assignLabelToRecords(labelId, selectedIds, recordType);
      onAssigned?.(created);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="border border-border rounded-md px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-50"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {t('lists.assignLabel')}
      </button>
      {open ? (
        <div role="menu" className="absolute end-0 top-full z-30 mt-1 w-48 max-h-64 overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg py-1">
          {labels == null ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">…</div>
          ) : labels.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">{t('lists.noLabels')}</div>
          ) : (
            labels.map((label) => (
              <button
                key={label.id}
                type="button"
                role="menuitem"
                onClick={() => assign(label.id)}
                className="flex w-full items-center gap-2 text-start px-3 py-2 text-sm hover:bg-accent"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full border border-border"
                  style={label.color ? { background: label.color } : undefined}
                  aria-hidden="true"
                />
                <span className="min-w-0 truncate">{label.name}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export default BulkLabelMenu;
