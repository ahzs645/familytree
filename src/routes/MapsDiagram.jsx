/**
 * Statistic Maps — every event whose place has coordinates, plotted on a map
 * with discoverable filters and an event detail panel.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useRecords } from '../lib/data/useRecords.js';
import { refToRecordName } from '../lib/recordRef.js';
import { readConclusionType } from '../lib/schema.js';
import { Map as MapView } from '../components/ui/Map.jsx';
import { MapModeSwitch } from '../components/ui/MapModeSwitch.jsx';
import { VisualOptionsDrawer } from '../components/charts/VisualOptionsDrawer.jsx';
import { formatEventDate } from '../utils/formatDate.js';
import { personSummary } from '../models/index.js';
import { Select } from '../components/ui/Select.jsx';
import { useIsMobile } from '../lib/useIsMobile.js';
import { cn } from '../lib/utils.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import {
  aggregateLegend,
  buildAggregateStatisticPoints,
  statisticEventMatches,
  STATISTIC_MAP_SOURCES,
} from '../lib/statisticMapData.js';
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

export default function MapsDiagram() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const inViews = location.pathname.startsWith('/views/');
  const [statisticSourceId, setStatisticSourceId] = useState('events-heat');
  const [subjectId, setSubjectId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [yearRange, setYearRange] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [stepYears, setStepYears] = useState(5);
  const [allYears, setAllYears] = useState(false);
  const isMobile = useIsMobile();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [visualOptions, setVisualOptions] = useState(() => normalizeVisualViewOptions('mapStory'));
  const navigateMapMode = (mode) => {
    const targets = inViews
      ? { map: '/views/virtual-map', globe: '/views/virtual-globe', statistics: '/views/statistic-maps' }
      : { map: '/map', globe: '/globe', statistics: '/maps-diagram' };
    navigate(targets[mode] || targets.statistics);
  };

  const { records: personEvents, loading: personEventsLoading } = useRecords('PersonEvent');
  const { records: familyEvents, loading: familyEventsLoading } = useRecords('FamilyEvent');
  const { records: placeRecords, loading: placesLoading } = useRecords('Place');
  const { records: coordRecords, loading: coordsLoading } = useRecords('Coordinate');
  const { records: personRecords, loading: personsLoading } = useRecords('Person');
  const { records: familyRecords, loading: familiesLoading } = useRecords('Family');
  const { records: childRelRecords, loading: childRelsLoading } = useRecords('ChildRelation');
  const { records: groupRelRecords, loading: groupRelsLoading } = useRecords('PersonGroupRelation');
  const loading = personEventsLoading || familyEventsLoading || placesLoading || coordsLoading
    || personsLoading || familiesLoading || childRelsLoading || groupRelsLoading;

  const events = useMemo(() => {
    const personById = new Map(personRecords.map((person) => [person.recordName, person]));
    // Person-group scoping inputs (parity with the Globe drawer).
    const groupByPerson = new Map();
    for (const rel of groupRelRecords) {
      const pid = refToRecordName(rel.fields?.person?.value);
      const gid = refToRecordName(rel.fields?.personGroup?.value);
      if (pid && gid && !groupByPerson.has(pid)) groupByPerson.set(pid, gid);
    }
    const childrenByFamily = new Map();
    for (const rel of childRelRecords) {
      const fam = refToRecordName(rel.fields?.family?.value);
      const child = refToRecordName(rel.fields?.child?.value);
      if (fam && child) { if (!childrenByFamily.has(fam)) childrenByFamily.set(fam, []); childrenByFamily.get(fam).push(child); }
    }
    const startPerson = personRecords.find((p) => p.fields?.isStartPerson?.value);
    const startFamilyIds = new Set();
    if (startPerson) {
      startFamilyIds.add(startPerson.recordName);
      for (const fam of familyRecords) {
        const members = [refToRecordName(fam.fields?.man?.value), refToRecordName(fam.fields?.woman?.value), ...(childrenByFamily.get(fam.recordName) || [])].filter(Boolean);
        if (members.includes(startPerson.recordName)) for (const m of members) startFamilyIds.add(m);
      }
    }
    const placeById = new Map(placeRecords.map((p) => [p.recordName, p]));
    const coordById = new Map(coordRecords.map((coord) => [coord.recordName, coord]));
    const coordByPlace = new Map();
    for (const c of coordRecords) {
      const placeId = refToRecordName(c.fields?.place?.value);
      if (placeId) coordByPlace.set(placeId, c);
    }
    const all = [...personEvents, ...familyEvents];
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
        subjectBookmarked: !!personById.get(subjectId)?.fields?.isBookmarked?.value,
        inStartFamily: !!subjectId && startFamilyIds.has(subjectId),
        personGroupId: subjectId ? groupByPerson.get(subjectId) || null : null,
        lat,
        lng,
      });
    }
    out.sort((a, b) => {
      const ay = Number.isFinite(a.year) ? a.year : -Infinity;
      const by = Number.isFinite(b.year) ? b.year : -Infinity;
      return ay - by || a.conclusionType.localeCompare(b.conclusionType);
    });
    return out;
  }, [personEvents, familyEvents, placeRecords, coordRecords, personRecords, familyRecords, childRelRecords, groupRelRecords]);

  const subjects = useMemo(
    () => [...new Map(events.filter((event) => event.subjectId).map((event) => [event.subjectId, event.subjectName])).entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [events],
  );

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
  const statisticSource = STATISTIC_MAP_SOURCES.find((source) => source.id === statisticSourceId) || STATISTIC_MAP_SOURCES[0];
  const statisticSourceLabel = t(`statisticMaps.sources.${statisticSource.labelKey}`);

  const filtered = useMemo(() => events.filter((e) => {
    if (!statisticSource.aggregate && !statisticEventMatches(e, statisticSource)) return false;
    if (filterType && e.conclusionType !== filterType) return false;
    if (subjectId && e.subjectId !== subjectId) return false;
    if (visualOptions.smartFilterMode === 'with-places' && !e.placeId) return false;
    if (visualOptions.smartFilterMode === 'missing-date' && e.year) return false;
    if (visualOptions.smartFilterMode === 'living' && e.subjectDeathYear) return false;
    if (visualOptions.personGroupMode === 'bookmarked' && !e.subjectBookmarked) return false;
    if (visualOptions.personGroupMode === 'start-family' && !e.inStartFamily) return false;
    if (!allYears && Number.isFinite(e.year) && (e.year < effectiveRange[0] || e.year > effectiveRange[1])) return false;
    return true;
  }), [events, statisticSource, filterType, subjectId, visualOptions.smartFilterMode, visualOptions.personGroupMode, effectiveRange, allYears]);

  const aggregatePoints = useMemo(() => statisticSource.aggregate
    ? buildAggregateStatisticPoints(statisticSource.id, {
      events,
      families: familyRecords,
      childRelations: childRelRecords,
    })
    : [], [statisticSource, events, familyRecords, childRelRecords]);
  const displayed = statisticSource.aggregate ? aggregatePoints : filtered;
  const legend = useMemo(() => aggregateLegend(aggregatePoints), [aggregatePoints]);

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
          if (!statisticEventMatches(event, statisticSource) || !Number.isFinite(event.year)) return false;
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
    if (selectedId && !displayed.some((event) => event.recordName === selectedId)) setSelectedId(null);
  }, [displayed, selectedId]);

  const center = useMemo(() => {
    if (displayed.length === 0) return [0, 20];
    const lats = displayed.map((m) => m.lat);
    const lngs = displayed.map((m) => m.lng);
    return [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
  }, [displayed]);

  const selectedEvent = displayed.find((event) => event.recordName === selectedId);
  const hoveredEvent = displayed.find((event) => event.recordName === hoveredId);
  const detailEvent = selectedEvent || hoveredEvent;
  const mapMarkers = useMemo(() => {
    return displayed.map((event) => ({
      id: event.recordName,
      year: event.year,
      lat: event.lat,
      lng: event.lng,
      color: event.color || colorForStatisticEvent(event, statisticSource, visualOptions, yearBounds),
      size: event.size || visualOptions.markerSize,
      popup: statisticSource.aggregate
        ? t('statisticMaps.aggregatePopup', { place: event.placeName, value: formatAggregateValue(event.value, event.unit, t), count: event.sampleCount })
        : `${event.conclusionType}${event.date ? ' · ' + event.date : ''} — ${event.placeName}`,
      onClick: () => setSelectedId(event.recordName),
    }));
  }, [displayed, statisticSource, visualOptions, yearBounds, t]);
  const mapConnections = useMemo(
    () => buildChronologicalConnections(
      mapMarkers,
      visualOptions.connectionLines,
      { connectionColor: visualOptions.connectionColor }
    ),
    [mapMarkers, visualOptions.connectionLines, visualOptions.connectionColor]
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
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold">Maps</h2>
            <MapModeSwitch activeMode="statistics" onModeChange={navigateMapMode} />
          </div>
          <div className="text-xs text-muted-foreground">
            {loading ? t('statisticMaps.loading') : t('statisticMaps.summary', { shown: displayed.length, total: events.length, source: statisticSourceLabel })}
          </div>
        </div>
        <div className="ms-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setOptionsOpen((open) => !open)}
            aria-expanded={optionsOpen}
            className="inline-flex h-8 items-center rounded-md border border-border bg-secondary px-2.5 text-xs hover:bg-accent"
          >
            {isMobile && optionsOpen ? 'Hide options' : 'Options'}
          </button>
          <Link to="/events" className="hidden inline-flex h-8 items-center rounded-md border border-border bg-secondary px-2.5 text-xs hover:bg-accent sm:inline-flex">Events</Link>
          <Link to="/places" className="hidden inline-flex h-8 items-center rounded-md border border-border bg-secondary px-2.5 text-xs hover:bg-accent sm:inline-flex">Places</Link>
        </div>
        </div>
        {/* Nine rows of filters at 390px — 64% of the screen above a map. On a
            phone they fold behind the toolbar's own Options toggle; on a wide
            screen they stay open, where there is room for them. */}
        <div className={cn(
          'mt-3 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1.35fr)_minmax(140px,0.65fr)_minmax(220px,1fr)_minmax(260px,1.25fr)]',
          isMobile && !optionsOpen ? 'hidden' : 'grid',
        )}>
          <label className="grid gap-1 text-xs text-muted-foreground">
            <span>Statistic</span>
            <Select
              value={statisticSourceId}
              onChange={(value) => {
                const nextSource = STATISTIC_MAP_SOURCES.find((source) => source.id === value);
                setStatisticSourceId(value);
                if (nextSource?.mode === 'heat') setVisualOptions((current) => normalizeVisualViewOptions('mapStory', { ...current, markerMode: 'pins-heat' }));
              }}
              ariaLabel="Statistic"
              triggerClassName="h-8 ps-2 pe-7 text-sm"
              options={STATISTIC_MAP_SOURCES.map((source) => ({ value: source.id, label: t(`statisticMaps.sources.${source.labelKey}`) }))}
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            <span>Type</span>
            <Select
              value={filterType}
              onChange={setFilterType}
              ariaLabel="Type"
              triggerClassName="h-8 ps-2 pe-7 text-sm"
              options={types.map((t) => ({ value: t, label: t || 'All types' }))}
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            <span>Person</span>
            <Select
              value={subjectId}
              onChange={setSubjectId}
              ariaLabel="Person"
              triggerClassName="h-8 ps-2 pe-7 text-sm"
              options={[{ value: '', label: 'All people' }, ...subjects.map((subject) => ({ value: subject.id, label: subject.name }))]}
            />
          </label>
          <div className="grid gap-1 rounded-md border border-border bg-background px-2.5 py-2 text-xs text-muted-foreground sm:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between gap-2">
              <span>Years {rangeLabel(effectiveRange)}</span>
              <button onClick={() => setYearRange(null)} className="text-interactive hover:underline">Reset</button>
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
                className="inline-flex h-8 items-center rounded-md border border-border bg-secondary px-2.5 text-xs disabled:opacity-50"
                title="Animate across the selected year range"
              >
                {playing ? 'Stop' : 'Start'} Slideshow
              </button>
              <label className="flex items-center gap-1">
                step
                <Select
                  value={String(stepYears)}
                  onChange={(value) => {
                    setStepYears(Number(value));
                    setVisualOptions((current) => normalizeVisualViewOptions('mapStory', { ...current, slideshowYearStep: Number(value) }));
                  }}
                  ariaLabel="Year step"
                  className="w-auto"
                  triggerClassName="h-8 ps-2 pe-7 text-xs"
                  options={[1, 2, 5, 10, 25].map((n) => ({ value: String(n), label: `${n}y` }))}
                />
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
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden">
        <div className="relative h-[min(52dvh,420px)] min-h-[280px] lg:h-auto lg:min-h-0">
          <MapView
            center={center}
            zoom={visualOptions.slideshowFit && playing ? 5 : 4}
            markers={mapMarkers}
            showMarkers={statisticSource.aggregate ? true : usesMarkerPins(visualOptions)}
            connections={mapConnections}
            connectionOptions={{ pattern: visualOptions.connectionPattern, width: visualOptions.connectionWidth, animate: visualOptions.animateConnections }}
            tileNames={visualOptions.tileNames}
            mapType={visualOptions.mapType}
            displayCurrentLocation={visualOptions.displayCurrentLocation}
            heatmap={{
              enabled: !statisticSource.aggregate && (statisticSource.mode === 'heat' || usesHeatMap(visualOptions)),
              radius: visualOptions.heatRadius,
              opacity: visualOptions.heatOpacity,
              amplification: visualOptions.heatAmplification,
              autoRadius: visualOptions.heatAutoRadius,
              fixedRadius: visualOptions.fixedHeatRadius,
              gradient: visualOptions.heatGradient,
              darkHeatMap: visualOptions.darkHeatMap,
            }}
            emptyMessage={loading ? '' : 'Not enough information to display this map. Make sure you have entered data for the selected statistics type and coordinates for event places.'}
          />
          {legend && <AggregateLegend legend={legend} t={t} />}
        </div>
        <aside className="min-h-0 border-t border-border bg-card p-4 lg:overflow-auto lg:border-l lg:border-t-0">
          <VisualOptionsDrawer
            kind="mapStory"
            open={optionsOpen}
            options={visualOptions}
            onChange={setVisualOptions}
            onClose={() => setOptionsOpen(false)}
            title="Map Options"
            placement="inline"
          />
          {optionsOpen && <div className="h-4" />}
          <EventDetail event={detailEvent} selected={!!selectedEvent} t={t} />
          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline</div>
            <div className="space-y-2">
              {displayed.length === 0 ? (
                <div className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">No events match the current map filters.</div>
              ) : displayed.slice(0, 500).map((event) => {
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
                    <div className="text-sm font-medium">{event.conclusionType || event.placeName}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{statisticSource.aggregate ? formatAggregateValue(event.value, event.unit, t) : `${formatEventDate(event.date) || 'Undated'} · ${event.placeName}`}</div>
                    {event.subjectName && <div className="mt-0.5 text-2xs text-muted-foreground">{event.subjectName}</div>}
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

function EventDetail({ event, selected, t }) {
  if (!event) {
    return (
      <div className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
        Hover or select an event row to inspect its date, place, and related actions.
      </div>
    );
  }
  if (event.recordType === 'PlaceAggregate') {
    return (
      <div className="rounded-md border border-border bg-background p-4">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {selected ? t('statisticMaps.selectedPlace') : t('statisticMaps.hoveredPlace')}
        </div>
        <h2 className="text-base font-semibold">{event.placeName}</h2>
        <div className="mt-2 text-2xl font-semibold">{formatAggregateValue(event.value, event.unit, t)}</div>
        <div className="text-xs text-muted-foreground">{t('statisticMaps.averageSamples', { count: event.sampleCount })}</div>
        <Link to={`/places?placeId=${encodeURIComponent(event.placeId)}`} className="mt-4 inline-flex h-8 items-center rounded-md border border-border bg-secondary px-2.5 text-xs hover:bg-accent">{t('statisticMaps.openPlace')}</Link>
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
        <Link to={`/events?eventId=${encodeURIComponent(event.recordName)}`} className="inline-flex h-8 items-center rounded-md border border-border bg-secondary px-2.5 text-xs hover:bg-accent">Open Event</Link>
        <Link to={`/places?placeId=${encodeURIComponent(event.placeId)}`} className="inline-flex h-8 items-center rounded-md border border-border bg-secondary px-2.5 text-xs hover:bg-accent">Open Place</Link>
        <Link to={`/views/media-gallery?targetId=${encodeURIComponent(event.recordName)}&targetType=${event.recordType}`} className="inline-flex h-8 items-center rounded-md border border-border bg-secondary px-2.5 text-xs hover:bg-accent">Related Media</Link>
      </div>
    </div>
  );
}

function AggregateLegend({ legend, t }) {
  return (
    <div className="absolute inset-inline-start-3 bottom-8 z-10 rounded-md border border-border bg-popover/95 px-3 py-2 text-xs text-popover-foreground shadow">
      <div className="font-semibold">{t('statisticMaps.legend.valuesAtPlace')}</div>
      <div className="mt-2 flex items-end gap-3 text-muted-foreground">
        <span className="inline-block h-[18px] w-[18px] rounded-full border-2 border-white bg-blue-600 shadow" />
        <span>{formatAggregateValue(legend.min, legend.unit, t)}</span>
        <span className="inline-block h-[32px] w-[32px] rounded-full border-2 border-white bg-red-700 shadow" />
        <span>{formatAggregateValue(legend.max, legend.unit, t)}</span>
      </div>
    </div>
  );
}

function formatAggregateValue(value, unit, t) {
  const rounded = Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
  return unit === 'children'
    ? t('statisticMaps.units.children', { value: rounded })
    : t('statisticMaps.units.years', { value: rounded });
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
