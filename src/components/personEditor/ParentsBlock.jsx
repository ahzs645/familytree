/**
 * Read-only summary of the active person's parents — grid of buttons that
 * navigate to each parent's editor. Empty state nudges toward the family
 * editor for adding a missing parent record.
 */
import React from 'react';
import { lifeSpanLabel } from '../../models/index.js';
import { Empty } from './uiPrimitives.jsx';

export function ParentsBlock({ context, onPick }) {
  if (!context.parents || context.parents.length === 0) {
    return <Empty title="No parents recorded" hint="Add parents via the family editor." />;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {context.parents.flatMap((fam) => [fam.man, fam.woman])
        .filter(Boolean)
        .map((p) => (
          <button
            key={p.recordName}
            onClick={() => onPick(p.recordName)}
            className="text-start p-3 rounded-md border border-border bg-secondary/30 hover:bg-secondary"
          >
            <div className="text-sm font-medium">{p.fullName}</div>
            <div className="text-xs text-muted-foreground">{lifeSpanLabel(p) || '—'}</div>
          </button>
        ))}
    </div>
  );
}
