import React, { useMemo } from 'react';
import { ChartCanvas } from './ChartCanvas.jsx';
import { ChartEmptyState } from './ChartEmptyState.jsx';
import { PersonNode } from './PersonNode.jsx';
import { DEFAULT_THEME } from './theme.js';
import { layoutDescendants } from './layouts/descendantLayout.js';

const NODE_PAD_X = 90;
const ROW_HEIGHT = 86;
const RADIAL_DESCENDANT_SIZE = 800;

function parseYear(value) {
  const match = String(value || '').match(/(\d{4})/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function shortName(person) {
  if (!person) return '';
  return person.firstName || String(person.fullName || '').split(/\s+/)[0] || 'Unknown';
}

function initialName(person) {
  if (!person) return 'Unknown';
  const parts = String(person.fullName || '').split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return shortName(person);
  return parts.map((part, index) => (index === parts.length - 1 ? part : `${part[0]}.`)).join(' ');
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

function collectDescendantRows(tree) {
  const rows = [];
  const links = [];
  const seen = new Set();

  function addPerson(person, generation, role = 'descendant') {
    if (!person?.recordName) return null;
    if (seen.has(person.recordName)) return rows.find((row) => row.id === person.recordName);
    const row = {
      id: person.recordName,
      person,
      name: person.fullName || 'No name recorded',
      birthYear: parseYear(person.birthDate),
      deathYear: parseYear(person.deathDate),
      generation,
      role,
      unions: [],
    };
    seen.add(person.recordName);
    rows.push(row);
    return row;
  }

  function visit(node, generation = 0) {
    const parent = addPerson(node?.person, generation, generation === 0 ? 'root' : 'descendant');
    if (!parent) return;
    for (const union of node.unions || []) {
      const partner = addPerson(union.partner, generation, 'spouse');
      parent.unions.push({
        familyRecordName: union.familyRecordName,
        partnerId: partner?.id || null,
        marriageYear: parseYear(union.marriageDate || union.family?.marriageDate),
      });
      for (const child of union.children || []) {
        const childRow = addPerson(child.person, generation + 1, 'descendant');
        if (childRow) {
          links.push({
            id: `${union.familyRecordName || parent.id}-${childRow.id}`,
            parentId: parent.id,
            partnerId: partner?.id || null,
            childId: childRow.id,
            childYear: childRow.birthYear,
          });
        }
        visit(child, generation + 1);
      }
    }
  }

  if (tree) visit(tree);
  rows.sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999) || a.generation - b.generation || a.name.localeCompare(b.name));
  return { rows, links };
}

function polarPoint(cx, cy, radius, angle) {
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

function polarPath(source, target, cx, cy) {
  const sr = source.radius || 0;
  const tr = target.radius || 0;
  const mid = (sr + tr) / 2;
  const s = polarPoint(cx, cy, sr, source.angle);
  const t = polarPoint(cx, cy, tr, target.angle);
  const c1 = polarPoint(cx, cy, mid, source.angle);
  const c2 = polarPoint(cx, cy, mid, target.angle);
  return `M ${s.x} ${s.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${t.x} ${t.y}`;
}

function buildRadialDescendantLayout(tree) {
  const cx = RADIAL_DESCENDANT_SIZE / 2;
  const cy = RADIAL_DESCENDANT_SIZE / 2;
  const nodes = [];
  const links = [];
  const unionCandidates = (tree?.unions || []).filter((union) => Array.isArray(union.children) && union.children.length);
  const selectedUnions = unionCandidates.length
    ? unionCandidates
    : (tree?.unions || []);
  const partners = selectedUnions.map((union) => union.partner).filter(Boolean);
  const rootNames = [tree?.person, ...partners]
    .map((person) => person?.fullName)
    .filter(Boolean);
  const rootLabel = rootNames.length > 1
    ? rootNames.length === 2
      ? rootNames.join(' & ')
      : `${tree?.person?.fullName || 'Selected person'} & family`
    : rootNames[0] || 'Selected family';
  const rootChildren = selectedUnions.flatMap((union) => union.children || []);
  const rootYears = [tree?.person, ...partners]
    .map((person) => parseYear(person?.birthDate))
    .filter(Number.isFinite);
  const childPeople = rootChildren.flatMap((child) => collectDescendantPersons(child));
  const years = childPeople
    .map((person) => parseYear(person.birthDate))
    .filter(Number.isFinite);
  const minYear = rootYears.length
    ? Math.min(...rootYears)
    : years.length
      ? Math.min(...years)
      : 1900;
  const maxYear = years.length ? Math.max(...years) : minYear + 10;
  const yearScale = Math.min(4.2, 330 / Math.max(1, maxYear - minYear));
  let leafIndex = 0;

  function childNodes(node) {
    return (node?.unions || []).flatMap((union) => union.children || []);
  }

  function measure(node, depth = 1, parentId = 'couple-root') {
    if (!node?.person) return null;
    const children = childNodes(node).map((child) => measure(child, depth + 1, node)).filter(Boolean);
    const birthYear = parseYear(node.person.birthDate);
    const leafCount = children.length ? children.reduce((sum, child) => sum + child.leafCount, 0) : 1;
    const angleSlot = children.length
      ? children.reduce((sum, child) => sum + child.angleSlot * child.leafCount, 0) / leafCount
      : leafIndex++;
    const item = {
      id: node.person.recordName,
      person: node.person,
      depth,
      parentId: typeof parentId === 'string' ? parentId : parentId?.person?.recordName || 'couple-root',
      birthYear,
      radius: birthYear != null
        ? Math.max(28, (birthYear - minYear) * yearScale)
        : depth * 72,
      angleSlot,
      leafCount,
      children,
    };
    nodes.push(item);
    return item;
  }

  const root = {
    id: 'couple-root',
    depth: 0,
    radius: 0,
    angleSlot: 0,
    leafCount: 1,
    x: cx,
    y: cy,
  };
  rootChildren.forEach((child) => measure(child, 1, root.id));
  const slots = Math.max(1, leafIndex);
  for (const node of nodes) {
    node.angle = -Math.PI / 2 + (node.angleSlot / slots) * Math.PI * 2;
    const point = polarPoint(cx, cy, node.radius, node.angle);
    node.x = point.x;
    node.y = point.y;
  }
  root.angle = nodes.length
    ? nodes.reduce((sum, node) => sum + node.angle, 0) / nodes.length
    : -Math.PI / 2;
  const byId = new Map([[root.id, root], ...nodes.map((node) => [node.id, node])]);
  for (const node of nodes) {
    if (!node.parentId) continue;
    const parent = byId.get(node.parentId);
    if (parent) links.push({ source: parent, target: node, d: polarPath(parent, node, cx, cy) });
  }
  const decades = [];
  const firstDecade = Math.ceil((minYear + 1) / 10) * 10;
  const lastDecade = Math.ceil(maxYear / 10) * 10;
  for (let year = firstDecade; year <= lastDecade; year += 10) {
    decades.push({ year, radius: Math.max(0, (year - minYear) * yearScale) });
  }
  return { nodes, links, decades, cx, cy, minYear, root, rootLabel };
}

export function RadialDescendantTimelineChart({ tree, onPersonClick, theme = DEFAULT_THEME, page, overlays, onOverlaysChange, chartCanvasRef, colorForPerson, ...overlayProps }) {
  const layout = useMemo(() => buildRadialDescendantLayout(tree), [tree]);

  if (!tree) return <ChartEmptyState theme={theme} />;

  return (
    <ChartCanvas ref={chartCanvasRef} theme={theme} page={{ ...page, backgroundColor: '#ffffff' }} overlays={overlays} onOverlaysChange={onOverlaysChange} {...overlayProps}>
      <g transform="translate(20,20)">
        {layout.decades.map((decade) => (
          <g key={decade.year}>
            <circle cx={layout.cx} cy={layout.cy} r={decade.radius} fill="none" stroke="#d8d8d8" strokeWidth={0.6} />
            <text x={layout.cx - 10} y={layout.cy - decade.radius + 3} textAnchor="end" fill="#111827" fontSize={8} fontFamily="Arial, sans-serif">{decade.year}</text>
          </g>
        ))}
        {layout.links.map((link) => (
          <path key={`${link.source.id}-${link.target.id}`} d={link.d} fill="none" stroke="#cfcfcf" strokeWidth={1.5} />
        ))}
        <text x={layout.cx} y={layout.cy + 4} textAnchor="middle" fill="#111827" fontSize={12} fontFamily="Arial, sans-serif">
          {layout.rootLabel || 'Selected family'}
        </text>
        {layout.nodes.map((node) => {
          const colors = ['#1f77b4', '#2ca02c', '#ff7f0e', '#d62728', '#9467bd'];
          const override = colorForPerson?.(node.person);
          const degrees = (node.angle * 180) / Math.PI;
          const labelFlip = Math.cos(node.angle) < 0;
          return (
            <g key={node.person.recordName} transform={`translate(${node.x},${node.y})`} onClick={() => onPersonClick?.(node.person)} style={{ cursor: 'pointer' }}>
              <circle r={4.5} fill="#fff" stroke={override?.stroke || colors[node.depth % colors.length]} strokeWidth={1.5} />
              {node.depth > 0 && (
                <g transform={`rotate(${degrees}) translate(8,0) ${labelFlip ? 'rotate(180)' : ''}`}>
                  <text fill="#111827" fontSize={10} fontFamily="Arial, sans-serif" dominantBaseline="middle" textAnchor={labelFlip ? 'end' : 'start'}>
                  {shortName(node.person)}
                  </text>
                </g>
              )}
              <title>{`${node.person.fullName || 'Unknown'}${node.birthYear ? ` · born ${node.birthYear}` : ''}`}</title>
            </g>
          );
        })}
      </g>
    </ChartCanvas>
  );
}

export function LifespanDescendantChart({ tree, onPersonClick, theme = DEFAULT_THEME, page, overlays, onOverlaysChange, chartCanvasRef, colorForPerson, ...overlayProps }) {
  const layout = useMemo(() => {
    const { rows, links } = collectDescendantRows(tree);
    const currentYear = new Date().getFullYear();
    const years = rows.flatMap((row) => [row.birthYear, row.deathYear, ...row.unions.map((union) => union.marriageYear)]).filter(Number.isFinite);
    const minYear = years.length ? Math.floor(Math.min(...years) / 10) * 10 : currentYear - 100;
    const maxYear = years.length ? Math.ceil(Math.max(...years, currentYear) / 10) * 10 : currentYear;
    const rowIndex = new Map(rows.map((row, index) => [row.id, index]));
    return { rows, links, rowIndex, currentYear, minYear, maxYear };
  }, [tree]);

  if (!tree) return <ChartEmptyState theme={theme} />;

  const x0 = 55;
  const width = 1400;
  const rowGap = 18;
  const top = 178;
  const scale = (year) => x0 + ((year - layout.minYear) / Math.max(1, layout.maxYear - layout.minYear)) * width;
  const rowY = (index) => top + index * rowGap;
  const decades = [];
  for (let year = Math.ceil(layout.minYear / 10) * 10; year <= layout.maxYear; year += 10) decades.push(year);
  const title = `${tree.person?.lastName || tree.person?.fullName || 'Family'} Descendants`;
  const chartHeight = top + layout.rows.length * rowGap + 82;

  return (
    <ChartCanvas ref={chartCanvasRef} theme={theme} page={{ ...page, backgroundColor: '#ffffff' }} overlays={overlays} onOverlaysChange={onOverlaysChange} {...overlayProps}>
      <g transform="translate(34,18)">
        <text x={x0 + width / 2} y={72} textAnchor="middle" fill="#111" fontSize={36} fontFamily="Georgia, serif" fontWeight={700}>{title}</text>
        <text x={x0 + width / 2} y={116} textAnchor="middle" fill="#111" fontSize={28} fontFamily="Georgia, serif" fontStyle="italic">compiled from this tree, visualized after Nicolas Jérémie Kruchten</text>
        {layout.rows.flatMap((row) => row.unions.map((union) => {
          const partnerIndex = layout.rowIndex.get(union.partnerId);
          const rowIndex = layout.rowIndex.get(row.id);
          if (partnerIndex == null || rowIndex == null) return null;
          const partner = layout.rows[partnerIndex];
          const y1 = rowY(rowIndex);
          const y2 = rowY(partnerIndex);
          const start = union.marriageYear || Math.max(row.birthYear || layout.minYear, partner.birthYear || layout.minYear);
          const end = Math.min(row.deathYear || layout.maxYear, partner.deathYear || layout.maxYear, layout.maxYear);
          return (
            <rect
              key={`${row.id}-${union.partnerId}-${union.familyRecordName}`}
              x={scale(start)}
              y={Math.min(y1, y2) - 6}
              width={Math.max(4, scale(end) - scale(start))}
              height={Math.abs(y2 - y1) + 12}
              fill="#d3d3d3"
              opacity={0.85}
            />
          );
        }))}
        {decades.map((year) => (
          <g key={year}>
            <line x1={scale(year)} y1={top - 22} x2={scale(year)} y2={chartHeight - 48} stroke="#fff" strokeWidth={1.4} opacity={0.88} />
            <text x={scale(year)} y={chartHeight - 12} textAnchor="middle" fill="#6b7280" fontSize={20} fontFamily="Georgia, serif">{year}</text>
          </g>
        ))}
        {layout.links.map((link) => {
          const parentIndex = layout.rowIndex.get(link.parentId);
          const partnerIndex = layout.rowIndex.get(link.partnerId);
          const childIndex = layout.rowIndex.get(link.childId);
          if (parentIndex == null || childIndex == null || link.childYear == null) return null;
          const parent = layout.rows[parentIndex];
          const partner = layout.rows[partnerIndex];
          const motherIndex = parent?.person?.gender === 1
            ? parentIndex
            : partner?.person?.gender === 1
              ? partnerIndex
              : parentIndex;
          const birthX = scale(link.childYear);
          return (
            <path
              key={link.id}
              d={`M ${birthX} ${rowY(motherIndex)} V ${rowY(childIndex)}`}
              fill="none"
              stroke="#a8a8a8"
              strokeWidth={1}
              opacity={0.75}
            />
          );
        })}
        {layout.rows.map((row, index) => {
          const y = rowY(index);
          const start = row.birthYear;
          const end = row.deathYear || Math.min(layout.maxYear, layout.currentYear);
          const barColor = row.person?.gender === 1 ? '#90ee90' : row.person?.gender === 0 ? '#add8e6' : '#ffffff';
          const override = colorForPerson?.(row.person);
          return (
            <g key={row.id} onClick={() => onPersonClick?.(row.person)} style={{ cursor: row.person ? 'pointer' : 'default' }}>
              {start != null && (
                <line
                  x1={scale(start)}
                  y1={y}
                  x2={scale(end)}
                  y2={y}
                  stroke={override?.stroke || barColor}
                  strokeWidth={10}
                  strokeLinecap="butt"
                />
              )}
              <text x={start != null ? scale(start) + 3 : x0} y={y + 3} fill="#111" fontSize={11} fontFamily="Helvetica Neue, Arial, sans-serif">{initialName(row.person)}</text>
            </g>
          );
        })}
      </g>
    </ChartCanvas>
  );
}

export function CircularAncestorChart({ tree, generations = 5, onPersonClick, theme = DEFAULT_THEME, page, overlays, onOverlaysChange, chartCanvasRef, colorForPerson, ...overlayProps }) {
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

  if (!tree) return <ChartEmptyState theme={theme} />;
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
        <PersonNode key={node.key} x={node.x} y={node.y} person={node.person} placeholder={node.placeholder} theme={theme} onClick={onPersonClick} colorOverride={colorForPerson?.(node.person)} />
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

// Friendly title fragment for the active distribution type. Falls back to the
// raw type id (or the legacy category title) so the heading is always sensible.
const DISTRIBUTION_TYPE_TITLES = {
  lastName: 'Last Names',
  firstName: 'First Names',
  gender: 'Genders',
  birthPlace: 'Birth Places',
  birthCountry: 'Birth Countries',
  deathPlace: 'Death Places',
  deathCountry: 'Death Countries',
  birthCentury: 'Birth Centuries',
  deathCentury: 'Death Centuries',
  occupation: 'Occupations',
  illness: 'Illnesses',
  eyeColor: 'Eye Colors',
  race: 'Races',
  skinColor: 'Skin Colors',
  caste: 'Caste Names',
  nationalOrigin: 'National Origins',
};

export function DistributionChart({ persons = [], distributionData, distributionType, theme = DEFAULT_THEME, page, overlays, onOverlaysChange, chartCanvasRef, ...overlayProps }) {
  // Single source of truth: the active distribution type is chosen in the chart
  // options panel and threaded through `distributionType` / the builder's
  // `distributionData.config`. The legacy 6-item sidebar has been removed so it
  // can no longer fight the selector. We render a count-based bar/line graph
  // (driven by `config.graphType`), optionally as relative percentages
  // (`config.relativeValues`).
  const config = distributionData?.config || {};
  const activeType = config.distributionType || distributionType || 'gender';
  const relative = Boolean(config.relativeValues);
  const graphType = config.graphType === 'line' ? 'line' : 'bar';
  const title = `Distribution of ${DISTRIBUTION_TYPE_TITLES[activeType] || activeType}`;

  const items = useMemo(() => {
    const source = Array.isArray(distributionData?.items) ? distributionData.items : [];
    return source
      .map((item) => ({
        value: item.label,
        count: item.count,
        fraction: item.fraction,
      }))
      .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)))
      .slice(0, 16);
  }, [distributionData]);

  const total = distributionData?.total || items.reduce((sum, item) => sum + item.count, 0) || 1;
  const valueFor = (item) => (relative ? (item.fraction ?? item.count / total) : item.count);
  const maxValue = items.length ? Math.max(...items.map(valueFor)) : 1;

  const chartWidth = 1040;
  const chartHeight = 520;
  const axisX = 70;
  const plotTop = 120;
  const plotBottom = plotTop + chartHeight;
  const plotLeft = axisX + 30;
  const plotRight = chartWidth + 40;
  const plotWidth = plotRight - plotLeft;
  const valueToY = (value) => plotBottom - (value / Math.max(maxValue, relative ? 0.0001 : 1)) * (plotBottom - plotTop);
  const slot = items.length ? plotWidth / items.length : 0;
  const barWidth = Math.min(48, Math.max(10, slot * 0.6));

  const ticks = [];
  const tickCount = 5;
  for (let i = 0; i <= tickCount; i += 1) ticks.push((maxValue * i) / tickCount);
  const formatValue = (value) => (relative ? `${Math.round(value * 100)}%` : Math.round(value).toLocaleString());

  const linePoints = items
    .map((item, i) => `${plotLeft + slot * (i + 0.5)},${valueToY(valueFor(item))}`)
    .join(' ');

  return (
    <ChartCanvas
      ref={chartCanvasRef}
      theme={theme}
      page={page}
      overlays={overlays}
      onOverlaysChange={onOverlaysChange}
      {...overlayProps}
    >
      <g>
        <text x={plotLeft + plotWidth / 2} y={56} textAnchor="middle" fill={theme.text} fontSize={24} fontWeight={700} fontFamily={theme.fontFamily}>{title}</text>
        <text x={plotLeft + plotWidth / 2} y={80} textAnchor="middle" fill={theme.textMuted} fontSize={12} fontFamily={theme.fontFamily}>
          {total.toLocaleString()} records{relative ? ' · relative values' : ''}
          {config.fromYear != null || config.toYear != null ? ` · ${config.fromYear ?? '…'}–${config.toYear ?? '…'}` : ''}
        </text>

        {ticks.map((tick, i) => (
          <g key={i}>
            <line x1={plotLeft} y1={valueToY(tick)} x2={plotRight} y2={valueToY(tick)} stroke={theme.connector} strokeWidth={0.5} opacity={0.4} />
            <text x={axisX} y={valueToY(tick) + 4} textAnchor="end" fill={theme.textMuted} fontSize={11} fontFamily={theme.fontFamily}>{formatValue(tick)}</text>
          </g>
        ))}

        {graphType === 'bar' && items.map((item, i) => {
          const cx = plotLeft + slot * (i + 0.5);
          const yTop = valueToY(valueFor(item));
          return (
            <g key={item.value}>
              <rect
                x={cx - barWidth / 2}
                y={yTop}
                width={barWidth}
                height={Math.max(2, plotBottom - yTop)}
                rx={3}
                fill={ribbonColor(i)}
                opacity={0.9}
              />
              {config.showValueLabels !== false && (
                <text x={cx} y={yTop - 4} textAnchor="middle" fill={theme.text} fontSize={10} fontFamily={theme.fontFamily}>{formatValue(valueFor(item))}</text>
              )}
            </g>
          );
        })}

        {graphType === 'line' && items.length > 0 && (
          <>
            <polyline points={linePoints} fill="none" stroke={ribbonColor(0)} strokeWidth={2.4} />
            {items.map((item, i) => {
              const cx = plotLeft + slot * (i + 0.5);
              const cy = valueToY(valueFor(item));
              return (
                <g key={item.value}>
                  <circle cx={cx} cy={cy} r={4} fill={ribbonColor(i)} />
                  {config.showValueLabels !== false && (
                    <text x={cx} y={cy - 8} textAnchor="middle" fill={theme.text} fontSize={10} fontFamily={theme.fontFamily}>{formatValue(valueFor(item))}</text>
                  )}
                </g>
              );
            })}
          </>
        )}

        {items.map((item, i) => {
          const cx = plotLeft + slot * (i + 0.5);
          return (
            <text
              key={`label-${item.value}`}
              x={cx}
              y={plotBottom + 18}
              textAnchor="middle"
              fill={theme.text}
              fontSize={11}
              fontFamily={theme.fontFamily}
              transform={`rotate(-35 ${cx} ${plotBottom + 18})`}
            >
              {item.value}
            </text>
          );
        })}

        {items.length === 0 && (
          <text x={plotLeft + plotWidth / 2} y={plotTop + chartHeight / 2} textAnchor="middle" fill={theme.textMuted} fontSize={14} fontFamily={theme.fontFamily}>
            No data available for this distribution type.
          </text>
        )}
      </g>
    </ChartCanvas>
  );
}

