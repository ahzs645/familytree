/**
 * DuplicatesApp — scan for duplicate persons/families/sources and merge them.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  clearSkippedDuplicatePairs,
  findDuplicateFamilies,
  findDuplicatePersons,
  findDuplicatePlaces,
  findDuplicateSources,
  getSkippedDuplicatePairs,
  skipDuplicatePair,
} from '../../lib/duplicates.js';
import { MergePair } from './MergePair.jsx';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

const SCANS = [
  { id: 'Person', run: findDuplicatePersons },
  { id: 'Family', run: findDuplicateFamilies },
  { id: 'Source', run: findDuplicateSources },
  { id: 'Place', run: findDuplicatePlaces },
];

export function DuplicatesApp() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialKind = SCANS.find((entry) => entry.id === searchParams.get('kind'))?.id || 'Person';
  const [kind, setKind] = useState(initialKind);
  const [pairs, setPairs] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [skippedCount, setSkippedCount] = useState(0);
  useEffect(() => {
    const paramKind = searchParams.get('kind');
    const nextKind = SCANS.find((entry) => entry.id === paramKind)?.id;
    if (nextKind && nextKind !== kind) setKind(nextKind);
  }, [kind, searchParams]);

  const onScan = useCallback(async () => {
    setScanning(true);
    const scan = SCANS.find((s) => s.id === kind);
    const [result, skippedPairs] = await Promise.all([scan.run(), getSkippedDuplicatePairs(kind)]);
    setPairs(result);
    setSkippedCount(skippedPairs.length);
    setHasScanned(true);
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
      <select
        value={kind}
        onChange={(e) => {
          const nextKind = e.target.value;
          setKind(nextKind);
          setPairs([]);
          setHasScanned(false);
          const next = new URLSearchParams(searchParams);
          next.set('kind', nextKind);
          setSearchParams(next, { replace: true });
        }}
        style={input}
      >
        {SCANS.map((s) => (
          <option key={s.id} value={s.id}>{t(`duplicatesPage.entity.${s.id}`)}</option>
        ))}
      </select>
        <button onClick={onScan} disabled={scanning} style={{ ...input, background: 'hsl(var(--primary))', cursor: 'pointer' }}>
          {scanning ? t('duplicatesPage.scanning') : t('duplicatesPage.scan')}
        </button>
        {skippedCount > 0 && (
          <button onClick={onClearSkipped} disabled={scanning} style={input}>
            {t('duplicatesPage.showSkipped', { count: skippedCount })}
          </button>
        )}
        <span style={{ marginLeft: 'auto', color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>
          {pairs.length > 0 && t('duplicatesPage.candidateCount', { count: pairs.length })}
        </span>
      </header>

      <main style={main}>
        {pairs.length === 0 && !scanning && (
          <div style={{ color: 'hsl(var(--muted-foreground))', textAlign: 'center', marginTop: 60 }}>
            {hasScanned
              ? (skippedCount > 0
                ? t('duplicatesPage.noneFoundSkipped', { count: skippedCount })
                : t('duplicatesPage.noneFound'))
              : t('duplicatesPage.emptyPrompt')}
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
