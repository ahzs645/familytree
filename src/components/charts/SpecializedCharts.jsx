import React, { useMemo, useState } from 'react';
import { ChartCanvas } from './ChartCanvas.jsx';
import { PersonNode } from './PersonNode.jsx';
import { DEFAULT_THEME } from './theme.js';
import { layoutDescendants } from './layouts/descendantLayout.js';

const NODE_PAD_X = 90;
const ROW_HEIGHT = 86;

const GENDER_LABELS = { 0: 'Male', 1: 'Female', 2: 'Unknown', 3: 'Intersex' };

const DISTRIBUTION_CATEGORIES = [
  {
    id: 'lastNames',
    title: 'Distribution of Last Names',
    description: 'Usage of the Last Names in your family tree by year.',
    sidebarTitle: 'Last Names',
    extract: (p) => (p.lastName || '').trim() || null,
  },
  {
    id: 'firstNames',
    title: 'Distribution of First Names',
    description: 'Usage of the First Names in your family tree by year.',
    sidebarTitle: 'First Names',
    extract: (p) => (p.firstName || '').trim() || null,
  },
  {
    id: 'genders',
    title: 'Distribution of Genders',
    description: 'Distribution of Genders in your family tree by year.',
    sidebarTitle: 'Genders',
    extract: (p) => GENDER_LABELS[p.gender ?? 2] || 'Unknown',
  },
  {
    id: 'birthPlaces',
    title: 'Distribution of Birth Places',
    description: 'The Places of Birth in your family tree showing where persons were born.',
    sidebarTitle: 'Birth Places',
    extract: (p) => (p.birthPlace || '').split(',')[0]?.trim() || null,
  },
  {
    id: 'birthCountries',
    title: 'Distribution of Birth Countries',
    description: 'The Countries of Birth in your family tree showing where persons were born.',
    sidebarTitle: 'Birth Countries',
    extract: (p) => {
      const parts = (p.birthPlace || '').split(',').map((s) => s.trim()).filter(Boolean);
      return parts.length ? parts[parts.length - 1] : null;
    },
  },
  {
    id: 'deathPlaces',
    title: 'Distribution of Death Places',
    description: 'The Places of Death in your family tree showing where persons died.',
    sidebarTitle: 'Death Places',
    extract: (p) => (p.deathPlace || '').split(',')[0]?.trim() || null,
  },
];