export function TimelineChart({ ancestorTree, descendantTree, timelineData, theme = DEFAULT_THEME, page, overlays, onOverlaysChange, chartCanvasRef, ...overlayProps }) {
  // When the caller supplies `timelineData` (from `buildTimelineData` in
  // src/lib/chartData/timelineBuilder.js) we render the full record-backed
  // timeline including per-row PersonEvent/FamilyEvent markers, honoring the
  // builder's grouping mode and marker mode. Otherwise we fall back to the
  // legacy tree-scan path that derives rows from birth/death years only.
  const hasBuilderRows = Array.isArray(timelineData?.rows) && timelineData.rows.length > 0;
  const config = timelineData?.config || {};
  const grouping = config.grouping && config.grouping !== 'none' ? config.grouping : null;
  // marker mode: 'event' draws each event as a vertical tick (line); otherwise
  // events render as dots. The lifespan bar is always drawn.
  const markerStyle = config.markerMode === 'event' ? 'line' : 'dot';

  const rows = useMemo(() => {
    if (hasBuilderRows) {
      return timelineData.rows
        .map((row) => ({
          key: row.id,
          name: row.name,
          birth: row.birthYear ?? null,
          death: row.deathYear ?? null,
          events: Array.isArray(row.events) ? row.events : [],
          group: row.group ?? 'all',
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
        group: 'all',
        gender: person.gender ?? 0,
      }))
      .filter((row) => row.birth || row.death)
      .sort((a, b) => (a.birth || 9999) - (b.birth || 9999))
      .slice(0, 80);
  }, [ancestorTree, descendantTree, timelineData, hasBuilderRows]);

  // Build a flat render list. When grouping is active we interleave a header
  // entry before each group's rows so the timeline visibly clusters by the
  // selected grouping mode (last name / gender / birth place / etc.).
  const renderItems = useMemo(() => {
    if (!grouping) return rows.map((row) => ({ type: 'row', row }));
    const byGroup = new Map();
    for (const row of rows) {
      const key = row.group || 'Unknown';
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key).push(row);
    }
    const items = [];
    for (const [key, groupRows] of [...byGroup.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
      items.push({ type: 'header', label: key });
      for (const row of groupRows) items.push({ type: 'row', row });
    }
    return items;
  }, [rows, grouping]);

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
        <text x={190} y={-28} fill={theme.textMuted} fontSize={12} fontFamily={theme.fontFamily}>{min} - {max}{grouping ? ` · grouped by ${grouping}` : ''}</text>
        {renderItems.map((item, index) => {
          const y = index * 30;
          if (item.type === 'header') {
            return (
              <g key={`header-${item.label}-${index}`} transform={`translate(0,${y})`}>
                <line x1={0} y1={6} x2={980} y2={6} stroke={theme.connector} strokeWidth={0.5} opacity={0.5} />
                <text x={0} y={20} fill={theme.text} fontSize={12} fontWeight={700} fontFamily={theme.fontFamily}>{item.label}</text>
              </g>
            );
          }
          const row = item.row;
          const start = row.birth || row.death;
          const end = row.death || Math.min(max, currentYear);
          const strokeColor = row.gender != null ? (theme.gender[row.gender]?.stroke || theme.connector) : theme.connector;
          return (
            <g key={row.key} transform={`translate(0,${y})`}>
              <text x={grouping ? 14 : 0} y={17} fill={theme.text} fontSize={12} fontFamily={theme.fontFamily}>{row.name}</text>
              {start != null && (
                <>
                  <line x1={scale(start)} y1={12} x2={scale(end)} y2={12} stroke={strokeColor} strokeWidth={8} strokeLinecap="round" />
                  <text x={scale(end) + 8} y={16} fill={theme.textMuted} fontSize={11} fontFamily={theme.fontFamily}>{start}{row.death ? `-${row.death}` : ''}</text>
                </>
              )}
              {row.events.map((event) => {
                if (event.year == null) return null;
                const x = scale(event.year);
                if (markerStyle === 'line') {
                  return (
                    <line key={event.id} x1={x} y1={3} x2={x} y2={21} stroke={theme.text} strokeWidth={2}>
                      <title>{`${event.type || 'event'} ${event.year}${event.placeName ? ` — ${event.placeName}` : ''}`}</title>
                    </line>
                  );
                }
                return (
                  <circle key={event.id} cx={x} cy={12} r={4} fill={theme.connector} stroke={theme.background || '#fff'} strokeWidth={1.5}>
                    <title>{`${event.type || 'event'} ${event.year}${event.placeName ? ` — ${event.placeName}` : ''}`}</title>
                  </circle>
                );
              })}
            </g>
          );
        })}
      </g>
    </ChartCanvas>
  );
}

