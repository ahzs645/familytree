/**
 * PlaceConvertToDetailSheet — collapse a Place into a PlaceDetail of a parent
 * Place, rewiring every incoming reference to the parent. Mac reference:
 * `PlaceConvertToPlaceDetailSheet.nib`.
 *
 * Flow:
 *   1. User picks a parent Place from the current tree.
 *   2. Sheet scans every record type for refs to the current Place.
 *   3. Preview shows a count per record type.
 *   4. On confirm, a single transaction:
 *        - creates a PlaceDetail on the parent (name = collapsed place name)
 *        - rewrites every ref that pointed to the collapsed place
 *        - deletes the collapsed Place record
 */
import React, { useEffect, useMemo, useState } from 'react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { refToRecordName, refValue } from '../lib/recordRef.js';
import { readField } from '../lib/schema.js';

export function PlaceConvertToDetailSheet({ placeRecordName, onClose, onConverted }) {
  const [place, setPlace] = useState(null);
  const [otherPlaces, setOtherPlaces] = useState([]);
  const [parentId, setParentId] = useState('');
  const [detailName, setDetailName] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = getLocalDatabase();
        const [record, { records }] = await Promise.all([
          db.getRecord(placeRecordName),
          db.query('Place', { limit: 100000 }),
        ]);
        if (cancelled) return;
        if (!record) {
          setError('This Place record was not found.');
          return;
        }
        setPlace(record);
        const name = readField(record, ['cached_displayName', 'cached_normallocationString', 'placeName', 'name'], record.recordName);
        setDetailName(name);
        const others = records
          .filter((r) => r.recordName !== placeRecordName)
          .map((r) => ({
            recordName: r.recordName,
            label: readField(r, ['cached_displayName', 'cached_normallocationString', 'placeName', 'name'], r.recordName),
          }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setOtherPlaces(others);
        if (others[0]) setParentId(others[0].recordName);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load Place.');
      }
    })();
    return () => { cancelled = true; };
  }, [placeRecordName]);

  useEffect(() => {
    if (!place) return;
    let cancelled = false;
    (async () => {
      try {
        const rewrites = await findReferencingRecords(placeRecordName);
        if (cancelled) return;
        const byType = {};
        for (const record of rewrites) byType[record.recordType] = (byType[record.recordType] || 0) + 1;
        setPreview({ count: rewrites.length, byType });
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to scan incoming references.');
      }
    })();
    return () => { cancelled = true; };
  }, [place, placeRecordName]);

  const placeLabel = useMemo(() => (
    place ? readField(place, ['cached_displayName', 'cached_normallocationString', 'placeName', 'name'], place.recordName) : ''
  ), [place]);

  const run = async () => {
    if (!place || !parentId) return;
    setRunning(true);
    setError('');
    try {
      await convertPlaceToDetail({
        placeRecordName,
        parentRecordName: parentId,
        detailName: detailName.trim() || placeLabel,
      });
      onConverted?.();
    } catch (e) {
      setError(e?.message || 'Conversion failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 pt-[8vh]" role="dialog" aria-modal="true" aria-label="Convert Place to Detail">
      <div className="w-full max-w-xl rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <header className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Convert Place to Detail</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Collapse <span className="text-foreground font-medium">{placeLabel || '(this place)'}</span> into a PlaceDetail of a parent place.
            Every reference to this place will be rewired to the parent, and the original Place record will be deleted.
          </p>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && <div className="text-sm text-destructive">{error}</div>}
          <label className="block text-xs font-medium">
            Parent place
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              disabled={running || otherPlaces.length === 0}
              className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            >
              {otherPlaces.length === 0 && <option value="">No other places available</option>}
              {otherPlaces.map((option) => (
                <option key={option.recordName} value={option.recordName}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium">
            New detail name on parent
            <input
              value={detailName}
              onChange={(e) => setDetailName(e.target.value)}
              disabled={running}
              className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            />
          </label>
          <div className="rounded-md border border-border bg-background p-3 text-xs">
            <div className="font-semibold mb-1">Reference rewire preview</div>
            {!preview ? (
              <div className="text-muted-foreground">Scanning…</div>
            ) : preview.count === 0 ? (
              <div className="text-muted-foreground">No records reference this place — it will simply be deleted.</div>
            ) : (
              <>
                <div className="text-muted-foreground mb-1">{preview.count} record{preview.count === 1 ? '' : 's'} will be rewired:</div>
                <ul className="list-disc ps-5 space-y-0.5">
                  {Object.entries(preview.byType).sort(([a], [b]) => a.localeCompare(b)).map(([type, count]) => (
                    <li key={type}>{type}: {count}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
        <footer className="px-4 py-3 border-t border-border flex items-center gap-2">
          <button type="button" onClick={onClose} disabled={running} className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent">Cancel</button>
          <button
            type="button"
            onClick={run}
            disabled={running || !parentId || !detailName.trim()}
            className="ms-auto bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
          >
            {running ? 'Converting…' : 'Convert'}
          </button>
        </footer>
      </div>
    </div>
  );
}

async function findReferencingRecords(placeRecordName) {
  const db = getLocalDatabase();
  const all = await db.getAllRecords();
  const matched = [];
  for (const record of all) {
    if (!record || record.recordName === placeRecordName) continue;
    if (recordTouchesPlace(record, placeRecordName)) matched.push(record);
  }
  return matched;
}

function recordTouchesPlace(record, placeRecordName) {
  for (const [, field] of Object.entries(record.fields || {})) {
    const ref = refToRecordName(field?.value);
    if (ref === placeRecordName) return true;
  }
  return false;
}

async function convertPlaceToDetail({ placeRecordName, parentRecordName, detailName }) {
  const db = getLocalDatabase();
  const parent = await db.getRecord(parentRecordName);
  if (!parent) throw new Error('Parent place not found.');

  const referencing = await findReferencingRecords(placeRecordName);
  const saveRecords = [];
  for (const record of referencing) {
    const next = rewireRecordRefs(record, placeRecordName, parentRecordName);
    if (next) saveRecords.push(next);
  }

  const detail = {
    recordName: `placedetail-convert-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    recordType: 'PlaceDetail',
    fields: {
      place: { value: refValue(parentRecordName, 'Place'), type: 'REFERENCE' },
      name: { value: detailName, type: 'STRING' },
      convertedFromPlace: { value: placeRecordName, type: 'STRING' },
    },
  };
  saveRecords.push(detail);

  await db.applyRecordTransaction({
    saveRecords,
    deleteRecordNames: [placeRecordName],
  });
}

function rewireRecordRefs(record, fromId, toId) {
  const nextFields = {};
  let touched = false;
  for (const [name, field] of Object.entries(record.fields || {})) {
    if (!field) { nextFields[name] = field; continue; }
    const currentRef = refToRecordName(field.value);
    if (currentRef === fromId) {
      const recordType = typeof field.value === 'string' && field.value.includes('---') ? field.value.split('---')[1] : 'Place';
      nextFields[name] = { ...field, value: refValue(toId, recordType || 'Place') };
      touched = true;
      continue;
    }
    nextFields[name] = field;
  }
  if (!touched) return null;
  return { ...record, fields: nextFields };
}

export default PlaceConvertToDetailSheet;
