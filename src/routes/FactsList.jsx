import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListPageHeader, SortableListTable } from '../components/lists/SortableListTable.jsx';
import { loadFactRows } from '../lib/listData.js';

export default function FactsList() {
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

  const columns = useMemo(() => [
    {
      key: 'personName',
      label: 'Person',
      render: (row) => row.personId
        ? <Link to={`/person/${row.personId}`} className="text-primary hover:underline">{row.personName || row.personId}</Link>
        : <span className="text-muted-foreground">No linked person</span>,
    },
    { key: 'factType', label: 'Fact' },
    {
      key: 'value',
      label: 'Value',
      render: (row) => row.value || <span className="text-muted-foreground">No value</span>,
    },
    {
      key: 'date',
      label: 'Date',
      render: (row) => row.formattedDate || <span className="text-muted-foreground">No date</span>,
    },
    {
      key: 'action',
      label: 'Action',
      sortable: false,
      export: false,
      render: (row) => row.personId
        ? <Link to={`/person/${row.personId}`} className="text-xs text-primary hover:underline">Open person</Link>
        : null,
    },
  ], []);

  if (loading) return <div className="p-10 text-muted-foreground">Loading facts...</div>;

  const filters = (
    <>
      <label className="text-xs text-muted-foreground ms-auto">Fact type</label>
      <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="bg-secondary text-foreground border border-border rounded-md px-2.5 py-1.5 text-sm">
        <option value="">All types</option>
        {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
      </select>
      <label className="text-xs text-muted-foreground">Date</label>
      <input
        value={dateFilter}
        onChange={(event) => setDateFilter(event.target.value)}
        placeholder="YYYY or text"
        className="w-32 bg-background text-foreground border border-border rounded-md px-2.5 py-1.5 text-sm outline-none focus:border-primary"
      />
    </>
  );

  return (
    <div className="flex flex-col h-full">
      <ListPageHeader
        title="Facts List"
        subtitle="Report-compatible person facts with type and date filtering."
        count={filteredRows.length}
        total={rows.length}
      />
      <SortableListTable
        rows={filteredRows}
        columns={columns}
        initialSortKey="personName"
        searchPlaceholder="Search facts..."
        toolbar={filters}
        emptyTitle="No facts"
        emptyHint="No PersonFact rows match the current filters."
      />
    </div>
  );
}
