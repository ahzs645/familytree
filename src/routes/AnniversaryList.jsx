import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListPageHeader } from '../components/lists/SortableListTable.jsx';
import { ConfigurableListTable } from '../components/lists/ConfigurableListTable.jsx';
import { ScopeFilterSelect } from '../components/lists/ScopeFilterSelect.jsx';
import { listToolbarInputBaseClass, listToolbarSelectTriggerClass } from '../components/lists/listToolbarClasses.js';
import { useScopedRows } from '../components/lists/useScopedRows.js';
import { loadAnniversaryRows } from '../lib/listData.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

const MONTH_VALUES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

export default function AnniversaryList() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');

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
      render: (row) => <Link to={`/person/${row.personId}`} className="text-primary hover:underline">{row.personName}</Link>,
    },
    {
      key: 'year',
      label: t('anniversaryList.year'),
      sortValue: (row) => row.year || 0,
      render: (row) => row.yearLabel,
    },
    {
      key: 'action',
      label: t('anniversaryList.action'),
      sortable: false,
      export: false,
      render: (row) => <Link to={`/person/${row.personId}`} className="text-xs text-primary hover:underline">{t('anniversaryList.openPerson')}</Link>,
    },
  ], [t]);

  if (loading) return <div className="p-10 text-muted-foreground">{t('anniversaryList.loading')}</div>;

  const filters = (
    <>
      <label className="text-xs text-muted-foreground ms-auto">{t('anniversaryList.filterType')}</label>
      <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={listToolbarSelectTriggerClass}>
        <option value="">{t('anniversaryList.birthAndDeath')}</option>
        <option value="Birth">{t('anniversaryList.birth')}</option>
        <option value="Death">{t('anniversaryList.death')}</option>
      </select>
      <ScopeFilterSelect
        value={scoped.scopeId}
        onChange={scoped.setScopeId}
        scopes={scoped.scopes}
        loading={scoped.loading}
        error={scoped.error}
        label={t('anniversaryList.personScope')}
      />
      <label className="text-xs text-muted-foreground">{t('anniversaryList.month')}</label>
      <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} className={listToolbarSelectTriggerClass}>
        <option value="">{t('anniversaryList.allMonths')}</option>
        {MONTH_VALUES.map((value) => <option key={value} value={value}>{t(`anniversaryList.months.${value}`)}</option>)}
      </select>
      <label className="text-xs text-muted-foreground">{t('anniversaryList.day')}</label>
      <input
        type="number"
        min="1"
        max="31"
        value={dayFilter}
        onChange={(event) => setDayFilter(event.target.value)}
        className={`${listToolbarInputBaseClass} w-20`}
      />
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
        searchPlaceholder={t('anniversaryList.searchPlaceholder')}
        toolbar={filters}
        emptyTitle={t('anniversaryList.emptyTitle')}
        emptyHint={t('anniversaryList.emptyHint')}
      />
    </div>
  );
}
