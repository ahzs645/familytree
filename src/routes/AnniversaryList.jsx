import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListPageHeader, SortableListTable } from '../components/lists/SortableListTable.jsx';
import { loadAnniversaryRows } from '../lib/listData.js';

const MONTHS = [
  ['1', 'January'],
  ['2', 'February'],
  ['3', 'March'],
  ['4', 'April'],
  ['5', 'May'],
  ['6', 'June'],
  ['7', 'July'],
  ['8', 'August'],
  ['9', 'September'],
  ['10', 'October'],
  ['11', 'November'],
  ['12', 'December'],
];

export default function AnniversaryList() {
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

  const columns = useMemo(() => [
    {
      key: 'monthDay',
      label: 'Month/Day',
      render: (row) => row.monthDayLabel,
    },
    { key: 'type', label: 'Type' },
    {
      key: 'personName',
      label: 'Person',
      render: (row) => <Link to={`/person/${row.personId}`} className="text-primary hover:underline">{row.personName}</Link>,
    },
    {
      key: 'year',
      label: 'Year',
      sortValue: (row) => row.year || 0,
      render: (row) => row.yearLabel,
    },
    {
      key: 'action',
      label: 'Action',
      sortable: false,
      export: false,
      render: (row) => <Link to={`/person/${row.personId}`} className="text-xs text-primary hover:underline">Open person</Link>,
    },
  ], []);

  if (loading) return <div className="p-10 text-muted-foreground">Loading anniversaries...</div>;

  const filters = (
    <>
      <label className="text-xs text-muted-foreground ml-auto">Type</label>
      <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="bg-secondary text-foreground border border-border rounded-md px-2.5 py-1.5 text-sm">
        <option value="">Birth and death</option>
        <option value="Birth">Birth</option>
        <option value="Death">Death</option>
      </select>
      <label className="text-xs text-muted-foreground">Month</label>
      <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} className="bg-secondary text-foreground border border-border rounded-md px-2.5 py-1.5 text-sm">
        <option value="">All months</option>
        {MONTHS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label className="text-xs text-muted-foreground">Day</label>
      <input
        type="number"
        min="1"
        max="31"
        value={dayFilter}
        onChange={(event) => setDayFilter(event.target.value)}
        className="w-20 bg-background text-foreground border border-border rounded-md px-2.5 py-1.5 text-sm outline-none focus:border-primary"
      />
    </>
  );

  return (
    <div className="flex flex-col h-full">
      <ListPageHeader
        title="Anniversary List"
        subtitle="Birth and death anniversaries with month/day filtering and readable years."
        count={filteredRows.length}
        total={rows.length}
      />
      <SortableListTable
        rows={filteredRows}
        columns={columns}
        initialSortKey="monthDay"
        searchPlaceholder="Search anniversaries..."
        toolbar={filters}
        emptyTitle="No anniversaries"
        emptyHint="No birth or death dates with month and day match the current filters."
      />
    </div>
  );
}