function normalizeYear(value) {
  if (!value) return null;
  if (typeof value === 'number') return value;
  const match = String(value).match(/(\d{4})/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function parseYear(value) {
  const match = String(value || '').match(/(\d{4})/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function collectAncestors(tree, maxGenerations = 6) {
  const nodes = [];
  const links = [];
  function visit(node, generation, slot, key, parentKey) {
    if (generation >= maxGenerations) return;
    const person = node?.person || null;
    nodes.push({ key, person, generation, slot, placeholder: !person });
    if (parentKey) links.push({ from: parentKey, to: key });
    visit(node?.father || null, generation + 1, slot * 2, `${key}F`, key);
    visit(node?.mother || null, generation + 1, slot * 2 + 1, `${key}M`, key);
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

export function CircularAncestorChart({ tree, generations = 5, onPersonClick, theme = DEFAULT_THEME, page, overlays, onOverlaysChange, chartCanvasRef, ...overlayProps }) {
  const layout = useMemo(() => {
    const { nodes, links } = collectAncestors(tree, generations);
    const cx = 720;
    const cy = 480;
    // Size the rings so the outermost generation's nodes don't touch each other.
    const outerSlots = Math.pow(2, Math.max(1, generations - 1));
    const requiredOuter = (theme.nodeWidth + 20) / (2 * Math.sin(Math.PI / outerSlots));
    const radiusStep = Math.max(140, requiredOuter / Math.max(1, generations - 1));
    const positioned = new Map();
    for (const node of nodes) {
      if (node.generation === 0) {
        positioned.set(node.key, {
          ...node,
          x: cx - theme.nodeWidth / 2,
          y: cy - theme.nodeHeight / 2,
          angle: 0,
          radius: 0,
        });
        continue;
      }
      // Full 360° split so father's line fills the top half and mother's fills
      // the bottom half: slot 0 at 12 o'clock, slots advance clockwise.
      const slots = 2 ** node.generation;
      const sliceArc = (Math.PI * 2) / slots;
      const angle = -Math.PI + (node.slot + 0.5) * sliceArc;
      const radius = node.generation * radiusStep;
      positioned.set(node.key, {
        ...node,
        angle,
        radius,
        x: cx + Math.cos(angle) * radius - theme.nodeWidth / 2,
        y: cy + Math.sin(angle) * radius - theme.nodeHeight / 2,
      });
    }
    const positionedLinks = links
      .map((link) => ({ from: positioned.get(link.from), to: positioned.get(link.to) }))
      .filter((link) => link.from && link.to);
    return { nodes: [...positioned.values()], links: positionedLinks, cx, cy };
  }, [tree, generations, theme]);

  if (!tree) return <div style={{ padding: 24, color: theme.textMuted }}>No person selected.</div>;
  return (
    <ChartCanvas
      ref={chartCanvasRef}
      theme={theme}
      page={page}
      overlays={overlays}
      onOverlaysChange={onOverlaysChange}
      {...overlayProps}
    >
      {layout.links.map((link, i) => (
        <line
          key={i}
          x1={link.from.x + theme.nodeWidth / 2}
          y1={link.from.y + theme.nodeHeight / 2}
          x2={link.to.x + theme.nodeWidth / 2}
          y2={link.to.y + theme.nodeHeight / 2}
          stroke={theme.connector}
          strokeWidth={theme.connectorWidth}
        />
      ))}
      {layout.nodes.map((node) => (
        <PersonNode key={node.key} x={node.x} y={node.y} person={node.person} placeholder={node.placeholder} theme={theme} onClick={onPersonClick} />
      ))}
    </ChartCanvas>
  );
}

function ribbonColor(index) {
  const palette = [
    '#2dd4bf', '#38bdf8', '#818cf8', '#a855f7', '#ec4899', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#6366f1', '#d946ef', '#ef4444',
    '#f59e0b', '#84cc16', '#10b981', '#0ea5e9',
  ];
  return palette[index % palette.length];
}

function buildRibbons(persons, category) {
  const current = new Date().getFullYear();
  const bucket = new Map();
  for (const person of persons) {
    const value = category.extract(person);
    if (!value) continue;
    const birth = normalizeYear(person.birthDate);
    const death = normalizeYear(person.deathDate);
    if (!birth && !death) continue;
    const start = birth ?? death;
    const end = death ?? current;
    const entry = bucket.get(value) || { value, min: Infinity, max: -Infinity, count: 0 };
    entry.min = Math.min(entry.min, start);
    entry.max = Math.max(entry.max, end);
    entry.count += 1;
    bucket.set(value, entry);
  }
  return [...bucket.values()]
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, 16);
}

export function DistributionChart({ persons = [], distributionData, theme = DEFAULT_THEME, page, overlays, onOverlaysChange, chartCanvasRef, ...overlayProps }) {
  const [categoryId, setCategoryId] = useState(DISTRIBUTION_CATEGORIES[0].id);
  const category = DISTRIBUTION_CATEGORIES.find((c) => c.id === categoryId) || DISTRIBUTION_CATEGORIES[0];

  // When a caller supplies `distributionData` from `buildDistributionData`
  // (src/lib/chartData/distributionBuilder.js) we prefer its record-backed
  // buckets + year ranges; this unlocks fact-based categories (occupation,
  // illness, eye color, etc.) that the tree-derived path can't compute.
  // The builder's per-bucket minYear/maxYear map straight to ribbon min/max.
  const ribbons = useMemo(() => {
    if (Array.isArray(distributionData?.items) && distributionData.items.length > 0) {
      return distributionData.items
        .filter((item) => item.minYear != null && item.maxYear != null)
        .map((item) => ({ value: item.label, min: item.minYear, max: item.maxYear, count: item.count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
        .slice(0, 16);
    }
    return buildRibbons(persons, category);
  }, [persons, category, distributionData]);

  const current = new Date().getFullYear();
  const minYear = ribbons.length ? Math.floor(Math.min(...ribbons.map((r) => r.min)) / 25) * 25 : 1900;
  const maxYear = ribbons.length ? Math.ceil(Math.max(...ribbons.map((r) => r.max), current) / 25) * 25 : current;
  const chartWidth = 960;
  const chartHeight = 540;
  const axisX = 90;
  const plotTop = 110;
  const plotBottom = plotTop + chartHeight;
  const plotLeft = axisX + 40;
  const plotRight = chartWidth + 40;
  const plotWidth = plotRight - plotLeft;
  const yearToY = (y) => plotBottom - ((y - minYear) / Math.max(1, maxYear - minYear)) * (plotBottom - plotTop);
  const gridYears = [];
  for (let y = minYear; y <= maxYear; y += 25) gridYears.push(y);
  const ribbonSlot = ribbons.length ? plotWidth / ribbons.length : 0;
  const ribbonWidth = Math.min(28, Math.max(10, ribbonSlot * 0.45));

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <ChartCanvas
          ref={chartCanvasRef}
          theme={theme}
          page={page}
          overlays={overlays}
          onOverlaysChange={onOverlaysChange}
          {...overlayProps}
        >
          <g>
            <text x={plotLeft + plotWidth / 2} y={50} textAnchor="middle" fill={theme.text} fontSize={24} fontWeight={700} fontFamily={theme.fontFamily}>{category.title}</text>
            <text x={plotLeft + plotWidth / 2} y={74} textAnchor="middle" fill={theme.textMuted} fontSize={12} fontFamily={theme.fontFamily}>{persons.length} people</text>

            {gridYears.map((y) => (
              <g key={y}>
                <line x1={plotLeft} y1={yearToY(y)} x2={plotRight} y2={yearToY(y)} stroke={theme.connector} strokeWidth={0.5} opacity={0.4} />
                <text x={axisX} y={yearToY(y) + 4} textAnchor="end" fill={theme.textMuted} fontSize={11} fontFamily={theme.fontFamily}>{y}</text>
              </g>
            ))}

            {ribbons.map((r, i) => {
              const cx = plotLeft + ribbonSlot * (i + 0.5);
              const yTop = yearToY(r.max);
              const yBottom = yearToY(r.min);
              const color = ribbonColor(i);
              return (
                <g key={r.value}>
                  <rect
                    x={cx - ribbonWidth / 2}
                    y={yTop}
                    width={ribbonWidth}
                    height={Math.max(4, yBottom - yTop)}
                    rx={ribbonWidth / 2}
                    fill={color}
                    opacity={0.9}
                  />
                  <text
                    x={cx}
                    y={plotBottom + 18}
                    textAnchor="middle"
                    fill={theme.text}
                    fontSize={11}
                    fontFamily={theme.fontFamily}
                    transform={`rotate(-35 ${cx} ${plotBottom + 18})`}
                  >
                    {r.value}
                  </text>
                </g>
              );
            })}

            {ribbons.length === 0 && (
              <text x={plotLeft + plotWidth / 2} y={plotTop + chartHeight / 2} textAnchor="middle" fill={theme.textMuted} fontSize={14} fontFamily={theme.fontFamily}>
                No data available for this category.
              </text>
            )}
          </g>
        </ChartCanvas>
      </div>
      <aside style={{ width: 260, borderInlineStart: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', overflowY: 'auto', padding: '12px 0' }}>
        {DISTRIBUTION_CATEGORIES.map((c) => {
          const selected = c.id === category.id;
          return (
            <button
              key={c.id}
              onClick={() => setCategoryId(c.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'start',
                padding: '10px 16px',
                border: 'none',
                borderInlineStart: selected ? '3px solid hsl(var(--primary))' : '3px solid transparent',
                background: selected ? 'hsl(var(--accent))' : 'transparent',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                font: '13px -apple-system, system-ui, sans-serif',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{c.title}</div>
              <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, lineHeight: 1.35 }}>{c.description}</div>
            </button>
          );
        })}
      </aside>
    </div>
  );
}

export function TimelineChart({ ancestorTree, descendantTree, timelineData, theme = DEFAULT_THEME, page, overlays, onOverlaysChange, chartCanvasRef, ...overlayProps }) {
  // When the caller supplies `timelineData` (from `buildTimelineData` in
  // src/lib/chartData/timelineBuilder.js) we render the full record-backed
  // timeline including per-row PersonEvent/FamilyEvent markers. Otherwise we
  // fall back to the legacy tree-scan path that derives rows from birth/death
  // years only.
  const hasBuilderRows = Array.isArray(timelineData?.rows) && timelineData.rows.length > 0;

  const rows = useMemo(() => {
    if (hasBuilderRows) {
      return timelineData.rows
        .map((row) => ({
          key: row.id,
          name: row.name,
          birth: row.birthYear ?? null,
          death: row.deathYear ?? null,
          events: Array.isArray(row.events) ? row.events : [],
          gender: null,
        }))
        .filter((row) => row.birth != null || row.death != null || row.events.length > 0)
        .sort((a, b) => (a.birth ?? 9999) - (b.birth ?? 9999))
        .slice(0, 120);
    }
    const map = new Map();
    for (const node of collectAncestors(ancestorTree, 6).nodes) if (node.person) map.set(node.person.recordName, node.person);
    for (const person of collectDescendantPersons(descendantTree)) map.set(person.recordName, person);
    return [...map.values()]
      .map((person) => ({
        key: person.recordName,
        name: person.fullName,
        birth: parseYear(person.birthDate),
        death: parseYear(person.deathDate),
        events: [],
        gender: person.gender ?? 0,
      }))
      .filter((row) => row.birth || row.death)
      .sort((a, b) => (a.birth || 9999) - (b.birth || 9999))
      .slice(0, 80);
  }, [ancestorTree, descendantTree, timelineData, hasBuilderRows]);

  const currentYear = new Date().getFullYear();
  const allYears = rows.flatMap((row) => [row.birth, row.death, ...row.events.map((e) => e.year)]).filter((y) => Number.isFinite(y));
  const min = allYears.length ? Math.min(...allYears) : currentYear;
  const max = allYears.length ? Math.max(...allYears) : min + 1;
  const scale = (year) => 220 + ((year - min) / Math.max(1, max - min)) * 760;
  return (
    <ChartCanvas
      ref={chartCanvasRef}
      theme={theme}
      page={page}
      overlays={overlays}
      onOverlaysChange={onOverlaysChange}
      {...overlayProps}
    >
      <g transform="translate(30,90)">
        <text x={190} y={-28} fill={theme.textMuted} fontSize={12} fontFamily={theme.fontFamily}>{min} - {max}</text>
        {rows.map((row, index) => {
          const y = index * 30;
          const start = row.birth || row.death;
          const end = row.death || Math.min(max, currentYear);
          const strokeColor = row.gender != null ? (theme.gender[row.gender]?.stroke || theme.connector) : theme.connector;
          return (
            <g key={row.key} transform={`translate(0,${y})`}>
              <text x={0} y={17} fill={theme.text} fontSize={12} fontFamily={theme.fontFamily}>{row.name}</text>
              {start != null && (
                <>
                  <line x1={scale(start)} y1={12} x2={scale(end)} y2={12} stroke={strokeColor} strokeWidth={8} strokeLinecap="round" />
                  <text x={scale(end) + 8} y={16} fill={theme.textMuted} fontSize={11} fontFamily={theme.fontFamily}>{start}{row.death ? `-${row.death}` : ''}</text>
                </>
              )}
              {row.events.map((event) => (
                event.year != null ? (
                  <circle key={event.id} cx={scale(event.year)} cy={12} r={4} fill={theme.connector} stroke={theme.background || '#fff'} strokeWidth={1.5}>
                    <title>{`${event.type || 'event'} ${event.year}${event.placeName ? ` — ${event.placeName}` : ''}`}</title>
                  </circle>
                ) : null
              ))}
            </g>
          );
        })}
      </g>
    </ChartCanvas>
  );
}

export function GenogramChart({ tree, genogramData, onPersonClick, theme = DEFAULT_THEME, page, sociogram = false, overlays, onOverlaysChange, chartCanvasRef, ...overlayProps }) {
  const layout = useMemo(() => layoutDescendants(tree, theme), [tree, theme]);
  // Index builder-output nodes by person record name so we can annotate each
  // layout node with its event/fact counts without reshaping the layout.
  const builderByPersonId = useMemo(() => {
    const map = new Map();
    if (Array.isArray(genogramData?.nodes)) {
      for (const node of genogramData.nodes) if (node?.id) map.set(node.id, node);
    }
    return map;
  }, [genogramData]);
  if (!tree) return <div style={{ padding: 24, color: theme.textMuted }}>No person selected.</div>;
  return (
    <ChartCanvas
      ref={chartCanvasRef}
      theme={theme}
      page={page}
      overlays={overlays}
      onOverlaysChange={onOverlaysChange}
      {...overlayProps}
    >
      <g transform="translate(40,80)">
        {layout.links.map((link, index) => (
          <path key={index} d={link.d} fill="none" stroke={sociogram ? '#d08c60' : theme.connector} strokeWidth={sociogram ? 2.4 : theme.connectorWidth} strokeDasharray={sociogram ? '6 4' : 'none'} />
        ))}
        {layout.nodes.map((node, index) => {
          const builderNode = node.person?.recordName ? builderByPersonId.get(node.person.recordName) : null;
          const eventCount = builderNode?.events?.length || 0;
          const factCount = builderNode?.facts?.length || 0;
          return (
            <g key={`${node.id}-${index}`}>
              <PersonNode x={node.x} y={node.y} person={node.person} placeholder={node.placeholder} theme={theme} onClick={onPersonClick} />
              {sociogram && !node.placeholder && (
                <circle cx={node.x + theme.nodeWidth - 14} cy={node.y + 14} r={5} fill="#d08c60" />
              )}
              {!node.placeholder && (eventCount > 0 || factCount > 0) && (
                <g>
                  <rect
                    x={node.x + theme.nodeWidth - 36}
                    y={node.y + theme.nodeHeight - 18}
                    width={32}
                    height={14}
                    rx={7}
                    fill={theme.connector}
                    opacity={0.85}
                  />
                  <text
                    x={node.x + theme.nodeWidth - 20}
                    y={node.y + theme.nodeHeight - 8}
                    textAnchor="middle"
                    fontSize={10}
                    fontFamily={theme.fontFamily}
                    fill={theme.background || '#fff'}
                  >
                    {eventCount ? `E${eventCount}` : ''}{eventCount && factCount ? ' ' : ''}{factCount ? `F${factCount}` : ''}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </g>
    </ChartCanvas>
  );
}

export function FractalAncestorChart({ tree, generations = 5, onPersonClick, theme = DEFAULT_THEME, page, variant = 'fractal', overlays, onOverlaysChange, chartCanvasRef, ...overlayProps }) {
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
    <ChartCanvas
      ref={chartCanvasRef}
      theme={theme}
      page={page}
      overlays={overlays}
      onOverlaysChange={onOverlaysChange}
      {...overlayProps}
    >
      {layout.links.map((link, index) => (
        <path key={index} d={`M ${link.from.x + theme.nodeWidth / 2} ${link.from.y + theme.nodeHeight} L ${link.to.x + theme.nodeWidth / 2} ${link.to.y}`} fill="none" stroke={theme.connector} strokeWidth={theme.connectorWidth} />
      ))}
      {layout.nodes.map((node) => (
        <PersonNode key={node.key} x={node.x} y={node.y} person={node.person} placeholder={node.placeholder} theme={theme} onClick={onPersonClick} />
      ))}
    </ChartCanvas>
  );
}
