/**
 * BatchPlaceLookupSheet — modal for looking up coordinates / GeoName IDs for
 * many Place records in one pass. Mac reference: `BatchPlaceLookupSheet.nib`.
 *
 * Surfaces places missing coordinates, lets the user pick which to process,
 * runs them serially against `lookupPlaceCandidates`, and shows per-row
 * status. Saves resolved coordinates through `buildCoordinateRecord`.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Sheet } from './ui/Sheet.jsx';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { refValue } from '../lib/recordRef.js';
import { readRef } from '../lib/schema.js';
import {
  buildCoordinateRecord,
  lookupPlaceCandidates,
  placeLookupLabel,
} from '../lib/placeGeocoding.js';

const STATUS = { PENDING: 'pending', RUNNING: 'running', MATCHED: 'matched', NO_MATCH: 'no-match', ERROR: 'error' };

export function BatchPlaceLookupSheet({ onClose, onDone }) {
  const [rows, setRows] = useState(null);
  const [selected, setSelected] = useState({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = getLocalDatabase();
        const [{ records: places }, { records: coords }] = await Promise.all([
          db.query('Place', { limit: 100000 }),
          db.query('Coordinate', { limit: 100000 }),
        ]);
        const hasCoord = new Set();
        for (const coord of coords) {
          const placeId = readRef(coord.fields?.place);
          if (placeId) hasCoord.add(placeId);
        }
        const missing = [];
        for (const place of places) {
          if (hasCoord.has(place.recordName)) continue;
          if (readRef(place.fields?.coordinate)) continue;
          const label = placeLookupLabel(place);
          if (!label) continue;
          missing.push({
            recordName: place.recordName,
            label,
            status: STATUS.PENDING,
            message: '',
          });
        }
        missing.sort((a, b) => a.label.localeCompare(b.label));
        if (!cancelled) {
          setRows(missing);
          const pick = {};
          for (const row of missing.slice(0, 10)) pick[row.recordName] = true;
          setSelected(pick);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load places.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleAll = (value) => {
    if (!rows) return;
    const next = {};
    for (const row of rows) next[row.recordName] = value;
    setSelected(next);
  };

  const summary = useMemo(() => {
    if (!rows) return { total: 0, selected: 0, matched: 0, noMatch: 0, errors: 0 };
    let matched = 0, noMatch = 0, errors = 0, picked = 0;
    for (const row of rows) {
      if (selected[row.recordName]) picked += 1;
      if (row.status === STATUS.MATCHED) matched += 1;
      if (row.status === STATUS.NO_MATCH) noMatch += 1;
      if (row.status === STATUS.ERROR) errors += 1;
    }
    return { total: rows.length, selected: picked, matched, noMatch, errors };
  }, [rows, selected]);

  const run = async () => {
    if (!rows) return;
    setRunning(true);
    const db = getLocalDatabase();
    for (let i = 0; i < rows.length; i += 1) {
      if (!selected[rows[i].recordName]) continue;
      setRows((current) => updateRow(current, i, { status: STATUS.RUNNING, message: 'Looking up…' }));
      try {
        const candidates = await lookupPlaceCandidates(rows[i].label, { limit: 1 });
        const candidate = candidates[0];
        if (!candidate) {
          setRows((current) => updateRow(current, i, { status: STATUS.NO_MATCH, message: 'No match found.' }));
          continue;
        }
        const place = await db.getRecord(rows[i].recordName);
        if (!place) {
          setRows((current) => updateRow(current, i, { status: STATUS.ERROR, message: 'Place record missing.' }));
          continue;
        }
        const coordinate = buildCoordinateRecord(place.recordName, candidate);
        await db.saveRecord(coordinate);
        await db.saveRecord({
          ...place,
          fields: {
            ...place.fields,
            coordinate: { value: refValue(coordinate.recordName, 'Coordinate'), type: 'REFERENCE' },
            lookupProvider: { value: candidate.provider, type: 'STRING' },
            lookupProviderId: { value: candidate.providerId, type: 'STRING' },
          },
        });
        setRows((current) => updateRow(current, i, {
          status: STATUS.MATCHED,
          message: `${candidate.latitude.toFixed(4)}, ${candidate.longitude.toFixed(4)} — ${candidate.name}`,
        }));
      } catch (e) {
        setRows((current) => updateRow(current, i, { status: STATUS.ERROR, message: e?.message || 'Lookup failed.' }));
      }
    }
    setRunning(false);
    onDone?.();
  };

  return (
    <Sheet
      ariaLabel="Batch place lookup"
      offset="pt-[6vh]"
      maxWidth="max-w-3xl"
      scroll="card"
      maxHeight="max-h-[85vh]"
      bodyClassName="p-3"
      title="Batch Place Lookup"
      subtitle="Look up coordinates for places that don't have a Coordinate record yet. Uses Nominatim (OpenStreetMap); respects the shared request rate."
      headerExtra={rows && (
        <div className="flex items-center gap-2 mt-2 text-xs flex-wrap">
          <span className="text-muted-foreground">{summary.total} place{summary.total === 1 ? '' : 's'} missing coordinates · {summary.selected} selected</span>
          {summary.matched > 0 && <span className="text-emerald-500">{summary.matched} matched</span>}
          {summary.noMatch > 0 && <span className="text-muted-foreground">{summary.noMatch} no match</span>}
          {summary.errors > 0 && <span className="text-destructive">{summary.errors} errors</span>}
          <div className="ms-auto flex gap-1">
            <button type="button" onClick={() => toggleAll(true)} disabled={running} className="border border-border rounded-md px-2 py-0.5 hover:bg-accent">Select all</button>
            <button type="button" onClick={() => toggleAll(false)} disabled={running} className="border border-border rounded-md px-2 py-0.5 hover:bg-accent">Select none</button>
          </div>
        </div>
      )}
      footerClassName="flex items-center gap-2"
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={running} className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent">Close</button>
          <button
            type="button"
            onClick={run}
            disabled={running || !rows || summary.selected === 0}
            className="ms-auto bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
          >
            {running ? 'Running…' : `Look up ${summary.selected} place${summary.selected === 1 ? '' : 's'}`}
          </button>
        </>
      )}
    >
          {error && <div className="text-sm text-destructive mb-3">{error}</div>}
          {!rows ? (
            <div className="text-sm text-muted-foreground">Loading places…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Every place already has coordinates.</div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li key={row.recordName} className="flex items-start gap-2 py-2">
                  <input
                    type="checkbox"
                    checked={!!selected[row.recordName]}
                    disabled={running || row.status === STATUS.MATCHED}
                    onChange={(e) => setSelected((prev) => ({ ...prev, [row.recordName]: e.target.checked }))}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{row.label}</div>
                    {row.message && (
                      <div className={`text-xs truncate ${statusTone(row.status)}`}>{row.message}</div>
                    )}
                  </div>
                  <div className={`text-[11px] ${statusTone(row.status)}`}>{statusLabel(row.status)}</div>
                </li>
              ))}
            </ul>
          )}
    </Sheet>
  );
}

function updateRow(list, index, patch) {
  const next = list.slice();
  next[index] = { ...next[index], ...patch };
  return next;
}

function statusLabel(status) {
  if (status === STATUS.RUNNING) return 'Running';
  if (status === STATUS.MATCHED) return 'Matched';
  if (status === STATUS.NO_MATCH) return 'No match';
  if (status === STATUS.ERROR) return 'Error';
  return '';
}

function statusTone(status) {
  if (status === STATUS.MATCHED) return 'text-emerald-500';
  if (status === STATUS.ERROR) return 'text-destructive';
  if (status === STATUS.RUNNING) return 'text-primary';
  if (status === STATUS.NO_MATCH) return 'text-muted-foreground';
  return 'text-muted-foreground';
}

export default BatchPlaceLookupSheet;
