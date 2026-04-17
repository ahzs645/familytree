/**
 * DuplicatesApp — scan for duplicate persons/families/sources and merge them.
 */
import React, { useState, useCallback } from 'react';
import { findDuplicatePersons, findDuplicateFamilies, findDuplicateSources } from '../../lib/duplicates.js';
import { MergePair } from './MergePair.jsx';

const SCANS = [
  { id: 'Person', label: 'Persons', run: findDuplicatePersons },
  { id: 'Family', label: 'Families', run: findDuplicateFamilies },
  { id: 'Source', label: 'Sources', run: findDuplicateSources },
];

export function DuplicatesApp() {
  const [kind, setKind] = useState('Person');
  const [pairs, setPairs] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [skipped, setSkipped] = useState(new Set());

  const onScan = useCallback(async () => {
    setScanning(true);
    const scan = SCANS.find((s) => s.id === kind);
    const result = await scan.run();
    setPairs(result);
    setSkipped(new Set());
    setScanning(false);
  }, [kind]);

  const visible = pairs.filter((p, i) => !skipped.has(i));

  return (
    <div style={shell}>
      <header style={header}>
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={input}>
          {SCANS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <button onClick={onScan} disabled={scanning} style={{ ...input, background: '#3b6db8', cursor: 'pointer' }}>
          {scanning ? 'Scanning…' : 'Scan'}
        </button>
        <span style={{ marginLeft: 'auto', color: '#8b90a0', fontSize: 12 }}>
          {pairs.length > 0 && `${visible.length} of ${pairs.length} candidate pair${pairs.length === 1 ? '' : 's'}`}
        </span>
      </header>

      <main style={main}>
        {pairs.length === 0 && !scanning && (
          <div style={{ color: '#8b90a0', textAlign: 'center', marginTop: 60 }}>
            Pick an entity type and click <strong>Scan</strong> to find potential duplicates.
          </div>
        )}
        {visible.map((pair, i) => {
          const realIndex = pairs.indexOf(pair);
          return (
            <MergePair
              key={pair.a.recordName + '|' + pair.b.recordName}
              pair={pair}
              onMerged={() => {
                const next = pairs.filter((_, j) => j !== realIndex);
                setPairs(next);
              }}
              onSkip={() => setSkipped(new Set([...skipped, realIndex]))}
            />
          );
        })}
      </main>
    </div>
  );
}

const shell = { display: 'flex', flexDirection: 'column', height: '100%', background: '#0f1117' };
const header = { display: 'flex', gap: 8, alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #2e3345', background: '#161926' };
const main = { flex: 1, overflow: 'auto', padding: 20 };
const input = { background: '#242837', color: '#e2e4eb', border: '1px solid #2e3345', borderRadius: 8, padding: '8px 12px', font: '13px -apple-system, system-ui, sans-serif', outline: 'none' };

export default DuplicatesApp;
