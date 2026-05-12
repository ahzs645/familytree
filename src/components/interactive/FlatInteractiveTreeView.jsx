/**
 * Flat (2D SVG) Interactive Tree viewer — mirrors the MacFamilyTree
 * InteractiveTreeViewFlatViewer: horizontal full-width pink/purple generation bands
 * with person cards and orthogonal connectors.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { lifeSpanLabel } from '../../models/index.js';
import { buildInteractiveLayout } from './threeDTree/layout.js';
import { readInitialViewerOptions } from './threeDTree/viewerOptions.js';
import { VIEWER_OPTIONS_STORAGE_KEY } from './threeDTree/constants.js';

const CARD_W = 130;
const CARD_H = 76;
const BAND_PADDING_Y = 24;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 3.0;

export function FlatInteractiveTreeView({
  ancestorTree,
  descendantTree,
  familyGraph,
  activeId,
  loading = false,
  onPick,
  onEditPerson,
  onShowInfo,
  onReturnToFamilyTree,
}) {
  const [viewerOptions, setViewerOptions] = useState(readInitialViewerOptions);
  const layout = useMemo(
    () => buildInteractiveLayout(ancestorTree, descendantTree, activeId, familyGraph, {
      ancestorGenerations: viewerOptions.ancestorGenerations,
      descendantGenerations: viewerOptions.descendantGenerations,
      childSortingMode: viewerOptions.childSortingMode,
    }),
    [ancestorTree, descendantTree, activeId, familyGraph, viewerOptions.ancestorGenerations, viewerOptions.descendantGenerations, viewerOptions.childSortingMode],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEWER_OPTIONS_STORAGE_KEY, JSON.stringify(viewerOptions));
    } catch {
      // Optional persistence.
    }
  }, [viewerOptions]);

  const bands = useMemo(() => computeFlatBands(layout.nodes), [layout.nodes]);
  const sceneBounds = useMemo(() => computeSceneBounds(layout.nodes, bands), [layout.nodes, bands]);
  const containerRef = useRef(null);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setViewport({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fit on bounds change.
  useEffect(() => {
    if (!layout.nodes.length) return;
    const sceneWidth = sceneBounds.maxX - sceneBounds.minX || 1;
    const sceneHeight = sceneBounds.maxY - sceneBounds.minY || 1;
    const scale = Math.min(viewport.width / sceneWidth, viewport.height / sceneHeight) * 0.9;
    const clampedScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, scale));
    const centerSceneX = (sceneBounds.minX + sceneBounds.maxX) / 2;
    const centerSceneY = (sceneBounds.minY + sceneBounds.maxY) / 2;
    setTransform({
      x: viewport.width / 2 - centerSceneX * clampedScale,
      y: viewport.height / 2 - centerSceneY * clampedScale,
      scale: clampedScale,
    });
  }, [sceneBounds.minX, sceneBounds.maxX, sceneBounds.minY, sceneBounds.maxY, viewport.width, viewport.height, layout.nodes.length, activeId]);

  const onWheel = (event) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.08 : 0.92;
    setTransform((current) => {
      const nextScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, current.scale * factor));
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return current;
      const cx = event.clientX - rect.left;
      const cy = event.clientY - rect.top;
      const ratio = nextScale / current.scale;
      return {
        scale: nextScale,
        x: cx - (cx - current.x) * ratio,
        y: cy - (cy - current.y) * ratio,
      };
    });
  };
  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    dragRef.current = { x: event.clientX, y: event.clientY, originX: transform.x, originY: transform.y, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    if (Math.hypot(dx, dy) > 4) dragRef.current.moved = true;
    setTransform((current) => ({
      ...current,
      x: dragRef.current.originX + dx,
      y: dragRef.current.originY + dy,
    }));
  };
  const onPointerUp = (event) => {
    if (dragRef.current) {
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* noop */ }
      dragRef.current = null;
    }
  };
  const onNodeClick = (recordName) => {
    if (dragRef.current?.moved) return;
    if (recordName) onPick?.(recordName);
  };

  const hasTree = layout.nodes.length > 0;
  const showBands = (viewerOptions.generationBandStyle || 'raised') !== 'none';
  const bandOpacity = Number.isFinite(viewerOptions.generationBandOpacity) ? viewerOptions.generationBandOpacity : 0.62;
  const fullWidth = viewerOptions.generationBandsFullWidth !== false;

  return (
    <div style={styles.shell}>
      <div style={styles.topBar}>
        <button type="button" style={styles.barButton} onClick={onReturnToFamilyTree}>
          Return to Family Tree
        </button>
        <span style={styles.viewerLabel}>Flat Interactive Tree</span>
      </div>
      <div
        ref={containerRef}
        style={styles.canvas}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg width={viewport.width} height={viewport.height} style={{ display: 'block', cursor: dragRef.current ? 'grabbing' : 'grab' }}>
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
            {showBands && bands.map((band) => (
              <BandRow
                key={band.generation}
                band={band}
                bounds={sceneBounds}
                fullWidth={fullWidth}
                opacity={bandOpacity}
              />
            ))}
            {layout.links.map((link) => (
              <LinkLine key={link.key} link={link} nodes={layout.nodes} />
            ))}
            {layout.nodes.map((node) => (
              <PersonCard
                key={node.id}
                node={node}
                viewerOptions={viewerOptions}
                active={node.id === activeId}
                onClick={() => onNodeClick(node.id)}
                onDoubleClick={() => onEditPerson?.(node.id)}
              />
            ))}
          </g>
        </svg>
        {(loading || !hasTree) && (
          <div style={styles.overlay}>
            {loading ? 'Loading tree...' : 'Pick a person from the list.'}
          </div>
        )}
      </div>
    </div>
  );
}

