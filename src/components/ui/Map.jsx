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

const CLUSTER_SOURCE_ID = 'ctw-marker-cluster-source';
const CLUSTER_LAYER_ID = 'ctw-marker-clusters';
const CLUSTER_COUNT_LAYER_ID = 'ctw-marker-cluster-count';
const POINT_LAYER_ID = 'ctw-marker-points';

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

function geojsonForMarkers(markers) {
  return {
    type: 'FeatureCollection',
    features: markers.flatMap((marker, markerIndex) => {
      if (typeof marker.lng !== 'number' || typeof marker.lat !== 'number') return [];
      return [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [marker.lng, marker.lat],
        },
        properties: {
          id: String(marker.id ?? markerIndex),
          markerIndex,
          popup: marker.popup || '',
        },
      }];
    }),
  };
}

function removeClusterLayers(map) {
  for (const layerId of [CLUSTER_COUNT_LAYER_ID, CLUSTER_LAYER_ID, POINT_LAYER_ID]) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  }
  if (map.getSource(CLUSTER_SOURCE_ID)) map.removeSource(CLUSTER_SOURCE_ID);
}

function addClusterLayers(map, data) {
  removeClusterLayers(map);
  map.addSource(CLUSTER_SOURCE_ID, {
    type: 'geojson',
    data,
    cluster: true,
    clusterMaxZoom: 12,
    clusterRadius: 48,
  });
  map.addLayer({
    id: CLUSTER_LAYER_ID,
    type: 'circle',
    source: CLUSTER_SOURCE_ID,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#2563eb',
        100,
        '#0f766e',
        500,
        '#7c3aed',
      ],
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        18,
        100,
        24,
        500,
        31,
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });
  map.addLayer({
    id: CLUSTER_COUNT_LAYER_ID,
    type: 'symbol',
    source: CLUSTER_SOURCE_ID,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': 12,
    },
    paint: {
      'text-color': '#ffffff',
    },
  });
  map.addLayer({
    id: POINT_LAYER_ID,
    type: 'circle',
    source: CLUSTER_SOURCE_ID,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#2563eb',
      'circle-radius': 7,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
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
  const useSourceClustering = preferences.markerClustering && markers.length >= 60 && !markers.some((marker) => marker.draggable);

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

  // Dense marker sets use MapLibre's GeoJSON source clustering so pan/zoom
  // stays smooth and cluster expansion is handled by the map engine.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    let cancelled = false;
    let popup = null;

    const onClusterClick = async (event) => {
      const features = map.queryRenderedFeatures(event.point, { layers: [CLUSTER_LAYER_ID] });
      const clusterId = features[0]?.properties?.cluster_id;
      const source = map.getSource(CLUSTER_SOURCE_ID);
      if (clusterId == null || !source?.getClusterExpansionZoom) return;
      const result = source.getClusterExpansionZoom(clusterId);
      const nextZoom = typeof result?.then === 'function' ? await result : result;
      map.easeTo({ center: features[0].geometry.coordinates, zoom: Math.min(nextZoom, 16), duration: 350 });
    };

    const onPointClick = (event) => {
      const feature = event.features?.[0];
      const marker = markers[Number(feature?.properties?.markerIndex)];
      if (!marker) return;
      if (marker.onClick) {
        marker.onClick(marker);
        return;
      }
      if (marker.popup) {
        popup?.remove();
        popup = new maplibregl.Popup({ offset: 14 })
          .setLngLat(feature.geometry.coordinates)
          .setText(marker.popup)
          .addTo(map);
      }
    };

    const onMouseEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const onMouseLeave = () => { map.getCanvas().style.cursor = ''; };

    const bindLayerEvents = () => {
      map.on('click', CLUSTER_LAYER_ID, onClusterClick);
      map.on('click', POINT_LAYER_ID, onPointClick);
      map.on('mouseenter', CLUSTER_LAYER_ID, onMouseEnter);
      map.on('mouseleave', CLUSTER_LAYER_ID, onMouseLeave);
      map.on('mouseenter', POINT_LAYER_ID, onMouseEnter);
      map.on('mouseleave', POINT_LAYER_ID, onMouseLeave);
    };

    const unbindLayerEvents = () => {
      try { map.off('click', CLUSTER_LAYER_ID, onClusterClick); } catch { /* layer gone */ }
      try { map.off('click', POINT_LAYER_ID, onPointClick); } catch { /* layer gone */ }
      try { map.off('mouseenter', CLUSTER_LAYER_ID, onMouseEnter); } catch { /* layer gone */ }
      try { map.off('mouseleave', CLUSTER_LAYER_ID, onMouseLeave); } catch { /* layer gone */ }
      try { map.off('mouseenter', POINT_LAYER_ID, onMouseEnter); } catch { /* layer gone */ }
      try { map.off('mouseleave', POINT_LAYER_ID, onMouseLeave); } catch { /* layer gone */ }
    };

    const renderSource = () => {
      if (cancelled || !mapRef.current) return;
      if (!map.isStyleLoaded()) {
        map.once('idle', renderSource);
        return;
      }
      unbindLayerEvents();
      try { removeClusterLayers(map); } catch { /* style reset */ }
      if (!useSourceClustering) return;
      addClusterLayers(map, geojsonForMarkers(markers));
      bindLayerEvents();
    };

    renderSource();

    return () => {
      cancelled = true;
      popup?.remove();
      unbindLayerEvents();
      try { removeClusterLayers(map); } catch { /* map removed */ }
    };
  }, [markers, ready, styleUrl, useSourceClustering]);

  // Render markers. Rebuilt from scratch whenever the prop changes — fine for
  // the scales we deal with (hundreds of places max).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const m of markerRefs.current) m.remove();
    markerRefs.current = [];
    if (useSourceClustering) return;
    for (const m of markers) {
      if (typeof m.lng !== 'number' || typeof m.lat !== 'number') continue;
      const el = document.createElement('div');
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', m.popup || 'Map marker');
      el.title = m.popup || '';
      el.style.cssText =
        'width:14px;height:14px;border-radius:50%;background:hsl(var(--primary));border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.5);cursor:pointer;';
      let marker = null;
      const activate = (ev) => {
        ev.stopPropagation();
        if (m.onClick) m.onClick(m);
        else marker?.togglePopup();
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
  }, [markers, ready, useSourceClustering]);

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
          className="absolute left-3 right-3 bottom-3 md:right-auto md:bottom-auto md:top-3 z-10 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card/95 px-2.5 py-2 text-xs shadow-lg backdrop-blur max-w-full md:max-w-[calc(100%-120px)]"
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
