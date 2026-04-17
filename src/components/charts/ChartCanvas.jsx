/**
 * Pan/zoom SVG container shared by every chart type.
 * Children are rendered inside a <g transform="..."> that responds to wheel + drag.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { DEFAULT_THEME } from './theme.js';

export function ChartCanvas({
  width = '100%',
  height = '100%',
  minZoom = 0.15,
  maxZoom = 4,
  theme = DEFAULT_THEME,
  children,
}) {
  const svgRef = useRef(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef(null);

  const onWheel = useCallback(
    (e) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setView((v) => {
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const nk = Math.min(maxZoom, Math.max(minZoom, v.k * factor));
        const ratio = nk / v.k;
        return { k: nk, x: mx - (mx - v.x) * ratio, y: my - (my - v.y) * ratio };
      });
    },
    [minZoom, maxZoom]
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const onMouseDown = (e) => {
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  };
  const onMouseMove = (e) => {
    if (!drag.current) return;
    setView((v) => ({ ...v, x: drag.current.vx + (e.clientX - drag.current.x), y: drag.current.vy + (e.clientY - drag.current.y) }));
  };
  const onMouseUp = () => {
    drag.current = null;
  };

  const reset = () => setView({ x: 0, y: 0, k: 1 });

  return (
    <div style={{ position: 'relative', width, height, background: theme.background, overflow: 'hidden' }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ cursor: drag.current ? 'grabbing' : 'grab', display: 'block' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>{children}</g>
      </svg>
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6 }}>
        <button onClick={() => setView((v) => ({ ...v, k: Math.min(maxZoom, v.k * 1.2) }))} style={btn}>+</button>
        <button onClick={() => setView((v) => ({ ...v, k: Math.max(minZoom, v.k / 1.2) }))} style={btn}>−</button>
        <button onClick={reset} style={btn}>Reset</button>
      </div>
    </div>
  );
}

const btn = {
  background: '#242837',
  color: '#e2e4eb',
  border: '1px solid #2e3345',
  borderRadius: 6,
  padding: '6px 10px',
  font: '13px -apple-system, system-ui, sans-serif',
  cursor: 'pointer',
};

export default ChartCanvas;
