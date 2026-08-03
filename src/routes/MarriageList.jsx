import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListPageHeader } from '../components/lists/SortableListTable.jsx';
import { ConfigurableListTable } from '../components/lists/ConfigurableListTable.jsx';
import { ScopeFilterSelect } from '../components/lists/ScopeFilterSelect.jsx';
import { useScopedRows } from '../components/lists/useScopedRows.js';
import { SORT_PROFILES, useSortProfile } from '../components/lists/useSortProfile.js';
import { loadMarriageRows } from '../lib/listData.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

export default function MarriageList() {
  const { t } = useTranslation();
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
      label: t('marriageList.partner1'),
      alwaysVisible: true,
      render: (row) => row.partner1Id
        ? <Link to={`/person/${row.partner1Id}`} className="text-interactive hover:underline">{row.partner1Name || row.partner1Id}</Link>
        : <span className="text-muted-foreground">{t('marriageList.unknown')}</span>,
    },
    {
      key: 'partner2Name',
      label: t('marriageList.partner2'),
      render: (row) => row.partner2Id
        ? <Link to={`/person/${row.partner2Id}`} className="text-interactive hover:underline">{row.partner2Name || row.partner2Id}</Link>
        : <span className="text-muted-foreground">{t('marriageList.unknown')}</span>,
    },
    {
      key: 'marriageDate',
      label: t('marriageList.marriageDate'),
      render: (row) => row.formattedMarriageDate || <span className="text-muted-foreground">{t('marriageList.noDate')}</span>,
    },
    {
      key: 'family',
      label: t('marriageList.family'),
      sortable: false,
      export: false,
      render: (row) => <Link to={`/family/${row.id}`} className="text-xs text-interactive hover:underline">{t('marriageList.openFamily')}</Link>,
    },
    { key: 'id', label: t('marriageList.familyId'), defaultVisible: false },
  ], [t]);
  const groupOptions = useMemo(() => [
    { key: 'none', label: t('lists.groups.none') },
    { key: 'marriageDecade', label: t('lists.groups.marriageDecade'), getGroup: (row) => {
      const match = String(row.marriageDate || '').match(/(\d{4})/);
      if (!match) return t('lists.groups.unknownDate');
      const decade = Math.floor(Number(match[1]) / 10) * 10;
      return { key: String(decade), label: t('lists.groups.decade', { year: decade }) };
    } },
  ], [t]);

  const scoped = useScopedRows(rows, {
    entityType: 'Family',
    rowIds: (row) => row.id,
  });

  if (loading) return <div className="p-10 text-muted-foreground">{t('marriageList.loading')}</div>;

  const filters = (
    <ScopeFilterSelect
      value={scoped.scopeId}
      onChange={scoped.setScopeId}
      scopes={scoped.scopes}
      loading={scoped.loading}
      error={scoped.error}
      label={t('marriageList.familyScope')}
      className="ms-auto"
    />
  );

  return (
    <div className="flex flex-col h-full">
      <ListPageHeader
        title={t('marriageList.title')}
        subtitle={t('marriageList.subtitle')}
        count={scoped.rows.length}
        total={rows.length}
      />
      <ConfigurableListTable
        listId="marriages"
        rows={scoped.rows}
        columns={columns}
        initialSortKey="marriageDate"
        sortProfile={sortProfile}
        groupOptions={groupOptions}
        searchPlaceholder={t('marriageList.searchPlaceholder')}
        toolbar={filters}
        emptyTitle={t('marriageList.emptyTitle')}
        emptyHint={t('marriageList.emptyHint')}
      />
    </div>
  );
}