// Role → ring distance multiplier. The root sits at the centre; immediate
// family forms an inner ring and associates push out to an outer ring so the
// social neighbourhood reads at a glance.
const SOCIOGRAM_ROLE_RING = {
  root: 0,
  partner: 1,
  parent: 1,
  child: 1,
  grandparent: 1.9,
  associate: 2,
};

const SOCIOGRAM_ROLE_COLOR = {
  root: '#2563eb',
  partner: '#db2777',
  parent: '#7c3aed',
  grandparent: '#9333ea',
  child: '#16a34a',
  associate: '#d08c60',
};

export function SociogramChart({ sociogramData, onPersonClick, theme = DEFAULT_THEME, page, overlays, onOverlaysChange, chartCanvasRef, colorForPerson, ...overlayProps }) {
  const spacing = Number.isFinite(sociogramData?.config?.associatedPersonsSpacing)
    ? sociogramData.config.associatedPersonsSpacing
    : 80;

  const layout = useMemo(() => {
    const nodes = Array.isArray(sociogramData?.nodes) ? sociogramData.nodes : [];
    const edges = Array.isArray(sociogramData?.edges) ? sociogramData.edges : [];
    const cx = 520;
    const cy = 420;
    const ringStep = Math.max(110, spacing * 1.6);
    const byRing = new Map();
    for (const node of nodes) {
      const ring = SOCIOGRAM_ROLE_RING[node.role] ?? 1.5;
      if (!byRing.has(ring)) byRing.set(ring, []);
      byRing.get(ring).push(node);
    }
    const positioned = new Map();
    for (const [ring, ringNodes] of byRing.entries()) {
      if (ring === 0) {
        for (const node of ringNodes) positioned.set(node.id, { ...node, x: cx, y: cy });
        continue;
      }
      const radius = ring * ringStep;
      ringNodes.forEach((node, index) => {
        const angle = -Math.PI / 2 + (index / ringNodes.length) * Math.PI * 2;
        positioned.set(node.id, {
          ...node,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
        });
      });
    }
    const positionedEdges = edges
      .map((edge) => ({ ...edge, from: positioned.get(edge.fromId), to: positioned.get(edge.toId) }))
      .filter((edge) => edge.from && edge.to);
    return { nodes: [...positioned.values()], edges: positionedEdges, cx, cy };
  }, [sociogramData, spacing]);

  if (!sociogramData || layout.nodes.length === 0) {
    return <ChartEmptyState theme={theme}>{sociogramData?.warning || 'No social connections to display.'}</ChartEmptyState>;
  }

  return (
    <ChartCanvas
      ref={chartCanvasRef}
      theme={theme}
      page={page}
      overlays={overlays}
      onOverlaysChange={onOverlaysChange}
      {...overlayProps}
    >
      <g>
        {layout.edges.map((edge, index) => (
          <line
            key={`${edge.fromId}-${edge.toId}-${index}`}
            x1={edge.from.x}
            y1={edge.from.y}
            x2={edge.to.x}
            y2={edge.to.y}
            stroke={edge.kind === 'associate' ? '#d08c60' : theme.connector}
            strokeWidth={edge.kind === 'associate' ? 2 : 1.6}
            strokeDasharray={edge.kind === 'associate' ? '6 4' : 'none'}
            opacity={0.8}
          />
        ))}
        {layout.nodes.map((node) => {
          const override = colorForPerson?.({ recordName: node.id, gender: node.gender });
          const fill = override?.fill || SOCIOGRAM_ROLE_COLOR[node.role] || theme.connector;
          const isRoot = node.role === 'root';
          const r = isRoot ? 16 : 11;
          return (
            <g key={node.id} transform={`translate(${node.x},${node.y})`} onClick={() => onPersonClick?.({ recordName: node.id })} style={{ cursor: 'pointer' }}>
              <circle r={r} fill={fill} stroke="#fff" strokeWidth={2} />
              <text x={0} y={r + 14} textAnchor="middle" fill={theme.text} fontSize={11} fontFamily={theme.fontFamily}>{node.name}</text>
              <title>{`${node.name} · ${node.role}`}</title>
            </g>
          );
        })}
      </g>
    </ChartCanvas>
  );
}

