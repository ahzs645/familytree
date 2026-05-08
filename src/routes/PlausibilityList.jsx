import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListPageHeader } from '../components/lists/SortableListTable.jsx';
import { ConfigurableListTable } from '../components/lists/ConfigurableListTable.jsx';
import { SORT_PROFILES, useSortProfile } from '../components/lists/useSortProfile.js';
import { runPlausibilityChecks } from '../lib/plausibility.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

const SEVERITY_CLASS = {
  high: 'text-destructive border-destructive/40',
  medium: 'text-amber-500 border-amber-500/40',
  low: 'text-muted-foreground border-border',
};

function recordHref(row) {
  if (row.recordType === 'Family') return `/family/${row.recordName}`;
  return `/person/${row.recordName}`;
}

export default function PlausibilityList() {
  const { t } = useTranslation();
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState('');
  const sortProfile = useSortProfile('plausibility', SORT_PROFILES.Plausibility, 'severity');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await runPlausibilityChecks();
      if (!cancelled) {
        setWarnings(next.map((warning, index) => ({ ...warning, id: `${warning.recordName}-${warning.rule}-${index}` })));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredWarnings = useMemo(
    () => severity ? warnings.filter((warning) => warning.severity === severity) : warnings,
    [warnings, severity]
  );

  const counts = useMemo(() => warnings.reduce((acc, warning) => {
    acc[warning.severity] = (acc[warning.severity] || 0) + 1;
    return acc;
  }, {}), [warnings]);

  const severityLabel = (level) => t(`plausibilityList.severity${level.charAt(0).toUpperCase()}${level.slice(1)}`);

  const columns = useMemo(() => [
    {
      key: 'severity',
      label: t('plausibilityList.severity'),
      sortValue: (row) => ({ high: 3, medium: 2, low: 1 }[row.severity] || 0),
      render: (row) => (
        <span className={`inline-block text-[10px] font-bold uppercase tracking-wide rounded border px-2 py-0.5 min-w-[62px] text-center ${SEVERITY_CLASS[row.severity] || SEVERITY_CLASS.low}`}>
          {severityLabel(row.severity)}
        </span>
      ),
    },
    { key: 'rule', label: t('plausibilityList.rule') },
    { key: 'recordType', label: t('plausibilityList.recordType'), defaultVisible: false },
    {
      key: 'recordName',
      label: t('plausibilityList.record'),
      alwaysVisible: true,
      render: (row) => <Link to={recordHref(row)} className="text-primary hover:underline">{row.recordName}</Link>,
    },
    { key: 'message', label: t('plausibilityList.message') },
    {
      key: 'action',
      label: t('plausibilityList.action'),
      sortable: false,
      export: false,
      render: (row) => <Link to={recordHref(row)} className="text-xs text-primary hover:underline">{t('plausibilityList.open')}</Link>,
    },
  ], [t]);

  if (loading) return <div className="p-10 text-muted-foreground">{t('plausibilityList.loading')}</div>;

  const filters = (
    <div className="ms-auto flex flex-wrap gap-2">
      {[
        ['', t('plausibilityList.filterAll', { count: warnings.length })],
        ['high', t('plausibilityList.filterHigh', { count: counts.high || 0 })],
        ['medium', t('plausibilityList.filterMedium', { count: counts.medium || 0 })],
        ['low', t('plausibilityList.filterLow', { count: counts.low || 0 })],
      ].map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => setSeverity(id)}
          className={`text-xs px-3 py-1.5 rounded-md border ${severity === id ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-secondary text-foreground'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <ListPageHeader
        title={t('plausibilityList.title')}
        subtitle={t('plausibilityList.subtitle')}
        count={filteredWarnings.length}
        total={warnings.length}
      />
      <ConfigurableListTable
        listId="plausibility"
        rows={filteredWarnings}
        columns={columns}
        initialSortKey="severity"
        initialSortDirection="desc"
        sortProfile={sortProfile}
        searchPlaceholder={t('plausibilityList.searchPlaceholder')}
        toolbar={filters}
        emptyTitle={warnings.length === 0 ? t('plausibilityList.emptyAllTitle') : t('plausibilityList.emptyFilteredTitle')}
        emptyHint={warnings.length === 0 ? t('plausibilityList.emptyAllHint') : t('plausibilityList.emptyFilteredHint')}
      />
    </div>
  );
}
