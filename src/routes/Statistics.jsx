/**
 * Statistics — aggregate counts + simple bar charts derived from the imported tree.
 */
import React, { useEffect, useState } from 'react';
import { computeStatistics, statisticsDrilldown } from '../lib/statistics.js';
import { loadGenealogyMetricRecords } from '../lib/genealogyMetrics.js';
import { humanizeType } from '../utils/humanizeType.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { StatisticsDrilldownSheet } from '../components/charts/StatisticsDrilldownSheet.jsx';

function Card({ title, children }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{title}</div>
      {children}
    </div>
  );
}

function StatLine({ label, value, hint, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className="flex w-full items-baseline gap-3 border-b border-border/40 py-1.5 text-start last:border-b-0 enabled:hover:bg-accent">
      <span className="text-sm text-muted-foreground flex-1">{label}</span>
      <span className="text-base font-semibold text-foreground tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </Tag>
  );
}

function HBar({ value, max, label, onClick }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className="flex w-full items-center gap-3 py-1 text-start enabled:hover:bg-accent">
      <span className="text-xs text-muted-foreground w-24 flex-shrink-0 truncate" title={label}>{label}</span>
      <div className="flex-1 h-3 rounded-sm bg-secondary overflow-hidden">
        <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-end text-xs tabular-nums text-foreground">{value}</span>
    </Tag>
  );
}

export default function Statistics() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [records, setRecords] = useState(null);
  const [drilldown, setDrilldown] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const loaded = await loadGenealogyMetricRecords();
      const s = await computeStatistics(loaded);
      if (!cancel) {
        setRecords(loaded);
        setStats(s);
      }
    })();
    return () => { cancel = true; };
  }, []);

  if (!stats) return <div className="p-10 text-muted-foreground">{t('statistics.computing')}</div>;

  const totalGender = stats.genderCounts.male + stats.genderCounts.female + stats.genderCounts.unknown + stats.genderCounts.intersex;
  const maxBirthCentury = Math.max(0, ...stats.birthsByCentury.map(([_, v]) => v));
  const maxSurname = Math.max(0, ...stats.topSurnames.map(([_, v]) => v));
  const maxCountry = Math.max(0, ...stats.countriesByCount.map(([_, v]) => v));
  const openDrilldown = (title, criterion) => {
    if (!records) return;
    setDrilldown({ title, rows: statisticsDrilldown(records, criterion) });
  };

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-6xl mx-auto p-5">
        <h2 className="text-xl font-bold mb-1">{t('statistics.title')}</h2>
        <p className="text-sm text-muted-foreground mb-5">{t('statistics.subtitle')}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <Card title={t('statistics.records')}>
            {Object.entries(stats.counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([type, n]) => (
              <StatLine key={type} label={t(`recordTypes.${type}`, { defaultValue: humanizeType(type) })} value={n.toLocaleString()} onClick={() => openDrilldown(t(`recordTypes.${type}`, { defaultValue: humanizeType(type) }), { kind: 'count', recordType: type })} />
            ))}
          </Card>

          <Card title={t('statistics.people')}>
            <StatLine label={t('statistics.totalPersons')} value={stats.persons.toLocaleString()} onClick={() => openDrilldown(t('statistics.totalPersons'), { kind: 'allPersons' })} />
            <StatLine label={t('statistics.withDeathDate')} value={stats.withDeath.toLocaleString()} onClick={() => openDrilldown(t('statistics.withDeathDate'), { kind: 'withDeath' })} />
            <StatLine label={t('statistics.probablyLiving')} value={stats.probablyLiving.toLocaleString()} hint={t('statistics.probablyLivingHint')} onClick={() => openDrilldown(t('statistics.probablyLiving'), { kind: 'probablyLiving' })} />
            <StatLine label={t('statistics.averageLifespan')} value={stats.avgLifespan ? t('statistics.years', { count: stats.avgLifespan }) : '—'} hint={`n=${stats.lifespanSampleSize}`} />
          </Card>

          <Card title={t('statistics.missingData')}>
            <StatLine label={t('statistics.noBirthDate')} value={stats.noBirthDate.toLocaleString()} onClick={() => openDrilldown(t('statistics.noBirthDate'), { kind: 'noBirthDate' })} />
            <StatLine label={t('statistics.noDeathDate')} value={stats.noDeathDate.toLocaleString()} onClick={() => openDrilldown(t('statistics.noDeathDate'), { kind: 'noDeathDate' })} />
            <StatLine label={t('statistics.noPhoto')} value={stats.noPhoto.toLocaleString()} onClick={() => openDrilldown(t('statistics.noPhoto'), { kind: 'noPhoto' })} />
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <Card title={t('statistics.genderSplit')}>
            <HBar label={t('onboarding.genderMale')} value={stats.genderCounts.male} max={totalGender} onClick={() => openDrilldown(t('onboarding.genderMale'), { kind: 'gender', value: 'male' })} />
            <HBar label={t('onboarding.genderFemale')} value={stats.genderCounts.female} max={totalGender} onClick={() => openDrilldown(t('onboarding.genderFemale'), { kind: 'gender', value: 'female' })} />
            {stats.genderCounts.unknown > 0 && <HBar label={t('statistics.genderUnknown')} value={stats.genderCounts.unknown} max={totalGender} onClick={() => openDrilldown(t('statistics.genderUnknown'), { kind: 'gender', value: 'unknown' })} />}
            {stats.genderCounts.intersex > 0 && <HBar label={t('statistics.genderIntersex')} value={stats.genderCounts.intersex} max={totalGender} onClick={() => openDrilldown(t('statistics.genderIntersex'), { kind: 'gender', value: 'intersex' })} />}
          </Card>

          <Card title={t('statistics.birthsByCentury')}>
            {stats.birthsByCentury.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">{t('statistics.noBirthDates')}</div>
            ) : stats.birthsByCentury.map(([c, v]) => (
              <HBar key={c} label={t('statistics.century', { century: c })} value={v} max={maxBirthCentury} onClick={() => openDrilldown(t('statistics.century', { century: c }), { kind: 'birthCentury', value: c })} />
            ))}
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title={t('statistics.topSurnames')}>
            {stats.topSurnames.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">{t('statistics.noSurnames')}</div>
            ) : stats.topSurnames.map(([name, n]) => (
              <HBar key={name} label={name} value={n} max={maxSurname} onClick={() => openDrilldown(name, { kind: 'surname', value: name })} />
            ))}
          </Card>

          <Card title={t('statistics.placesByCountry')}>
            {stats.countriesByCount.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">{t('statistics.noCountries')}</div>
            ) : stats.countriesByCount.slice(0, 12).map(([name, n]) => (
              <HBar key={name} label={name} value={n} max={maxCountry} onClick={() => openDrilldown(name, { kind: 'placeCountry', value: name })} />
            ))}
          </Card>
        </div>
      </div>
      {drilldown && <StatisticsDrilldownSheet value={drilldown} onClose={() => setDrilldown(null)} />}
    </div>
  );
}
