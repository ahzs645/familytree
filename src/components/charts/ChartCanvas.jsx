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
  page = {},
  overlays = [],
  onOverlaysChange,
  children,
}) {
  const svgRef = useRef(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef(null);
  const overlayDrag = useRef(null);

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
    if (overlayDrag.current) {
      const { id, startX, startY, original } = overlayDrag.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      onOverlaysChange?.(
        overlays.map((overlay) => overlay.id === id ? moveOverlay(original, dx, dy) : overlay)
      );
      return;
    }
    if (!drag.current) return;
    setView((v) => ({ ...v, x: drag.current.vx + (e.clientX - drag.current.x), y: drag.current.vy + (e.clientY - drag.current.y) }));
  };
  const onMouseUp = () => {
    drag.current = null;
    overlayDrag.current = null;
  };

  const reset = () => setView({ x: 0, y: 0, k: 1 });
  const background = page.backgroundColor || theme.background;

  const exportSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', exportSize(page).width);
    clone.setAttribute('height', exportSize(page).height);
    downloadBlob(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }), safeFilename(page.title || 'chart', 'svg'));
  };

  const exportPng = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const size = exportSize(page);
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', size.width);
    clone.setAttribute('height', size.height);
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, size.width, size.height);
      ctx.drawImage(img, 0, 0, size.width, size.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((png) => {
        if (png) downloadBlob(png, safeFilename(page.title || 'chart', 'png'));
      }, 'image/png');
    };
    img.src = url;
  };

  return (
    <div style={{ position: 'relative', width, height, background, overflow: 'hidden' }}>
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
        <rect x="0" y="0" width="100%" height="100%" fill={background} />
        {(page.title || page.note) && (
          <g pointerEvents="none">
            {page.title && <text x={24} y={34} fill={theme.text} fontSize={20} fontFamily={theme.fontFamily} fontWeight={700}>{page.title}</text>}
            {page.note && <text x={24} y={56} fill={theme.textMuted} fontSize={12} fontFamily={theme.fontFamily}>{page.note}</text>}
          </g>
        )}
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>{children}</g>
        <OverlayLayer
          overlays={overlays}
          theme={theme}
          onDragStart={(event, overlay) => {
            event.stopPropagation();
            overlayDrag.current = {
              id: overlay.id,
              startX: event.clientX,
              startY: event.clientY,
              original: overlay,
            };
          }}
        />
      </svg>
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6 }}>
        <button onClick={() => setView((v) => ({ ...v, k: Math.min(maxZoom, v.k * 1.2) }))} style={btn}>+</button>
        <button onClick={() => setView((v) => ({ ...v, k: Math.max(minZoom, v.k / 1.2) }))} style={btn}>−</button>
        <button onClick={reset} style={btn}>Reset</button>
        <button onClick={exportSvg} style={btn}>SVG</button>
        <button onClick={exportPng} style={btn}>PNG</button>
      </div>
    </div>
  );
}

function OverlayLayer({ overlays, theme, onDragStart }) {
  if (!Array.isArray(overlays) || overlays.length === 0) return null;
  return (
    <g>
      {overlays.map((overlay) => {
        if (overlay.type === 'line') {
          return (
            <g key={overlay.id} onMouseDown={(event) => onDragStart(event, overlay)} style={{ cursor: 'move' }}>
              <line
                x1={overlay.x1}
                y1={overlay.y1}
                x2={overlay.x2}
                y2={overlay.y2}
                stroke={overlay.color || theme.text}
                strokeWidth={overlay.strokeWidth || 2}
              />
              <line x1={overlay.x1} y1={overlay.y1} x2={overlay.x2} y2={overlay.y2} stroke="transparent" strokeWidth={12} />
            </g>
          );
        }
        if (overlay.type === 'image') {
          return (
            <image
              key={overlay.id}
              href={overlay.href}
              x={overlay.x}
              y={overlay.y}
              width={overlay.width || 180}
              height={overlay.height || 120}
              preserveAspectRatio="xMidYMid meet"
              style={{ cursor: 'move' }}
              onMouseDown={(event) => onDragStart(event, overlay)}
            />
          );
        }
        return (
          <text
            key={overlay.id}
            x={overlay.x}
            y={overlay.y}
            fill={overlay.color || theme.text}
            fontSize={overlay.fontSize || 18}
            fontFamily={theme.fontFamily}
            fontWeight={overlay.bold ? 700 : 500}
            style={{ cursor: 'move', userSelect: 'none' }}
            onMouseDown={(event) => onDragStart(event, overlay)}
          >
            {overlay.text || 'Text'}
          </text>
        );
      })}
    </g>
  );
}

function moveOverlay(overlay, dx, dy) {
  if (overlay.type === 'line') {
    return {
      ...overlay,
      x1: overlay.x1 + dx,
      y1: overlay.y1 + dy,
      x2: overlay.x2 + dx,
      y2: overlay.y2 + dy,
    };
  }
  return { ...overlay, x: overlay.x + dx, y: overlay.y + dy };
}

function exportSize(page = {}) {
  const sizes = {
    letter: [1056, 816],
    a4: [1123, 794],
    legal: [1344, 816],
  };
  const [landscapeWidth, landscapeHeight] = sizes[page.size] || sizes.letter;
  if (page.orientation === 'portrait') return { width: landscapeHeight, height: landscapeWidth };
  return { width: landscapeWidth, height: landscapeHeight };
}

function safeFilename(base, ext) {
  return `${String(base || 'chart').replace(/[^\w-]+/g, '_')}.${ext}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

const btn = {
  background: 'hsl(var(--secondary))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  padding: '6px 10px',
  font: '13px -apple-system, system-ui, sans-serif',
  cursor: 'pointer',
};

export default ChartCanvas;
