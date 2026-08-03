/**
 * DuplicatesApp — scan for duplicate persons/families/sources and merge them.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { Button } from '../ui/Button.jsx';
import { Select } from '../ui/Select.jsx';

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
  const scopedRecordId = searchParams.get('recordId') || '';
  const [kind, setKind] = useState(initialKind);
  const [pairs, setPairs] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [skippedCount, setSkippedCount] = useState(0);
  const autoScanApplied = useRef(false);
  useEffect(() => {
    const paramKind = searchParams.get('kind');
    const nextKind = SCANS.find((entry) => entry.id === paramKind)?.id;
    if (nextKind && nextKind !== kind) setKind(nextKind);
  }, [kind, searchParams]);

  const onScan = useCallback(async () => {
    setScanning(true);
    const scan = SCANS.find((s) => s.id === kind);
    const [result, skippedPairs] = await Promise.all([scan.run(), getSkippedDuplicatePairs(kind)]);
    setPairs(scopedRecordId
      ? result.filter((pair) => pair.a?.recordName === scopedRecordId || pair.b?.recordName === scopedRecordId)
      : result);
    setSkippedCount(skippedPairs.length);
    setHasScanned(true);
    setScanning(false);
  }, [kind, scopedRecordId]);

  useEffect(() => {
    if (searchParams.get('auto') !== '1' || autoScanApplied.current) return;
    autoScanApplied.current = true;
    void onScan();
  }, [onScan, searchParams]);

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
    setPairs(scopedRecordId
      ? result.filter((pair) => pair.a?.recordName === scopedRecordId || pair.b?.recordName === scopedRecordId)
      : result);
    setSkippedCount(0);
    setScanning(false);
  }, [kind, scopedRecordId]);

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex gap-2 items-center px-5 py-3.5 border-b border-border bg-card">
        <Select
          value={kind}
          onChange={(nextKind) => {
            setKind(nextKind);
            setPairs([]);
            setHasScanned(false);
            const next = new URLSearchParams(searchParams);
            next.set('kind', nextKind);
            setSearchParams(next, { replace: true });
          }}
          options={SCANS.map((s) => ({ value: s.id, label: t(`duplicatesPage.entity.${s.id}`) }))}
          className="w-44"
        />
        <Button variant="primary" size="md" onClick={onScan} disabled={scanning}>
          {scanning ? t('duplicatesPage.scanning') : t('duplicatesPage.scan')}
        </Button>
        {skippedCount > 0 && (
          <Button size="md" onClick={onClearSkipped} disabled={scanning}>
            {t('duplicatesPage.showSkipped', { count: skippedCount })}
          </Button>
        )}
        <span className="ms-auto text-muted-foreground text-xs">
          {pairs.length > 0 && t('duplicatesPage.candidateCount', { count: pairs.length })}
        </span>
      </header>

      <div className="flex-1 overflow-auto p-5">
        {pairs.length === 0 && !scanning && (
          <div className="text-muted-foreground text-center mt-16">
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
      </div>
    </div>
  );
}

export default DuplicatesApp;
