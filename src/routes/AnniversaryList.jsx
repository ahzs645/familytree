import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListPageHeader } from '../components/lists/SortableListTable.jsx';
import { ConfigurableListTable } from '../components/lists/ConfigurableListTable.jsx';
import { ScopeFilterSelect } from '../components/lists/ScopeFilterSelect.jsx';
import { listToolbarInputBaseClass, listToolbarSelectTriggerClass } from '../components/lists/listToolbarClasses.js';
import { useScopedRows } from '../components/lists/useScopedRows.js';
import { loadAnniversaryRows } from '../lib/listData.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { useSortProfile } from '../components/lists/useSortProfile.js';

const MONTH_VALUES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

export default function AnniversaryList() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const sortOptions = useMemo(() => [
    { key: 'monthDay', label: t('anniversaryList.monthDay') },
    { key: 'type', label: t('anniversaryList.type') },
    { key: 'personName', label: t('anniversaryList.person') },
    { key: 'year', label: t('anniversaryList.year') },
  ], [t]);
  const sortProfile = useSortProfile('anniversaries', sortOptions, 'monthDay');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await loadAnniversaryRows();
      if (!cancelled) {
        setRows(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (typeFilter && row.type !== typeFilter) return false;
    if (monthFilter && row.month !== Number(monthFilter)) return false;
    if (dayFilter && row.day !== Number(dayFilter)) return false;
    return true;
  }), [rows, typeFilter, monthFilter, dayFilter]);
  const scoped = useScopedRows(filteredRows, {
    entityType: 'Person',
    rowIds: (row) => row.personId,
  });

  const columns = useMemo(() => [
    {
      key: 'monthDay',
      label: t('anniversaryList.monthDay'),
      render: (row) => row.monthDayLabel,
    },
    { key: 'type', label: t('anniversaryList.type') },
    {
      key: 'personName',
      label: t('anniversaryList.person'),
      render: (row) => <Link to={`/person/${row.personId}`} className="text-interactive hover:underline">{row.personName}</Link>,
    },
    {
      key: 'year',
      label: t('anniversaryList.year'),
      sortValue: (row) => row.year || 0,
      render: (row) => row.yearLabel,
    },
    {
      key: 'yearsAgo',
      label: t('anniversaryList.yearsAgo'),
      sortValue: (row) => (row.year ? currentYear - row.year : -1),
      render: (row) => (row.year ? t('anniversaryList.yearsAgoValue', { count: currentYear - row.year }) : '—'),
    },
    {
      key: 'action',
      label: t('anniversaryList.action'),
      sortable: false,
      export: false,
      render: (row) => <Link to={`/person/${row.personId}`} className="text-xs text-interactive hover:underline">{t('anniversaryList.openPerson')}</Link>,
    },
  ], [t, currentYear]);
  const groupOptions = useMemo(() => [
    { key: 'none', label: t('lists.groups.none') },
    { key: 'type', label: t('anniversaryList.type'), getGroup: (row) => row.type },
    { key: 'month', label: t('anniversaryList.month'), getGroup: (row) => t(`anniversaryList.months.${row.month}`) },
    { key: 'year', label: t('anniversaryList.year'), getGroup: (row) => row.yearLabel },
  ], [t]);

  if (loading) return <div className="p-10 text-muted-foreground">{t('anniversaryList.loading')}</div>;

  const filters = (
    <>
      <label className="ms-auto flex items-center gap-2 text-xs text-muted-foreground">
      <span>{t('anniversaryList.filterType')}</span>
      <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={listToolbarSelectTriggerClass}>
        <option value="">{t('anniversaryList.birthAndDeath')}</option>
        <option value="Birth">{t('anniversaryList.birth')}</option>
        <option value="Death">{t('anniversaryList.death')}</option>
      </select>
      </label>
      <ScopeFilterSelect
        value={scoped.scopeId}
        onChange={scoped.setScopeId}
        scopes={scoped.scopes}
        loading={scoped.loading}
        error={scoped.error}
        label={t('anniversaryList.personScope')}
      />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{t('anniversaryList.month')}</span>
      <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} className={listToolbarSelectTriggerClass}>
        <option value="">{t('anniversaryList.allMonths')}</option>
        {MONTH_VALUES.map((value) => <option key={value} value={value}>{t(`anniversaryList.months.${value}`)}</option>)}
      </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{t('anniversaryList.day')}</span>
      <input
        type="number"
        min="1"
        max="31"
        value={dayFilter}
        onChange={(event) => setDayFilter(event.target.value)}
        className={`${listToolbarInputBaseClass} w-20`}
      />
      </label>
    </>
  );

  return (
    <div className="flex flex-col h-full">
      <ListPageHeader
        title={t('anniversaryList.title')}
        subtitle={t('anniversaryList.subtitle')}
        count={scoped.rows.length}
        total={rows.length}
      />
      <ConfigurableListTable
        listId="anniversaries"
        rows={scoped.rows}
        columns={columns}
        initialSortKey="monthDay"
        sortProfile={sortProfile}
        groupOptions={groupOptions}
        searchPlaceholder={t('anniversaryList.searchPlaceholder')}
        toolbar={filters}
        emptyTitle={t('anniversaryList.emptyTitle')}
        emptyHint={t('anniversaryList.emptyHint')}
      />
    </div>
  );
}
