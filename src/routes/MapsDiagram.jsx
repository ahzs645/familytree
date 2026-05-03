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
import { VisualOptionsDrawer } from '../components/charts/VisualOptionsDrawer.jsx';
import { formatEventDate } from '../utils/formatDate.js';
import { personSummary } from '../models/index.js';
import {
  buildChronologicalConnections,
  colorForVisualEvent,
  normalizeVisualViewOptions,
  usesHeatMap,
  usesMarkerPins,
} from '../lib/visualViewOptions.js';

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

const STATISTIC_SOURCES = [
  { id: 'events-heat', label: 'Events heat map', mode: 'heat', predicate: () => true },
  { id: 'events', label: 'Events', predicate: () => true },
  { id: 'birth-heat', label: 'Birth events heat map', mode: 'heat', predicate: (event) => /birth|christ|bapt/i.test(event.conclusionType) },
  { id: 'birth', label: 'Birth Events', predicate: (event) => /birth|christ|bapt/i.test(event.conclusionType) },
  { id: 'birth-living', label: 'Birth events of living persons', predicate: (event) => /birth|christ|bapt/i.test(event.conclusionType) && !event.subjectDeathYear },
  { id: 'death-heat', label: 'Death events heat map', mode: 'heat', predicate: (event) => /death|crem/i.test(event.conclusionType) },
  { id: 'death', label: 'Death Events', predicate: (event) => /death|crem/i.test(event.conclusionType) },
  { id: 'burial', label: 'Burial Events', predicate: (event) => /burial|buri/i.test(event.conclusionType) },
  { id: 'burial-heat', label: 'Burial events heat map', mode: 'heat', predicate: (event) => /burial|buri/i.test(event.conclusionType) },
  { id: 'name-distribution', label: 'Name distribution', colorBy: 'name', predicate: () => true },
  { id: 'gender-distribution', label: 'Gender distribution', colorBy: 'gender', predicate: () => true },
  { id: 'living-heat', label: 'Heat map of living persons', mode: 'heat', predicate: (event) => !event.subjectDeathYear },
  { id: 'average-age', label: 'Average age', colorBy: 'age', predicate: (event) => Number.isFinite(event.subjectBirthYear) },
  { id: 'average-age-at-death', label: 'Average age at death', colorBy: 'ageAtDeath', predicate: (event) => Number.isFinite(event.subjectBirthYear) && Number.isFinite(event.subjectDeathYear) },
];

