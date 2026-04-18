/**
 * Theme-aware MapLibre wrapper. Pick light/dark basemaps from Carto's free
 * tile service, render markers, and forward clicks so callers can set
 * coordinates from the map.
 *
 * Usage:
 *   <Map center={[lon, lat]} zoom={9} markers={[{lng, lat, id, onClick}]} onClick={handler} />
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import {
  DEFAULT_MAP_PREFERENCES,
  MAP_PREFERENCES_EVENT,
  getMapPreferences,
  saveMapPreferences,
} from '../../lib/placeGeocoding.js';

const STYLE_URLS = {
  positron: {
    label: 'Light',
    labels: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    noLabels: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
  },
  voyager: {
    label: 'Voyager',
    labels: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    noLabels: 'https://basemaps.cartocdn.com/gl/voyager-nolabels-gl-style/style.json',
  },
  dark: {
    label: 'Dark',
    labels: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    noLabels: 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json',
  },
};

function styleUrlFor(theme, preferences) {
  const preferred = preferences.basemap === 'auto'
    ? (theme === 'dark' ? 'dark' : 'positron')
    : preferences.basemap;
  const style = STYLE_URLS[preferred] || STYLE_URLS.positron;
  return preferences.showLabels ? style.labels : style.noLabels;
}

function distanceSq(a, b) {
  const dx = a.lng - b.lng;
  const dy = a.lat - b.lat;
  return dx * dx + dy * dy;
}

function clusterMarkers(markers, enabled) {
  if (!enabled || markers.length < 60) return markers;
  const precision = markers.length > 450 ? 0 : markers.length > 160 ? 1 : 2;
  const groups = new globalThis.Map();
  for (const marker of markers) {
    if (typeof marker.lng !== 'number' || typeof marker.lat !== 'number') continue;
    const key = `${marker.lat.toFixed(precision)}:${marker.lng.toFixed(precision)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(marker);
  }
  return Array.from(groups.entries()).flatMap(([key, group]) => {
    if (group.length === 1) return group;
    const lat = group.reduce((sum, marker) => sum + marker.lat, 0) / group.length;
    const lng = group.reduce((sum, marker) => sum + marker.lng, 0) / group.length;
    const names = group.slice(0, 4).map((marker) => marker.popup || marker.id).filter(Boolean);
    return [{
      id: `cluster-${key}`,
      lat,
      lng,
      count: group.length,
      cluster: true,
      popup: `${group.length} records near this area${names.length ? `: ${names.join(', ')}${group.length > names.length ? '…' : ''}` : ''}`,
    }];
  });
}

export function Map({
  center = [0, 20],
  zoom = 1.5,
  markers = [],
  onClick,
  className = '',
  interactive = true,
  projection,
  showControls = true,
}) {
  const { theme } = useTheme();
  const [preferences, setPreferences] = useState(DEFAULT_MAP_PREFERENCES);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRefs = useRef([]);
  const [ready, setReady] = useState(false);
  const styleUrl = useMemo(() => styleUrlFor(theme, preferences), [theme, preferences]);
  const renderedMarkers = useMemo(
    () => clusterMarkers(markers, preferences.markerClustering),
    [markers, preferences.markerClustering]
  );

  useEffect(() => {
    let mounted = true;
    getMapPreferences().then((prefs) => {
      if (mounted) setPreferences(prefs);
    });
    const onChanged = (event) => setPreferences(event.detail || DEFAULT_MAP_PREFERENCES);
    window.addEventListener(MAP_PREFERENCES_EVENT, onChanged);
    return () => {
      mounted = false;
      window.removeEventListener(MAP_PREFERENCES_EVENT, onChanged);
    };
  }, []);

  const updatePreference = useCallback(async (patch) => {
    const saved = await saveMapPreferences(patch);
    setPreferences(saved);
  }, []);

  // Initialize map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center,
      zoom,
      interactive,
      renderWorldCopies: !projection,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: !!projection }), 'top-right');
    // Globe projection has to be applied after the style has finished parsing;
    // passing it in the constructor (or calling setProjection from 'load')
    // leaves the tile manager in mercator mode and no tiles get requested.
    let projectionTimer = null;
    const applyProjection = () => {
      if (projectionTimer) clearTimeout(projectionTimer);
      projectionTimer = setTimeout(() => {
        if (projection && typeof map.setProjection === 'function') {
          try { map.setProjection(projection); } catch { /* older maplibre */ }
        }
      }, 100);
    };
    map.on('styledata', applyProjection);
    map.on('load', () => setReady(true));

    // The container often measures 0 while Suspense is still resolving the
    // lazy route, so the canvas gets stuck at its initial size. Watch the
    // container and resize the map whenever its box changes.
    const resizeObserver = new ResizeObserver(() => {
      try { map.resize(); } catch { /* map gone */ }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (projectionTimer) clearTimeout(projectionTimer);
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap basemap when the theme/preferences change. setStyle resets the projection,
  // so re-apply it once the new style finishes loading.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(styleUrl);
    if (projection && typeof map.setProjection === 'function') {
      const reapply = () => { try { map.setProjection(projection); } catch { /* ignore */ } };
      map.once('styledata', reapply);
    }
  }, [styleUrl, projection]);

  // Forward clicks.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onClick) return;
    const handler = (e) => onClick({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [onClick]);

  // Render markers. Rebuilt from scratch whenever the prop changes — fine for
  // the scales we deal with (hundreds of places max).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const m of markerRefs.current) m.remove();
    markerRefs.current = [];
    for (const m of renderedMarkers) {
      if (typeof m.lng !== 'number' || typeof m.lat !== 'number') continue;
      const el = document.createElement('div');
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', m.cluster ? `${m.count} map records` : (m.popup || 'Map marker'));
      el.title = m.popup || '';
      if (m.cluster) {
        el.textContent = String(m.count);
        el.style.cssText =
          'min-width:26px;height:26px;padding:0 6px;border-radius:999px;background:hsl(var(--primary));color:hsl(var(--primary-foreground));border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.45);cursor:pointer;display:flex;align-items:center;justify-content:center;font:700 11px -apple-system,system-ui,sans-serif;';
      } else {
        el.style.cssText =
          'width:14px;height:14px;border-radius:50%;background:hsl(var(--primary));border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.5);cursor:pointer;';
      }
      let marker = null;
      const activate = (ev) => {
        ev.stopPropagation();
        if (m.cluster) {
          map.easeTo({ center: [m.lng, m.lat], zoom: Math.min((map.getZoom() || zoom) + 2, 12), duration: 350 });
        } else {
          if (m.onClick) m.onClick(m);
          else marker?.togglePopup();
        }
      };
      el.addEventListener('click', activate);
      el.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') activate(ev);
      });
      marker = new maplibregl.Marker({ element: el, draggable: !!m.draggable })
        .setLngLat([m.lng, m.lat])
        .addTo(map);
      if (m.popup) marker.setPopup(new maplibregl.Popup({ offset: 14 }).setText(m.popup));
      if (m.draggable && m.onDragEnd) {
        marker.on('dragend', () => {
          const p = marker.getLngLat();
          m.onDragEnd({ lng: p.lng, lat: p.lat });
        });
      }
      markerRefs.current.push(marker);
    }
  }, [renderedMarkers, ready, zoom]);

  // Update center/zoom when the inputs change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.jumpTo({ center, zoom });
  }, [center[0], center[1], zoom, ready]);

  const resetView = () => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ center, zoom, duration: 350 });
  };

  const recenterNearMarker = () => {
    const map = mapRef.current;
    if (!map || markers.length === 0) return;
    const current = map.getCenter();
    const nearest = markers
      .filter((marker) => typeof marker.lng === 'number' && typeof marker.lat === 'number')
      .reduce((best, marker) => {
        const score = distanceSq(marker, { lng: current.lng, lat: current.lat });
        return !best || score < best.score ? { marker, score } : best;
      }, null)?.marker;
    if (nearest) {
      map.easeTo({
        center: [nearest.lng, nearest.lat],
        zoom: Math.max(map.getZoom() || zoom, Math.min(Number(preferences.defaultZoom) || zoom, 10)),
        duration: 350,
      });
    }
  };

  return (
    <div className={className} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {showControls ? (
        <div
          className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card/95 px-2.5 py-2 text-xs shadow-lg backdrop-blur"
          onClick={(event) => event.stopPropagation()}
        >
          <label className="sr-only" htmlFor="map-basemap">Basemap</label>
          <select
            id="map-basemap"
            value={preferences.basemap}
            onChange={(event) => updatePreference({ basemap: event.target.value })}
            className="h-8 rounded-md border border-border bg-secondary px-2 text-xs text-foreground"
            title="Basemap style"
          >
            <option value="auto">Auto</option>
            <option value="positron">Light</option>
            <option value="voyager">Voyager</option>
            <option value="dark">Dark</option>
          </select>
          <label className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-secondary px-2 text-foreground" title="Toggle map labels">
            <input
              type="checkbox"
              checked={preferences.showLabels}
              onChange={(event) => updatePreference({ showLabels: event.target.checked })}
            />
            Labels
          </label>
          {markers.length >= 60 ? (
            <label className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-secondary px-2 text-foreground" title="Cluster nearby markers">
              <input
                type="checkbox"
                checked={preferences.markerClustering}
                onChange={(event) => updatePreference({ markerClustering: event.target.checked })}
              />
              Cluster
            </label>
          ) : null}
          <button
            type="button"
            onClick={resetView}
            className="h-8 rounded-md border border-border bg-secondary px-2 text-foreground hover:bg-accent"
            title="Reset zoom and center"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={recenterNearMarker}
            disabled={markers.length === 0}
            className="h-8 rounded-md border border-border bg-secondary px-2 text-foreground hover:bg-accent disabled:opacity-50"
            title="Recenter to the marker nearest the current map center"
          >
            Near center
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default Map;
