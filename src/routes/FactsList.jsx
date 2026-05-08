import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListPageHeader } from '../components/lists/SortableListTable.jsx';
import { ConfigurableListTable } from '../components/lists/ConfigurableListTable.jsx';
import { ScopeFilterSelect } from '../components/lists/ScopeFilterSelect.jsx';
import { useScopedRows } from '../components/lists/useScopedRows.js';
import { loadFactRows } from '../lib/listData.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

export default function FactsList() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await loadFactRows();
      if (!cancelled) {
        setRows(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const typeOptions = useMemo(() => [...new Set(rows.map((row) => row.factType).filter(Boolean))].sort(), [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    if (typeFilter && row.factType !== typeFilter) return false;
    if (dateFilter.trim() && !String(row.date || '').toLowerCase().includes(dateFilter.trim().toLowerCase())) return false;
    return true;
  }), [rows, typeFilter, dateFilter]);
  const scoped = useScopedRows(filteredRows, {
    entityType: 'Person',
    rowIds: (row) => row.personId,
  });

  const columns = useMemo(() => [
    {
      key: 'personName',
      label: t('factsList.person'),
      render: (row) => row.personId
        ? <Link to={`/person/${row.personId}`} className="text-primary hover:underline">{row.personName || row.personId}</Link>
        : <span className="text-muted-foreground">{t('factsList.noLinkedPerson')}</span>,
    },
    { key: 'factType', label: t('factsList.fact') },
    {
      key: 'value',
      label: t('factsList.value'),
      render: (row) => row.value || <span className="text-muted-foreground">{t('factsList.noValue')}</span>,
    },
    {
      key: 'date',
      label: t('factsList.date'),
      render: (row) => row.formattedDate || <span className="text-muted-foreground">{t('factsList.noDate')}</span>,
    },
    {
      key: 'action',
      label: t('factsList.action'),
      sortable: false,
      export: false,
      render: (row) => row.personId
        ? <Link to={`/person/${row.personId}`} className="text-xs text-primary hover:underline">{t('factsList.openPerson')}</Link>
        : null,
    },
  ], [t]);

  if (loading) return <div className="p-10 text-muted-foreground">{t('factsList.loading')}</div>;

  const filters = (
    <>
      <label className="text-xs text-muted-foreground ms-auto">{t('factsList.factType')}</label>
      <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="bg-secondary text-foreground border border-border rounded-md px-2.5 py-1.5 text-sm">
        <option value="">{t('factsList.allTypes')}</option>
        {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
      </select>
      <ScopeFilterSelect
        value={scoped.scopeId}
        onChange={scoped.setScopeId}
        scopes={scoped.scopes}
        loading={scoped.loading}
        error={scoped.error}
        label={t('factsList.personScope')}
      />
      <label className="text-xs text-muted-foreground">{t('factsList.date')}</label>
      <input
        value={dateFilter}
        onChange={(event) => setDateFilter(event.target.value)}
        placeholder={t('factsList.datePlaceholder')}
        className="w-32 bg-background text-foreground border border-border rounded-md px-2.5 py-1.5 text-sm outline-none focus:border-primary"
      />
    </>
  );

  return (
    <div className="flex flex-col h-full">
      <ListPageHeader
        title={t('factsList.title')}
        subtitle={t('factsList.subtitle')}
        count={scoped.rows.length}
        total={rows.length}
      />
      <ConfigurableListTable
        listId="facts"
        rows={scoped.rows}
        columns={columns}
        initialSortKey="personName"
        searchPlaceholder={t('factsList.searchPlaceholder')}
        toolbar={filters}
        emptyTitle={t('factsList.emptyTitle')}
        emptyHint={t('factsList.emptyHint')}
      />
    </div>
  );
}
