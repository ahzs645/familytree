/**
 * Maps Diagram — every event whose place has coordinates, plotted on a map
 * with a timeline scrubber and event-type filter.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { refToRecordName } from '../lib/recordRef.js';
import { Map as MapView } from '../components/ui/Map.jsx';

function yearOf(s) {
  const m = String(s || '').match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

export default function MapsDiagram() {
  const [events, setEvents] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [yearMax, setYearMax] = useState(null);

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
      // Build coord lookup keyed by place
      const coordByPlace = new Map();
      for (const c of coords.records) {
        const placeId = refToRecordName(c.fields?.place?.value);
        if (placeId) coordByPlace.set(placeId, c);
      }
      const all = [...pe.records, ...fe.records];
      const out = [];
      for (const ev of all) {
        const placeId = refToRecordName(ev.fields?.place?.value) || refToRecordName(ev.fields?.assignedPlace?.value);
        if (!placeId) continue;
        const place = placeById.get(placeId);
        const coord = coordByPlace.get(placeId);
        const lat = coord?.fields?.latitude?.value;
        const lng = coord?.fields?.longitude?.value;
        if (typeof lat !== 'number' || typeof lng !== 'number') continue;
        out.push({
          recordName: ev.recordName,
          recordType: ev.recordType,
          conclusionType: refToRecordName(ev.fields?.conclusionType?.value) || ev.fields?.eventType?.value || 'Event',
          date: ev.fields?.date?.value || '',
          year: yearOf(ev.fields?.date?.value),
          placeName: place?.fields?.cached_normallocationString?.value || place?.fields?.placeName?.value || placeId,
          lat,
          lng,
        });
      }
      if (!cancel) setEvents(out);
    })();
    return () => { cancel = true; };
  }, []);

  const types = useMemo(() => {
    const set = new Set(events.map((e) => e.conclusionType).filter(Boolean));
    return ['', ...Array.from(set).sort()];
  }, [events]);

  const yearBounds = useMemo(() => {
    const years = events.map((e) => e.year).filter(Boolean);
    if (years.length === 0) return [1500, 2025];
    return [Math.min(...years), Math.max(...years)];
  }, [events]);
  const effectiveMax = yearMax ?? yearBounds[1];

  const filtered = useMemo(() => events.filter((e) => {
    if (filterType && e.conclusionType !== filterType) return false;
    if (e.year && e.year > effectiveMax) return false;
    return true;
  }), [events, filterType, effectiveMax]);

  const center = useMemo(() => {
    if (filtered.length === 0) return [0, 20];
    const lats = filtered.map((m) => m.lat);
    const lngs = filtered.map((m) => m.lng);
    return [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
  }, [filtered]);

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card flex-wrap">
        <h1 className="text-base font-semibold">Maps Diagram</h1>
        <span className="text-xs text-muted-foreground">{filtered.length} of {events.length} events plotted</span>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <label className="text-xs text-muted-foreground">Type</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="bg-secondary border border-border rounded-md px-2 py-1 text-xs">
            {types.map((t) => <option key={t} value={t}>{t || 'All types'}</option>)}
          </select>
          <label className="text-xs text-muted-foreground">Up to year {effectiveMax}</label>
          <input type="range" min={yearBounds[0]} max={yearBounds[1]} value={effectiveMax}
            onChange={(e) => setYearMax(+e.target.value)} className="w-48" />
          <button onClick={() => setYearMax(null)} className="text-xs text-primary hover:underline">reset</button>
        </div>
      </header>
      <div className="flex-1 relative">
        <MapView
          center={center}
          zoom={4}
          markers={filtered.map((e) => ({
            id: e.recordName,
            lat: e.lat,
            lng: e.lng,
            popup: `${e.conclusionType}${e.date ? ' · ' + e.date : ''} — ${e.placeName}`,
          }))}
        />
      </div>
    </div>
  );
}
