import React, { useMemo } from 'react';
import { ChartCanvas } from './ChartCanvas.jsx';
import { PersonNode } from './PersonNode.jsx';
import { DEFAULT_THEME } from './theme.js';
import { layoutDescendants } from './layouts/descendantLayout.js';

const NODE_PAD_X = 90;
const ROW_HEIGHT = 86;

function parseYear(value) {
  const match = String(value || '').match(/(\d{4})/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function collectAncestors(tree, maxGenerations = 6) {
  const nodes = [];
  const links = [];
  function visit(node, generation, slot, key, parentKey) {
    if (!node || generation > maxGenerations) return;
    nodes.push({ key, person: node.person, generation, slot, placeholder: !node.person });
    if (parentKey) links.push({ from: parentKey, to: key });
    visit(node.father, generation + 1, slot * 2, `${key}F`, key);
    visit(node.mother, generation + 1, slot * 2 + 1, `${key}M`, key);
  }
  visit(tree, 0, 0, 'root', null);
  return { nodes, links };
}

function collectDescendantPersons(tree, out = [], seen = new Set()) {
  if (!tree?.person || seen.has(tree.person.recordName)) return out;
  seen.add(tree.person.recordName);
  out.push({ ...tree.person, generation: tree.generation || 0 });
  for (const union of tree.unions || []) {
    if (union.partner && !seen.has(union.partner.recordName)) {
      seen.add(union.partner.recordName);
      out.push({ ...union.partner, generation: tree.generation || 0, partner: true });
    }
    for (const child of union.children || []) collectDescendantPersons(child, out, seen);
  }
  return out;
}

export function CircularAncestorChart({ tree, generations = 5, onPersonClick, theme = DEFAULT_THEME, page, overlays, onOverlaysChange }) {
  const layout = useMemo(() => {
    const { nodes, links } = collectAncestors(tree, generations);
    const cx = 720;
    const cy = 480;
    const radiusStep = 155;
    const positioned = new Map();
    for (const node of nodes) {
      if (node.generation === 0) {
        positioned.set(node.key, { ...node, x: cx - theme.nodeWidth / 2, y: cy - theme.nodeHeight / 2 });
        continue;
      }
      const slots = 2 ** node.generation;
      const angle = -Math.PI / 2 + ((node.slot + 0.5) / slots) * Math.PI * 2;
      const radius = node.generation * radiusStep;
      positioned.set(node.key, {
        ...node,
        x: cx + Math.cos(angle) * radius - theme.nodeWidth / 2,
        y: cy + Math.sin(angle) * radius - theme.nodeHeight / 2,
      });
    }
    return { nodes: [...positioned.values()], links: links.map((link) => ({ from: positioned.get(link.from), to: positioned.get(link.to) })).filter((link) => link.from && link.to) };
  }, [tree, generations, theme]);

  if (!tree) return <div style={{ padding: 24, color: theme.textMuted }}>No person selected.</div>;
  return (
    <ChartCanvas theme={theme} page={page} overlays={overlays} onOverlaysChange={onOverlaysChange}>
      {layout.links.map((link, i) => (
        <line key={i} x1={link.from.x + theme.nodeWidth / 2} y1={link.from.y + theme.nodeHeight / 2} x2={link.to.x + theme.nodeWidth / 2} y2={link.to.y + theme.nodeHeight / 2} stroke={theme.connector} strokeWidth={theme.connectorWidth} />
      ))}
      {layout.nodes.map((node) => (
        <PersonNode key={node.key} x={node.x} y={node.y} person={node.person} placeholder={node.placeholder} theme={theme} onClick={onPersonClick} />
      ))}
    </ChartCanvas>
  );
}

export function DistributionChart({ persons = [], theme = DEFAULT_THEME, page, overlays, onOverlaysChange }) {
  const bars = useMemo(() => {
    const counts = new Map();
    for (const person of persons) {
      const year = parseYear(person.birthDate);
      if (!year) continue;
      const century = Math.floor((year - 1) / 100) + 1;
      counts.set(century, (counts.get(century) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([century, count]) => ({ label: `${century}th`, count }));
  }, [persons]);
  const max = Math.max(1, ...bars.map((bar) => bar.count));
  return (
    <ChartCanvas theme={theme} page={page} overlays={overlays} onOverlaysChange={onOverlaysChange}>
      <g transform="translate(80,110)">
        <text x={0} y={-32} fill={theme.text} fontSize={18} fontWeight={700} fontFamily={theme.fontFamily}>Birth Distribution</text>
        {bars.map((bar, index) => {
          const width = (bar.count / max) * 720;
          const y = index * 34;
          return (
            <g key={bar.label} transform={`translate(0,${y})`}>
              <text x={0} y={18} fill={theme.textMuted} fontSize={12} fontFamily={theme.fontFamily}>{bar.label}</text>
              <rect x={70} y={2} width={width} height={22} fill={theme.gender[index % 4]?.fill || '#7aa2ff'} stroke={theme.gender[index % 4]?.stroke || theme.connector} rx={4} />
              <text x={80 + width} y={18} fill={theme.text} fontSize={12} fontFamily={theme.fontFamily}>{bar.count}</text>
            </g>
          );
        })}
      </g>
    </ChartCanvas>
  );
}

export function TimelineChart({ ancestorTree, descendantTree, theme = DEFAULT_THEME, page, overlays, onOverlaysChange }) {
  const rows = useMemo(() => {
    const map = new Map();
    for (const node of collectAncestors(ancestorTree, 6).nodes) if (node.person) map.set(node.person.recordName, node.person);
    for (const person of collectDescendantPersons(descendantTree)) map.set(person.recordName, person);
    return [...map.values()]
      .map((person) => ({ person, birth: parseYear(person.birthDate), death: parseYear(person.deathDate) }))
      .filter((row) => row.birth || row.death)
      .sort((a, b) => (a.birth || 9999) - (b.birth || 9999))
      .slice(0, 80);
  }, [ancestorTree, descendantTree]);
  const min = Math.min(...rows.map((row) => row.birth || row.death), new Date().getFullYear());
  const max = Math.max(...rows.map((row) => row.death || row.birth), min + 1);
  const scale = (year) => 220 + ((year - min) / Math.max(1, max - min)) * 760;
  return (
    <ChartCanvas theme={theme} page={page} overlays={overlays} onOverlaysChange={onOverlaysChange}>
      <g transform="translate(30,90)">
        <text x={190} y={-28} fill={theme.textMuted} fontSize={12} fontFamily={theme.fontFamily}>{min} - {max}</text>
        {rows.map((row, index) => {
          const y = index * 30;
          const start = row.birth || row.death;
          const end = row.death || Math.min(max, new Date().getFullYear());
          return (
            <g key={row.person.recordName} transform={`translate(0,${y})`}>
              <text x={0} y={17} fill={theme.text} fontSize={12} fontFamily={theme.fontFamily}>{row.person.fullName}</text>
              <line x1={scale(start)} y1={12} x2={scale(end)} y2={12} stroke={theme.gender[row.person.gender ?? 0]?.stroke || theme.connector} strokeWidth={8} strokeLinecap="round" />
              <text x={scale(end) + 8} y={16} fill={theme.textMuted} fontSize={11} fontFamily={theme.fontFamily}>{start}{row.death ? `-${row.death}` : ''}</text>
            </g>
          );
        })}
      </g>
    </ChartCanvas>
  );
}

export function GenogramChart({ tree, onPersonClick, theme = DEFAULT_THEME, page, sociogram = false, overlays, onOverlaysChange }) {
  const layout = useMemo(() => layoutDescendants(tree, theme), [tree, theme]);
  if (!tree) return <div style={{ padding: 24, color: theme.textMuted }}>No person selected.</div>;
  return (
    <ChartCanvas theme={theme} page={page} overlays={overlays} onOverlaysChange={onOverlaysChange}>
      <g transform="translate(40,80)">
        {layout.links.map((link, index) => (
          <path key={index} d={link.d} fill="none" stroke={sociogram ? '#d08c60' : theme.connector} strokeWidth={sociogram ? 2.4 : theme.connectorWidth} strokeDasharray={sociogram ? '6 4' : 'none'} />
        ))}
        {layout.nodes.map((node, index) => (
          <g key={`${node.id}-${index}`}>
            <PersonNode x={node.x} y={node.y} person={node.person} placeholder={node.placeholder} theme={theme} onClick={onPersonClick} />
            {sociogram && !node.placeholder && (
              <circle cx={node.x + theme.nodeWidth - 14} cy={node.y + 14} r={5} fill="#d08c60" />
            )}
          </g>
        ))}
      </g>
    </ChartCanvas>
  );
}

export function FractalAncestorChart({ tree, generations = 5, onPersonClick, theme = DEFAULT_THEME, page, variant = 'fractal', overlays, onOverlaysChange }) {
  const layout = useMemo(() => {
    const nodes = [];
    const links = [];
    function visit(node, x, y, spread, depth, key) {
      if (!node || depth > generations) return;
      nodes.push({ key, x, y, person: node.person, placeholder: !node.person });
      const nextSpread = Math.max(90, spread * 0.56);
      const dy = variant === 'h-tree' ? 118 : variant === 'square' ? 96 : 132;
      const left = { x: x + (variant === 'square' ? 0 : spread), y: y + dy };
      const right = { x: x + (variant === 'square' ? spread : -spread), y: y + dy };
      if (node.father) {
        links.push({ from: { x, y }, to: left });
        visit(node.father, left.x, left.y, nextSpread, depth + 1, `${key}F`);
      }
      if (node.mother) {
        links.push({ from: { x, y }, to: right });
        visit(node.mother, right.x, right.y, nextSpread, depth + 1, `${key}M`);
      }
    }
    visit(tree, 560, 90, 280, 0, 'root');
    return { nodes, links };
  }, [tree, generations, variant]);
  if (!tree) return <div style={{ padding: 24, color: theme.textMuted }}>No person selected.</div>;
  return (
    <ChartCanvas theme={theme} page={page} overlays={overlays} onOverlaysChange={onOverlaysChange}>
      {layout.links.map((link, index) => (
        <path key={index} d={`M ${link.from.x + theme.nodeWidth / 2} ${link.from.y + theme.nodeHeight} L ${link.to.x + theme.nodeWidth / 2} ${link.to.y}`} fill="none" stroke={theme.connector} strokeWidth={theme.connectorWidth} />
      ))}
      {layout.nodes.map((node) => (
        <PersonNode key={node.key} x={node.x} y={node.y} person={node.person} placeholder={node.placeholder} theme={theme} onClick={onPersonClick} />
      ))}
    </ChartCanvas>
  );
}
