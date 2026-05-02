import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListPageHeader } from '../components/lists/SortableListTable.jsx';
import { ConfigurableListTable } from '../components/lists/ConfigurableListTable.jsx';
import { ScopeFilterSelect } from '../components/lists/ScopeFilterSelect.jsx';
import { useScopedRows } from '../components/lists/useScopedRows.js';
import { SORT_PROFILES, useSortProfile } from '../components/lists/useSortProfile.js';
import { loadPersonAnalysisRows } from '../lib/listData.js';

const RISK_CLASS = {
  High: 'text-destructive border-destructive/40',
  Medium: 'text-amber-500 border-amber-500/40',
  Low: 'text-muted-foreground border-border',
};

export default function PersonAnalysis() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('attention');
  const sortProfile = useSortProfile('person-analysis', SORT_PROFILES.PersonAnalysis, 'orphanedRelationships');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await loadPersonAnalysisRows();
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
    if (filter === 'attention') return row.attentionScore > 0;
    if (filter === 'missing-dates') return row.missingDates.length > 0;
    if (filter === 'unsourced') return row.sourceState !== 'Supported';
    if (filter === 'unplaced') return row.unplacedEvents > 0;
    if (filter === 'parents') return row.parentCount === 0;
    if (filter === 'impossible') return row.impossibleAgeIssues.length > 0;
    if (filter === 'orphaned') return row.orphanedRelationships > 0;
    if (filter === 'duplicates') return row.duplicateRisk !== 'Low';
    return true;
  }), [rows, filter]);
  const scoped = useScopedRows(filteredRows, {
    entityType: 'Person',
    rowIds: (row) => row.personId,
  });

  const summary = useMemo(() => ({
    attention: rows.filter((row) => row.attentionScore > 0).length,
    unsourced: rows.filter((row) => row.sourceState !== 'Supported').length,
    unplaced: rows.filter((row) => row.unplacedEvents > 0).length,
    parents: rows.filter((row) => row.parentCount === 0).length,
    impossible: rows.filter((row) => row.impossibleAgeIssues.length > 0).length,
    duplicates: rows.filter((row) => row.duplicateRisk !== 'Low').length,
  }), [rows]);

  const columns = useMemo(() => [
    {
      key: 'personName',
      label: 'Person',
      alwaysVisible: true,
      render: (row) => <Link to={`/person/${row.personId}`} className="text-primary hover:underline">{row.personName}</Link>,
    },
    {
      key: 'age',
      label: 'Age',
      sortValue: (row) => row.age ?? -1,
      render: (row) => row.ageLabel,
    },
    {
      key: 'missingDateLabel',
      label: 'Missing Dates',
      sortValue: (row) => row.missingDates.length,
      render: (row) => row.missingDates.length ? row.missingDateLabel : <span className="text-muted-foreground">None</span>,
    },
    {
      key: 'orphanedRelationships',
      label: 'Research Gaps',
      render: (row) => row.orphanedRelationships ? (
        <div>
          <div>{row.orphanedRelationships}</div>
          <div className="text-xs text-muted-foreground mt-1">{row.relationshipIssues.slice(0, 2).join('; ')}</div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          {row.parentCount === 0 ? 'No parents' : `${row.parentCount} parent${row.parentCount === 1 ? '' : 's'}`}
          {row.unplacedEvents ? ` · ${row.unplacedEvents} unplaced` : ''}
          {row.impossibleAgeIssues.length ? ` · ${row.impossibleAgeIssues[0]}` : ''}
        </div>
      ),
    },
    {
      key: 'sourceState',
      label: 'Evidence',
      sortValue: (row) => row.sourceCount,
      render: (row) => (
        <div>
          <span className={`inline-block text-[10px] font-bold uppercase tracking-wide rounded border px-2 py-0.5 ${
            row.sourceState === 'Supported' ? 'text-emerald-600 border-emerald-600/40' : row.sourceState === 'Weak' ? 'text-amber-500 border-amber-500/40' : 'text-destructive border-destructive/40'
          }`}>
            {row.sourceState}
          </span>
          <div className="mt-1 text-xs text-muted-foreground">{row.sourceCount} source link{row.sourceCount === 1 ? '' : 's'}</div>
        </div>
      ),
    },
    {
      key: 'duplicateRisk',
      label: 'Duplicate Risk',
      render: (row) => (
        <span className={`inline-block text-[10px] font-bold uppercase tracking-wide rounded border px-2 py-0.5 min-w-[62px] text-center ${RISK_CLASS[row.duplicateRisk]}`}>
          {row.duplicateRisk}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      sortable: false,
      export: false,
      render: (row) => <Link to={`/person/${row.personId}`} className="text-xs text-primary hover:underline">Open person</Link>,
    },
    { key: 'personId', label: 'Person ID', defaultVisible: false },
  ], []);

  if (loading) return <div className="p-10 text-muted-foreground">Analyzing persons...</div>;

  const filters = (
    <>
    <div className="ms-auto flex flex-wrap gap-2">
      {[
        ['attention', 'Needs attention'],
        ['missing-dates', 'Missing dates'],
        ['unsourced', 'Unsourced/weak'],
        ['unplaced', 'Unplaced events'],
        ['parents', 'No parents'],
        ['impossible', 'Impossible ages'],
        ['orphaned', 'Orphaned links'],
        ['duplicates', 'Duplicate risk'],
        ['all', 'All persons'],
      ].map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => setFilter(id)}
          className={`text-xs px-3 py-1.5 rounded-md border ${filter === id ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-secondary text-foreground'}`}
        >
          {label}
        </button>
      ))}
    </div>
    <ScopeFilterSelect
      value={scoped.scopeId}
      onChange={scoped.setScopeId}
      scopes={scoped.scopes}
      loading={scoped.loading}
      error={scoped.error}
      label="Person scope"
    />
    </>
  );

  return (
    <div className="flex flex-col h-full">
      <ListPageHeader
        title="Research Dashboard"
        subtitle="Queues for missing dates, source coverage, parent gaps, unplaced events, impossible ages, and duplicate candidates."
        count={scoped.rows.length}
        total={rows.length}
      />
      <div className="grid grid-cols-2 gap-3 border-b border-border bg-card px-5 py-3 md:grid-cols-6">
        {[
          ['Needs attention', summary.attention],
          ['Unsourced/weak', summary.unsourced],
          ['Unplaced events', summary.unplaced],
          ['No parents', summary.parents],
          ['Impossible ages', summary.impossible],
          ['Duplicate risk', summary.duplicates],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-border bg-background px-3 py-2">
            <div className="text-lg font-semibold tabular-nums">{value}</div>
            <div className="text-[11px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      <ConfigurableListTable
        listId="person-analysis"
        rows={scoped.rows}
        columns={columns}
        initialSortKey="orphanedRelationships"
        initialSortDirection="desc"
        sortProfile={sortProfile}
        searchPlaceholder="Search person analysis..."
        toolbar={filters}
        emptyTitle="No analysis rows"
        emptyHint="No persons match the current analysis filter."
      />
    </div>
  );
}
