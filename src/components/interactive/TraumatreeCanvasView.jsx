import React, { useMemo, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw, Scan } from 'lucide-react';
import { Gender, lifeSpanLabel } from '../../models/index.js';

const NODE_WIDTH = 184;
const NODE_HEIGHT = 82;
const GENERATION_GAP = 154;
const COLUMN_GAP = 76;
const PADDING = 96;

export function TraumatreeCanvasView({ graph, activeId, loading, onPick, onEditPerson, onOpenFamily }) {
  const layout = useMemo(() => buildCanvasLayout(graph), [graph]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  if (loading) return <div style={emptyState}>Building family tree canvas...</div>;
  if (!layout.nodes.length) return <div style={emptyState}>No connected family graph found for this person.</div>;

  const viewBox = `${layout.bounds.minX - pan.x} ${layout.bounds.minY - pan.y} ${layout.bounds.width / zoom} ${layout.bounds.height / zoom}`;

  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div style={shell}>
      <div style={controls}>
        <IconButton label="Zoom out" onClick={() => setZoom((value) => Math.max(0.55, value - 0.15))}>
          <Minus size={16} />
        </IconButton>
        <div style={zoomLabel}>{Math.round(zoom * 100)}%</div>
        <IconButton label="Zoom in" onClick={() => setZoom((value) => Math.min(2.4, value + 0.15))}>
          <Plus size={16} />
        </IconButton>
        <IconButton label="Reset view" onClick={reset}>
          <RotateCcw size={16} />
        </IconButton>
        <IconButton label="Fit family" onClick={reset}>
          <Scan size={16} />
        </IconButton>
      </div>
      <svg
        role="img"
        aria-label="Traumatrees style family tree canvas"
        style={svg}
        viewBox={viewBox}
        onWheel={(event) => {
          event.preventDefault();
          setZoom((value) => Math.min(2.4, Math.max(0.55, value + (event.deltaY > 0 ? -0.08 : 0.08))));
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
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
      >
        <defs>
          <pattern id="traumatree-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#dfd6c8" strokeWidth="0.8" opacity="0.55" />
          </pattern>
          <filter id="traumatree-node-shadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#2f271f" floodOpacity="0.12" />
          </filter>
        </defs>
        <rect
          x={layout.bounds.minX - 1200}
          y={layout.bounds.minY - 1200}
          width={layout.bounds.width + 2400}
          height={layout.bounds.height + 2400}
          fill="#f7f1e6"
        />
        <rect
          x={layout.bounds.minX - 1200}
          y={layout.bounds.minY - 1200}
          width={layout.bounds.width + 2400}
          height={layout.bounds.height + 2400}
          fill="url(#traumatree-grid)"
        />
        {layout.generations.map((generation) => (
          <text
            key={generation.value}
            x={layout.bounds.minX + 24}
            y={generation.y - 54}
            style={generationLabel}
            fill="#8a7d6c"
          >
            {generation.label}
          </text>
        ))}
        {layout.groups.map((group) => (
          <g key={group.id} aria-label={`${group.name} group`}>
            <rect
              x={group.x}
              y={group.y}
              width={group.width}
              height={group.height}
              rx="14"
              fill={group.fill}
              stroke={group.stroke}
              strokeWidth="1.2"
              strokeDasharray="7 6"
              opacity="0.78"
            />
            <text x={group.x + 14} y={group.y + 22} style={groupLabel} fill={group.text}>
              {truncate(group.name, 34)}
            </text>
          </g>
        ))}
        {layout.edges.map((edge) => (
          <path
            key={edge.id}
            d={edge.path}
            fill="none"
            stroke={edge.kind === 'partner' ? '#8d7f6c' : '#b4a894'}
            strokeWidth={edge.kind === 'partner' ? 2 : 1.4}
            strokeDasharray={edge.kind === 'partner' ? '0' : edge.relationKind === 'secondary' ? '4 7' : '0'}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={edge.relationKind === 'secondary' ? 0.72 : 0.88}
            onDoubleClick={(event) => {
              event.stopPropagation();
              if (edge.familyId) onOpenFamily?.(edge.familyId);
            }}
            style={{ cursor: edge.familyId ? 'pointer' : 'default' }}
          />
        ))}
        {layout.nodes.map((node) => (
          <CanvasPersonNode
            key={node.id}
            node={node}
            active={node.id === activeId}
            onPick={onPick}
            onEditPerson={onEditPerson}
          />
        ))}
      </svg>
    </div>
  );
}

function CanvasPersonNode({ node, active, onPick, onEditPerson }) {
  const person = node.person;
  const dates = lifeSpanLabel(person);
  const color = nodeColor(person?.gender);
  const status = node.featured ? 'Focus person' : roleLabel(node.roles);
  const duplicateRisk = node.status?.duplicateRisk;

  return (
    <g
      transform={`translate(${node.x} ${node.y})`}
      style={{ cursor: 'pointer' }}
      onClick={(event) => {
        event.stopPropagation();
        onPick?.(node.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onEditPerson?.(node.id);
      }}
    >
      <rect
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx="8"
        fill="#fffaf2"
        stroke={active ? '#5f8ea3' : '#d7cabb'}
        strokeWidth={active ? 2.5 : 1.4}
        filter="url(#traumatree-node-shadow)"
      />
      <rect width={NODE_WIDTH} height="4" rx="2" fill={color.accent} />
      <circle cx="22" cy="28" r="12" fill={color.soft} stroke={color.accent} strokeWidth="1.5" />
      <text x="22" y="32" textAnchor="middle" style={initialText} fill={color.text}>
        {initials(person?.fullName)}
      </text>
      <text x="43" y="27" style={nameText} fill="#2f2a24">
        {truncate(person?.fullName || 'No name recorded', 22)}
      </text>
      {dates && (
        <text x="43" y="44" style={dateText} fill="#756a5b">
          {truncate(dates, 26)}
        </text>
      )}
      <line x1="12" y1="56" x2={NODE_WIDTH - 12} y2="56" stroke="#eadfce" />
      <text x="12" y="72" style={metaText} fill="#746858">
        {status}
      </text>
      {duplicateRisk && duplicateRisk !== 'Low' && (
        <g transform={`translate(${NODE_WIDTH - 58} 61)`}>
          <rect width="46" height="14" rx="7" fill="#f0d7c4" />
          <text x="23" y="10" textAnchor="middle" style={badgeText} fill="#6e3c21">
            {duplicateRisk}
          </text>
        </g>
      )}
    </g>
  );
}

function buildCanvasLayout(graph) {
  if (!graph?.nodes?.length) return { nodes: [], edges: [], groups: [], generations: [], bounds: defaultBounds() };

  const rows = new Map();
  for (const node of graph.nodes) {
    const generation = Number.isFinite(node.generation) ? node.generation : 0;
    if (!rows.has(generation)) rows.set(generation, []);
    rows.get(generation).push(node);
  }

  const generations = [...rows.keys()].sort((a, b) => a - b);
  const minGeneration = generations[0] ?? 0;
  const positioned = [];
  const nodeById = new Map();

  for (const generation of generations) {
    const row = rows.get(generation).sort(compareGraphNodes(graph.rootId));
    const rowWidth = row.length * NODE_WIDTH + Math.max(0, row.length - 1) * COLUMN_GAP;
    const startX = -rowWidth / 2;
    const y = (generation - minGeneration) * GENERATION_GAP;
    row.forEach((node, index) => {
      const positionedNode = {
        ...node,
        x: startX + index * (NODE_WIDTH + COLUMN_GAP),
        y,
      };
      positioned.push(positionedNode);
      nodeById.set(positionedNode.id, positionedNode);
    });
  }

  const groups = buildGroupBoxes(positioned);
  const edges = [];
  const edgeKeys = new Set();
  for (const family of graph.families || []) {
    const parents = (family.parents || []).map((id) => nodeById.get(id)).filter(Boolean);
    const children = (family.children || []).map((id) => nodeById.get(id)).filter(Boolean);
    if (parents.length >= 2) {
      const [a, b] = parents.slice().sort((left, right) => left.x - right.x);
      addEdge(edges, edgeKeys, {
        id: `partner-${family.id}-${a.id}-${b.id}`,
        familyId: family.id,
        kind: 'partner',
        path: `M ${a.x + NODE_WIDTH} ${a.y + NODE_HEIGHT / 2} C ${a.x + NODE_WIDTH + 28} ${a.y + NODE_HEIGHT / 2}, ${b.x - 28} ${b.y + NODE_HEIGHT / 2}, ${b.x} ${b.y + NODE_HEIGHT / 2}`,
      });
    }

    const parentCenter = parents.length
      ? averagePoint(parents.map((parent) => ({ x: parent.x + NODE_WIDTH / 2, y: parent.y + NODE_HEIGHT })))
      : null;
    if (!parentCenter) continue;
    for (const child of children) {
      const relation = family.childRelations?.[child.id] || {};
      addEdge(edges, edgeKeys, {
        id: `child-${family.id}-${child.id}`,
        familyId: family.id,
        kind: 'child',
        relationKind: relation.kind || 'primary',
        relationLabel: relation.label || '',
        path: elbowPath(parentCenter.x, parentCenter.y, child.x + NODE_WIDTH / 2, child.y),
      });
    }
  }

  return {
    nodes: positioned,
    edges,
    groups,
    generations: generations.map((value) => ({
      value,
      y: (value - minGeneration) * GENERATION_GAP,
      label: value < 0 ? `Generation ${Math.abs(value)} up` : value === 0 ? 'Focus generation' : `Generation ${value} down`,
    })),
    bounds: computeBounds(positioned),
  };
}

function compareGraphNodes(rootId) {
  return (a, b) => {
    if (a.id === rootId) return -1;
    if (b.id === rootId) return 1;
    const aBranch = branchWeight(a);
    const bBranch = branchWeight(b);
    if (aBranch !== bBranch) return aBranch - bBranch;
    return String(a.person?.fullName || '').localeCompare(String(b.person?.fullName || ''));
  };
}

function buildGroupBoxes(nodes) {
  const grouped = new Map();
  for (const node of nodes) {
    for (const group of node.groups || []) {
      if (!group?.id || !group?.name) continue;
      if (!grouped.has(group.id)) grouped.set(group.id, { ...group, nodes: [] });
      grouped.get(group.id).nodes.push(node);
    }
  }
  return [...grouped.values()]
    .filter((group) => group.nodes.length >= 2)
    .slice(0, 8)
    .map((group, index) => {
      const minX = Math.min(...group.nodes.map((node) => node.x)) - 32;
      const maxX = Math.max(...group.nodes.map((node) => node.x + NODE_WIDTH)) + 32;
      const minY = Math.min(...group.nodes.map((node) => node.y)) - 42;
      const maxY = Math.max(...group.nodes.map((node) => node.y + NODE_HEIGHT)) + 28;
      return {
        id: group.id,
        name: group.name,
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        ...groupColor(index),
      };
    });
}

function groupColor(index) {
  const colors = [
    { fill: '#e9f3f5', stroke: '#84a8b2', text: '#426b75' },
    { fill: '#f4eadb', stroke: '#c2a474', text: '#705a34' },
    { fill: '#edf0df', stroke: '#9cab6e', text: '#5e6a37' },
    { fill: '#f5e8e4', stroke: '#c69482', text: '#744d41' },
  ];
  return colors[index % colors.length];
}

function branchWeight(node) {
  if (node.featured) return -2;
  if (node.branches?.includes('paternal')) return -1;
  if (node.branches?.includes('maternal')) return 1;
  return 0;
}

function addEdge(edges, edgeKeys, edge) {
  if (edgeKeys.has(edge.id)) return;
  edgeKeys.add(edge.id);
  edges.push(edge);
}

function averagePoint(points) {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function elbowPath(x1, y1, x2, y2) {
  const midY = y1 + Math.max(34, (y2 - y1) / 2);
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

function computeBounds(nodes) {
  if (!nodes.length) return defaultBounds();
  const minX = Math.min(...nodes.map((node) => node.x)) - PADDING;
  const maxX = Math.max(...nodes.map((node) => node.x + NODE_WIDTH)) + PADDING;
  const minY = Math.min(...nodes.map((node) => node.y)) - PADDING;
  const maxY = Math.max(...nodes.map((node) => node.y + NODE_HEIGHT)) + PADDING;
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

function defaultBounds() {
  return { minX: -320, minY: -220, width: 640, height: 440 };
}

function IconButton({ label, onClick, children }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} style={iconButton}>
      {children}
    </button>
  );
}

function nodeColor(gender) {
  if (gender === Gender.Male) return { accent: '#6f9cac', soft: '#d8edf2', text: '#245464' };
  if (gender === Gender.Female) return { accent: '#c8848a', soft: '#f5dcdf', text: '#703b42' };
  return { accent: '#b39b70', soft: '#efe4cf', text: '#5f5038' };
}

function roleLabel(roles = []) {
  if (roles.includes('descendant')) return 'Descendant';
  if (roles.includes('collateral')) return 'Collateral relative';
  if (roles.some((role) => role.includes('parent'))) return 'Ancestor';
  if (roles.includes('partner-family')) return 'Partner family';
  return 'Relative';
}

function initials(value) {
  const parts = String(value || '?').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
}

function truncate(value, maxLength) {
  const text = String(value || '');
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

const shell = { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f7f1e6' };
const svg = { display: 'block', width: '100%', height: '100%', touchAction: 'none' };
const controls = {
  position: 'absolute',
  zIndex: 2,
  top: 14,
  right: 14,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: 6,
  borderRadius: 8,
  border: '1px solid #d8d0c2',
  background: 'rgb(255 250 242 / 0.92)',
  boxShadow: '0 10px 24px rgb(47 39 31 / 0.12)',
};
const iconButton = {
  width: 32,
  height: 32,
  borderRadius: 6,
  border: '1px solid #d8d0c2',
  background: '#fffaf2',
  color: '#3b3328',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};
const zoomLabel = { minWidth: 44, textAlign: 'center', color: '#6b6257', fontSize: 12, fontVariantNumeric: 'tabular-nums' };
const emptyState = { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--muted-foreground))', fontSize: 13 };
const generationLabel = { fontFamily: 'Arial, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: 0, textTransform: 'uppercase', userSelect: 'none' };
const initialText = { fontFamily: 'Arial, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: 0, pointerEvents: 'none', userSelect: 'none' };
const nameText = { fontFamily: 'Arial, sans-serif', fontSize: 13, fontWeight: 700, letterSpacing: 0, pointerEvents: 'none', userSelect: 'none' };
const dateText = { fontFamily: 'Arial, sans-serif', fontSize: 11, fontWeight: 500, pointerEvents: 'none', userSelect: 'none' };
const metaText = { fontFamily: 'Arial, sans-serif', fontSize: 11, fontWeight: 600, pointerEvents: 'none', userSelect: 'none' };
const badgeText = { fontFamily: 'Arial, sans-serif', fontSize: 9, fontWeight: 700, pointerEvents: 'none', userSelect: 'none' };
const groupLabel = { fontFamily: 'Arial, sans-serif', fontSize: 12, fontWeight: 800, letterSpacing: 0, pointerEvents: 'none', userSelect: 'none' };

export default TraumatreeCanvasView;
