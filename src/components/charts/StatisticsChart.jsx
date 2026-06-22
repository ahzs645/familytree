/**
 * Statistics chart (#20) — renders the comprehensive tree statistics produced by
 * the (previously orphaned) `lib/chartData/statisticsBuilder.js` as a dashboard
 * of bar-chart sections. Mirrors MacFamilyTree's "Statistics" chart pane, with a
 * Bars / Lines toggle and a section selector.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { buildStatisticsData } from '../../lib/chartData/statisticsBuilder.js';
import { DEFAULT_THEME } from './theme.js';

const SECTION_DEFS = [
  { id: 'gender', label: 'Persons by gender', pick: (d) => mapPairs(d.gender) },
  { id: 'birthsByCentury', label: 'Births by century', pick: (d) => mapPairs(d.birthsByCentury) },
  { id: 'deathsByCentury', label: 'Deaths by century', pick: (d) => mapPairs(d.deathsByCentury) },
  { id: 'surnames', label: 'Most common surnames', pick: (d) => listPairs(d.surnames, 'name', 'count') },
  { id: 'countries', label: 'Persons by country', pick: (d) => listPairs(d.countries, 'name', 'count') },
  { id: 'occupations', label: 'Top occupations', pick: (d) => listPairs(d.rich?.topOccupations, 'name', 'count') },
  { id: 'childrenPerFamily', label: 'Children per family', pick: (d) => listPairs(d.rich?.childrenPerFamily, 'children', 'count') },
  { id: 'ageAtMarriage', label: 'Age at marriage', pick: (d) => listPairs(d.rich?.ageAtMarriage, 'name', 'count') },
  { id: 'marriageMonths', label: 'Marriage months', pick: (d) => listPairs(d.rich?.marriageMonths, 'month', 'count') },
];

function mapPairs(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj).map(([label, value]) => ({ label: String(label), value: Number(value) || 0 }));
}
function listPairs(rows, labelKey, valueKey) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({ label: String(row[labelKey] ?? ''), value: Number(row[valueKey]) || 0 })).filter((r) => r.label);
}

const BAR_COLOR = '#3b82f6';

export function StatisticsChart({ chartCanvasRef, theme = DEFAULT_THEME }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [statisticType, setStatisticType] = useState('gender');
  const [graphType, setGraphType] = useState('bars');

  useEffect(() => {
    let cancelled = false;
    buildStatisticsData({})
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Could not compute statistics.'); });
    return () => { cancelled = true; };
  }, []);

  const section = useMemo(() => SECTION_DEFS.find((s) => s.id === statisticType) || SECTION_DEFS[0], [statisticType]);
  const rows = useMemo(() => (data ? section.pick(data) : []), [data, section]);

  if (error) return <div className="p-10 text-sm text-destructive">{error}</div>;
  if (!data) return <div className="p-10 text-sm text-muted-foreground">Computing statistics…</div>;

  const controls = (
    <div style={{ display: 'flex', gap: 8, padding: 10, flexWrap: 'wrap' }}>
      <select value={statisticType} onChange={(e) => setStatisticType(e.target.value)} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid hsl(var(--border))', background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))' }}>
        {SECTION_DEFS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <select value={graphType} onChange={(e) => setGraphType(e.target.value)} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid hsl(var(--border))', background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))' }}>
        <option value="bars">Bars</option>
        <option value="lines">Lines</option>
      </select>
    </div>
  );

  const width = 760;
  const top = 56;
  const rowH = 30;
  const labelW = 170;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const barAreaW = width - labelW - 70;
  const height = top + Math.max(1, rows.length) * rowH + 24;

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      {controls}
      <svg ref={chartCanvasRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ background: theme.background || '#fff', fontFamily: theme.fontFamily }}>
      <text x={20} y={28} fontSize={18} fontWeight={700} fill={theme.text || '#111'}>Statistics — {section.label}</text>
      <text x={20} y={46} fontSize={12} fill={theme.textMuted || '#667085'}>
        {data.totals.persons} persons · {data.totals.families} families · {data.totals.places} places
      </text>
      {rows.length === 0 && <text x={20} y={top + 20} fontSize={13} fill={theme.textMuted || '#667085'}>No data for this statistic.</text>}
      {graphType === 'lines'
        ? <LineSeries rows={rows} top={top} labelW={labelW} barAreaW={barAreaW} max={max} height={height} theme={theme} />
        : rows.map((row, i) => {
            const y = top + i * rowH;
            const w = Math.round((row.value / max) * barAreaW);
            return (
              <g key={`${row.label}-${i}`}>
                <text x={labelW - 8} y={y + rowH / 2 + 4} fontSize={12} textAnchor="end" fill={theme.text || '#111'}>{trim(row.label, 24)}</text>
                <rect x={labelW} y={y + 5} width={Math.max(1, w)} height={rowH - 12} rx={3} fill={BAR_COLOR} opacity={0.85} />
                <text x={labelW + w + 6} y={y + rowH / 2 + 4} fontSize={11} fill={theme.textMuted || '#667085'}>{row.value.toLocaleString()}</text>
              </g>
            );
          })}
      </svg>
    </div>
  );
}

function LineSeries({ rows, top, labelW, barAreaW, max, height, theme }) {
  if (rows.length === 0) return null;
  const plotW = barAreaW;
  const plotH = height - top - 40;
  const stepX = rows.length > 1 ? plotW / (rows.length - 1) : 0;
  const points = rows.map((row, i) => {
    const x = labelW + i * stepX;
    const y = top + plotH - (row.value / max) * plotH;
    return [x, y];
  });
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <g>
      <path d={path} fill="none" stroke={BAR_COLOR} strokeWidth={2} />
      {points.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={3} fill={BAR_COLOR} />
          <text x={x} y={top + plotH + 16} fontSize={10} textAnchor="middle" fill={theme.textMuted || '#667085'}>{trim(rows[i].label, 8)}</text>
        </g>
      ))}
    </g>
  );
}

function trim(value, max) {
  const s = String(value || '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export const STATISTIC_TYPE_OPTIONS = SECTION_DEFS.map((s) => [s.id, s.label]);

export default StatisticsChart;
