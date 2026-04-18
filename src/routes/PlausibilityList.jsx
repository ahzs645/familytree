import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListPageHeader, SortableListTable } from '../components/lists/SortableListTable.jsx';
import { runPlausibilityChecks } from '../lib/plausibility.js';

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
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState('');

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

  const columns = useMemo(() => [
    {
      key: 'severity',
      label: 'Severity',
      sortValue: (row) => ({ high: 3, medium: 2, low: 1 }[row.severity] || 0),
      render: (row) => (
        <span className={`inline-block text-[10px] font-bold uppercase tracking-wide rounded border px-2 py-0.5 min-w-[62px] text-center ${SEVERITY_CLASS[row.severity] || SEVERITY_CLASS.low}`}>
          {row.severity}
        </span>
      ),
    },
    { key: 'rule', label: 'Rule' },
    {
      key: 'recordName',
      label: 'Record',
      render: (row) => <Link to={recordHref(row)} className="text-primary hover:underline">{row.recordName}</Link>,
    },
    { key: 'message', label: 'Message' },
    {
      key: 'action',
      label: 'Action',
      sortable: false,
      export: false,
      render: (row) => <Link to={recordHref(row)} className="text-xs text-primary hover:underline">Open</Link>,
    },
  ], []);

  if (loading) return <div className="p-10 text-muted-foreground">Running plausibility checks...</div>;

  const filters = (
    <div className="ml-auto flex flex-wrap gap-2">
      {[['', `All (${warnings.length})`], ['high', `High (${counts.high || 0})`], ['medium', `Medium (${counts.medium || 0})`], ['low', `Low (${counts.low || 0})`]].map(([id, label]) => (
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
        title="Plausibility List"
        subtitle="Dedicated list route for the same checker output, with sortable columns and editor links."
        count={filteredWarnings.length}
        total={warnings.length}
      />
      <SortableListTable
        rows={filteredWarnings}
        columns={columns}
        initialSortKey="severity"
        initialSortDirection="desc"
        searchPlaceholder="Search warnings..."
        toolbar={filters}
        emptyTitle={warnings.length === 0 ? 'No plausibility issues found' : 'No warnings at this severity'}
        emptyHint={warnings.length === 0 ? 'The current tree passed all implemented plausibility rules.' : 'Choose another severity or clear the search text.'}
      />
    </div>
  );
}
