/**
 * DuplicatesApp — scan for duplicate persons/families/sources and merge them.
 */
import React, { useState, useCallback } from 'react';
import {
  clearSkippedDuplicatePairs,
  findDuplicateFamilies,
  findDuplicatePersons,
  findDuplicateSources,
  getSkippedDuplicatePairs,
  skipDuplicatePair,
} from '../../lib/duplicates.js';
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
  const [skippedCount, setSkippedCount] = useState(0);

  const onScan = useCallback(async () => {
    setScanning(true);
    const scan = SCANS.find((s) => s.id === kind);
    const [result, skippedPairs] = await Promise.all([scan.run(), getSkippedDuplicatePairs(kind)]);
    setPairs(result);
    setSkippedCount(skippedPairs.length);
    setScanning(false);
  }, [kind]);

  const onSkipPair = useCallback(async (pair) => {
    await skipDuplicatePair(kind, pair.a, pair.b);
    setPairs((current) => current.filter((item) => item !== pair));
    setSkippedCount((count) => count + 1);
  }, [kind]);

  const onClearSkipped = useCallback(async () => {
    setScanning(true);
    await clearSkippedDuplicatePairs(kind);
    const scan = SCANS.find((s) => s.id === kind);
    const result = await scan.run();
    setPairs(result);
    setSkippedCount(0);
    setScanning(false);
  }, [kind]);

  return (
    <div style={shell}>
      <header style={header}>
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={input}>
          {SCANS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <button onClick={onScan} disabled={scanning} style={{ ...input, background: 'hsl(var(--primary))', cursor: 'pointer' }}>
          {scanning ? 'Scanning…' : 'Scan'}
        </button>
        {skippedCount > 0 && (
          <button onClick={onClearSkipped} disabled={scanning} style={input}>
            Show {skippedCount} skipped
          </button>
        )}
        <span style={{ marginLeft: 'auto', color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>
          {pairs.length > 0 && `${pairs.length} candidate pair${pairs.length === 1 ? '' : 's'}`}
        </span>
      </header>

      <main style={main}>
        {pairs.length === 0 && !scanning && (
          <div style={{ color: 'hsl(var(--muted-foreground))', textAlign: 'center', marginTop: 60 }}>
            Pick an entity type and click <strong>Scan</strong> to find potential duplicates.
          </div>
        )}
        {pairs.map((pair) => {
          return (
            <MergePair
              key={pair.a.recordName + '|' + pair.b.recordName}
              pair={pair}
              onMerged={() => {
                setPairs((current) => current.filter((item) => item !== pair));
              }}
              onSkip={() => onSkipPair(pair)}
            />
          );
        })}
      </main>
    </div>
  );
}

const shell = { display: 'flex', flexDirection: 'column', height: '100%', background: 'hsl(var(--background))' };
const header = { display: 'flex', gap: 8, alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' };
const main = { flex: 1, overflow: 'auto', padding: 20 };
const input = { background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: '8px 12px', font: '13px -apple-system, system-ui, sans-serif', outline: 'none' };

export default DuplicatesApp;
