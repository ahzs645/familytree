/**
 * Statistics chart (#20) — renders the comprehensive tree statistics produced by
 * the (previously orphaned) `lib/chartData/statisticsBuilder.js` as a dashboard
 * of bar-chart sections. Mirrors MacFamilyTree's "Statistics" chart pane, with a
 * Bars / Lines toggle and a section selector.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { buildStatisticsData } from '../../lib/chartData/statisticsBuilder.js';
import { loadGenealogyMetricRecords } from '../../lib/genealogyMetrics.js';
import { statisticsDrilldown } from '../../lib/statistics.js';
import { DEFAULT_THEME } from './theme.js';
import { formClasses } from '../ui/formClasses.js';
import { cn } from '../../lib/utils.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { StatisticsDrilldownSheet } from './StatisticsDrilldownSheet.jsx';

const SECTION_DEFS = [
  { id: 'gender', label: 'Persons by gender', pick: (d) => mapPairs(d.gender) },
  { id: 'birthsByCentury', label: 'Births by century', pick: (d) => listPairs(d.birthsByCentury, 'century', 'count') },
  { id: 'deathsByCentury', label: 'Deaths by century', pick: (d) => listPairs(d.deathsByCentury, 'century', 'count') },
  { id: 'surnames', label: 'Most common surnames', pick: (d) => listPairs(d.surnames, 'name', 'count') },
  { id: 'countries', label: 'Places by country', pick: (d) => listPairs(d.countries, 'name', 'count') },
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
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');
  const [statisticType, setStatisticType] = useState('gender');
  const [graphType, setGraphType] = useState('bars');
  const [drilldown, setDrilldown] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([buildStatisticsData({}), loadGenealogyMetricRecords()])
      .then(([result, loaded]) => { if (!cancelled) { setData(result); setRecords(loaded); } })
      .catch((err) => { if (!cancelled) setError(err?.message || t('statistics.chart.computeError')); });
    return () => { cancelled = true; };
  }, [t]);

  const section = useMemo(() => SECTION_DEFS.find((s) => s.id === statisticType) || SECTION_DEFS[0], [statisticType]);
  const rows = useMemo(() => (data ? section.pick(data) : []), [data, section]);

  if (error) return <div className="p-10 text-sm text-destructive-text">{error}</div>;
  if (!data) return <div className="p-10 text-sm text-muted-foreground">{t('statistics.computing')}</div>;

  const openRow = (row) => {
    const criterion = chartCriterion(section.id, row.label);
    if (!criterion || !records) return;
    setDrilldown({ title: row.label, rows: statisticsDrilldown(records, criterion) });
  };

  const selectClasses = cn(formClasses.input, 'w-auto bg-secondary px-2 py-1 text-xs');
  const controls = (
    <div className="flex flex-wrap gap-2 p-2.5">
      <select aria-label={t('statistics.chart.statistic')} value={statisticType} onChange={(e) => setStatisticType(e.target.value)} className={selectClasses}>
        {SECTION_DEFS.map((s) => <option key={s.id} value={s.id}>{t(`statistics.chart.sections.${s.id}`, { defaultValue: s.label })}</option>)}
      </select>
      <select aria-label={t('statistics.chart.graphType')} value={graphType} onChange={(e) => setGraphType(e.target.value)} className={selectClasses}>
        <option value="bars">{t('statistics.chart.bars')}</option>
        <option value="lines">{t('statistics.chart.lines')}</option>
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
    <div className="h-full overflow-auto">
      {controls}
      <svg ref={chartCanvasRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ background: theme.background || '#fff', fontFamily: theme.fontFamily }}>
      <text x={20} y={28} fontSize={18} fontWeight={700} fill={theme.text || '#111'}>{t('statistics.title')} — {t(`statistics.chart.sections.${section.id}`, { defaultValue: section.label })}</text>
      <text x={20} y={46} fontSize={12} fill={theme.textMuted || '#667085'}>
        {t('statistics.chart.totals', { persons: data.totals.persons, families: data.totals.families, places: data.totals.places })}
      </text>
      {rows.length === 0 && <text x={20} y={top + 20} fontSize={13} fill={theme.textMuted || '#667085'}>{t('statistics.chart.noData')}</text>}
      {graphType === 'lines'
        ? <LineSeries rows={rows} top={top} labelW={labelW} barAreaW={barAreaW} max={max} height={height} theme={theme} onPick={openRow} />
        : rows.map((row, i) => {
            const y = top + i * rowH;
            const w = Math.round((row.value / max) * barAreaW);
            return (
              <g key={`${row.label}-${i}`}>
                <text x={labelW - 8} y={y + rowH / 2 + 4} fontSize={12} textAnchor="end" fill={theme.text || '#111'}>{trim(row.label, 24)}</text>
                <rect role={chartCriterion(section.id, row.label) ? 'button' : undefined} tabIndex={chartCriterion(section.id, row.label) ? 0 : undefined} aria-label={chartCriterion(section.id, row.label) ? t('statistics.chart.openBucket', { label: row.label }) : undefined} onClick={() => openRow(row)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openRow(row); }} className={chartCriterion(section.id, row.label) ? 'cursor-pointer' : ''} x={labelW} y={y + 5} width={Math.max(1, w)} height={rowH - 12} rx={3} fill={BAR_COLOR} opacity={0.85} />
                <text x={labelW + w + 6} y={y + rowH / 2 + 4} fontSize={11} fill={theme.textMuted || '#667085'}>{row.value.toLocaleString()}</text>
              </g>
            );
          })}
      </svg>
      {drilldown && <StatisticsDrilldownSheet value={drilldown} onClose={() => setDrilldown(null)} />}
    </div>
  );
}

function LineSeries({ rows, top, labelW, barAreaW, max, height, theme, onPick }) {
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
          <circle onClick={() => onPick(rows[i])} className="cursor-pointer" cx={x} cy={y} r={5} fill={BAR_COLOR} />
          <text x={x} y={top + plotH + 16} fontSize={10} textAnchor="middle" fill={theme.textMuted || '#667085'}>{trim(rows[i].label, 8)}</text>
        </g>
      ))}
    </g>
  );
}

function chartCriterion(sectionId, label) {
  if (sectionId === 'gender') return { kind: 'gender', value: label };
  if (sectionId === 'birthsByCentury') return { kind: 'birthCentury', value: Number(label) };
  if (sectionId === 'deathsByCentury') return { kind: 'deathCentury', value: Number(label) };
  if (sectionId === 'surnames') return { kind: 'surname', value: label };
  if (sectionId === 'countries') return { kind: 'placeCountry', value: label };
  if (sectionId === 'occupations') return { kind: 'occupation', value: label };
  if (sectionId === 'childrenPerFamily') return { kind: 'childrenPerFamily', value: Number(label) };
  if (sectionId === 'ageAtMarriage') return { kind: 'ageAtMarriage', value: label };
  if (sectionId === 'marriageMonths') return { kind: 'marriageMonth', value: label };
  return null;
}

function trim(value, max) {
  const s = String(value || '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export default StatisticsChart;
