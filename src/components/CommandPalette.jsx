import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_FUNCTIONS } from '../lib/functionCatalog.js';
import { cn } from '../lib/utils.js';

/**
 * CommandPalette — ⌘K/Ctrl+K globally. Fuzzy-search across every route in
 * APP_FUNCTIONS and jump with Enter. Also registers a handful of verb-mode
 * shortcuts (`/bookmark`, `/toggle theme`, etc) registered by the host.
 *
 * Host the component near the app root; it manages its own open state via
 * a keyboard listener, but callers can still pass `open`/`onOpenChange` to
 * force-open it for a menu item.
 */
export function CommandPalette({ commands = [], open: controlledOpen, onOpenChange }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof controlledOpen === 'boolean';
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (next) => {
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  };
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (event) => {
      const isPaletteKey = (event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'K');
      if (isPaletteKey) {
        event.preventDefault();
        setOpen(!open);
      } else if (event.key === 'Escape' && open) {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const allEntries = useMemo(() => {
    const routeEntries = APP_FUNCTIONS.map((fn) => ({
      id: `route:${fn.to}`,
      label: fn.label,
      section: fn.category,
      action: () => navigate(fn.to),
    }));
    return [...commands, ...routeEntries];
  }, [commands, navigate]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allEntries;
    return allEntries.filter((entry) => entry.label.toLowerCase().includes(q) || entry.section?.toLowerCase().includes(q));
  }, [allEntries, query]);

  if (!open) return null;

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((c) => Math.min(results.length - 1, c + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const entry = results[cursor];
      if (entry) {
        entry.action();
        setOpen(false);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 pt-[10vh]"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-xl rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setCursor(0); }}
          onKeyDown={onKeyDown}
          placeholder="Type a command or page name…"
          className="w-full h-12 bg-transparent border-b border-border px-4 text-sm outline-none"
        />
        <ul className="max-h-[60vh] overflow-y-auto py-1">
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">No matches.</li>
          ) : (
            results.map((entry, index) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => { entry.action(); setOpen(false); }}
                  className={cn(
                    'w-full text-start px-4 py-2 flex items-center gap-3 text-sm',
                    index === cursor ? 'bg-accent' : 'hover:bg-accent/50',
                  )}
                >
                  <span className="flex-1 truncate">{entry.label}</span>
                  {entry.section ? <span className="text-xs text-muted-foreground">{entry.section}</span> : null}
                  {entry.shortcut ? <kbd className="text-[10px] font-semibold border border-border rounded px-1.5 py-0.5">{entry.shortcut}</kbd> : null}
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
          <span>↑↓ navigate · Enter to run · Esc to close</span>
          <kbd className="font-semibold border border-border rounded px-1.5 py-0.5">⌘K</kbd>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
