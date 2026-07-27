/**
 * Labeled field used by every editor. Accepts any child input-like element.
 */
import React from 'react';

export function FieldRow({ label, children, hint }) {
  return (
    <label className="block mb-3.5">
      <span className="block text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">
        {label}
      </span>
      {children}
      {hint && <span className="block text-muted-foreground text-xs mt-1">{hint}</span>}
    </label>
  );
}

export default FieldRow;
