/**
 * MapView — every Place with coordinates plotted on an interactive basemap.
 * Click a marker to jump to its record in the Places editor.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
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
  const [places, setPlaces] = useState([]);
  const [coordinates, setCoordinates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const db = getLocalDatabase();
      const [placeResult, coordinateResult] = await Promise.all([
        db.query('Place', { limit: 100000 }),
        db.query('Coordinate', { limit: 100000 }),
      ]);
      setPlaces(placeResult.records);
      setCoordinates(coordinateResult.records);
      setLoading(false);
    })();
  }, []);

  const markers = useMemo(() => {
    const coordByPlace = new Map();
    for (const coord of coordinates) {
      const placeId = refToRecordName(coord.fields?.place?.value);
      if (placeId) coordByPlace.set(placeId, coord);
    }

    const out = [];
    for (const p of places) {
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
  }, [places, coordinates, navigate]);

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
        <strong className="text-sm">Virtual Map</strong>
        <MapModeSwitch activeMode="map" onModeChange={(mode) => {
          if (mode === 'globe') navigate(location.pathname.startsWith('/views/') ? '/views/virtual-globe' : '/globe');
        }} />
        <span className="text-xs text-muted-foreground">
          {loading
            ? 'Loading places…'
            : markers.length === 0
              ? `No places with coordinates (${places.length} places total — add lat/long in the Places editor)`
              : `${markers.length} of ${places.length} places plotted`}
        </span>
      </header>
      <div className="flex-1 relative">
        <BaseMap center={initial.center} zoom={initial.zoom} bounds={initial.bounds} markers={markers} />
      </div>
    </div>
  );
}
