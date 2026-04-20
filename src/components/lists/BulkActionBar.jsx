import React from 'react';

/**
 * BulkActionBar — inline bar that appears above a list when any rows are
 * selected. Renders the count, a Clear button, and whatever action buttons
 * the caller passes as children.
 */
export function BulkActionBar({ count, onClear, children }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-2 p-2 bg-primary/10 border border-primary/30 rounded-md text-xs">
      <span className="font-semibold">{count} selected</span>
      <div className="flex-1" />
      {children}
      <button
        type="button"
        onClick={onClear}
        className="border border-border rounded-md px-2.5 py-1 text-xs hover:bg-accent"
      >
        Clear
      </button>
    </div>
  );
}

export default BulkActionBar;
