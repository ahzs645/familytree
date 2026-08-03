/**
 * Pan/zoom SVG container shared by every chart type.
 * Children are rendered inside a <g transform="...")> that responds to wheel + drag.
 */
import React, { useEffect, useRef, useState, useCallback, useImperativeHandle } from 'react';
import { DEFAULT_THEME } from './theme.js';
import { exportChartAsPdf, exportChartAsPng, exportChartAsSvg, printChart } from '../../lib/chartExport.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { useModal } from '../../contexts/ModalContext.jsx';
import { Button } from '../ui/Button.jsx';

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
  const { t } = useTranslation();
  const modal = useModal();
  const svgRef = useRef(null);
  const contentRef = useRef(null);
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
    const pinchState = pinch.current;
    if (pinchState && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const svg = svgRef.current;
      const rect = svg ? svg.getBoundingClientRect() : { left: 0, top: 0 };
      const cx = (a.x + b.x) / 2 - rect.left;
      const cy = (a.y + b.y) / 2 - rect.top;
      const startCx = pinchState.cx - rect.left;
      const startCy = pinchState.cy - rect.top;
      const nk = Math.min(maxZoom, Math.max(minZoom, pinchState.k * (dist / pinchState.dist)));
      const ratio = nk / pinchState.k;
      setView({
        k: nk,
        x: cx - (startCx - pinchState.vx) * ratio,
        y: cy - (startCy - pinchState.vy) * ratio,
      });
      return;
    }
    if (overlayDrag.current) {
      const { id, startX, startY, original } = overlayDrag.current;
      const dx = (e.clientX - startX) / view.k;
      const dy = (e.clientY - startY) / view.k;
      const next = overlays.map((overlay) => (overlay.id === id ? moveOverlay(original, dx, dy) : overlay));
      overlayDrag.current.preview = next;
      emitOverlays(next, { finalize: false });
      return;
    }
    const dragState = drag.current;
    if (!dragState) return;
    setView((v) => ({
      ...v,
      x: dragState.vx + (e.clientX - dragState.x),
      y: dragState.vy + (e.clientY - dragState.y),
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

  // Scale + center the drawn content inside the visible SVG. Without this the
  // view stays anchored at the top-left origin and, on small screens, a chart's
  // subject can render entirely off-screen with no way to recover via Reset.
  const fitToContent = useCallback(() => {
    const svg = svgRef.current;
    const content = contentRef.current;
    if (!svg || !content) return;
    let bbox;
    try { bbox = content.getBBox(); } catch { return; }
    if (!bbox || bbox.width < 1 || bbox.height < 1) return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const k = Math.min(maxZoom, Math.max(minZoom, Math.min(rect.width / bbox.width, rect.height / bbox.height) * 0.92));
    const x = (rect.width - bbox.width * k) / 2 - bbox.x * k;
    const y = (rect.height - bbox.height * k) / 2 - bbox.y * k;
    setView({ x, y, k });
  }, [minZoom, maxZoom]);

  const onReset = useCallback(() => fitToContent(), [fitToContent]);

  // Fit on first render and whenever the chart's top-level content changes
  // (person / chart-type switch). Retries one frame if the SVG isn't yet
  // measurable. Manual pan/zoom is preserved across unrelated re-renders.
  const childCount = React.Children.count(children);
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      const content = contentRef.current;
      let bbox;
      try { bbox = content?.getBBox(); } catch { /* not ready */ }
      if (bbox && bbox.width >= 1 && bbox.height >= 1) fitToContent();
      else raf2 = requestAnimationFrame(() => fitToContent());
    });
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); };
  }, [childCount, fitToContent]);

  const background = page.backgroundColor || theme.background;

  const exportOptions = {
    page,
    filename: filename || page.title || 'chart',
    exportSettings,
    fileNameTemplate: exportSettings?.fileNameTemplate,
  };

  const showExportError = (error) => {
    console.error('[CloudTreeWeb] chart export failed', error);
    modal.alert(t('charts.exportFailed'));
  };
  const onExportSvg = () => exportChartAsSvg(svgRef.current, exportOptions);
  const onExportPng = () => exportChartAsPng(svgRef.current, exportOptions, background).catch(showExportError);
  const onExportPdf = () => exportChartAsPdf(svgRef.current, exportOptions, background).catch(showExportError);
  const onPrint = () => {
    try {
      printChart(svgRef.current, exportOptions);
    } catch (error) {
      showExportError(error);
    }
  };

  useImperativeHandle(ref, () => ({
    focusRoot: () => onReset(),
    resetView: () => onReset(),
    exportSvg: onExportSvg,
    exportPng: onExportPng,
    exportPdf: onExportPdf,
    print: onPrint,
    measurePageBreakObjects: () => measurePageBreakObjects(contentRef.current),
  }), [onReset, onExportSvg, onExportPng, onExportPdf, onPrint]);

  return (
    // width/height are props and background comes from the chart theme, so
    // they stay inline.
    <div className="relative overflow-hidden" style={{ width, height, background }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="block touch-none"
        style={{ cursor: drag.current ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <rect x="0" y="0" width="100%" height="100%" fill={background} />
        <g ref={contentRef} data-chart-export-content="true" transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {(page.title || page.note) && (
            <g pointerEvents="none">
              {page.title && <text x={24} y={34} fill={theme.text} fontSize={20} fontFamily={theme.fontFamily} fontWeight={700}>{page.title}</text>}
              {page.note && <text x={24} y={56} fill={theme.textMuted} fontSize={12} fontFamily={theme.fontFamily}>{page.note}</text>}
            </g>
          )}
          {children}
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
        </g>
      </svg>
      <div className="absolute end-3 top-3 flex gap-1.5">
        <Button onClick={() => setView((v) => ({ ...v, k: Math.min(maxZoom, v.k * 1.2) }))}>＋</Button>
        <Button onClick={() => setView((v) => ({ ...v, k: Math.max(minZoom, v.k / 1.2) }))}>－</Button>
        <Button onClick={onReset}>{t('charts.reset', { defaultValue: 'Reset' })}</Button>
        <Button onClick={onExportSvg}>SVG</Button>
        <Button onClick={onExportPng}>PNG</Button>
        <Button onClick={onPrint} title={t('charts.printHint')}>{t('charts.print')}</Button>
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
        const opacity = overlayOpacity(overlay);
        if (overlay.type === 'line') {
          const stroke = isSelected ? '#1e88e5' : (overlay.color || theme.text);
          const strokeWidth = isSelected ? (overlay.strokeWidth || 2) + 1 : (overlay.strokeWidth || 2);
          const dashArray = strokeDashArray(overlay.strokeDash, strokeWidth);
          return (
            <g
              key={overlay.id}
              data-chart-object-kind="overlay"
              data-chart-object-id={overlay.id}
              opacity={opacity}
              onPointerDown={(event) => {
                onSelect?.(overlay.id);
                onDragStart(event, overlay);
              }}
              style={{ cursor: 'move' }}
            >
              <line x1={overlay.x1} y1={overlay.y1} x2={overlay.x2} y2={overlay.y2} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} />
              <line x1={overlay.x1} y1={overlay.y1} x2={overlay.x2} y2={overlay.y2} stroke="transparent" strokeWidth={12} />
            </g>
          );
        }

        if (overlay.type === 'image') {
          return (
            <g key={overlay.id} opacity={opacity} data-chart-object-kind="overlay" data-chart-object-id={overlay.id}>
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
            data-chart-object-kind="overlay"
            data-chart-object-id={overlay.id}
            x={overlay.x}
            y={overlay.y}
            fill={isSelected ? '#1e88e5' : (overlay.color || theme.text)}
            fontSize={overlay.fontSize || 18}
            fontFamily={theme.fontFamily}
            fontWeight={overlayFontWeight(overlay)}
            opacity={opacity}
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

function measurePageBreakObjects(content) {
  if (!content) return null;
  let contentBounds;
  try {
    const bbox = content.getBBox();
    contentBounds = { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
  } catch {
    return null;
  }
  const seen = new Set();
  const objects = [];
  for (const element of content.querySelectorAll('[data-chart-object-kind="person"], [data-chart-object-kind="overlay"]')) {
    const id = element.getAttribute('data-chart-object-id');
    const kind = element.getAttribute('data-chart-object-kind');
    if (!id || seen.has(`${kind}:${id}`)) continue;
    const bounds = boundsRelativeTo(element, content);
    if (!bounds) continue;
    seen.add(`${kind}:${id}`);
    objects.push({ id, kind, bounds });
  }
  return { contentBounds, objects };
}

function boundsRelativeTo(element, ancestor) {
  try {
    const bbox = element.getBBox();
    const elementMatrix = element.getCTM();
    const ancestorMatrix = ancestor.getCTM();
    if (!elementMatrix || !ancestorMatrix) return null;
    const matrix = ancestorMatrix.inverse().multiply(elementMatrix);
    const points = [
      new DOMPoint(bbox.x, bbox.y),
      new DOMPoint(bbox.x + bbox.width, bbox.y),
      new DOMPoint(bbox.x, bbox.y + bbox.height),
      new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height),
    ].map((point) => point.matrixTransform(matrix));
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  } catch {
    return null;
  }
}

// Object Inspector edits write `fontWeight` ('normal'|'bold'); older overlays
// may still carry a boolean `bold`. Render either as an SVG numeric weight.
function overlayFontWeight(overlay) {
  if (overlay.fontWeight === 'bold' || overlay.fontWeight === 700) return 700;
  if (overlay.fontWeight === 'normal' || overlay.fontWeight === 400) return 400;
  return overlay.bold ? 700 : 500;
}

// Clamp the inspector's 0–1 opacity; undefined means fully opaque.
function overlayOpacity(overlay) {
  const value = overlay.opacity;
  if (value === undefined || value === null || !Number.isFinite(Number(value))) return 1;
  return Math.min(1, Math.max(0, Number(value)));
}

// Map the inspector's stroke-style choice to an SVG strokeDasharray, scaling
// the pattern by the line's stroke width so it reads at any thickness.
function strokeDashArray(strokeDash, strokeWidth = 2) {
  const w = Math.max(0.5, Number(strokeWidth) || 2);
  if (strokeDash === 'dashed') return `${w * 3} ${w * 2}`;
  if (strokeDash === 'dotted') return `${w} ${w * 1.5}`;
  return undefined;
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

ChartCanvas.displayName = 'ChartCanvas';

export default ChartCanvas;
