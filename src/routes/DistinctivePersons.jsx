import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListPageHeader, SortableListTable } from '../components/lists/SortableListTable.jsx';
import { loadDistinctivePersonRows } from '../lib/listData.js';

const CRITERIA = [
  { id: 'marker', label: 'Distinctive marker', test: (row) => !!row.markerField },
  { id: 'bookmarked', label: 'Bookmarked', test: (row) => row.bookmarked },
  { id: 'startPerson', label: 'Start person', test: (row) => row.startPerson },
  { id: 'missingBirth', label: 'Missing birth date', test: (row) => !row.birthDate },
  { id: 'missingDeath', label: 'Missing death date', test: (row) => !row.deathDate },
  { id: 'missingSurname', label: 'Missing surname', test: (row) => !row.lastName },
  { id: 'longLifespan', label: 'Long lifespan', test: (row) => row.birthYear && row.deathYear && row.deathYear - row.birthYear >= 90 },
  { id: 'hasPhoto', label: 'Has photo', test: (row) => row.hasPhoto },
];

export default function DistinctivePersons() {
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
    const active = CRITERIA.filter((criterion) => selectedCriteria.has(criterion.id));
    if (active.length === 0) return rows;
    return rows.filter((row) => {
      const matches = active.map((criterion) => criterion.test(row));
      return matchMode === 'all' ? matches.every(Boolean) : matches.some(Boolean);
    });
  }, [rows, selectedCriteria, matchMode]);

  const columns = useMemo(() => [
    {
      key: 'fullName',
      label: 'Name',
      render: (row) => <Link to={`/person/${row.id}`} className="text-primary hover:underline">{row.fullName}</Link>,
    },
    { key: 'genderLabel', label: 'Gender' },
    {
      key: 'birthDate',
      label: 'Born',
      render: (row) => row.birthDate || <span className="text-muted-foreground">No date</span>,
    },
    {
      key: 'deathDate',
      label: 'Died',
      render: (row) => row.deathDate || <span className="text-muted-foreground">No date</span>,
    },
    {
      key: 'signals',
      label: 'Signals',
      sortValue: (row) => row.tags.length,
      searchValue: (row) => row.tags.join(' '),
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.tags.length ? row.tags.map((tag) => (
            <span key={tag} className="rounded border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">{tag}</span>
          )) : <span className="text-muted-foreground">No signals</span>}
        </div>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      sortable: false,
      export: false,
      render: (row) => <Link to={`/person/${row.id}`} className="text-xs text-primary hover:underline">Open person</Link>,
    },
  ], []);

  const toggleCriterion = (id) => {
    setSelectedCriteria((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) return <div className="p-10 text-muted-foreground">Loading distinctive persons...</div>;

  const filters = (
    <div className="ms-auto flex flex-wrap items-center gap-2">
      <select value={matchMode} onChange={(event) => setMatchMode(event.target.value)} className="bg-secondary text-foreground border border-border rounded-md px-2.5 py-1.5 text-sm">
        <option value="any">Match any rule</option>
        <option value="all">Match all rules</option>
      </select>
      {CRITERIA.map((criterion) => (
        <label key={criterion.id} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-md px-2.5 py-1.5 bg-secondary">
          <input type="checkbox" checked={selectedCriteria.has(criterion.id)} onChange={() => toggleCriterion(criterion.id)} />
          {criterion.label}
        </label>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <ListPageHeader
        title="Distinctive Persons"
        subtitle={hasMarker ? 'Using imported distinctive markers plus optional rule filters.' : 'No distinctive marker field was detected; use manual criteria to define the list.'}
        count={filteredRows.length}
        total={rows.length}
      />
      <SortableListTable
        rows={filteredRows}
        columns={columns}
        initialSortKey="signals"
        initialSortDirection="desc"
        searchPlaceholder="Search distinctive persons..."
        toolbar={filters}
        emptyTitle="No distinctive persons"
        emptyHint="No person matches the current criteria. Adjust the rule checkboxes or match mode."
      />
    </div>
  );
}
