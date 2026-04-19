/**
 * Virtual Globe — every event with coordinates plotted on a 3D globe.
 * Distinct from /map (flat) and /maps-diagram (flat with timeline).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { refToRecordName } from '../lib/recordRef.js';
import { Map as MapView } from '../components/ui/Map.jsx';

export default function Globe() {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const db = getLocalDatabase();
      const [pe, fe, places, coords] = await Promise.all([
        db.query('PersonEvent', { limit: 100000 }),
        db.query('FamilyEvent', { limit: 100000 }),
        db.query('Place', { limit: 100000 }),
        db.query('Coordinate', { limit: 100000 }),
      ]);
      const placeById = new Map(places.records.map((p) => [p.recordName, p]));
      const coordByPlace = new Map();
      for (const c of coords.records) {
        const placeId = refToRecordName(c.fields?.place?.value);
        if (placeId) coordByPlace.set(placeId, c);
      }
      const events = [...pe.records, ...fe.records];
      const out = [];
      for (const ev of events) {
        const placeId = refToRecordName(ev.fields?.place?.value) || refToRecordName(ev.fields?.assignedPlace?.value);
        if (!placeId) continue;
        const place = placeById.get(placeId);
        const coord = coordByPlace.get(placeId);
        const lat = coord?.fields?.latitude?.value;
        const lng = coord?.fields?.longitude?.value;
        if (typeof lat !== 'number' || typeof lng !== 'number') continue;
        out.push({
          id: ev.recordName,
          lat,
          lng,
          popup: `${refToRecordName(ev.fields?.conclusionType?.value) || ev.fields?.eventType?.value || 'Event'}${ev.fields?.date?.value ? ' · ' + ev.fields.date.value : ''} — ${place?.fields?.cached_normallocationString?.value || place?.fields?.placeName?.value || placeId}`,
        });
      }
      if (!cancel) {
        setPoints(out);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const center = useMemo(() => {
    if (points.length === 0) return [0, 20];
    const lats = points.map((m) => m.lat);
    const lngs = points.map((m) => m.lng);
    return [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
  }, [points]);

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">Virtual Globe</h1>
        <span className="text-xs text-muted-foreground">
          {loading ? 'Loading…' : `${points.length} event location${points.length === 1 ? '' : 's'}`}
        </span>
        <span className="ms-auto text-xs text-muted-foreground">3D projection · drag to rotate · scroll to zoom</span>
      </header>
      <div className="flex-1 relative">
        <MapView
          center={center}
          zoom={1.6}
          markers={points}
          projection={{ type: 'globe' }}
        />
      </div>
    </div>
  );
}
