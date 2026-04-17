/**
 * Side-by-side merge card for a candidate duplicate pair.
 * For each field present on either record the user picks left or right;
 * clicking "Merge" writes the chosen values to the left record and deletes the right.
 */
import React, { useMemo, useState } from 'react';
import { mergeRecords } from '../../lib/duplicates.js';

const SKIP_FIELDS = new Set(['modified', 'created']);

function collectFields(a, b) {
  const keys = new Set([...Object.keys(a.fields || {}), ...Object.keys(b.fields || {})]);
  return [...keys].filter((k) => !SKIP_FIELDS.has(k)).sort();
}

function displayValue(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.recordName) return 'ref → ' + v.recordName;
    return JSON.stringify(v).slice(0, 50);
  }
  return String(v);
}

export function MergePair({ pair, onMerged, onSkip }) {
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

  const onMergeClick = async () => {
    setBusy(true);
    // Build merged field set according to choices, write to A, delete B.
    const db = await import('../../lib/LocalDatabase.js').then((m) => m.getLocalDatabase());
    const mergedFields = { ...a.fields };
    for (const k of fields) {
      const pick = choices[k] === 'b' ? b.fields?.[k] : a.fields?.[k];
      if (pick !== undefined) mergedFields[k] = pick;
      else delete mergedFields[k];
    }
    const merged = { ...a, fields: mergedFields };
    await db.saveRecord(merged);
    await db.deleteRecord(b.recordName);
    setBusy(false);
    onMerged?.();
  };

  return (
    <div style={card}>
      <div style={header}>
        <div>
          <div style={{ fontSize: 14, color: '#e2e4eb', fontWeight: 600 }}>
            {a.recordType} pair — score {(score * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: 12, color: '#8b90a0', marginTop: 2 }}>{reasons.join(' · ') || 'heuristic match'}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onSkip} style={btnSecondary}>Skip</button>
          <button onClick={onMergeClick} disabled={busy} style={btnPrimary}>{busy ? 'Merging…' : 'Merge →'}</button>
        </div>
      </div>
      <div style={grid}>
        <div style={colHeader}>Keep (A) · {a.recordName}</div>
        <div style={colHeader}>Discard (B) · {b.recordName}</div>
      </div>
      {fields.map((k) => {
        const av = a.fields?.[k]?.value;
        const bv = b.fields?.[k]?.value;
        const different = JSON.stringify(av) !== JSON.stringify(bv);
        return (
          <div key={k} style={row}>
            <div style={{ ...cell, border: choices[k] === 'a' ? '1px solid #3b6db8' : '1px solid #2e3345', background: different && av != null ? '#1a2030' : '#161922' }}>
              <div style={fieldLabel}>{k}</div>
              <div style={fieldValue}>{displayValue(av)}</div>
              {different && (
                <button onClick={() => setChoices({ ...choices, [k]: 'a' })} style={tinyBtn}>Use A</button>
              )}
            </div>
            <div style={{ ...cell, border: choices[k] === 'b' ? '1px solid #b8417a' : '1px solid #2e3345', background: different && bv != null ? '#1e1820' : '#161922' }}>
              <div style={fieldLabel}>{k}</div>
              <div style={fieldValue}>{displayValue(bv)}</div>
              {different && (
                <button onClick={() => setChoices({ ...choices, [k]: 'b' })} style={tinyBtn}>Use B</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const card = {
  background: '#13161f',
  border: '1px solid #2e3345',
  borderRadius: 10,
  padding: 16,
  marginBottom: 18,
};
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 };
const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 };
const colHeader = { color: '#8b90a0', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 };
const row = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 };
const cell = { padding: 10, borderRadius: 6 };
const fieldLabel = { color: '#8b90a0', fontSize: 11, marginBottom: 3 };
const fieldValue = { color: '#e2e4eb', fontSize: 13, wordBreak: 'break-word' };
const tinyBtn = {
  marginTop: 6,
  background: 'transparent',
  color: '#6c8aff',
  border: '1px solid #2e3345',
  borderRadius: 4,
  padding: '3px 8px',
  fontSize: 11,
  cursor: 'pointer',
};
const btnPrimary = {
  background: '#3b6db8',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '7px 14px',
  fontSize: 13,
  cursor: 'pointer',
};
const btnSecondary = {
  background: '#242837',
  color: '#e2e4eb',
  border: '1px solid #2e3345',
  borderRadius: 6,
  padding: '7px 14px',
  fontSize: 13,
  cursor: 'pointer',
};

export default MergePair;
