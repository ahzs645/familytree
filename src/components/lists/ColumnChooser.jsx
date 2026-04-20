import React, { useEffect, useRef, useState } from 'react';

/**
 * ColumnChooser — small dropdown menu that lets users toggle per-column
 * visibility. columns: [{ key, label, alwaysVisible? }]. Caller provides
 * `isVisible(key)` and `onToggle(key)`.
 */
export function ColumnChooser({ columns, isVisible, onToggle, onReset }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="border border-border rounded-md px-2.5 py-1.5 text-xs hover:bg-accent inline-flex items-center gap-1"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Columns
        <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true"><path fill="currentColor" d="M2 4l4 4 4-4z" /></svg>
      </button>
      {open ? (
        <div className="absolute end-0 mt-1 w-56 rounded-md border border-border bg-popover text-popover-foreground shadow-lg z-30">
          <ul className="max-h-72 overflow-y-auto p-1" role="menu">
            {columns.map((col) => (
              <li key={col.key} role="menuitemcheckbox" aria-checked={isVisible(col.key)}>
                <label className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-xs ${col.alwaysVisible ? 'opacity-60' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isVisible(col.key)}
                    disabled={!!col.alwaysVisible}
                    onChange={() => onToggle(col.key)}
                  />
                  <span>{col.label}</span>
                </label>
              </li>
            ))}
          </ul>
          {onReset ? (
            <div className="border-t border-border p-1">
              <button
                type="button"
                onClick={() => { onReset(); setOpen(false); }}
                className="w-full text-xs px-2 py-1.5 rounded hover:bg-accent text-start"
              >
                Reset to defaults
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default ColumnChooser;
