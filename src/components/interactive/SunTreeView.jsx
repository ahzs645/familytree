import React, { useMemo, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { lifeSpanLabel } from '../../models/index.js';
import { buildSunTreeLayout, sunNodeClass } from './sunTreeLayout.js';
import { localizeNoName, noNameLabel } from '../../lib/personDisplayName.js';

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 14;
const BUTTON_ZOOM_STEP = 0.5;
const WHEEL_ZOOM_FACTOR = 1.16;

export function SunTreeView({ descendantTree, activeId, loading, onPick, onEditPerson, menu }) {
  const layout = useMemo(() => buildSunTreeLayout(descendantTree), [descendantTree]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  if (loading) return <div className={emptyStateClass}>Building family tree…</div>;
  if (!layout.nodes.length) return <div className={emptyStateClass}>No descendants found for this person.</div>;

  const viewBox = `${layout.bounds.minX - pan.x} ${layout.bounds.minY - pan.y} ${layout.bounds.width / zoom} ${layout.bounds.height / zoom}`;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f7f1e6]">
      {/* The sun tree is a fixed parchment scene; the overlay colors are chosen
          to match the SVG canvas, not the app theme tokens. */}
      <div className="pointer-events-none absolute left-1/2 top-2 z-[2] -translate-x-1/2 text-[13px] text-[#2e2a24] [font-family:Georgia,Times,serif]">
        Use scroll for zooming and drag & drop to move around.
      </div>
      <div className="absolute end-3.5 top-3.5 z-[2] flex items-center gap-1.5 rounded-md border border-[#d8d0c2] bg-[#f7f1e6]/90 p-1.5">
        <IconButton label="Zoom out" onClick={() => setZoom((value) => clampZoom(value - BUTTON_ZOOM_STEP))}>
          <Minus size={16} />
        </IconButton>
        <div className="min-w-11 text-center text-xs tabular-nums text-[#6b6257]">{Math.round(zoom * 100)}%</div>
        <IconButton label="Zoom in" onClick={() => setZoom((value) => clampZoom(value + BUTTON_ZOOM_STEP))}>
          <Plus size={16} />
        </IconButton>
        <IconButton label="Reset view" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
          <RotateCcw size={16} />
        </IconButton>
      </div>

      <svg
        role="img"
        aria-label="Radial family tree"
        className="block h-full w-full touch-none"
        viewBox={viewBox}
        onWheel={(event) => {
          event.preventDefault();
          setZoom((value) => clampZoom(event.deltaY > 0 ? value / WHEEL_ZOOM_FACTOR : value * WHEEL_ZOOM_FACTOR));
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { x: event.clientX, y: event.clientY, pan };
        }}
        onPointerMove={(event) => {
          if (!dragRef.current) return;
          const dx = (event.clientX - dragRef.current.x) / zoom;
          const dy = (event.clientY - dragRef.current.y) / zoom;
          setPan({ x: dragRef.current.pan.x - dx, y: dragRef.current.pan.y - dy });
        }}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }}
      >
        <defs>
          <clipPath id="sun-root-map-clip">
            <circle cx="0" cy="0" r="48" />
          </clipPath>
        </defs>
        <rect x={layout.bounds.minX - 1000} y={layout.bounds.minY - 1000} width={layout.bounds.width + 2000} height={layout.bounds.height + 2000} fill="#f7f1e6" />
        {layout.rings.map((ring) => (
          <circle key={ring.generation} cx="0" cy="0" r={ring.radius} fill="none" stroke="#cfc7b8" strokeWidth="1" strokeDasharray="2 5" opacity="0.72" />
        ))}
        {layout.links.map((link) => (
          <line
            key={`${link.type}-${link.from}-${link.to}`}
            x1={link.x1}
            y1={link.y1}
            x2={link.x2}
            y2={link.y2}
            stroke="#c7c0b3"
            strokeWidth={link.type === 'partner' ? 1.1 : 0.8}
            strokeDasharray={link.type === 'partner' ? '0' : '2 4'}
            opacity="0.82"
            strokeLinecap="round"
          />
        ))}
        {layout.nodes.map((node) => (
          <SunPersonNode
            key={node.id}
            node={node}
            active={node.id === activeId}
            onPick={onPick}
            menu={menu}
            onEditPerson={onEditPerson}
          />
        ))}
      </svg>
    </div>
  );
}