function BandRow({ band, bounds, fullWidth, opacity }) {
  const minX = fullWidth ? bounds.minX - 80 : band.minX - 40;
  const maxX = fullWidth ? bounds.maxX + 80 : band.maxX + 40;
  const width = Math.max(40, maxX - minX);
  const height = band.height;
  const y = band.y;
  return (
    <g opacity={opacity}>
      <rect
        x={minX}
        y={y}
        width={width}
        height={height}
        rx={28}
        ry={28}
        fill={bandFill(band.generation)}
        stroke={bandStroke(band.generation)}
        strokeWidth={1.2}
      />
      <text
        x={minX + 18}
        y={y + height / 2 + 5}
        fill={bandTextColor(band.generation)}
        fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        fontWeight={750}
        fontSize={14}
      >
        {generationLabel(band.generation)}
      </text>
    </g>
  );
}

function PersonCard({ node, viewerOptions, active, onClick, onDoubleClick }) {
  const x = node.x - CARD_W / 2;
  const y = node.y - CARD_H / 2;
  const name = node.person?.fullName || 'Unknown';
  const isFemale = String(node.person?.gender || '').toLowerCase().includes('fem');
  const isMale = String(node.person?.gender || '').toLowerCase().includes('mal') && !isFemale;
  const fillColor = isMale ? '#dbe7ff' : isFemale ? '#fde0ef' : '#eaedf2';
  const strokeColor = active ? '#7b5af6' : isMale ? '#9bb5e8' : isFemale ? '#dba6c1' : '#bcc0c7';
  const dates = buildDates(node.person, viewerOptions);
  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }} onClick={onClick} onDoubleClick={onDoubleClick}>
      <rect
        width={CARD_W}
        height={CARD_H}
        rx={10}
        ry={10}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={active ? 2.4 : 1.2}
      />
      {(viewerOptions?.personImageStyle || 'round') !== 'none' && (
        <circle cx={20} cy={CARD_H / 2} r={14} fill="#f4d3a5" stroke="#c79462" strokeWidth={1} />
      )}
      <text
        x={42}
        y={28}
        fill="#17191d"
        fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        fontWeight={700}
        fontSize={12}
      >
        {truncate(name, 16)}
      </text>
      {dates && (
        <text
          x={42}
          y={46}
          fill="#646973"
          fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
          fontWeight={600}
          fontSize={10}
        >
          {dates}
        </text>
      )}
    </g>
  );
}

function LinkLine({ link, nodes }) {
  const from = nodes.find((node) => node.id === link.from);
  const to = nodes.find((node) => node.id === link.to);
  if (!from || !to) return null;

  if (link.type === 'partner') {
    return (
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="#c97aa6"
        strokeWidth={1.6}
        strokeDasharray="6 4"
      />
    );
  }

  // Orthogonal: from bottom of higher to top of lower
  const isFromAbove = from.y < to.y;
  const top = isFromAbove ? from : to;
  const bottom = isFromAbove ? to : from;
  const topEdgeY = top.y + CARD_H / 2;
  const bottomEdgeY = bottom.y - CARD_H / 2;
  const midY = (topEdgeY + bottomEdgeY) / 2;
  const points = `${top.x},${topEdgeY} ${top.x},${midY} ${bottom.x},${midY} ${bottom.x},${bottomEdgeY}`;
  return (
    <polyline
      points={points}
      fill="none"
      stroke={link.type === 'ancestor' ? '#9aa0a8' : '#8da6c6'}
      strokeWidth={1.4}
    />
  );
}