export function GenogramChart({ tree, genogramData, onPersonClick, theme = DEFAULT_THEME, page, sociogram = false, overlays, onOverlaysChange, chartCanvasRef, colorForPerson, ...overlayProps }) {
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
  if (!tree) return <ChartEmptyState theme={theme} />;
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
              <PersonNode x={node.x} y={node.y} person={node.person} placeholder={node.placeholder} theme={theme} onClick={onPersonClick} colorOverride={colorForPerson?.(node.person)} />
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

export function FractalAncestorChart({ tree, generations = 5, onPersonClick, theme = DEFAULT_THEME, page, variant = 'fractal', overlays, onOverlaysChange, chartCanvasRef, colorForPerson, ...overlayProps }) {
  const layout = useMemo(() => {
    return layoutFractalAncestors(tree, generations, theme, variant);
  }, [tree, generations, theme, variant]);
  if (!tree) return <ChartEmptyState theme={theme} />;
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
        <path key={index} d={link.d} fill="none" stroke={theme.connector} strokeWidth={theme.connectorWidth} />
      ))}
      {layout.nodes.map((node) => (
        <PersonNode key={node.key} x={node.x} y={node.y} person={node.person} placeholder={node.placeholder} theme={theme} onClick={onPersonClick} colorOverride={colorForPerson?.(node.person)} />
      ))}
    </ChartCanvas>
  );
}