export default function MapsDiagram() {
  const [events, setEvents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [statisticSourceId, setStatisticSourceId] = useState('events-heat');
  const [subjectId, setSubjectId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [yearRange, setYearRange] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [stepYears, setStepYears] = useState(5);
  const [allYears, setAllYears] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [visualOptions, setVisualOptions] = useState(() => normalizeVisualViewOptions('mapStory'));

  useEffect(() => {
    let cancel = false;
    (async () => {
      const db = getLocalDatabase();
      const [pe, fe, places, coords, persons] = await Promise.all([
        db.query('PersonEvent', { limit: 100000 }),
        db.query('FamilyEvent', { limit: 100000 }),
        db.query('Place', { limit: 100000 }),
        db.query('Coordinate', { limit: 100000 }),
        db.query('Person', { limit: 100000 }),
      ]);
      const personById = new Map(persons.records.map((person) => [person.recordName, person]));
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
          subjectName: personSummary(personById.get(subjectId))?.fullName || subjectId,
          subjectGender: personById.get(subjectId)?.fields?.gender?.value || personById.get(subjectId)?.fields?.sex?.value || '',
          subjectBirthYear: yearOf(personById.get(subjectId)?.fields?.birthDate?.value || personById.get(subjectId)?.fields?.cached_birthDate?.value),
          subjectDeathYear: yearOf(personById.get(subjectId)?.fields?.deathDate?.value || personById.get(subjectId)?.fields?.cached_deathDate?.value),
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
        setSubjects([...new Map(out.filter((event) => event.subjectId).map((event) => [event.subjectId, event.subjectName])).entries()]
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name)));
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

  const effectiveRange = allYears ? yearBounds : (yearRange || yearBounds);
  const statisticSource = STATISTIC_SOURCES.find((source) => source.id === statisticSourceId) || STATISTIC_SOURCES[0];

  const filtered = useMemo(() => events.filter((e) => {
    if (!statisticSource.predicate(e)) return false;
    if (filterType && e.conclusionType !== filterType) return false;
    if (subjectId && e.subjectId !== subjectId) return false;
    if (visualOptions.smartFilterMode === 'with-places' && !e.placeId) return false;
    if (visualOptions.smartFilterMode === 'missing-date' && e.year) return false;
    if (visualOptions.smartFilterMode === 'living' && e.subjectDeathYear) return false;
    if (!allYears && Number.isFinite(e.year) && (e.year < effectiveRange[0] || e.year > effectiveRange[1])) return false;
    return true;
  }), [events, statisticSource, filterType, subjectId, visualOptions.smartFilterMode, effectiveRange, allYears]);

  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => {
      setYearRange((range) => {
        const current = range || yearBounds;
        const span = Math.max(1, current[1] - current[0]);
        let nextStart = current[0] + (visualOptions.slideshowYearStep || stepYears);
        if (nextStart + span > yearBounds[1]) nextStart = yearBounds[0];
        const nextEnd = visualOptions.slideshowExpandRange ? Math.min(yearBounds[1], current[1] + (visualOptions.slideshowYearStep || stepYears)) : Math.min(yearBounds[1], nextStart + span);
        const next = [nextStart, nextEnd];
        if (!visualOptions.slideshowSkipEmptyYears) return next;
        const hasEvent = events.some((event) => {
          if (!statisticSource.predicate(event) || !Number.isFinite(event.year)) return false;
          return event.year >= next[0] && event.year <= next[1];
        });
        return hasEvent ? next : yearBounds;
      });
    }, visualOptions.slideshowDelayMs);
    return () => clearInterval(id);
  }, [events, playing, statisticSource, stepYears, visualOptions.slideshowDelayMs, visualOptions.slideshowExpandRange, visualOptions.slideshowSkipEmptyYears, visualOptions.slideshowYearStep, yearBounds]);

  useEffect(() => {
    if (allYears) setPlaying(false);
  }, [allYears]);

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
  const mapMarkers = useMemo(() => {
    return filtered.map((event) => ({
      id: event.recordName,
      lat: event.lat,
      lng: event.lng,
      color: colorForStatisticEvent(event, statisticSource, visualOptions, yearBounds),
      size: visualOptions.markerSize,
      popup: `${event.conclusionType}${event.date ? ' · ' + event.date : ''} — ${event.placeName}`,
      onClick: () => setSelectedId(event.recordName),
    }));
  }, [filtered, statisticSource, visualOptions, yearBounds]);
  const mapConnections = useMemo(
    () => buildChronologicalConnections(filtered, visualOptions.connectionLines),
    [filtered, visualOptions.connectionLines]
  );

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
      <header className="border-b border-border bg-card px-3 py-3 md:px-5">
        <div className="flex items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-semibold">Map + Timeline Story</h1>
          <div className="text-xs text-muted-foreground">
            {loading ? 'Loading events…' : `${filtered.length} of ${events.length} placed event${events.length === 1 ? '' : 's'} · ${statisticSource.label}`}
          </div>
        </div>
        <div className="ms-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setOptionsOpen((open) => !open)}
            className="rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs hover:bg-accent"
          >
            Options
          </button>
          <Link to="/events" className="hidden rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs hover:bg-accent sm:inline-flex">Events</Link>
          <Link to="/places" className="hidden rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs hover:bg-accent sm:inline-flex">Places</Link>
        </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-[minmax(240px,1.35fr)_minmax(140px,0.65fr)_minmax(220px,1fr)_minmax(260px,1.25fr)]">
          <label className="grid gap-1 text-xs text-muted-foreground">
            <span>Statistic</span>
            <select
              value={statisticSourceId}
              onChange={(e) => {
                const nextSource = STATISTIC_SOURCES.find((source) => source.id === e.target.value);
                setStatisticSourceId(e.target.value);
                if (nextSource?.mode === 'heat') setVisualOptions((current) => normalizeVisualViewOptions('mapStory', { ...current, markerMode: 'pins-heat' }));
              }}
              className="h-8 min-w-0 rounded-md border border-border bg-secondary px-2 text-sm text-foreground"
            >
              {STATISTIC_SOURCES.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            <span>Type</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-8 min-w-0 rounded-md border border-border bg-secondary px-2 text-sm text-foreground"
            >
              {types.map((t) => <option key={t} value={t}>{t || 'All types'}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            <span>Person</span>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="h-8 min-w-0 rounded-md border border-border bg-secondary px-2 text-sm text-foreground"
            >
              <option value="">All people</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
          </label>
          <div className="col-span-2 grid gap-1 rounded-md border border-border bg-background px-2.5 py-2 text-xs text-muted-foreground xl:col-span-1">
            <div className="flex items-center justify-between gap-2">
              <span>Years {rangeLabel(effectiveRange)}</span>
              <button onClick={() => setYearRange(null)} className="text-primary hover:underline">Reset</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="range"
                min={yearBounds[0]}
                max={yearBounds[1]}
                value={effectiveRange[0]}
                onChange={(e) => setRangeMin(e.target.value)}
                className="min-w-0"
                aria-label="Minimum year"
              />
              <input
                type="range"
                min={yearBounds[0]}
                max={yearBounds[1]}
                value={effectiveRange[1]}
                onChange={(e) => setRangeMax(e.target.value)}
                className="min-w-0"
                aria-label="Maximum year"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setPlaying((p) => !p)}
                disabled={allYears}
                className="rounded-md border border-border bg-secondary px-2 py-1 text-xs disabled:opacity-50"
                title="Animate across the selected year range"
              >
                {playing ? 'Stop' : 'Start'} Slideshow
              </button>
              <label className="flex items-center gap-1">
                step
                <select
                  value={stepYears}
                  onChange={(e) => {
                    setStepYears(Number(e.target.value));
                    setVisualOptions((current) => normalizeVisualViewOptions('mapStory', { ...current, slideshowYearStep: Number(e.target.value) }));
                  }}
                  className="rounded-md border border-border bg-secondary px-1 py-0.5 text-xs"
                >
                  {[1, 2, 5, 10, 25].map((n) => <option key={n} value={n}>{n}y</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={allYears} onChange={(e) => setAllYears(e.target.checked)} />
                All years
              </label>
              <span className="ms-auto hidden items-center gap-1 sm:flex">
                <span className="inline-block h-3 w-3 rounded-full border-2 border-white bg-primary shadow" />
                Event location
              </span>
            </div>
          </div>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative min-h-[420px]">
          <MapView
            center={center}
            zoom={visualOptions.slideshowFit && playing ? 5 : 4}
            markers={mapMarkers}
            showMarkers={usesMarkerPins(visualOptions)}
            connections={mapConnections}
            heatmap={{
              enabled: statisticSource.mode === 'heat' || usesHeatMap(visualOptions),
              radius: visualOptions.heatRadius,
              opacity: visualOptions.heatOpacity,
              amplification: visualOptions.heatAmplification,
              autoRadius: visualOptions.heatAutoRadius,
              fixedRadius: visualOptions.fixedHeatRadius,
              gradient: visualOptions.heatGradient,
            }}
          />
          <VisualOptionsDrawer
            kind="mapStory"
            open={optionsOpen}
            options={visualOptions}
            onChange={setVisualOptions}
            onClose={() => setOptionsOpen(false)}
            title="Map Options"
          />
        </div>
        <aside className="min-h-0 overflow-auto border-t border-border bg-card p-4 lg:border-l lg:border-t-0">
          <EventDetail event={detailEvent} selected={!!selectedEvent} />
          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline</div>
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
                    className={`w-full rounded-md border p-2.5 text-start transition-colors ${active ? 'border-primary bg-accent' : 'border-border bg-background hover:bg-accent/60'}`}
                  >
                    <div className="text-sm font-medium">{event.conclusionType}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{formatEventDate(event.date) || 'Undated'} · {event.placeName}</div>
                    {event.subjectName && <div className="mt-0.5 text-[11px] text-muted-foreground">{event.subjectName}</div>}
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

function colorForStatisticEvent(event, source, visualOptions, yearBounds) {
  if (source?.colorBy === 'gender') {
    const gender = String(event.subjectGender || '').toLowerCase();
    if (gender.includes('female') || gender === 'f') return '#be185d';
    if (gender.includes('male') || gender === 'm') return '#2563eb';
    return '#64748b';
  }
  if (source?.colorBy === 'name') {
    const initial = String(event.subjectName || '').trim().charCodeAt(0) || 0;
    return ['#2563eb', '#0f766e', '#d97706', '#7c3aed', '#be123c'][initial % 5];
  }
  if (source?.colorBy === 'age' || source?.colorBy === 'ageAtDeath') {
    const endYear = source.colorBy === 'ageAtDeath' ? event.subjectDeathYear : event.year;
    const age = Number.isFinite(endYear) && Number.isFinite(event.subjectBirthYear) ? endYear - event.subjectBirthYear : null;
    if (age == null) return '#64748b';
    if (age < 18) return '#2563eb';
    if (age < 50) return '#0f766e';
    if (age < 75) return '#d97706';
    return '#7f1d1d';
  }
  return colorForVisualEvent(event, visualOptions, yearBounds);
}
