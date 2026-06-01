/**
 * TreeSwitcher — current-tree label + dropdown of library trees.
 *
 * Lives in the NavigationDrawer header so the active tree is always visible
 * and switching is one click away. Switching is non-destructive: the
 * underlying switchToTree() saves the current dataset back into its library
 * entry before restoring the target.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Plus, Check } from 'lucide-react';
import {
  ACTIVE_TREE_CHANGED_EVENT,
  TREES_CHANGED_EVENT,
  getActiveTreeId,
  listTreeSnapshots,
  switchToTree,
} from '../lib/treeLibrary.js';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { cn } from '../lib/utils.js';

export function TreeSwitcher({ collapsed = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refresh } = useDatabaseStatus();
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [activeId, setActiveId] = useState(() => getActiveTreeId());
  const [busy, setBusy] = useState(false);
  const rootRef = useRef(null);

  const reload = useCallback(async () => {
    setSnapshots(await listTreeSnapshots({ sortBy: 'favorites' }));
    setActiveId(getActiveTreeId());
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const onActive = () => setActiveId(getActiveTreeId());
    const onTrees = () => reload();
    window.addEventListener(ACTIVE_TREE_CHANGED_EVENT, onActive);
    window.addEventListener(TREES_CHANGED_EVENT, onTrees);
    return () => {
      window.removeEventListener(ACTIVE_TREE_CHANGED_EVENT, onActive);
      window.removeEventListener(TREES_CHANGED_EVENT, onTrees);
    };
  }, [reload]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const activeTree = useMemo(
    () => snapshots.find((s) => s.id === activeId) || null,
    [snapshots, activeId],
  );

  const onPickTree = async (snapshot) => {
    if (busy || snapshot.id === activeId) { setOpen(false); return; }
    setBusy(true);
    try {
      await switchToTree(snapshot.id);
      await refresh();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const onCreateNew = () => {
    setOpen(false);
    navigate('/welcome');
  };

  const triggerLabel = activeTree?.name || t('treeSwitcher.noTree', { defaultValue: 'No tree yet' });

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('treeSwitcher.aria', { defaultValue: 'Switch family tree' })}
        title={collapsed ? triggerLabel : undefined}
        className={cn(
          'flex items-center gap-1.5 rounded-md border border-border bg-secondary hover:bg-accent text-foreground',
          collapsed ? 'w-9 h-9 justify-center px-0' : 'w-full px-2.5 py-1.5 min-w-0',
        )}
      >
        {collapsed ? (
          <ChevronDown size={14} className="opacity-80" />
        ) : (
          <>
            <span className="flex-1 min-w-0 truncate text-start text-xs font-semibold">
              {triggerLabel}
            </span>
            <ChevronDown size={14} className="flex-shrink-0 opacity-70" />
          </>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-40 mt-1 start-0 end-auto min-w-[240px] max-w-[280px] rounded-md border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden"
          style={{ insetInlineStart: 0 }}
        >
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
            {t('treeSwitcher.heading', { defaultValue: 'My family trees' })}
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {snapshots.length === 0 && (
              <li className="px-3 py-2 text-xs text-muted-foreground">
                {t('treeSwitcher.empty', { defaultValue: 'No saved trees yet.' })}
              </li>
            )}
            {snapshots.map((snapshot) => {
              const isActive = snapshot.id === activeId;
              return (
                <li key={snapshot.id}>
                  <button
                    type="button"
                    onClick={() => onPickTree(snapshot)}
                    disabled={busy}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-start text-xs hover:bg-accent disabled:opacity-50',
                      isActive && 'bg-accent/50',
                    )}
                  >
                    <span className="w-4 flex-shrink-0">
                      {isActive ? <Check size={14} className="text-primary" /> : null}
                    </span>
                    <span className="flex-1 min-w-0 truncate">
                      {snapshot.favorite && <span aria-hidden className="text-yellow-500 me-1">★</span>}
                      {snapshot.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {snapshot.recordCount}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border">
            <button
              type="button"
              onClick={onCreateNew}
              disabled={busy}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              <Plus size={14} />
              <span>{t('treeSwitcher.create', { defaultValue: 'Create new tree' })}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TreeSwitcher;
