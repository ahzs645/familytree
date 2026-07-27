/**
 * Side-by-side merge card for a candidate duplicate pair.
 * For each field present on either record the user picks left or right;
 * clicking "Merge" writes the chosen values to the left record and deletes the right.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { mergeRecordsSafely, previewMergeRecords } from '../../lib/duplicates.js';
import { readRef } from '../../lib/schema.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { Button } from '../ui/Button.jsx';
import { cn } from '../../lib/utils.js';

const SKIP_FIELDS = new Set(['modified', 'created']);

function collectFields(a, b) {
  const keys = new Set([...Object.keys(a.fields || {}), ...Object.keys(b.fields || {})]);
  return [...keys].filter((k) => !SKIP_FIELDS.has(k)).sort();
}

function displayValue(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    const ref = readRef(v);
    if (ref) return 'ref -> ' + ref;
    if (v.recordName) return 'ref → ' + v.recordName;
    return JSON.stringify(v).slice(0, 50);
  }
  return String(v);
}

export function MergePair({ pair, onMerged, onSkip }) {
  const { t } = useTranslation();
  const { a, b, score, reasons } = pair;
  const fields = useMemo(() => collectFields(a, b), [a, b]);
  const [choices, setChoices] = useState(() => {
    const init = {};
    for (const k of fields) {
      init[k] = a.fields?.[k] != null ? 'a' : 'b';
    }
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let cancelled = false;
    previewMergeRecords(a.recordName, b.recordName)
      .then((result) => { if (!cancelled) setPreview(result); })
      .catch(() => { if (!cancelled) setPreview(null); });
    return () => { cancelled = true; };
  }, [a.recordName, b.recordName]);

  const onMergeClick = async () => {
    setBusy(true);
    const mergedFields = { ...a.fields };
    for (const k of fields) {
      const pick = choices[k] === 'b' ? b.fields?.[k] : a.fields?.[k];
      if (pick !== undefined) mergedFields[k] = pick;
      else delete mergedFields[k];
    }
    await mergeRecordsSafely(a.recordName, b.recordName, { mergedFields });
    setBusy(false);
    onMerged?.();
  };

  return (
    <div className="bg-card text-card-foreground border border-border rounded-lg p-4 mb-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="text-sm text-foreground font-semibold">
            {t('duplicatesPage.pairTitle', { type: t(`duplicatesPage.entity.${a.recordType}`, { defaultValue: a.recordType }), score: (score * 100).toFixed(0) })}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {reasons.map((reason) => t(`duplicatesPage.reason.${reason}`, { defaultValue: reason })).join(' · ') || t('duplicatesPage.heuristicMatch')}
          </div>
          {preview && (
            <div className="text-xs text-muted-foreground mt-1">
              {t('duplicatesPage.previewSummary', { refs: preview.rewrittenReferenceCount, kept: preview.preservedRecordCount, removed: preview.deletedRecordNames.length })}
              {preview.dedupedRelationCount ? t('duplicatesPage.previewDedupe', { count: preview.dedupedRelationCount }) : ''}
            </div>
          )}
        </div>
        <div className="flex gap-1.5">
          <Button size="md" onClick={onSkip}>{t('duplicatesPage.skip')}</Button>
          <Button variant="primary" size="md" onClick={onMergeClick} disabled={busy}>
            {busy ? t('duplicatesPage.merging') : t('duplicatesPage.merge')}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-1.5">
        <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">{t('duplicatesPage.keepA')} · {a.recordName}</div>
        <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">{t('duplicatesPage.discardB')} · {b.recordName}</div>
      </div>
      {fields.map((k) => {
        const av = a.fields?.[k]?.value;
        const bv = b.fields?.[k]?.value;
        const different = JSON.stringify(av) !== JSON.stringify(bv);
        return (
          <div key={k} className="grid grid-cols-2 gap-2 mb-1.5">
            <div
              className={cn(
                'p-2.5 rounded-md border',
                choices[k] === 'a' ? 'border-primary' : 'border-border',
                different && av != null ? 'bg-accent' : 'bg-muted'
              )}
            >
              <div className="text-xs text-muted-foreground mb-0.5">{k}</div>
              <div className="text-sm text-foreground break-words">{displayValue(av)}</div>
              {different && (
                <Button variant="outline" className="mt-1.5 text-primary" onClick={() => setChoices({ ...choices, [k]: 'a' })}>
                  {t('duplicatesPage.useA')}
                </Button>
              )}
            </div>
            <div
              className={cn(
                'p-2.5 rounded-md border',
                choices[k] === 'b' ? 'border-destructive' : 'border-border',
                different && bv != null ? 'bg-accent' : 'bg-muted'
              )}
            >
              <div className="text-xs text-muted-foreground mb-0.5">{k}</div>
              <div className="text-sm text-foreground break-words">{displayValue(bv)}</div>
              {different && (
                <Button variant="outline" className="mt-1.5 text-primary" onClick={() => setChoices({ ...choices, [k]: 'b' })}>
                  {t('duplicatesPage.useB')}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MergePair;
