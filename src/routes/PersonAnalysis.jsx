import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListPageHeader, SortableListTable } from '../components/lists/SortableListTable.jsx';
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
    if (filter === 'orphaned') return row.orphanedRelationships > 0;
    if (filter === 'duplicates') return row.duplicateRisk !== 'Low';
    return true;
  }), [rows, filter]);

  const columns = useMemo(() => [
    {
      key: 'personName',
      label: 'Person',
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
      label: 'Orphaned Relationships',
      render: (row) => row.orphanedRelationships ? (
        <div>
          <div>{row.orphanedRelationships}</div>
          <div className="text-xs text-muted-foreground mt-1">{row.relationshipIssues.slice(0, 2).join('; ')}</div>
        </div>
      ) : <span className="text-muted-foreground">0</span>,
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
  ], []);

  if (loading) return <div className="p-10 text-muted-foreground">Analyzing persons...</div>;

  const filters = (
    <div className="ms-auto flex flex-wrap gap-2">
      {[
        ['attention', 'Needs attention'],
        ['missing-dates', 'Missing dates'],
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
  );

  return (
    <div className="flex flex-col h-full">
      <ListPageHeader
        title="Person Analysis"
        subtitle="Reusable metrics for age, missing dates, broken relationship links, and duplicate risk."
        count={filteredRows.length}
        total={rows.length}
      />
      <SortableListTable
        rows={filteredRows}
        columns={columns}
        initialSortKey="orphanedRelationships"
        initialSortDirection="desc"
        searchPlaceholder="Search person analysis..."
        toolbar={filters}
        emptyTitle="No analysis rows"
        emptyHint="No persons match the current analysis filter."
      />
    </div>
  );
}