function SunPersonNode({ node, active, onPick, onEditPerson, menu }) {
  const className = sunNodeClass(node.person, node.kind);
  const fill = nodeFill(className);
  const dates = lifeSpanLabel(node.person);
  const name = compactName(node.person?.fullName).join(' ');
  const normalizedAngle = normalizeAngle(node.angle);
  const textLeft = normalizedAngle > Math.PI / 2 || normalizedAngle < -Math.PI / 2;
  const rotation = node.kind === 'root' ? 0 : normalizedAngle * 180 / Math.PI + (textLeft ? 180 : 0);
  const textX = textLeft ? -(node.radius + 6) : node.radius + 6;
  const textAnchor = textLeft ? 'end' : 'start';

  if (node.kind === 'root') {
    return (
      <g
        transform={`translate(${node.x} ${node.y})`}
        className="cursor-pointer"
        onClick={(event) => {
          event.stopPropagation();
          onPick?.(node.id);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onEditPerson?.(node.id);
        }}
        {...(menu?.handlersFor?.({ person: node.person }) || {})}
      >
        <image href={`${import.meta.env.BASE_URL}ftree/map_2x.png`} x="-96" y="-96" width="192" height="192" clipPath="url(#sun-root-map-clip)" opacity="0.98" />
        <circle r="48" fill="none" stroke="#f7f1e6" strokeWidth="3" />
        <text y="4" textAnchor="middle" fill="#1f2933" style={rootName}>{shortRootName(node.person?.fullName)}</text>
        {dates && <text y="18" textAnchor="middle" fill="#1f2933" style={rootDate}>{dates}</text>}
      </g>
    );
  }

  return (
    <g
      transform={`translate(${node.x} ${node.y}) rotate(${rotation})`}
      className="cursor-pointer"
      onClick={(event) => {
        event.stopPropagation();
        onPick?.(node.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onEditPerson?.(node.id);
      }}
      {...(menu?.handlersFor?.({ person: node.person }) || {})}
    >
      <circle
        r={node.radius}
        fill={fill}
        stroke={active ? '#6b5f4f' : nodeStroke(className)}
        strokeWidth={active ? 2.2 : className === 'unknown' ? 1.3 : 0}
        opacity={node.person?.deathDate ? 0.46 : 1}
      />
      <text x={textX} y={dates ? -2 : 3} textAnchor={textAnchor} fill="#3b3328" style={nodeName}>
        {name}
      </text>
      {dates && (
        <text x={textX} y={10} textAnchor={textAnchor} fill="#4d453a" style={dateText}>
          {dates}
        </text>
      )}
    </g>
  );
}

function IconButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-[#d8d0c2] bg-[#fbf7ee] text-[#3b3328]"
    >
      {children}
    </button>
  );
}

function compactName(value) {
  const parts = String(value ? localizeNoName(value) : noNameLabel()).trim().split(/\s+/);
  if (parts.length <= 2) return [parts.join(' ')];
  return [`${parts[0]} ${parts[1]}`];
}

function shortRootName(value) {
  return compactName(value).join(' ');
}

function normalizeAngle(angle) {
  let value = angle % (Math.PI * 2);
  if (value > Math.PI) value -= Math.PI * 2;
  if (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function nodeFill(className) {
  if (className === 'male') return '#8eb2bd';
  if (className === 'female') return '#e89096';
  return '#f7f1e6';
}

function nodeStroke(className) {
  if (className === 'male') return '#8eb2bd';
  if (className === 'female') return '#e89096';
  return '#8eb2bd';
}

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

const emptyStateClass = 'h-full flex items-center justify-center text-sm text-muted-foreground';
// SVG <text> styling below feeds the SVG scene renderer and intentionally stays inline.
const nodeName = { fontFamily: 'Arial, sans-serif', fontSize: 8, fontWeight: 500, letterSpacing: 0, pointerEvents: 'none', userSelect: 'none' };
const dateText = { fontFamily: 'Arial, sans-serif', fontSize: 6, fontWeight: 400, pointerEvents: 'none', userSelect: 'none' };
const rootName = { fontFamily: 'Arial, sans-serif', fontSize: 8, fontWeight: 700, pointerEvents: 'none', userSelect: 'none' };
const rootDate = { fontFamily: 'Arial, sans-serif', fontSize: 6, fontWeight: 600, pointerEvents: 'none', userSelect: 'none' };

export default SunTreeView;
