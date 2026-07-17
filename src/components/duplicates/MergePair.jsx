/**
 * Side-by-side merge card for a candidate duplicate pair.
 * For each field present on either record the user picks left or right;
 * clicking "Merge" writes the chosen values to the left record and deletes the right.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { mergeRecordsSafely, previewMergeRecords } from '../../lib/duplicates.js';
import { readRef } from '../../lib/schema.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

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
    <div style={card}>
      <div style={header}>
        <div>
          <div style={{ fontSize: 14, color: 'hsl(var(--foreground))', fontWeight: 600 }}>
            {t('duplicatesPage.pairTitle', { type: t(`duplicatesPage.entity.${a.recordType}`, { defaultValue: a.recordType }), score: (score * 100).toFixed(0) })}
          </div>
          <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
            {reasons.map((reason) => t(`duplicatesPage.reason.${reason}`, { defaultValue: reason })).join(' · ') || t('duplicatesPage.heuristicMatch')}
          </div>
          {preview && (
            <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 5 }}>
              {t('duplicatesPage.previewSummary', { refs: preview.rewrittenReferenceCount, kept: preview.preservedRecordCount, removed: preview.deletedRecordNames.length })}
              {preview.dedupedRelationCount ? t('duplicatesPage.previewDedupe', { count: preview.dedupedRelationCount }) : ''}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onSkip} style={btnSecondary}>{t('duplicatesPage.skip')}</button>
          <button onClick={onMergeClick} disabled={busy} style={btnPrimary}>{busy ? t('duplicatesPage.merging') : t('duplicatesPage.merge')}</button>
        </div>
      </div>
      <div style={grid}>
        <div style={colHeader}>{t('duplicatesPage.keepA')} · {a.recordName}</div>
        <div style={colHeader}>{t('duplicatesPage.discardB')} · {b.recordName}</div>
      </div>
      {fields.map((k) => {
        const av = a.fields?.[k]?.value;
        const bv = b.fields?.[k]?.value;
        const different = JSON.stringify(av) !== JSON.stringify(bv);
        return (
          <div key={k} style={row}>
            <div style={{ ...cell, border: choices[k] === 'a' ? '1px solid hsl(var(--primary))' : '1px solid hsl(var(--border))', background: different && av != null ? 'hsl(var(--accent))' : 'hsl(var(--muted))' }}>
              <div style={fieldLabel}>{k}</div>
              <div style={fieldValue}>{displayValue(av)}</div>
              {different && (
                <button onClick={() => setChoices({ ...choices, [k]: 'a' })} style={tinyBtn}>{t('duplicatesPage.useA')}</button>
              )}
            </div>
            <div style={{ ...cell, border: choices[k] === 'b' ? '1px solid #b8417a' : '1px solid hsl(var(--border))', background: different && bv != null ? 'hsl(var(--accent))' : 'hsl(var(--muted))' }}>
              <div style={fieldLabel}>{k}</div>
              <div style={fieldValue}>{displayValue(bv)}</div>
              {different && (
                <button onClick={() => setChoices({ ...choices, [k]: 'b' })} style={tinyBtn}>{t('duplicatesPage.useB')}</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const card = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 10,
  padding: 16,
  marginBottom: 18,
};
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 };
const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 };
const colHeader = { color: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 };
const row = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 };
const cell = { padding: 10, borderRadius: 6 };
const fieldLabel = { color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 };
const fieldValue = { color: 'hsl(var(--foreground))', fontSize: 13, wordBreak: 'break-word' };
const tinyBtn = {
  marginTop: 6,
  background: 'transparent',
  color: 'hsl(var(--primary))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 4,
  padding: '3px 8px',
  fontSize: 11,
  cursor: 'pointer',
};
const btnPrimary = {
  background: 'hsl(var(--primary))',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '7px 14px',
  fontSize: 13,
  cursor: 'pointer',
};
const btnSecondary = {
  background: 'hsl(var(--secondary))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  padding: '7px 14px',
  fontSize: 13,
  cursor: 'pointer',
};

export default MergePair;
