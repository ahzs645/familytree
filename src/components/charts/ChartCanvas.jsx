/**
 * Pan/zoom SVG container shared by every chart type.
 * Children are rendered inside a <g transform="...")> that responds to wheel + drag.
 */
import React, { useEffect, useRef, useState, useCallback, useImperativeHandle } from 'react';
import { DEFAULT_THEME } from './theme.js';
import { exportChartAsPng, exportChartAsSvg, printChartViaPdf } from '../../lib/chartExport.js';

export const ChartCanvas = React.forwardRef(function ChartCanvas(
  {
    width = '100%',
    height = '100%',
    minZoom = 0.15,
    maxZoom = 4,
    theme = DEFAULT_THEME,
    page = {},
    overlays = [],
    onOverlaysChange,
    onOverlaysPreview,
    onOverlaysCommit,
    onSelectOverlay,
    selectedOverlayId,
    filename,
    exportSettings,
    children,
  },
  ref
) {
  const svgRef = useRef(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef(null);
  const overlayDrag = useRef(null);
  const pointers = useRef(new Map());
  const pinch = useRef(null);

  const emitOverlays = useCallback((next, options = {}) => {
    const { finalize = false } = options;
    const updater = finalize ? onOverlaysCommit : onOverlaysPreview;
    const callback = updater || onOverlaysChange;
    callback?.(next, { finalize });
  }, [onOverlaysChange, onOverlaysPreview, onOverlaysCommit]);

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

  const finalizeOverlayDrag = () => {
    if (!overlayDrag.current) return;
    const next = overlayDrag.current.preview;
    if (next) {
      emitOverlays(next, { finalize: true });
    }
    overlayDrag.current = null;
  };

  const onPointerDown = (e) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) { /* noop */ }
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      pinch.current = {
        dist,
        k: view.k,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
        vx: view.x,
        vy: view.y,
      };
      drag.current = null;
      return;
    }
    if (overlayDrag.current) return;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  };

  const onPointerMove = (e) => {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const svg = svgRef.current;
      const rect = svg ? svg.getBoundingClientRect() : { left: 0, top: 0 };
      const cx = (a.x + b.x) / 2 - rect.left;
      const cy = (a.y + b.y) / 2 - rect.top;
      const startCx = pinch.current.cx - rect.left;
      const startCy = pinch.current.cy - rect.top;
      const nk = Math.min(maxZoom, Math.max(minZoom, pinch.current.k * (dist / pinch.current.dist)));
      const ratio = nk / pinch.current.k;
      setView({
        k: nk,
        x: cx - (startCx - pinch.current.vx) * ratio,
        y: cy - (startCy - pinch.current.vy) * ratio,
      });
      return;
    }
    if (overlayDrag.current) {
      const { id, startX, startY, original } = overlayDrag.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const next = overlays.map((overlay) => (overlay.id === id ? moveOverlay(original, dx, dy) : overlay));
      overlayDrag.current.preview = next;
      emitOverlays(next, { finalize: false });
      return;
    }
    if (!drag.current) return;
    setView((v) => ({
      ...v,
      x: drag.current.vx + (e.clientX - drag.current.x),
      y: drag.current.vy + (e.clientY - drag.current.y),
    }));
  };

  const onPointerUp = (e) => {
    if (overlayDrag.current) {
      finalizeOverlayDrag();
    }
    pointers.current.delete(e?.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      drag.current = null;
    }
  };

  const onReset = () => setView({ x: 0, y: 0, k: 1 });
  const background = page.backgroundColor || theme.background;

  const exportOptions = {
    page,
    filename: filename || page.title || 'chart',
    exportSettings,
    fileNameTemplate: exportSettings?.fileNameTemplate,
  };

  const onExportSvg = () => exportChartAsSvg(svgRef.current, exportOptions);
  const onExportPng = () => exportChartAsPng(svgRef.current, exportOptions, background);
  const onPrint = () => printChartViaPdf(svgRef.current, exportOptions);

  useImperativeHandle(ref, () => ({
    focusRoot: () => onReset(),
    resetView: () => onReset(),
    exportSvg: onExportSvg,
    exportPng: onExportPng,
    exportPdf: onPrint,
    print: onPrint,
  }), [onReset, onExportSvg, onExportPng, onPrint]);

  return (
    <div style={{ position: 'relative', width, height, background, overflow: 'hidden' }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ cursor: drag.current ? 'grabbing' : 'grab', display: 'block', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
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
          selectedOverlayId={selectedOverlayId}
          onSelect={onSelectOverlay}
          onDragStart={(event, overlay) => {
            event.stopPropagation();
            onSelectOverlay?.(overlay.id);
            overlayDrag.current = {
              id: overlay.id,
              startX: event.clientX,
              startY: event.clientY,
              original: overlay,
            };
          }}
        />
      </svg>
      <div style={{ position: 'absolute', top: 12, insetInlineEnd: 12, display: 'flex', gap: 6 }}>
        <button onClick={() => setView((v) => ({ ...v, k: Math.min(maxZoom, v.k * 1.2) }))} style={btn}>＋</button>
        <button onClick={() => setView((v) => ({ ...v, k: Math.max(minZoom, v.k / 1.2) }))} style={btn}>－</button>
        <button onClick={onReset} style={btn}>Reset</button>
        <button onClick={onExportSvg} style={btn}>SVG</button>
        <button onClick={onExportPng} style={btn}>PNG</button>
        <button onClick={onPrint} style={btn}>PDF</button>
      </div>
    </div>
  );
});

