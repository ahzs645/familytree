import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListPageHeader } from '../components/lists/SortableListTable.jsx';
import { ConfigurableListTable } from '../components/lists/ConfigurableListTable.jsx';
import { ScopeFilterSelect } from '../components/lists/ScopeFilterSelect.jsx';
import { useScopedRows } from '../components/lists/useScopedRows.js';
import { SORT_PROFILES, useSortProfile } from '../components/lists/useSortProfile.js';
import { loadMarriageRows } from '../lib/listData.js';

export default function MarriageList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const sortProfile = useSortProfile('marriages', SORT_PROFILES.Marriages, 'marriageDate');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await loadMarriageRows();
      if (!cancelled) {
        setRows(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const columns = useMemo(() => [
    {
      key: 'partner1Name',
      label: 'Partner 1',
      alwaysVisible: true,
      render: (row) => row.partner1Id
        ? <Link to={`/person/${row.partner1Id}`} className="text-primary hover:underline">{row.partner1Name || row.partner1Id}</Link>
        : <span className="text-muted-foreground">Unknown</span>,
    },
    {
      key: 'partner2Name',
      label: 'Partner 2',
      render: (row) => row.partner2Id
        ? <Link to={`/person/${row.partner2Id}`} className="text-primary hover:underline">{row.partner2Name || row.partner2Id}</Link>
        : <span className="text-muted-foreground">Unknown</span>,
    },
    {
      key: 'marriageDate',
      label: 'Marriage Date',
      render: (row) => row.formattedMarriageDate || <span className="text-muted-foreground">No date</span>,
    },
    {
      key: 'family',
      label: 'Family',
      sortable: false,
      export: false,
      render: (row) => <Link to={`/family/${row.id}`} className="text-xs text-primary hover:underline">Open family</Link>,
    },
    { key: 'id', label: 'Family ID', defaultVisible: false },
  ], []);

  const scoped = useScopedRows(rows, {
    entityType: 'Family',
    rowIds: (row) => row.id,
  });

  if (loading) return <div className="p-10 text-muted-foreground">Loading marriage list...</div>;

  const filters = (
    <ScopeFilterSelect
      value={scoped.scopeId}
      onChange={scoped.setScopeId}
      scopes={scoped.scopes}
      loading={scoped.loading}
      error={scoped.error}
      label="Family scope"
      className="ms-auto"
    />
  );

  return (
    <div className="flex flex-col h-full">
      <ListPageHeader
        title="Marriage List"
        subtitle="Report-compatible list of family partner pairs and marriage dates."
        count={scoped.rows.length}
        total={rows.length}
      />
      <ConfigurableListTable
        listId="marriages"
        rows={scoped.rows}
        columns={columns}
        initialSortKey="marriageDate"
        sortProfile={sortProfile}
        searchPlaceholder="Search partners or dates..."
        toolbar={filters}
        emptyTitle="No marriages"
        emptyHint="Family rows appear here once partner records have been imported or created."
      />
    </div>
  );
}
