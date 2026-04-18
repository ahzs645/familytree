/**
 * MapView — every Place with coordinates plotted on an interactive basemap.
 * Click a marker to jump to its record in the Places editor.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { refToRecordName } from '../lib/recordRef.js';
import { placeSummary } from '../models/index.js';
import { Map as BaseMap } from '../components/ui/Map.jsx';

function parseCoord(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export default function MapView() {
  const navigate = useNavigate();
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

  const initial = useMemo(() => {
    if (markers.length === 0) return { center: [0, 20], zoom: 1.5 };
    const lats = markers.map((m) => m.lat);
    const lngs = markers.map((m) => m.lng);
    const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const cLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    return { center: [cLng, cLat], zoom: 4 };
  }, [markers]);

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <strong className="text-sm">Virtual Map</strong>
        <span className="text-xs text-muted-foreground">
          {loading
            ? 'Loading places…'
            : markers.length === 0
              ? `No places with coordinates (${places.length} places total — add lat/long in the Places editor)`
              : `${markers.length} of ${places.length} places plotted`}
        </span>
      </header>
      <div className="flex-1 relative">
        <BaseMap center={initial.center} zoom={initial.zoom} markers={markers} />
      </div>
    </div>
  );
}
