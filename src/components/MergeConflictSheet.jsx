import React, { useMemo, useState } from 'react';
import { CONFLICT_RESOLUTION } from '../lib/mergeImport.js';
import { Sheet } from './ui/Sheet.jsx';
import { Button } from './ui/Button.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

const RESOLUTION_KEYS = {
  [CONFLICT_RESOLUTION.KEEP_EXISTING]: ['merge.resolution.keepCurrent', 'Keep current'],
  [CONFLICT_RESOLUTION.USE_INCOMING]: ['merge.resolution.useIncoming', 'Use incoming'],
  [CONFLICT_RESOLUTION.RENAME_INCOMING]: ['merge.resolution.keepBoth', 'Keep both (rename)'],
};

/**
 * MergeConflictSheet — modal shown before applying a GEDCOM / mftpkg / backup
 * merge when the plan contains conflicting records. Each conflicting record
 * shows its field diffs and a selector mapping to `CONFLICT_RESOLUTION`.
 *
 * Every row starts on "Keep current", which is the data-safe default but also
 * the one that throws away everything the other copy changed. That is stated
 * outright while it is still true of every row — merging back a tree a
 * relative reviewed is the common case, and silently dropping their work is
 * the worst outcome this sheet can produce.
 *
 * Props:
 *   plan: result of `planMerge(json)`  — { conflicts, newRecords, assetCollisions }
 *   onApply(resolutions):              — called with { recordName: CONFLICT_RESOLUTION }
 *   onCancel():
 */
export function MergeConflictSheet({ plan, onApply, onCancel }) {
  const { t } = useTranslation();
  const [resolutions, setResolutions] = useState(() => seedDefaults(plan));
  const conflictCount = plan?.conflicts?.length || 0;
  const newCount = plan?.newRecords?.length || 0;

  const resolutionLabels = useMemo(() => Object.fromEntries(
    Object.entries(RESOLUTION_KEYS).map(([value, [key, fallback]]) => [value, t(key, { defaultValue: fallback })])
  ), [t]);

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

  const everythingKeepsCurrent = conflictCount > 0 && summary.incoming === 0 && summary.rename === 0;
  const title = t('merge.title', { defaultValue: 'Resolve merge conflicts' });

  return (
    <Sheet
      ariaLabel={title}
      offset="pt-[8vh]"
      maxWidth="max-w-3xl"
      scroll="card"
      maxHeight="max-h-[80vh]"
      bodyClassName="p-4 space-y-4"
      title={title}
      subtitle={(
        <>
          {t('merge.subtitle', {
            count: conflictCount,
            defaultValue: `${conflictCount} records already exist with different values.`,
          })}
          {newCount ? ` ${t('merge.newRecords', {
            count: newCount,
            defaultValue: `${newCount} new records will be added automatically.`,
          })}` : ''}
        </>
      )}
      headerExtra={(
        <>
          {everythingKeepsCurrent && (
            <p className="mt-2 rounded-md border border-warning/50 bg-warning/10 px-2.5 py-1.5 text-xs text-warning-text" dir="auto">
              {t('merge.defaultWarning', {
                count: conflictCount,
                defaultValue: `Every row below is set to "Keep current", so applying now keeps your values and discards all ${conflictCount} incoming changes. Choose "Use incoming all" to take them instead.`,
              })}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
            <span className="text-muted-foreground">{t('merge.bulk', { defaultValue: 'Bulk:' })}</span>
            <button type="button" onClick={() => setAll(CONFLICT_RESOLUTION.KEEP_EXISTING)} className="border border-border rounded-md px-2.5 py-1 hover:bg-accent">
              {t('merge.bulkKeepCurrent', { defaultValue: 'Keep current all' })}
            </button>
            <button type="button" onClick={() => setAll(CONFLICT_RESOLUTION.USE_INCOMING)} className="border border-border rounded-md px-2.5 py-1 hover:bg-accent">
              {t('merge.bulkUseIncoming', { defaultValue: 'Use incoming all' })}
            </button>
            <button type="button" onClick={() => setAll(CONFLICT_RESOLUTION.RENAME_INCOMING)} className="border border-border rounded-md px-2.5 py-1 hover:bg-accent">
              {t('merge.bulkKeepBoth', { defaultValue: 'Keep both all' })}
            </button>
          </div>
        </>
      )}
      footerClassName="flex items-center gap-2"
      footer={(
        <>
          <div className="text-xs text-muted-foreground flex-1">
            {t('merge.footerCounts', {
              existing: summary.existing,
              incoming: summary.incoming,
              rename: summary.rename,
              defaultValue: `Kept current: ${summary.existing} · Used incoming: ${summary.incoming} · Kept both: ${summary.rename}`,
            })}
          </div>
          <button type="button" onClick={onCancel} className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent">
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </button>
          <Button variant="primary" size="sm" onClick={() => onApply(resolutions)}>
            {t('merge.apply', { defaultValue: 'Apply merge' })}
          </Button>
        </>
      )}
    >
      {(plan?.conflicts || []).map((entry) => (
            <article key={entry.recordName} className="border border-border rounded-md p-3">
              <header className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold truncate" dir="auto">
                  <span className="text-muted-foreground me-1">{entry.recordType}</span>
                  {entry.recordName}
                </div>
                <select
                  value={resolutions[entry.recordName] || CONFLICT_RESOLUTION.KEEP_EXISTING}
                  onChange={(e) => setOne(entry.recordName, e.target.value)}
                  aria-label={t('merge.resolutionFor', { record: entry.recordName, defaultValue: `Resolution for ${entry.recordName}` })}
                  className="h-8 rounded-md border border-border bg-secondary text-xs px-2"
                >
                  {Object.entries(resolutionLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </header>
              <div className="grid grid-cols-[140px_1fr_1fr] gap-2 text-xs">
                <div className="text-muted-foreground">{t('merge.field', { defaultValue: 'Field' })}</div>
                <div className="text-muted-foreground">{t('merge.current', { defaultValue: 'Current' })}</div>
                <div className="text-muted-foreground">{t('merge.incoming', { defaultValue: 'Incoming' })}</div>
                {entry.fields.map((field) => (
                  <React.Fragment key={field.name}>
                    <div className="font-medium truncate">{field.name}</div>
                    <div className="truncate" dir="auto">{formatValue(field.existing)}</div>
                    <div className="truncate" dir="auto">{formatValue(field.incoming)}</div>
                  </React.Fragment>
                ))}
              </div>
            </article>
          ))}
          {(plan?.assetCollisions || []).length ? (
            <article className="border border-border rounded-md p-3">
              <h3 className="text-xs font-semibold mb-2">
                {t('merge.assetCollisions', { count: plan.assetCollisions.length, defaultValue: `Asset collisions (${plan.assetCollisions.length})` })}
              </h3>
              <div className="space-y-1">
                {plan.assetCollisions.map((assetId) => (
                  <div key={assetId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate" dir="auto">{assetId}</span>
                    <select
                      value={resolutions[`asset:${assetId}`] || CONFLICT_RESOLUTION.KEEP_EXISTING}
                      onChange={(e) => setOne(`asset:${assetId}`, e.target.value)}
                      aria-label={t('merge.resolutionFor', { record: assetId, defaultValue: `Resolution for ${assetId}` })}
                      className="h-7 rounded-md border border-border bg-secondary text-xs px-2"
                    >
                      {Object.entries(resolutionLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
    </Sheet>
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
