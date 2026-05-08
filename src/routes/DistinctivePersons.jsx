import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListPageHeader } from '../components/lists/SortableListTable.jsx';
import { ConfigurableListTable } from '../components/lists/ConfigurableListTable.jsx';
import { ScopeFilterSelect } from '../components/lists/ScopeFilterSelect.jsx';
import { useScopedRows } from '../components/lists/useScopedRows.js';
import { loadDistinctivePersonRows } from '../lib/listData.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

const CRITERIA_DEFS = [
  { id: 'marker', test: (row) => !!row.markerField },
  { id: 'bookmarked', test: (row) => row.bookmarked },
  { id: 'startPerson', test: (row) => row.startPerson },
  { id: 'missingBirth', test: (row) => !row.birthDate },
  { id: 'missingDeath', test: (row) => !row.deathDate },
  { id: 'missingSurname', test: (row) => !row.lastName },
  { id: 'longLifespan', test: (row) => row.birthYear && row.deathYear && row.deathYear - row.birthYear >= 90 },
  { id: 'hasPhoto', test: (row) => row.hasPhoto },
];

export default function DistinctivePersons() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [matchMode, setMatchMode] = useState('any');
  const [selectedCriteria, setSelectedCriteria] = useState(() => new Set(['marker']));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await loadDistinctivePersonRows();
      if (!cancelled) {
        setRows(next);
        if (!next.some((row) => row.markerField)) setSelectedCriteria(new Set(['bookmarked', 'startPerson', 'missingBirth']));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasMarker = rows.some((row) => row.markerField);
  const filteredRows = useMemo(() => {
    const active = CRITERIA_DEFS.filter((criterion) => selectedCriteria.has(criterion.id));
    if (active.length === 0) return rows;
    return rows.filter((row) => {
      const matches = active.map((criterion) => criterion.test(row));
      return matchMode === 'all' ? matches.every(Boolean) : matches.some(Boolean);
    });
  }, [rows, selectedCriteria, matchMode]);
  const scoped = useScopedRows(filteredRows, {
    entityType: 'Person',
  });

  const columns = useMemo(() => [
    {
      key: 'fullName',
      label: t('distinctivePersons.name'),
      render: (row) => <Link to={`/person/${row.id}`} className="text-primary hover:underline">{row.fullName}</Link>,
    },
    { key: 'genderLabel', label: t('distinctivePersons.gender') },
    {
      key: 'birthDate',
      label: t('distinctivePersons.born'),
      render: (row) => row.birthDate || <span className="text-muted-foreground">{t('distinctivePersons.noDate')}</span>,
    },
    {
      key: 'deathDate',
      label: t('distinctivePersons.died'),
      render: (row) => row.deathDate || <span className="text-muted-foreground">{t('distinctivePersons.noDate')}</span>,
    },
    {
      key: 'signals',
      label: t('distinctivePersons.signals'),
      sortValue: (row) => row.tags.length,
      searchValue: (row) => row.tags.join(' '),
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.tags.length ? row.tags.map((tag) => (
            <span key={tag} className="rounded border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">{tag}</span>
          )) : <span className="text-muted-foreground">{t('distinctivePersons.noSignals')}</span>}
        </div>
      ),
    },
    {
      key: 'action',
      label: t('distinctivePersons.action'),
      sortable: false,
      export: false,
      render: (row) => <Link to={`/person/${row.id}`} className="text-xs text-primary hover:underline">{t('distinctivePersons.openPerson')}</Link>,
    },
  ], [t]);

  const toggleCriterion = (id) => {
    setSelectedCriteria((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) return <div className="p-10 text-muted-foreground">{t('distinctivePersons.loading')}</div>;

  const filters = (
    <div className="ms-auto flex flex-wrap items-center gap-2">
      <ScopeFilterSelect
        value={scoped.scopeId}
        onChange={scoped.setScopeId}
        scopes={scoped.scopes}
        loading={scoped.loading}
        error={scoped.error}
        label={t('distinctivePersons.personScope')}
      />
      <select value={matchMode} onChange={(event) => setMatchMode(event.target.value)} className="bg-secondary text-foreground border border-border rounded-md px-2.5 py-1.5 text-sm">
        <option value="any">{t('distinctivePersons.matchAny')}</option>
        <option value="all">{t('distinctivePersons.matchAll')}</option>
      </select>
      {CRITERIA_DEFS.map((criterion) => (
        <label key={criterion.id} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-md px-2.5 py-1.5 bg-secondary">
          <input type="checkbox" checked={selectedCriteria.has(criterion.id)} onChange={() => toggleCriterion(criterion.id)} />
          {t(`distinctivePersons.criteria.${criterion.id}`)}
        </label>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <ListPageHeader
        title={t('distinctivePersons.title')}
        subtitle={hasMarker ? t('distinctivePersons.subtitleWithMarker') : t('distinctivePersons.subtitleNoMarker')}
        count={scoped.rows.length}
        total={rows.length}
      />
      <ConfigurableListTable
        listId="distinctive-persons"
        rows={scoped.rows}
        columns={columns}
        initialSortKey="signals"
        initialSortDirection="desc"
        searchPlaceholder={t('distinctivePersons.searchPlaceholder')}
        toolbar={filters}
        emptyTitle={t('distinctivePersons.emptyTitle')}
        emptyHint={t('distinctivePersons.emptyHint')}
      />
    </div>
  );
}
