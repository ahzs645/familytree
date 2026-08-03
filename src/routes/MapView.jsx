/**
 * MapView — every Place with coordinates plotted on an interactive basemap.
 * Click a marker to jump to its record in the Places editor.
 */
import React, { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useRecords } from '../lib/data/useRecords.js';
import { refToRecordName } from '../lib/recordRef.js';
import { placeSummary } from '../models/index.js';
import { Map as BaseMap } from '../components/ui/Map.jsx';
import { MapModeSwitch } from '../components/ui/MapModeSwitch.jsx';

function parseCoord(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export default function MapView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const scopedPersonId = searchParams.get('person') || '';
  const scopedFamilyId = searchParams.get('family') || '';
  const { records: places, loading: placesLoading } = useRecords('Place');
  const { records: coordinates, loading: coordinatesLoading } = useRecords('Coordinate');
  const { records: personEvents, loading: personEventsLoading } = useRecords('PersonEvent');
  const { records: familyEvents, loading: familyEventsLoading } = useRecords('FamilyEvent');
  const { records: families, loading: familiesLoading } = useRecords('Family');
  const loading = placesLoading || coordinatesLoading || personEventsLoading || familyEventsLoading || familiesLoading;
  const inViews = location.pathname.startsWith('/views/');

  const navigateMapMode = (mode) => {
    const targets = inViews
      ? { map: '/views/virtual-map', globe: '/views/virtual-globe', statistics: '/views/statistic-maps' }
      : { map: '/map', globe: '/globe', statistics: '/maps-diagram' };
    navigate(targets[mode] || targets.map);
  };

  const scopedPlaceIds = useMemo(() => {
    if (!scopedPersonId && !scopedFamilyId) return null;
    const personIds = new Set(scopedPersonId ? [scopedPersonId] : []);
    if (scopedFamilyId) {
      const family = families.find((record) => record.recordName === scopedFamilyId);
      const manId = refToRecordName(family?.fields?.man?.value);
      const womanId = refToRecordName(family?.fields?.woman?.value);
      if (manId) personIds.add(manId);
      if (womanId) personIds.add(womanId);
    }
    const ids = new Set();
    for (const event of personEvents) {
      if (!personIds.has(refToRecordName(event.fields?.person?.value))) continue;
      const placeId = refToRecordName(event.fields?.place?.value) || refToRecordName(event.fields?.assignedPlace?.value);
      if (placeId) ids.add(placeId);
    }
    for (const event of familyEvents) {
      if (scopedFamilyId !== refToRecordName(event.fields?.family?.value)) continue;
      const placeId = refToRecordName(event.fields?.place?.value) || refToRecordName(event.fields?.assignedPlace?.value);
      if (placeId) ids.add(placeId);
    }
    return ids;
  }, [families, familyEvents, personEvents, scopedFamilyId, scopedPersonId]);

  const markers = useMemo(() => {
    const coordByPlace = new Map();
    for (const coord of coordinates) {
      const placeId = refToRecordName(coord.fields?.place?.value);
      if (placeId) coordByPlace.set(placeId, coord);
    }

    const out = [];
    for (const p of places) {
      if (scopedPlaceIds && !scopedPlaceIds.has(p.recordName)) continue;
      const coordinateRef = refToRecordName(p.fields?.coordinate?.value);
      const coord =
        (coordinateRef && coordinates.find((c) => c.recordName === coordinateRef)) ||
        coordByPlace.get(p.recordName);
      const lat = parseCoord(coord?.fields?.latitude?.value ?? p.fields?.latitude?.value);
      const lng = parseCoord(coord?.fields?.longitude?.value ?? p.fields?.longitude?.value);
      if (lat == null || lng == null) continue;
      const s = placeSummary(p);
      out.push({
        id: p.recordName,
        lat,
        lng,
        popup: s?.displayName || s?.name || p.recordName,
        onClick: () => navigate(`/places?placeId=${encodeURIComponent(p.recordName)}`),
      });
    }
    return out;
  }, [places, coordinates, navigate, scopedPlaceIds]);

  // Frame the marker bounding box so spread-out places stay in view instead of
  // opening on empty ocean at the geometric midpoint. Fall back to a world view
  // when nothing is plotted. The Map component fits the bounds (padding/maxZoom).
  const initial = useMemo(() => {
    if (markers.length === 0) return { center: [0, 20], zoom: 1.5, bounds: null };
    const lats = markers.map((m) => m.lat);
    const lngs = markers.map((m) => m.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
      zoom: 4,
      bounds: [[minLng, minLat], [maxLng, maxLat]],
    };
  }, [markers]);

  return (
    <div className="flex flex-col h-full">
      <header className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <strong className="text-sm">Maps</strong>
        <MapModeSwitch activeMode="map" onModeChange={navigateMapMode} />
        <span className="text-xs text-muted-foreground">
          {loading
            ? 'Loading places…'
            : markers.length === 0
              ? `No places with coordinates (${places.length} places total — add lat/long in the Places editor)`
              : `${markers.length} of ${places.length} places plotted`}
        </span>
      </header>
      <div className="flex-1 relative">
        <BaseMap
          center={initial.center}
          zoom={initial.zoom}
          bounds={initial.bounds}
          markers={markers}
          emptyMessage={loading ? '' : 'No coordinates available. Assign coordinates to places to make them appear on the map.'}
        />
      </div>
    </div>
  );
}
