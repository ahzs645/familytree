/**
 * Theme-aware MapLibre wrapper. Pick light/dark basemaps from Carto's free
 * tile service, render markers, and forward clicks so callers can set
 * coordinates from the map.
 *
 * Usage:
 *   <Map center={[lon, lat]} zoom={9} markers={[{lng, lat, id, onClick}]} onClick={handler} />
 */
import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from '../../contexts/ThemeContext.jsx';

const STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export function Map({
  center = [0, 20],
  zoom = 1.5,
  markers = [],
  onClick,
  className = '',
  interactive = true,
  projection,
}) {
  const { theme } = useTheme();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRefs = useRef([]);
  const [ready, setReady] = useState(false);

  // Initialize map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: theme === 'dark' ? STYLE_DARK : STYLE_LIGHT,
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

  // Swap basemap when the theme changes. setStyle resets the projection,
  // so re-apply it once the new style finishes loading.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(theme === 'dark' ? STYLE_DARK : STYLE_LIGHT);
    if (projection && typeof map.setProjection === 'function') {
      const reapply = () => { try { map.setProjection(projection); } catch { /* ignore */ } };
      map.once('styledata', reapply);
    }
  }, [theme, projection]);

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
    for (const m of markers) {
      if (typeof m.lng !== 'number' || typeof m.lat !== 'number') continue;
      const el = document.createElement('div');
      el.style.cssText =
        'width:14px;height:14px;border-radius:50%;background:hsl(var(--primary));border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.5);cursor:pointer;';
      if (m.onClick) el.addEventListener('click', (ev) => { ev.stopPropagation(); m.onClick(m); });
      const marker = new maplibregl.Marker({ element: el, draggable: !!m.draggable })
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
  }, [markers, ready]);

  // Update center/zoom when the inputs change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.jumpTo({ center, zoom });
  }, [center[0], center[1], zoom, ready]);

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }} />;
}

export default Map;
