import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListPageHeader } from '../components/lists/SortableListTable.jsx';
import { ConfigurableListTable } from '../components/lists/ConfigurableListTable.jsx';
import { SORT_PROFILES, useSortProfile } from '../components/lists/useSortProfile.js';
import { loadLdsOrdinanceRows } from '../lib/listData.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

function ownerLink(row) {
  if (row.ownerType === 'Person' && row.ownerId) return `/person/${row.ownerId}`;
  if (row.ownerType === 'Family' && row.ownerId) return `/family/${row.ownerId}`;
  return null;
}

export default function LdsOrdinances() {
  const { t } = useTranslation();
  const [result, setResult] = useState({ schemaPresent: false, detectedSchema: [], rows: [] });
  const [loading, setLoading] = useState(true);
  const sortProfile = useSortProfile('lds-ordinances', SORT_PROFILES.LdsOrdinances, 'ownerName');

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
      label: t('ldsOrdinances.owner'),
      alwaysVisible: true,
      render: (row) => {
        const href = ownerLink(row);
        return href ? <Link to={href} className="text-primary hover:underline">{row.ownerName}</Link> : row.ownerName;
      },
    },
    { key: 'ordinance', label: t('ldsOrdinances.ordinance') },
    {
      key: 'date',
      label: t('ldsOrdinances.date'),
      render: (row) => row.date || <span className="text-muted-foreground">{t('ldsOrdinances.noDate')}</span>,
    },
    {
      key: 'status',
      label: t('ldsOrdinances.status'),
      render: (row) => String(row.status || '') || <span className="text-muted-foreground">{t('ldsOrdinances.noStatus')}</span>,
    },
    {
      key: 'temple',
      label: t('ldsOrdinances.templePlace'),
      render: (row) => String(row.temple || '') || <span className="text-muted-foreground">{t('ldsOrdinances.noTemple')}</span>,
    },
    { key: 'recordType', label: t('ldsOrdinances.recordType') },
    { key: 'id', label: t('ldsOrdinances.recordId'), defaultVisible: false },
  ], [t]);

  if (loading) return <div className="p-10 text-muted-foreground">{t('ldsOrdinances.loading')}</div>;

  if (!result.schemaPresent) {
    return (
      <div className="flex flex-col h-full">
        <ListPageHeader
          title={t('ldsOrdinances.title')}
          subtitle={t('ldsOrdinances.gatedSubtitle')}
          count={0}
        />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-xl text-center">
            <h2 className="text-lg font-semibold mb-2">{t('ldsOrdinances.noSchemaTitle')}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{t('ldsOrdinances.noSchemaBody')}</p>
          </div>
        </main>
      </div>
    );
  }

  const detectedLabel = t('ldsOrdinances.detectedSchemaPrefix', {
    schema: `${result.detectedSchema.slice(0, 4).join(', ')}${result.detectedSchema.length > 4 ? '...' : ''}`,
  });

  return (
    <div className="flex flex-col h-full">
      <ListPageHeader
        title={t('ldsOrdinances.title')}
        subtitle={detectedLabel}
        count={result.rows.length}
      />
      <ConfigurableListTable
        listId="lds-ordinances"
        rows={result.rows}
        columns={columns}
        initialSortKey="ownerName"
        sortProfile={sortProfile}
        searchPlaceholder={t('ldsOrdinances.searchPlaceholder')}
        emptyTitle={t('ldsOrdinances.emptyTitle')}
        emptyHint={t('ldsOrdinances.emptyHint')}
      />
    </div>
  );
}
