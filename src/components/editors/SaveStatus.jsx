/**
 * Shared save-state indicator for record editors. Shows a transient status
 * message ("Saved", "Locked", …) when present, otherwise a steady
 * "Unsaved changes" / "All changes saved" state driven by the editor's dirty
 * flag. Pair with a Save button that disables when `!dirty` and `useSaveShortcut`.
 */
import React from 'react';

export function SaveStatus({ status, dirty }) {
  if (status) return <span className="text-emerald-500 text-xs">{status}</span>;
  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />Unsaved changes
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">All changes saved</span>;
}

export default SaveStatus;
