/**
 * Virtual Globe — every event with coordinates plotted on a 3D globe.
 * Distinct from /map (flat) and /maps-diagram (flat with timeline).
 *
 * Mirrors MacFamilyTree 11 "Statistic Maps" by layering event-type overlays
 * (births / deaths / marriages / residences / other) and an optional year-range
 * slider on top of the 3D projection.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { refToRecordName } from '../lib/recordRef.js';
import { readConclusionType } from '../lib/schema.js';
import { Map as MapView } from '../components/ui/Map.jsx';
import { MapModeSwitch } from '../components/ui/MapModeSwitch.jsx';
import { VisualOptionsDrawer } from '../components/charts/VisualOptionsDrawer.jsx';
import {
  attachEventCounts,
  buildChronologicalConnections,
  colorForVisualEvent,
  normalizeVisualViewOptions,
  usesHeatMap,
  usesMarkerPins,
} from '../lib/visualViewOptions.js';

const OVERLAY_TYPES = [
  { id: 'all', label: 'All events', match: () => true },
  { id: 'birth', label: 'Births', match: (t) => /birth|christ|bapt/i.test(t) },
  { id: 'death', label: 'Deaths', match: (t) => /death|buri|crem/i.test(t) },
  { id: 'marriage', label: 'Marriages', match: (t) => /marri|engag|divorc/i.test(t) },
  { id: 'residence', label: 'Residences', match: (t) => /resid|occup|migra|immig|emig|census|arrival|depart/i.test(t) },
  { id: 'other', label: 'Other', match: () => true },
];

function yearFromDateValue(value) {
  if (!value) return null;
  const match = String(value).match(/-?\d{4}/);
  return match ? Number(match[0]) : null;
}

function classifyOverlay(type) {
  if (!type) return 'other';
  for (const overlay of OVERLAY_TYPES) {
    if (overlay.id === 'all' || overlay.id === 'other') continue;
    if (overlay.match(type)) return overlay.id;
  }
  return 'other';
}

export default function Globe() {
  const navigate = useNavigate();
  const location = useLocation();
  const inViews = location.pathname.startsWith('/views/');
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overlay, setOverlay] = useState('all');
  const [yearBounds, setYearBounds] = useState({ min: null, max: null });
  const [yearFrom, setYearFrom] = useState(null);
  const [yearTo, setYearTo] = useState(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [visualOptions, setVisualOptions] = useState(() => normalizeVisualViewOptions('globe'));

  useEffect(() => {
    let cancel = false;
    (async () => {
      const db = getLocalDatabase();
      const [pe, fe, places, coords, personsQ, familiesQ, childRelsQ, groupRelsQ] = await Promise.all([
        db.query('PersonEvent', { limit: 100000 }),
        db.query('FamilyEvent', { limit: 100000 }),
        db.query('Place', { limit: 100000 }),
        db.query('Coordinate', { limit: 100000 }),
        db.query('Person', { limit: 100000 }),
        db.query('Family', { limit: 100000 }),
        db.query('ChildRelation', { limit: 100000 }),
        db.query('PersonGroupRelation', { limit: 100000 }),
      ]);
      const groupByPerson = new Map();
      for (const rel of groupRelsQ.records) {
        const personId = refToRecordName(rel.fields?.person?.value);
        const groupId = refToRecordName(rel.fields?.personGroup?.value);
        if (personId && groupId && !groupByPerson.has(personId)) groupByPerson.set(personId, groupId);
      }
      const placeById = new Map(places.records.map((p) => [p.recordName, p]));
      const coordByPlace = new Map();
      for (const c of coords.records) {
        const placeId = refToRecordName(c.fields?.place?.value);
        if (placeId) coordByPlace.set(placeId, c);
      }
      // Subject metadata so the "Person Groups" and "Smart Filter" option
      // drawers actually filter the globe (parity with MapsDiagram).
      const personById = new Map(personsQ.records.map((p) => [p.recordName, p]));
      const familyById = new Map(familiesQ.records.map((f) => [f.recordName, f]));
      const childrenByFamily = new Map();
      for (const cr of childRelsQ.records) {
        const fam = refToRecordName(cr.fields?.family?.value);
        const childId = refToRecordName(cr.fields?.child?.value);
        if (!fam || !childId) continue;
        if (!childrenByFamily.has(fam)) childrenByFamily.set(fam, []);
        childrenByFamily.get(fam).push(childId);
      }
      const startPerson = personsQ.records.find((p) => p.fields?.isStartPerson?.value);
      const startFamilyIds = new Set();
      if (startPerson) {
        startFamilyIds.add(startPerson.recordName);
        for (const fam of familiesQ.records) {
          const members = [
            refToRecordName(fam.fields?.man?.value),
            refToRecordName(fam.fields?.woman?.value),
            ...(childrenByFamily.get(fam.recordName) || []),
          ].filter(Boolean);
          if (members.includes(startPerson.recordName)) for (const m of members) startFamilyIds.add(m);
        }
      }
      const subjectPersonForEvent = (ev) => {
        const direct = refToRecordName(ev.fields?.person?.value);
        if (direct) return direct;
        const fam = familyById.get(refToRecordName(ev.fields?.family?.value));
        return refToRecordName(fam?.fields?.man?.value) || refToRecordName(fam?.fields?.woman?.value) || '';
      };
      const events = [...pe.records, ...fe.records];
      const out = [];
      let minYear = Number.POSITIVE_INFINITY;
      let maxYear = Number.NEGATIVE_INFINITY;
      for (const ev of events) {
        const placeId = refToRecordName(ev.fields?.place?.value) || refToRecordName(ev.fields?.assignedPlace?.value);
        if (!placeId) continue;
        const place = placeById.get(placeId);
        const coord = coordByPlace.get(placeId);
        const lat = coord?.fields?.latitude?.value;
        const lng = coord?.fields?.longitude?.value;
        if (typeof lat !== 'number' || typeof lng !== 'number') continue;
        const conclusion = readConclusionType(ev) || ev.fields?.eventType?.value || 'Event';
        const dateValue = ev.fields?.date?.value || '';
        const year = yearFromDateValue(dateValue);
        if (year !== null) {
          if (year < minYear) minYear = year;
          if (year > maxYear) maxYear = year;
        }
        const subjectId = subjectPersonForEvent(ev);
        const subject = subjectId ? personById.get(subjectId) : null;
        out.push({
          id: ev.recordName,
          lat,
          lng,
          year,
          overlayType: classifyOverlay(conclusion),
          conclusion,
          subjectDeathYear: yearFromDateValue(subject?.fields?.cached_deathDate?.value || subject?.fields?.deathDate?.value),
          subjectBookmarked: !!subject?.fields?.isBookmarked?.value,
          inStartFamily: !!subjectId && startFamilyIds.has(subjectId),
          personGroupId: subjectId ? groupByPerson.get(subjectId) || null : null,
          popup: `${conclusion}${dateValue ? ' · ' + dateValue : ''} — ${place?.fields?.cached_normallocationString?.value || place?.fields?.placeName?.value || placeId}`,
        });
      }
      if (!cancel) {
        setPoints(out);
        if (Number.isFinite(minYear) && Number.isFinite(maxYear)) {
          setYearBounds({ min: minYear, max: maxYear });
          setYearFrom(minYear);
          setYearTo(maxYear);
        }
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const filtered = useMemo(() => {
    const smartFilter = visualOptions.smartFilterMode;
    const personGroup = visualOptions.personGroupMode;
    return points.filter((point) => {
      if (overlay !== 'all' && point.overlayType !== overlay) return false;
      if (yearFrom !== null && point.year !== null && point.year < yearFrom) return false;
      if (yearTo !== null && point.year !== null && point.year > yearTo) return false;
      // Smart Filter drawer
      if (smartFilter === 'missing-date' && point.year !== null) return false;
      if (smartFilter === 'living' && point.subjectDeathYear) return false;
      // ('with-places' is a no-op on the globe: every plotted event already has coordinates.)
      // Person Groups drawer
      if (personGroup === 'bookmarked' && !point.subjectBookmarked) return false;
      if (personGroup === 'start-family' && !point.inStartFamily) return false;
      return true;
    });
  }, [overlay, points, yearFrom, yearTo, visualOptions.smartFilterMode, visualOptions.personGroupMode]);

  const countsByOverlay = useMemo(() => {
    const map = {};
    for (const point of points) {
      map[point.overlayType] = (map[point.overlayType] || 0) + 1;
    }
    map.all = points.length;
    return map;
  }, [points]);

  const center = useMemo(() => {
    if (filtered.length === 0) return [0, 20];
    const lats = filtered.map((m) => m.lat);
    const lngs = filtered.map((m) => m.lng);
    return [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
  }, [filtered]);

  const countedFiltered = useMemo(
    () => (visualOptions.colorBy === 'events-count' ? attachEventCounts(filtered) : filtered),
    [filtered, visualOptions.colorBy]
  );
  const mapMarkers = useMemo(() => countedFiltered.map((point) => ({
    ...point,
    color: colorForVisualEvent(point, visualOptions, yearBounds),
    size: visualOptions.markerSize,
  })), [countedFiltered, visualOptions, yearBounds]);
  const mapConnections = useMemo(
    () => buildChronologicalConnections(
      mapMarkers,
      visualOptions.connectionLines,
      { connectionColor: visualOptions.connectionColor }
    ),
    [mapMarkers, visualOptions.connectionLines, visualOptions.connectionColor]
  );

  const yearRange = yearBounds.min !== null && yearBounds.max !== null
    ? `${yearBounds.min}–${yearBounds.max}`
    : '';
  const navigateMapMode = (mode) => {
    const targets = inViews
      ? { map: '/views/virtual-map', globe: '/views/virtual-globe', statistics: '/views/statistic-maps' }
      : { map: '/map', globe: '/globe', statistics: '/maps-diagram' };
    navigate(targets[mode] || targets.globe);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">Maps</h1>
        <MapModeSwitch activeMode="globe" onModeChange={navigateMapMode} />
        <span className="text-xs text-muted-foreground">
          {loading ? 'Loading all person events…' : `${filtered.length.toLocaleString()} / ${points.length.toLocaleString()} person and family event location${points.length === 1 ? '' : 's'}`}
        </span>
        <div className="flex items-center gap-1 flex-wrap">
          {OVERLAY_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setOverlay(type.id)}
              className={`px-2 py-1 text-[11px] rounded-md border ${overlay === type.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border hover:bg-accent'}`}
              title={`Show ${type.label.toLowerCase()}`}
            >
              {type.label}
              <span className="ms-1 text-[10px] opacity-70">{countsByOverlay[type.id] || 0}</span>
            </button>
          ))}
        </div>
        {yearBounds.min !== null && yearBounds.max !== null && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="whitespace-nowrap">Year {yearFrom}–{yearTo}</span>
            <input
              type="range"
              min={yearBounds.min}
              max={yearBounds.max}
              value={yearFrom ?? yearBounds.min}
              onChange={(event) => setYearFrom(Math.min(Number(event.target.value), yearTo ?? yearBounds.max))}
              className="min-w-0 flex-1 max-w-[42vw]"
              aria-label="Year from"
            />
            <input
              type="range"
              min={yearBounds.min}
              max={yearBounds.max}
              value={yearTo ?? yearBounds.max}
              onChange={(event) => setYearTo(Math.max(Number(event.target.value), yearFrom ?? yearBounds.min))}
              className="min-w-0 flex-1 max-w-[42vw]"
              aria-label="Year to"
            />
            <button
              type="button"
              onClick={() => { setYearFrom(yearBounds.min); setYearTo(yearBounds.max); }}
              className="px-2 py-0.5 rounded-md border border-border bg-secondary text-foreground hover:bg-accent"
              title={`Reset to full range ${yearRange}`}
            >
              Reset
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setOptionsOpen((open) => !open)}
          className="ms-auto rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs hover:bg-accent"
        >
          Options
        </button>
        <span className="text-xs text-muted-foreground">3D projection · drag to rotate · scroll to zoom</span>
      </header>
      <div className="flex-1 relative" style={{ background: visualOptions.globeBackground === 'light' ? '#eef2f7' : '#0a0a14' }}>
        <MapView
          center={center}
          zoom={1.6}
          markers={mapMarkers}
          showMarkers={usesMarkerPins(visualOptions)}
          connections={mapConnections}
          heatmap={{
            enabled: usesHeatMap(visualOptions),
            radius: visualOptions.heatRadius,
            opacity: visualOptions.heatOpacity,
            amplification: visualOptions.heatAmplification,
            autoRadius: visualOptions.heatAutoRadius,
            fixedRadius: visualOptions.fixedHeatRadius,
            gradient: visualOptions.heatGradient,
            darkHeatMap: visualOptions.darkHeatMap,
          }}
          projection={{ type: 'globe' }}
          connectionOptions={{ pattern: visualOptions.connectionPattern, width: visualOptions.connectionWidth, animate: visualOptions.animateConnections }}
          sunMode={visualOptions.sunMode}
          tileNames={visualOptions.tileNames}
          mapType={visualOptions.mapType}
          displayCurrentLocation={visualOptions.displayCurrentLocation}
          emptyMessage={loading ? '' : 'The Virtual Globe cannot display any person or family events because no coordinates have been provided.'}
        />
        <VisualOptionsDrawer
          kind="globe"
          open={optionsOpen}
          options={visualOptions}
          onChange={setVisualOptions}
          onClose={() => setOptionsOpen(false)}
          title="Globe Options"
        />
      </div>
    </div>
  );
}