export function layoutFractalAncestors(tree, generations = 5, theme = DEFAULT_THEME, variant = 'fractal') {
  const nodes = [];
  const links = [];
  const nodeGapX = variant === 'square' ? 26 : 34;
  const nodeGapY = variant === 'h-tree' ? 30 : variant === 'square' ? 24 : 36;
  const rowStep = theme.nodeHeight + (variant === 'square' ? 42 : variant === 'h-tree' ? 58 : 76);
  const maxDepth = Math.max(1, generations);

  function visit(node, x, y, spread, depth, key, parentKey = null) {
    if (!node || depth >= maxDepth) return;
    nodes.push({ key, x, y, person: node.person, placeholder: !node.person, depth });
    if (parentKey) links.push({ fromKey: parentKey, toKey: key });

    const nextSpread = Math.max(theme.nodeWidth * 0.55, spread * 0.58);
    if (node.father) {
      const fatherX = variant === 'square' ? x : x - spread;
      visit(node.father, fatherX, y + rowStep, nextSpread, depth + 1, `${key}F`, key);
    }
    if (node.mother) {
      const motherX = variant === 'square' ? x + spread : x + spread;
      visit(node.mother, motherX, y + rowStep, nextSpread, depth + 1, `${key}M`, key);
    }
  }

  visit(tree, 420, 90, 280, 0, 'root');

  const adjustedNodes = avoidNodeOverlaps(nodes, theme, nodeGapX, nodeGapY);
  const byKey = new Map(adjustedNodes.map((node) => [node.key, node]));
  const adjustedLinks = links
    .map((link) => {
      const from = byKey.get(link.fromKey);
      const to = byKey.get(link.toKey);
      if (!from || !to) return null;
      return { ...link, d: fractalLinkPath(from, to, theme, variant, link.toKey, adjustedNodes) };
    })
    .filter(Boolean);

  return { nodes: adjustedNodes, links: adjustedLinks };
}

