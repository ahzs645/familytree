/**
 * Card-style section used by every editor. Header has an accent dot, a title,
 * and an optional right-side control (usually a TypePicker dropdown).
 */
import React from 'react';

export function Section({ title, accent = 'hsl(var(--primary))', controls, children }) {
  return (
    <div className="rounded-lg border border-border bg-card mb-4 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/40">
        <span
          className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
          style={{ background: accent }}
        />
        <h3 className="text-sm font-semibold text-foreground flex-1">{title}</h3>
        {controls && <div className="ml-auto">{controls}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default Section;
