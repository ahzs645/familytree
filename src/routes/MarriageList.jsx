import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListPageHeader, SortableListTable } from '../components/lists/SortableListTable.jsx';
import { loadMarriageRows } from '../lib/listData.js';

export default function MarriageList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

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
  ], []);

  if (loading) return <div className="p-10 text-muted-foreground">Loading marriage list...</div>;

  return (
    <div className="flex flex-col h-full">
      <ListPageHeader
        title="Marriage List"
        subtitle="Report-compatible list of family partner pairs and marriage dates."
        count={rows.length}
      />
      <SortableListTable
        rows={rows}
        columns={columns}
        initialSortKey="marriageDate"
        searchPlaceholder="Search partners or dates..."
        emptyTitle="No marriages"
        emptyHint="Family rows appear here once partner records have been imported or created."
      />
    </div>
  );
}
