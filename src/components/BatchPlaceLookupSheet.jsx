/**
 * Batch place lookup with explicit review for every selected place. Candidates
 * use the same detailed chooser as single-place lookup; no first-result write
 * happens without the user seeing the feature type, hierarchy, and map.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { getAppDataClient } from '../lib/data/AppDataClient.js';
import { saveWithChangeLog } from '../lib/changeLog.js';
import { createWithChangeLog } from '../lib/recordWrite.js';
import { refValue } from '../lib/recordRef.js';
import { readRef } from '../lib/schema.js';
import {
  applyPlaceLookupCandidate,
  buildCoordinateRecord,
  lookupPlaceCandidates,
  placeLookupLabel,
} from '../lib/placeGeocoding.js';
import { PlaceLookupCandidateSheet } from './PlaceLookupCandidateSheet.jsx';
import { Button } from './ui/Button.jsx';
import { Sheet } from './ui/Sheet.jsx';

const STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  MATCHED: 'matched',
  NO_MATCH: 'no-match',
  SKIPPED: 'skipped',
  ERROR: 'error',
};

export function BatchPlaceLookupSheet({ onClose, onDone }) {
  const { t } = useTranslation();
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const reviewResolverRef = useRef(null);
  const [rows, setRows] = useState(null);
  const [selected, setSelected] = useState({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [review, setReview] = useState(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    dialogRef.current?.querySelector('button, input')?.focus();
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || running || review) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [onClose, review, running]);

  // A review changes `review` and therefore restarts the keyboard/focus effect
  // above. Only settle an outstanding review when the whole batch sheet is
  // actually removed; otherwise opening the chooser immediately skips it.
  useEffect(() => () => {
    const resolve = reviewResolverRef.current;
    reviewResolverRef.current = null;
    resolve?.(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = getAppDataClient();
        const [{ records: places }, { records: coords }] = await Promise.all([
          client.records.query('Place', { limit: 100000 }),
          client.records.query('Coordinate', { limit: 100000 }),
        ]);
        const hasCoord = new Set();
        for (const coord of coords) {
          const placeId = readRef(coord.fields?.place);
          if (placeId) hasCoord.add(placeId);
        }
        const missing = [];
        for (const place of places) {
          if (hasCoord.has(place.recordName) || readRef(place.fields?.coordinate)) continue;
          const label = placeLookupLabel(place);
          if (!label) continue;
          missing.push({ recordName: place.recordName, label, status: STATUS.PENDING, message: '' });
        }
        missing.sort((a, b) => a.label.localeCompare(b.label));
        if (!cancelled) {
          setRows(missing);
          setSelected(Object.fromEntries(missing.slice(0, 10).map((row) => [row.recordName, true])));
        }
      } catch {
        if (!cancelled) setError(t('placeLookup.batch.loadFailed'));
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  const toggleAll = (value) => {
    if (!rows) return;
    setSelected(Object.fromEntries(rows.map((row) => [row.recordName, value])));
  };

  const summary = useMemo(() => {
    const result = { total: rows?.length || 0, selected: 0, matched: 0, noMatch: 0, skipped: 0, errors: 0 };
    for (const row of rows || []) {
      if (selected[row.recordName]) result.selected += 1;
      if (row.status === STATUS.MATCHED) result.matched += 1;
      if (row.status === STATUS.NO_MATCH) result.noMatch += 1;
      if (row.status === STATUS.SKIPPED) result.skipped += 1;
      if (row.status === STATUS.ERROR) result.errors += 1;
    }
    return result;
  }, [rows, selected]);

  const requestReview = (row, candidates) => new Promise((resolve) => {
    reviewResolverRef.current = resolve;
    setReview({ row, candidates });
  });

  const finishReview = (choice) => {
    const resolve = reviewResolverRef.current;
    reviewResolverRef.current = null;
    setReview(null);
    resolve?.(choice);
  };

  const run = async () => {
    if (!rows) return;
    setRunning(true);
    const client = getAppDataClient();
    for (const row of rows) {
      if (!selected[row.recordName] || row.status === STATUS.MATCHED) continue;
      setRows((current) => updateRow(current, row.recordName, { status: STATUS.RUNNING, message: t('placeLookup.batch.lookingUp') }));
      try {
        const candidates = await lookupPlaceCandidates(row.label, { limit: 8 });
        if (!candidates.length) {
          setRows((current) => updateRow(current, row.recordName, { status: STATUS.NO_MATCH, message: t('placeLookup.batch.noMatch') }));
          continue;
        }
        const choice = await requestReview(row, candidates);
        if (!choice) {
          setRows((current) => updateRow(current, row.recordName, { status: STATUS.SKIPPED, message: t('placeLookup.batch.skipped') }));
          continue;
        }
        const place = await client.records.get(row.recordName);
        if (!place) {
          setRows((current) => updateRow(current, row.recordName, { status: STATUS.ERROR, message: t('placeLookup.batch.recordMissing') }));
          continue;
        }
        const coordinate = buildCoordinateRecord(place.recordName, choice.candidate);
        await createWithChangeLog(coordinate);
        const namedPlace = applyPlaceLookupCandidate(place, choice.candidate, choice.chosenName);
        await saveWithChangeLog({
          ...namedPlace,
          fields: {
            ...namedPlace.fields,
            coordinate: { value: refValue(coordinate.recordName, 'Coordinate'), type: 'REFERENCE' },
          },
        });
        setRows((current) => updateRow(current, row.recordName, {
          status: STATUS.MATCHED,
          message: t('placeLookup.batch.matchedMessage', {
            coordinates: `${choice.candidate.latitude.toFixed(4)}, ${choice.candidate.longitude.toFixed(4)}`,
            name: choice.chosenName || choice.candidate.name,
          }),
        }));
      } catch {
        setRows((current) => updateRow(current, row.recordName, { status: STATUS.ERROR, message: t('placeLookup.batch.lookupFailed') }));
      }
    }
    setRunning(false);
    onDone?.();
  };

  return (
    <>
      <Sheet
        dialogRef={dialogRef}
        ariaLabel={t('placeLookup.batch.ariaLabel')}
        offset="pt-[6vh]"
        maxWidth="max-w-3xl"
        scroll="card"
        maxHeight="max-h-[85vh]"
        bodyClassName="p-3"
        title={t('placeLookup.batch.title')}
        subtitle={t('placeLookup.batch.subtitle')}
        headerExtra={rows && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">{t('placeLookup.batch.summary', { total: summary.total, selected: summary.selected })}</span>
            {summary.matched > 0 && <span className="text-success-text">{t('placeLookup.batch.matchedCount', { count: summary.matched })}</span>}
            {summary.noMatch > 0 && <span className="text-muted-foreground">{t('placeLookup.batch.noMatchCount', { count: summary.noMatch })}</span>}
            {summary.skipped > 0 && <span className="text-muted-foreground">{t('placeLookup.batch.skippedCount', { count: summary.skipped })}</span>}
            {summary.errors > 0 && <span className="text-destructive-text">{t('placeLookup.batch.errorCount', { count: summary.errors })}</span>}
            <div className="ms-auto flex gap-1">
              <button type="button" onClick={() => toggleAll(true)} disabled={running} className="rounded-md border border-border px-2 py-0.5 hover:bg-accent">{t('placeLookup.batch.selectAll')}</button>
              <button type="button" onClick={() => toggleAll(false)} disabled={running} className="rounded-md border border-border px-2 py-0.5 hover:bg-accent">{t('placeLookup.batch.selectNone')}</button>
            </div>
          </div>
        )}
        footerClassName="flex items-center gap-2"
        footer={(
          <>
            <button type="button" onClick={onClose} disabled={running} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">{t('placeLookup.batch.close')}</button>
            <Button variant="primary" size="sm" onClick={run} disabled={running || !rows || summary.selected === 0} className="ms-auto">
              {running ? t('placeLookup.batch.running') : t('placeLookup.batch.run', { count: summary.selected })}
            </Button>
          </>
        )}
      >
        {error && <div className="mb-3 text-sm text-destructive-text" role="alert">{error}</div>}
        {!rows ? (
          <div className="text-sm text-muted-foreground">{t('placeLookup.batch.loading')}</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t('placeLookup.batch.complete')}</div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.recordName} className="flex items-start gap-2 py-2">
                <label className="mt-0.5 inline-flex">
                  <span className="sr-only">{t('placeLookup.batch.selectPlace', { name: row.label })}</span>
                  <input
                    type="checkbox"
                    checked={!!selected[row.recordName]}
                    disabled={running || row.status === STATUS.MATCHED}
                    onChange={(event) => setSelected((previous) => ({ ...previous, [row.recordName]: event.target.checked }))}
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{row.label}</div>
                  {row.message && <div className={`truncate text-xs ${statusTone(row.status)}`}>{row.message}</div>}
                </div>
                <div className={`text-2xs ${statusTone(row.status)}`}>{statusLabel(row.status, t)}</div>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
      {review && (
        <PlaceLookupCandidateSheet
          query={review.row.label}
          candidates={review.candidates}
          onApply={finishReview}
          onCancel={() => finishReview(null)}
        />
      )}
    </>
  );
}

function updateRow(list, recordName, patch) {
  return (list || []).map((row) => row.recordName === recordName ? { ...row, ...patch } : row);
}

function statusLabel(status, t) {
  return status === STATUS.PENDING ? '' : t(`placeLookup.batch.status.${status}`);
}

function statusTone(status) {
  if (status === STATUS.MATCHED) return 'text-success-text';
  if (status === STATUS.ERROR) return 'text-destructive-text';
  if (status === STATUS.RUNNING) return 'text-interactive';
  return 'text-muted-foreground';
}

export default BatchPlaceLookupSheet;
