/**
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
 * Flat (2D SVG) Interactive Tree viewer — mirrors the MacFamilyTree
 * InteractiveTreeViewFlatViewer: horizontal full-width pink/purple generation bands
 * with person cards and orthogonal connectors.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { lifeSpanLabel } from '../../models/index.js';
import { buildInteractiveLayout } from './threeDTree/layout.js';
import { readInitialViewerOptions } from './threeDTree/viewerOptions.js';
import { FLAT_BACKGROUND_STYLES, VIEWER_OPTIONS_STORAGE_KEY } from './threeDTree/constants.js';

const CARD_W = 148;
const CARD_H = 64;
const BAND_PADDING_Y = 28;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 3.0;

// CSS background per native BackgroundStyle preset. Spotlights are radial
// gradients lit from the upper-middle, like the Mac flat viewer.
function flatBackgroundCss(style, customColor) {
  const color = customColor || '#dce7f5';
  switch (style) {
    case 'gray': return '#e8e8ec';
    case 'blue': return '#dbe6f4';
    case 'whiteSpotlight':
      return 'radial-gradient(ellipse 120% 90% at 50% 34%, #ffffff 0%, #ececf1 62%, #dddde4 100%)';
    case 'lightBlueSpotlight':
      return 'radial-gradient(ellipse 120% 90% at 50% 34%, #f4f9ff 0%, #d3e2f5 62%, #bdd2ea 100%)';
    case 'lightOrangeSpotlight':
      return 'radial-gradient(ellipse 120% 90% at 50% 34%, #fff8f0 0%, #f7e1c8 62%, #eed2b1 100%)';
    case 'customColor': return color;
    case 'customGradient':
      return `linear-gradient(180deg, color-mix(in srgb, ${color}, white 55%) 0%, ${color} 100%)`;
    case 'customSpotlight':
      return `radial-gradient(ellipse 120% 90% at 50% 34%, color-mix(in srgb, ${color}, white 70%) 0%, ${color} 70%)`;
    default: return 'hsl(var(--background))';
  }
}

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
  const { t } = useTranslation();
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

  const backgroundStyle = viewerOptions.flatBackgroundStyle || 'none';
  const showCustomColor = backgroundStyle.startsWith('custom');

  return (
    <div style={{ ...styles.shell, background: flatBackgroundCss(backgroundStyle, viewerOptions.flatBackgroundCustomColor) }}>
      <div style={styles.topBar}>
        <button type="button" style={styles.barButton} onClick={onReturnToFamilyTree}>
          {t('interactiveTree.returnToFamilyTree')}
        </button>
        <span style={styles.viewerLabel}>{t('interactiveTree.flatViewerLabel')}</span>
        <label style={styles.viewerLabel}>
          {t('interactiveTree.background')}{' '}
          <select
            value={backgroundStyle}
            onChange={(event) => setViewerOptions((current) => ({ ...current, flatBackgroundStyle: event.target.value }))}
            style={styles.backgroundSelect}
            aria-label={t('interactiveTree.backgroundStyleAria')}
          >
            {FLAT_BACKGROUND_STYLES.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        {showCustomColor && (
          <input
            type="color"
            value={viewerOptions.flatBackgroundCustomColor || '#dce7f5'}
            onChange={(event) => setViewerOptions((current) => ({ ...current, flatBackgroundCustomColor: event.target.value }))}
            aria-label={t('interactiveTree.customBackgroundColorAria')}
            style={{ width: 28, height: 24, padding: 0, border: '1px solid hsl(var(--border))', borderRadius: 4, background: 'transparent' }}
          />
        )}
      </div>
      <div
        ref={containerRef}
        style={backgroundStyle === 'none' ? styles.canvas : { ...styles.canvas, background: 'transparent', backgroundImage: 'none' }}
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
            <FamilyConnectors links={layout.links} nodes={layout.nodes} />
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
        stroke={bandStroke()}
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
  const gender = Number(node.person?.gender);
  const isFemale = gender === 1;
  const isMale = gender === 0;
  // Mac uses light blue for males, light pink for females, neutral for unknown.
  const fillColor = isMale ? '#dde9fb' : isFemale ? '#fbd9ec' : '#f0eef6';
  const innerHighlight = isMale ? '#f1f7ff' : isFemale ? '#fef0f8' : '#f8f6fb';
  const strokeColor = active ? '#7b5af6' : isMale ? '#a7c1ef' : isFemale ? '#e5a7c8' : '#cbc7d6';
  const dates = buildDates(node.person, viewerOptions);
  const showAvatar = (viewerOptions?.personImageStyle || 'round') !== 'none';
  const textInsetX = showAvatar ? 44 : 14;
  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }} onClick={onClick} onDoubleClick={onDoubleClick}>
      <rect
        width={CARD_W}
        height={CARD_H}
        rx={9}
        ry={9}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={active ? 2.2 : 1}
      />
      {/* Subtle inner highlight strip on top half for the soft Mac look */}
      <rect
        x={1}
        y={1}
        width={CARD_W - 2}
        height={(CARD_H - 2) / 2}
        rx={8}
        ry={8}
        fill={innerHighlight}
        opacity={0.65}
      />
      {showAvatar && (
        <>
          <circle cx={22} cy={CARD_H / 2} r={15} fill="#f5d6a8" stroke="#c79462" strokeWidth={0.8} />
          <circle cx={22} cy={CARD_H / 2 - 4} r={5.5} fill="#3b2e23" opacity={0.6} />
          <ellipse cx={22} cy={CARD_H / 2 + 9} rx={9} ry={5} fill="#3b2e23" opacity={0.55} />
        </>
      )}
      <text
        x={textInsetX}
        y={dates ? 24 : CARD_H / 2 + 4}
        fill="#1c1d22"
        fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        fontWeight={700}
        fontSize={12}
      >
        {truncate(name, 18)}
      </text>
      {dates && (
        <text
          x={textInsetX}
          y={42}
          fill="#5d6068"
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

const LINK_COLOR = '#d04a96';
const LINK_WIDTH = 1.4;

function FamilyConnectors({ links, nodes }) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const descendantByParent = new Map();
  const ancestorByChild = new Map();
  const passThrough = [];

  for (const link of links) {
    if (link.type === 'descendant' && link.from && link.to) {
      if (!descendantByParent.has(link.from)) descendantByParent.set(link.from, []);
      descendantByParent.get(link.from).push(link);
    } else if (link.type === 'ancestor' && link.from && link.to) {
      if (!ancestorByChild.has(link.to)) ancestorByChild.set(link.to, []);
      ancestorByChild.get(link.to).push(link);
    } else {
      passThrough.push(link);
    }
  }

  const buses = [];
  for (const [parentId, parentLinks] of descendantByParent) {
    const parent = nodeById.get(parentId);
    const children = parentLinks.map((link) => nodeById.get(link.to)).filter(Boolean);
    if (!parent || children.length === 0) continue;
    buses.push({ key: `dbus:${parentId}`, anchor: parent, others: children, descendant: true });
  }
  for (const [childId, ancestorLinks] of ancestorByChild) {
    const child = nodeById.get(childId);
    const parents = ancestorLinks.map((link) => nodeById.get(link.from)).filter(Boolean);
    if (!child || parents.length === 0) continue;
    buses.push({ key: `abus:${childId}`, anchor: child, others: parents, descendant: false });
  }

  return (
    <g>
      {buses.map((bus) => (
        <BusConnector key={bus.key} anchor={bus.anchor} others={bus.others} descendant={bus.descendant} />
      ))}
      {passThrough.map((link) => (
        <LinkLine key={link.key} link={link} nodes={nodes} />
      ))}
    </g>
  );
}

function BusConnector({ anchor, others, descendant }) {
  const anchorEdgeY = descendant ? anchor.y + CARD_H / 2 : anchor.y - CARD_H / 2;
  const otherY = others[0].y;
  const otherEdgeY = descendant ? otherY - CARD_H / 2 : otherY + CARD_H / 2;
  const busY = (anchorEdgeY + otherEdgeY) / 2;
  const xs = others.map((node) => node.x);
  const minX = Math.min(...xs, anchor.x);
  const maxX = Math.max(...xs, anchor.x);

  return (
    <g stroke={LINK_COLOR} strokeWidth={LINK_WIDTH} fill="none">
      <line x1={anchor.x} y1={anchorEdgeY} x2={anchor.x} y2={busY} />
      {Math.abs(maxX - minX) > 1 && (
        <line x1={minX} y1={busY} x2={maxX} y2={busY} />
      )}
      {others.map((other) => (
        <line key={other.id} x1={other.x} y1={busY} x2={other.x} y2={otherEdgeY} />
      ))}
    </g>
  );
}

function LinkLine({ link, nodes }) {
  const from = nodes.find((node) => node.id === link.from);
  const to = nodes.find((node) => node.id === link.to);
  if (!from || !to) return null;

  if (link.type === 'partner') {
    // Mac draws partner as a thin solid magenta line right between the two cards.
    return (
      <line
        x1={from.x + (to.x > from.x ? CARD_W / 2 : -CARD_W / 2)}
        y1={from.y}
        x2={to.x + (from.x > to.x ? CARD_W / 2 : -CARD_W / 2)}
        y2={to.y}
        stroke={LINK_COLOR}
        strokeWidth={LINK_WIDTH}
      />
    );
  }

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
      stroke={LINK_COLOR}
      strokeWidth={LINK_WIDTH}
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

// Mac source uses uniform pink across all generations with subtle saturation
// changes; mirror that here. The root band sits slightly more saturated.
function bandFill(generation) {
  if (generation === 0) return '#f4c6e0';
  const tiers = ['#fbdfee', '#f8d4e8', '#f5cae3', '#f1c0dd', '#edb6d8'];
  return tiers[Math.min(Math.abs(generation) - 1, tiers.length - 1)];
}

function bandStroke() {
  return '#dba2c0';
}

function bandTextColor(generation) {
  return generation === 0 ? '#9b3978' : '#7e3a64';
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
    // Reserve room for the zoom cluster (+/−/Fit ≈ 110px wide at inset 12px)
    // so the two bars never overlap on narrow screens.
    maxWidth: 'calc(100% - 148px)',
    overflowX: 'auto',
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
  backgroundSelect: {
    height: 24,
    borderRadius: 6,
    border: '1px solid hsl(var(--border))',
    background: 'hsl(var(--background))',
    color: 'hsl(var(--foreground))',
    font: '600 11px -apple-system, system-ui, sans-serif',
  },
  canvas: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    touchAction: 'none',
    background: '#f4f3ee',
    backgroundImage: 'radial-gradient(rgba(0,0,0,0.045) 1px, transparent 1px)',
    backgroundSize: '12px 12px',
    backgroundPosition: '0 0',
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
