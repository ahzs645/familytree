/**
 * Statistic Maps — every event whose place has coordinates, plotted on a map
 * with discoverable filters and an event detail panel.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { refToRecordName } from '../lib/recordRef.js';
import { readConclusionType } from '../lib/schema.js';
import { Map as MapView } from '../components/ui/Map.jsx';
import { formatEventDate } from '../utils/formatDate.js';

function yearOf(s) {
  const m = String(s || '').match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

function parseCoord(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function rangeLabel(range) {
  return `${range[0]} - ${range[1]}`;
}

export default function MapsDiagram() {
  const [events, setEvents] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [yearRange, setYearRange] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
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
      const coordById = new Map(coords.records.map((coord) => [coord.recordName, coord]));
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
        const coordinateRef = refToRecordName(place?.fields?.coordinate?.value);
        const coord = coordByPlace.get(placeId) || (coordinateRef ? coordById.get(coordinateRef) : null);
        const lat = parseCoord(coord?.fields?.latitude?.value ?? place?.fields?.latitude?.value);
        const lng = parseCoord(coord?.fields?.longitude?.value ?? place?.fields?.longitude?.value);
        if (lat == null || lng == null) continue;
        const subjectId = refToRecordName(ev.fields?.person?.value) || refToRecordName(ev.fields?.family?.value) || '';
        out.push({
          recordName: ev.recordName,
          recordType: ev.recordType,
          conclusionType: readConclusionType(ev) || 'Event',
          date: ev.fields?.date?.value || '',
          year: yearOf(ev.fields?.date?.value),
          description: ev.fields?.description?.value || ev.fields?.userDescription?.value || '',
          placeId,
          placeName: place?.fields?.cached_normallocationString?.value || place?.fields?.placeName?.value || placeId,
          subjectId,
          lat,
          lng,
        });
      }
      out.sort((a, b) => {
        const ay = Number.isFinite(a.year) ? a.year : -Infinity;
        const by = Number.isFinite(b.year) ? b.year : -Infinity;
        return ay - by || a.conclusionType.localeCompare(b.conclusionType);
      });
      if (!cancel) {
        setEvents(out);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const types = useMemo(() => {
    const set = new Set(events.map((e) => e.conclusionType).filter(Boolean));
    return ['', ...Array.from(set).sort()];
  }, [events]);

  const yearBounds = useMemo(() => {
    const years = events.map((e) => e.year).filter((year) => Number.isFinite(year));
    if (years.length === 0) return [1500, 2025];
    return [Math.min(...years), Math.max(...years)];
  }, [events]);

  const effectiveRange = yearRange || yearBounds;

  const filtered = useMemo(() => events.filter((e) => {
    if (filterType && e.conclusionType !== filterType) return false;
    if (Number.isFinite(e.year) && (e.year < effectiveRange[0] || e.year > effectiveRange[1])) return false;
    return true;
  }), [events, filterType, effectiveRange]);

  useEffect(() => {
    if (selectedId && !filtered.some((event) => event.recordName === selectedId)) setSelectedId(null);
  }, [filtered, selectedId]);

  const center = useMemo(() => {
    if (filtered.length === 0) return [0, 20];
    const lats = filtered.map((m) => m.lat);
    const lngs = filtered.map((m) => m.lng);
    return [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
  }, [filtered]);

  const selectedEvent = filtered.find((event) => event.recordName === selectedId);
  const hoveredEvent = filtered.find((event) => event.recordName === hoveredId);
  const detailEvent = selectedEvent || hoveredEvent;

  const setRangeMin = (value) => {
    const next = Number(value);
    setYearRange((range) => {
      const current = range || yearBounds;
      return [Math.min(next, current[1]), current[1]];
    });
  };

  const setRangeMax = (value) => {
    const next = Number(value);
    setYearRange((range) => {
      const current = range || yearBounds;
      return [current[0], Math.max(next, current[0])];
    });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-5 py-3">
        <div>
          <h1 className="text-base font-semibold">Statistic Maps</h1>
          <div className="text-xs text-muted-foreground">
            {loading ? 'Loading events…' : `${filtered.length} of ${events.length} event location${events.length === 1 ? '' : 's'} plotted`}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link to="/events" className="rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs hover:bg-accent">Events</Link>
          <Link to="/places" className="rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs hover:bg-accent">Places</Link>
        </div>
        <div className="basis-full flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Type
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground"
            >
              {types.map((t) => <option key={t} value={t}>{t || 'All types'}</option>)}
            </select>
          </label>
          <div className="flex min-w-[280px] flex-1 flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Years {rangeLabel(effectiveRange)}</span>
            <input
              type="range"
              min={yearBounds[0]}
              max={yearBounds[1]}
              value={effectiveRange[0]}
              onChange={(e) => setRangeMin(e.target.value)}
              className="w-36"
              aria-label="Minimum year"
            />
            <input
              type="range"
              min={yearBounds[0]}
              max={yearBounds[1]}
              value={effectiveRange[1]}
              onChange={(e) => setRangeMax(e.target.value)}
              className="w-36"
              aria-label="Maximum year"
            />
            <button onClick={() => setYearRange(null)} className="text-xs text-primary hover:underline">Reset years</button>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-white bg-primary shadow" />
            Event location
          </div>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative min-h-[360px]">
          <MapView
            center={center}
            zoom={4}
            markers={filtered.map((e) => ({
              id: e.recordName,
              lat: e.lat,
              lng: e.lng,
              popup: `${e.conclusionType}${e.date ? ' · ' + e.date : ''} — ${e.placeName}`,
              onClick: () => setSelectedId(e.recordName),
            }))}
          />
        </div>
        <aside className="min-h-0 overflow-auto border-t border-border bg-card p-4 lg:border-l lg:border-t-0">
          <EventDetail event={detailEvent} selected={!!selectedEvent} />
          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Event Rows</div>
            <div className="space-y-2">
              {filtered.length === 0 ? (
                <div className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">No events match the current map filters.</div>
              ) : filtered.slice(0, 500).map((event) => {
                const active = event.recordName === selectedId || event.recordName === hoveredId;
                return (
                  <button
                    type="button"
                    key={event.recordName}
                    onMouseEnter={() => setHoveredId(event.recordName)}
                    onMouseLeave={() => setHoveredId(null)}
                    onFocus={() => setHoveredId(event.recordName)}
                    onBlur={() => setHoveredId(null)}
                    onClick={() => setSelectedId(event.recordName)}
                    className={`w-full rounded-md border p-2.5 text-left transition-colors ${active ? 'border-primary bg-accent' : 'border-border bg-background hover:bg-accent/60'}`}
                  >
                    <div className="text-sm font-medium">{event.conclusionType}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{formatEventDate(event.date) || 'Undated'} · {event.placeName}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function EventDetail({ event, selected }) {
  if (!event) {
    return (
      <div className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
        Hover or select an event row to inspect its date, place, and related actions.
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {selected ? 'Selected Event' : 'Hovered Event'}
      </div>
      <h2 className="text-base font-semibold">{event.conclusionType}</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Date</dt>
          <dd>{formatEventDate(event.date) || 'Undated'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Place</dt>
          <dd>{event.placeName}</dd>
        </div>
        {event.description ? (
          <div>
            <dt className="text-xs text-muted-foreground">Description</dt>
            <dd>{event.description}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={`/events?eventId=${encodeURIComponent(event.recordName)}`} className="rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs hover:bg-accent">Open Event</Link>
        <Link to={`/places?placeId=${encodeURIComponent(event.placeId)}`} className="rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs hover:bg-accent">Open Place</Link>
        <Link to={`/views/media-gallery?targetId=${encodeURIComponent(event.recordName)}&targetType=${event.recordType}`} className="rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs hover:bg-accent">Related Media</Link>
      </div>
    </div>
  );
}
