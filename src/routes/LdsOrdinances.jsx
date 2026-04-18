import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListPageHeader, SortableListTable } from '../components/lists/SortableListTable.jsx';
import { loadLdsOrdinanceRows } from '../lib/listData.js';

function ownerLink(row) {
  if (row.ownerType === 'Person' && row.ownerId) return `/person/${row.ownerId}`;
  if (row.ownerType === 'Family' && row.ownerId) return `/family/${row.ownerId}`;
  return null;
}

export default function LdsOrdinances() {
  const [result, setResult] = useState({ schemaPresent: false, detectedSchema: [], rows: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await loadLdsOrdinanceRows();
      if (!cancelled) {
        setResult(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const columns = useMemo(() => [
    {
      key: 'ownerName',
      label: 'Owner',
      render: (row) => {
        const href = ownerLink(row);
        return href ? <Link to={href} className="text-primary hover:underline">{row.ownerName}</Link> : row.ownerName;
      },
    },
    { key: 'ordinance', label: 'Ordinance' },
    {
      key: 'date',
      label: 'Date',
      render: (row) => row.date || <span className="text-muted-foreground">No date</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => String(row.status || '') || <span className="text-muted-foreground">No status</span>,
    },
    {
      key: 'temple',
      label: 'Temple / Place',
      render: (row) => String(row.temple || '') || <span className="text-muted-foreground">No temple</span>,
    },
    { key: 'recordType', label: 'Record Type' },
  ], []);

  if (loading) return <div className="p-10 text-muted-foreground">Checking LDS ordinance schema...</div>;

  if (!result.schemaPresent) {
    return (
      <div className="flex flex-col h-full">
        <ListPageHeader
          title="LDS Ordinances"
          subtitle="This list is gated until LDS-related fields or record types are present in the imported model."
          count={0}
        />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-xl text-center">
            <h2 className="text-lg font-semibold mb-2">No LDS ordinance schema detected</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The current database does not expose fields or record types for LDS ordinances, temples, endowments,
              confirmations, or sealings. Import a tree that includes those fields, or map the source model fields
              before using this route.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ListPageHeader
        title="LDS Ordinances"
        subtitle={`Detected schema: ${result.detectedSchema.slice(0, 4).join(', ')}${result.detectedSchema.length > 4 ? '...' : ''}`}
        count={result.rows.length}
      />
      <SortableListTable
        rows={result.rows}
        columns={columns}
        initialSortKey="ownerName"
        searchPlaceholder="Search LDS ordinances..."
        emptyTitle="No LDS ordinance rows"
        emptyHint="Schema-like fields exist, but no listable ordinance rows were found."
      />
    </div>
  );
}