function computeFlatBands(nodes) {
  if (!nodes.length) return [];
  const byGeneration = new Map();
  for (const node of nodes) {
    if (!byGeneration.has(node.generation)) byGeneration.set(node.generation, []);
    byGeneration.get(node.generation).push(node);
  }
  const generations = [...byGeneration.keys()].sort((a, b) => a - b);
  return generations.map((generation) => {
    const list = byGeneration.get(generation);
    const xs = list.map((node) => node.x);
    return {
      generation,
      minX: Math.min(...xs) - CARD_W / 2,
      maxX: Math.max(...xs) + CARD_W / 2,
      y: list[0].y - CARD_H / 2 - BAND_PADDING_Y,
      height: CARD_H + BAND_PADDING_Y * 2,
      count: list.length,
    };
  });
}

function computeSceneBounds(nodes, bands) {
  if (!nodes.length) return { minX: 0, maxX: 200, minY: 0, maxY: 200 };
  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  const bandYs = bands.flatMap((band) => [band.y, band.y + band.height]);
  return {
    minX: Math.min(...xs) - CARD_W,
    maxX: Math.max(...xs) + CARD_W,
    minY: Math.min(...ys, ...bandYs) - CARD_H,
    maxY: Math.max(...ys, ...bandYs) + CARD_H,
  };
}

function bandFill(generation) {
  if (generation === 0) return '#f9d4ec';
  if (generation < 0) return ['#fbd6e7', '#f7c7d6', '#f3b8c9', '#efaabf', '#ec9bb7'][Math.min(Math.abs(generation) - 1, 4)];
  return ['#e6d4ee', '#d9c8e8', '#cbbbe1', '#bfb0d9', '#b3a4d1'][Math.min(generation - 1, 4)];
}

function bandStroke(generation) {
  if (generation === 0) return '#e295c3';
  return generation < 0 ? '#dba2b4' : '#b69ec9';
}

function bandTextColor(generation) {
  if (generation === 0) return '#9b3978';
  return generation < 0 ? '#8b4960' : '#5e4980';
}

function generationLabel(generation) {
  if (generation === 0) return 'Root';
  if (generation < 0) return `Generation ${Math.abs(generation)}`;
  return `Descendant ${generation}`;
}

function buildDates(person, options) {
  const showBirth = options?.displayBirthDate !== false;
  const showDeath = options?.displayDeathDate !== false;
  if (!showBirth && !showDeath) return '';
  if (showBirth && showDeath) return lifeSpanLabel(person) || '';
  const date = showBirth ? person?.birthDate : person?.deathDate;
  if (!date) return '';
  const yearMatch = String(date).match(/\d{4}/);
  const year = yearMatch ? yearMatch[0] : String(date);
  return showBirth ? `b. ${year}` : `d. ${year}`;
}

function truncate(value, max) {
  const text = String(value || '');
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

const styles = {
  shell: {
    position: 'relative',
    width: '100%',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
    background: 'hsl(var(--background))',
  },
  topBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 22,
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: 6,
    borderRadius: 8,
    background: 'hsl(var(--card) / 0.88)',
    border: '1px solid hsl(var(--border))',
    boxShadow: '0 10px 24px rgb(0 0 0 / 0.12)',
    backdropFilter: 'blur(14px)',
  },
  barButton: {
    height: 31,
    borderRadius: 6,
    border: '1px solid hsl(var(--border))',
    background: 'hsl(var(--secondary))',
    color: 'hsl(var(--foreground))',
    font: '750 12px -apple-system, system-ui, sans-serif',
    padding: '0 10px',
    cursor: 'pointer',
  },
  viewerLabel: {
    paddingInlineStart: 10,
    paddingInlineEnd: 6,
    color: 'hsl(var(--muted-foreground))',
    font: '650 12px -apple-system, system-ui, sans-serif',
  },
  canvas: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    touchAction: 'none',
    background: 'linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--secondary) / 0.4) 100%)',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    color: 'hsl(var(--muted-foreground))',
    font: '700 13px -apple-system, system-ui, sans-serif',
  },
};

export default FlatInteractiveTreeView;