function avoidNodeOverlaps(nodes, theme, gapX, gapY) {
  const placed = [];
  for (const source of [...nodes].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const node = { ...source };
    let guard = 0;
    while (placed.some((other) => rectanglesOverlap(node, other, theme, gapX, gapY)) && guard < 200) {
      const blockers = placed.filter((other) => rectanglesOverlap(node, other, theme, gapX, gapY));
      node.y = Math.max(...blockers.map((other) => other.y + theme.nodeHeight + gapY));
      guard += 1;
    }
    placed.push(node);
  }
  return placed.sort((a, b) => a.depth - b.depth || a.key.localeCompare(b.key));
}

function rectanglesOverlap(a, b, theme, gapX, gapY) {
  return (
    a.x < b.x + theme.nodeWidth + gapX
    && a.x + theme.nodeWidth + gapX > b.x
    && a.y < b.y + theme.nodeHeight + gapY
    && a.y + theme.nodeHeight + gapY > b.y
  );
}

function fractalLinkPath(from, to, theme, variant, toKey, nodes = []) {
  const fromX = from.x + theme.nodeWidth / 2;
  const fromY = from.y + theme.nodeHeight;
  const toX = to.x + theme.nodeWidth / 2;
  const toY = to.y;
  if (variant === 'square') {
    return squareTreeLinkPath(from, to, theme, toKey, nodes);
  }
  if (variant === 'h-tree') {
    const midY = fromY + Math.max(20, (toY - fromY) / 2);
    return `M ${fromX} ${fromY} V ${midY} H ${toX} V ${toY}`;
  }
  return `M ${fromX} ${fromY} C ${fromX} ${fromY + 42}, ${toX} ${toY - 42}, ${toX} ${toY}`;
}