function OverlayLayer({ overlays, theme, onDragStart, onSelect, selectedOverlayId }) {
  if (!Array.isArray(overlays) || overlays.length === 0) return null;
  return (
    <g>
      {overlays.map((overlay) => {
        const isSelected = overlay.id === selectedOverlayId;
        if (overlay.type === 'line') {
          const stroke = isSelected ? '#1e88e5' : (overlay.color || theme.text);
          const strokeWidth = isSelected ? (overlay.strokeWidth || 2) + 1 : (overlay.strokeWidth || 2);
          return (
            <g
              key={overlay.id}
              onPointerDown={(event) => {
                onSelect?.(overlay.id);
                onDragStart(event, overlay);
              }}
              style={{ cursor: 'move' }}
            >
              <line x1={overlay.x1} y1={overlay.y1} x2={overlay.x2} y2={overlay.y2} stroke={stroke} strokeWidth={strokeWidth} />
              <line x1={overlay.x1} y1={overlay.y1} x2={overlay.x2} y2={overlay.y2} stroke="transparent" strokeWidth={12} />
            </g>
          );
        }

        if (overlay.type === 'image') {
          return (
            <g key={overlay.id}>
              <image
                href={overlay.href}
                x={overlay.x}
                y={overlay.y}
                width={overlay.width || 180}
                height={overlay.height || 120}
                preserveAspectRatio="xMidYMid meet"
                style={{ cursor: 'move' }}
                onPointerDown={(event) => {
                  onSelect?.(overlay.id);
                  onDragStart(event, overlay);
                }}
              />
              {isSelected && (
                <rect
                  x={overlay.x}
                  y={overlay.y}
                  width={overlay.width || 180}
                  height={overlay.height || 120}
                  fill="none"
                  stroke="#1e88e5"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                />
              )}
            </g>
          );
        }

        return (
          <text
            key={overlay.id}
            x={overlay.x}
            y={overlay.y}
            fill={isSelected ? '#1e88e5' : (overlay.color || theme.text)}
            fontSize={overlay.fontSize || 18}
            fontFamily={theme.fontFamily}
            fontWeight={overlay.bold ? 700 : 500}
            style={{ cursor: 'move', userSelect: 'none' }}
            onPointerDown={(event) => {
              onSelect?.(overlay.id);
              onDragStart(event, overlay);
            }}
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

const btn = {
  background: 'hsl(var(--secondary))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  padding: '6px 10px',
  font: '13px -apple-system, system-ui, sans-serif',
  cursor: 'pointer',
};

ChartCanvas.displayName = 'ChartCanvas';

export default ChartCanvas;
