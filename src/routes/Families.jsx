import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { ListPageHeader } from '../components/lists/SortableListTable.jsx';
import { ConfigurableListTable } from '../components/lists/ConfigurableListTable.jsx';
import { ScopeFilterSelect } from '../components/lists/ScopeFilterSelect.jsx';
import { useScopedRows } from '../components/lists/useScopedRows.js';
import { SORT_PROFILES, useSortProfile } from '../components/lists/useSortProfile.js';
import { BulkLabelMenu } from '../components/lists/BulkLabelMenu.jsx';
import { listToolbarButtonClass } from '../components/lists/listToolbarClasses.js';
import { deleteRecordsWithLog } from '../lib/bulkActions.js';
import { downloadRowsAsCsv } from '../lib/listExport.js';
import { loadMarriageRows } from '../lib/listData.js';
import { createRecordEnvelope, createWithChangeLog } from '../lib/recordWrite.js';
import { cn } from '../lib/utils.js';
import { useModal } from '../contexts/ModalContext.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { localizeNoName } from '../lib/personDisplayName.js';

export default function Families() {
  const { t } = useTranslation();
  const modal = useModal();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const sortProfile = useSortProfile('families', SORT_PROFILES.Families, 'partner1Name');

  // Create an empty Family and open it in the editor. Families otherwise only
  // came into existence as a side effect of linking spouses/children, leaving
  // no way to start one from this list. The editor lets the user set the
  // partners and children from there.
  const newFamily = useCallback(async () => {
    const record = createRecordEnvelope('Family', 'family');
    await createWithChangeLog(record);
    navigate(`/family/${record.recordName}`);
  }, [navigate]);

  const reload = useCallback(async () => {
    const next = await loadMarriageRows();
    setRows(next);
    setLoading(false);
  }, []);

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
      label: t('families.partner1'),
      alwaysVisible: true,
      render: (row) => row.partner1Id
        ? <Link to={`/person/${row.partner1Id}`} className="text-interactive hover:underline">{localizeNoName(row.partner1Name || row.partner1Id)}</Link>
        : <span className="text-muted-foreground">{t('families.unknown')}</span>,
    },
    {
      key: 'partner2Name',
      label: t('families.partner2'),
      render: (row) => row.partner2Id
        ? <Link to={`/person/${row.partner2Id}`} className="text-interactive hover:underline">{localizeNoName(row.partner2Name || row.partner2Id)}</Link>
        : <span className="text-muted-foreground">{t('families.unknown')}</span>,
    },
    {
      key: 'marriageDate',
      label: t('families.marriageDate'),
      render: (row) => row.formattedMarriageDate || <span className="text-muted-foreground">{t('families.noDate')}</span>,
    },
    {
      key: 'family',
      label: t('families.family'),
      sortable: false,
      export: false,
      render: (row) => <Link to={`/family/${row.id}`} className="text-xs text-interactive hover:underline">{t('families.openFamily')}</Link>,
    },
    { key: 'bookmarked', label: t('lists.columnLabels.bookmarked'), defaultVisible: false, sortValue: (row) => !!row.family?.fields?.isBookmarked?.value, exportValue: (row) => !!row.family?.fields?.isBookmarked?.value },
    { key: 'private', label: t('lists.columnLabels.private'), defaultVisible: false, sortValue: (row) => !!row.family?.fields?.isPrivate?.value, exportValue: (row) => !!row.family?.fields?.isPrivate?.value },
    { key: 'id', label: t('families.familyId'), defaultVisible: false },
  ], [t]);

  const groupOptions = useMemo(() => [
    { key: 'none', label: t('lists.groups.none') },
    {
      key: 'marriageDecade',
      label: t('lists.groups.marriageDecade'),
      getGroup: (row) => {
        const match = String(row.marriageDate || '').match(/(\d{4})/);
        if (!match) return { key: 'unknown', label: t('lists.groups.unknownDate') };
        const decade = Math.floor(Number(match[1]) / 10) * 10;
        return { key: String(decade), label: t('lists.groups.decade', { year: decade }) };
      },
    },
    {
      key: 'partnerInitial',
      label: t('lists.groups.partnerInitial'),
      getGroup: (row) => String(row.partner1Name || row.partner2Name || '').trim()[0]?.toLocaleUpperCase() || t('lists.unknownGroup'),
    },
  ], [t]);

  const scoped = useScopedRows(rows, {
    entityType: 'Family',
    rowIds: (row) => row.id,
  });

  const bulkDelete = useCallback(async (ids, clear) => {
    if (!ids.length) return;
    if (!(await modal.confirm(t('lists.deleteConfirm', { count: ids.length }), { title: t('lists.deleteTitle'), okLabel: t('lists.deleteOk'), destructive: true }))) return;
    await deleteRecordsWithLog(ids, 'Family');
    clear();
    await reload();
  }, [modal, reload, t]);

  const renderBulkActions = useCallback((ids, clear) => (
    <>
      <BulkLabelMenu selectedIds={ids} recordType="Family" onAssigned={clear} />
      <button
        type="button"
        onClick={() => downloadRowsAsCsv('families-selected', rows.filter((row) => ids.includes(row.id)), [
          { key: 'partner1Name', label: t('families.partner1') },
          { key: 'partner2Name', label: t('families.partner2') },
          { key: 'marriageDate', label: t('families.marriageDate') },
          { key: 'id', label: t('families.familyId') },
        ])}
        className="border border-border rounded-md px-2.5 py-1 text-xs hover:bg-accent"
      >
        {t('lists.exportSelected')}
      </button>
      <button
        type="button"
        onClick={() => bulkDelete(ids, clear)}
        className="border border-destructive text-destructive-text rounded-md px-2.5 py-1 text-xs hover:bg-destructive/10"
      >
        {t('common.delete')}
      </button>
    </>
  ), [bulkDelete, rows, t]);

  if (loading) return <div className="p-10 text-muted-foreground">{t('families.loading')}</div>;

  const filters = (
    <ScopeFilterSelect
      value={scoped.scopeId}
      onChange={scoped.setScopeId}
      scopes={scoped.scopes}
      loading={scoped.loading}
      error={scoped.error}
      label={t('families.familyScope')}
      className="ms-auto"
    />
  );

  return (
    <div className="flex flex-col h-full">
      <ListPageHeader
        title={t('families.title')}
        subtitle={t('families.subtitle')}
        count={scoped.rows.length}
        total={rows.length}
        actions={(
          <button
            type="button"
            onClick={newFamily}
            className={cn(listToolbarButtonClass, 'border-primary/60 text-interactive')}
            title={t('families.newFamily', { defaultValue: 'New family' })}
          >
            <Users size={15} className="flex-shrink-0" />
            <span className="hidden sm:inline">{t('families.newFamily', { defaultValue: 'New family' })}</span>
          </button>
        )}
      />
      <ConfigurableListTable
        listId="families"
        rows={scoped.rows}
        columns={columns}
        initialSortKey="partner1Name"
        sortProfile={sortProfile}
        groupOptions={groupOptions}
        searchPlaceholder={t('families.searchPlaceholder')}
        toolbar={filters}
        emptyTitle={t('families.emptyTitle')}
        emptyHint={t('families.emptyHint')}
        selectable
        renderBulkActions={renderBulkActions}
      />
    </div>
  );
}