function squareTreeLinkPath(from, to, theme, toKey, nodes) {
  const fromX = from.x + theme.nodeWidth / 2;
  const fromY = from.y + theme.nodeHeight;
  const toX = to.x + theme.nodeWidth / 2;
  const toY = to.y;
  const stub = 18;
  const leftEdge = Math.min(from.x, to.x);
  const rightEdge = Math.max(from.x + theme.nodeWidth, to.x + theme.nodeWidth);
  const laneStep = theme.nodeWidth + 64;
  const fatherFirst = toKey?.endsWith('F');
  const leftCandidates = [leftEdge - 28, leftEdge - laneStep, leftEdge - laneStep * 2];
  const rightCandidates = [rightEdge + 28, rightEdge + laneStep, rightEdge + laneStep * 2];
  const candidates = fatherFirst
    ? [...leftCandidates, ...rightCandidates]
    : [...rightCandidates, ...leftCandidates];
  const blockedNodes = nodes.filter((node) => node.key !== from.key && node.key !== to.key);
  const railX = candidates.find((candidate) => {
    const segments = squareRouteSegments(fromX, fromY, toX, toY, candidate, stub);
    return !segments.some((segment) => blockedNodes.some((node) => segmentIntersectsNode(segment, node, theme)));
  }) || candidates[0];

  return `M ${fromX} ${fromY} V ${fromY + stub} H ${railX} V ${toY - stub} H ${toX} V ${toY}`;
}

function squareRouteSegments(fromX, fromY, toX, toY, railX, stub) {
  return [
    { x1: fromX, y1: fromY, x2: fromX, y2: fromY + stub },
    { x1: fromX, y1: fromY + stub, x2: railX, y2: fromY + stub },
    { x1: railX, y1: fromY + stub, x2: railX, y2: toY - stub },
    { x1: railX, y1: toY - stub, x2: toX, y2: toY - stub },
    { x1: toX, y1: toY - stub, x2: toX, y2: toY },
  ];
}

function segmentIntersectsNode(segment, node, theme) {
  const left = node.x;
  const right = node.x + theme.nodeWidth;
  const top = node.y;
  const bottom = node.y + theme.nodeHeight;
  const minX = Math.min(segment.x1, segment.x2);
  const maxX = Math.max(segment.x1, segment.x2);
  const minY = Math.min(segment.y1, segment.y2);
  const maxY = Math.max(segment.y1, segment.y2);
  if (segment.x1 === segment.x2) {
    return segment.x1 > left && segment.x1 < right && maxY > top && minY < bottom;
  }
  return segment.y1 > top && segment.y1 < bottom && maxX > left && minX < right;
}
