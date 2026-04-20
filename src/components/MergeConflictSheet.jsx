import React, { useMemo, useState } from 'react';
import { CONFLICT_RESOLUTION } from '../lib/mergeImport.js';

const RESOLUTION_LABELS = {
  [CONFLICT_RESOLUTION.KEEP_EXISTING]: 'Keep current',
  [CONFLICT_RESOLUTION.USE_INCOMING]: 'Use incoming',
  [CONFLICT_RESOLUTION.RENAME_INCOMING]: 'Keep both (rename)',
};

/**
 * MergeConflictSheet — modal shown before applying a GEDCOM / mftpkg / backup
 * merge when the plan contains conflicting records. Each conflicting record
 * shows its field diffs and a radio selector mapping to `CONFLICT_RESOLUTION`.
 *
 * Props:
 *   plan: result of `planMerge(json)`  — { conflicts, newRecords, assetCollisions }
 *   onApply(resolutions):              — called with { recordName: CONFLICT_RESOLUTION }
 *   onCancel():
 */
export function MergeConflictSheet({ plan, onApply, onCancel }) {
  const [resolutions, setResolutions] = useState(() => seedDefaults(plan));
  const conflictCount = plan?.conflicts?.length || 0;

  const setAll = (value) => {
    const next = {};
    for (const entry of plan?.conflicts || []) next[entry.recordName] = value;
    for (const assetId of plan?.assetCollisions || []) next[`asset:${assetId}`] = value;
    setResolutions(next);
  };

  const setOne = (key, value) => setResolutions((prev) => ({ ...prev, [key]: value }));

  const summary = useMemo(() => {
    const counts = { existing: 0, incoming: 0, rename: 0 };
    for (const key of Object.keys(resolutions)) {
      const v = resolutions[key];
      if (counts[v] !== undefined) counts[v] += 1;
    }
    return counts;
  }, [resolutions]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 pt-[8vh]" role="dialog" aria-modal="true" aria-label="Resolve merge conflicts">
      <div className="w-full max-w-3xl rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <header className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Resolve merge conflicts</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {conflictCount} record{conflictCount === 1 ? '' : 's'} already exist with different values.
            {plan?.newRecords?.length ? ` ${plan.newRecords.length} new record${plan.newRecords.length === 1 ? '' : 's'} will be added automatically.` : ''}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="text-muted-foreground">Bulk:</span>
            <button type="button" onClick={() => setAll(CONFLICT_RESOLUTION.KEEP_EXISTING)} className="border border-border rounded-md px-2.5 py-1 hover:bg-accent">Keep current all</button>
            <button type="button" onClick={() => setAll(CONFLICT_RESOLUTION.USE_INCOMING)} className="border border-border rounded-md px-2.5 py-1 hover:bg-accent">Use incoming all</button>
            <button type="button" onClick={() => setAll(CONFLICT_RESOLUTION.RENAME_INCOMING)} className="border border-border rounded-md px-2.5 py-1 hover:bg-accent">Keep both all</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {(plan?.conflicts || []).map((entry) => (
            <article key={entry.recordName} className="border border-border rounded-md p-3">
              <header className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold truncate">
                  <span className="text-muted-foreground me-1">{entry.recordType}</span>
                  {entry.recordName}
                </div>
                <select
                  value={resolutions[entry.recordName] || CONFLICT_RESOLUTION.KEEP_EXISTING}
                  onChange={(e) => setOne(entry.recordName, e.target.value)}
                  className="h-8 rounded-md border border-border bg-secondary text-xs px-2"
                >
                  {Object.entries(RESOLUTION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </header>
              <div className="grid grid-cols-[140px_1fr_1fr] gap-2 text-xs">
                <div className="text-muted-foreground">Field</div>
                <div className="text-muted-foreground">Current</div>
                <div className="text-muted-foreground">Incoming</div>
                {entry.fields.map((field) => (
                  <React.Fragment key={field.name}>
                    <div className="font-medium truncate">{field.name}</div>
                    <div className="truncate">{formatValue(field.existing)}</div>
                    <div className="truncate">{formatValue(field.incoming)}</div>
                  </React.Fragment>
                ))}
              </div>
            </article>
          ))}
          {(plan?.assetCollisions || []).length ? (
            <article className="border border-border rounded-md p-3">
              <h3 className="text-xs font-semibold mb-2">Asset collisions ({plan.assetCollisions.length})</h3>
              <div className="space-y-1">
                {plan.assetCollisions.map((assetId) => (
                  <div key={assetId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{assetId}</span>
                    <select
                      value={resolutions[`asset:${assetId}`] || CONFLICT_RESOLUTION.KEEP_EXISTING}
                      onChange={(e) => setOne(`asset:${assetId}`, e.target.value)}
                      className="h-7 rounded-md border border-border bg-secondary text-xs px-2"
                    >
                      {Object.entries(RESOLUTION_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </div>

        <footer className="px-4 py-3 border-t border-border flex items-center gap-2">
          <div className="text-xs text-muted-foreground flex-1">
            Kept current: {summary.existing} · Used incoming: {summary.incoming} · Kept both: {summary.rename}
          </div>
          <button type="button" onClick={onCancel} className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent">Cancel</button>
          <button type="button" onClick={() => onApply(resolutions)} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold hover:opacity-90">Apply merge</button>
        </footer>
      </div>
    </div>
  );
}

function seedDefaults(plan) {
  const out = {};
  for (const entry of plan?.conflicts || []) out[entry.recordName] = CONFLICT_RESOLUTION.KEEP_EXISTING;
  for (const assetId of plan?.assetCollisions || []) out[`asset:${assetId}`] = CONFLICT_RESOLUTION.KEEP_EXISTING;
  return out;
}

function formatValue(value) {
  if (value == null || value === '') return <span className="text-muted-foreground italic">—</span>;
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

export default MergeConflictSheet;
