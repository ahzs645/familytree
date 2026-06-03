import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListPageHeader } from '../components/lists/SortableListTable.jsx';
import { ConfigurableListTable } from '../components/lists/ConfigurableListTable.jsx';
import { ScopeFilterSelect } from '../components/lists/ScopeFilterSelect.jsx';
import { listToolbarButtonClass } from '../components/lists/listToolbarClasses.js';
import { useScopedRows } from '../components/lists/useScopedRows.js';
import { SORT_PROFILES, useSortProfile } from '../components/lists/useSortProfile.js';
import { loadPersonAnalysisRows } from '../lib/listData.js';
import { buildRelationshipMatrix } from '../lib/relationshipPath.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

const RISK_CLASS = {
  High: 'text-destructive border-destructive/40',
  Medium: 'text-amber-500 border-amber-500/40',
  Low: 'text-muted-foreground border-border',
};

const FILTER_IDS = ['attention', 'missing-dates', 'unsourced', 'unplaced', 'parents', 'impossible', 'orphaned', 'duplicates', 'all'];
const SUMMARY_KEYS = ['attention', 'unsourced', 'unplaced', 'parents', 'impossible', 'duplicates'];

export default function PersonAnalysis() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('attention');
  const [matrix, setMatrix] = useState(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const sortProfile = useSortProfile('person-analysis', SORT_PROFILES.PersonAnalysis, 'orphanedRelationships');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await loadPersonAnalysisRows();
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
    if (filter === 'attention') return row.attentionScore > 0;
    if (filter === 'missing-dates') return row.missingDates.length > 0;
    if (filter === 'unsourced') return row.sourceState !== 'Supported';
    if (filter === 'unplaced') return row.unplacedEvents > 0;
    if (filter === 'parents') return row.parentCount === 0;
    if (filter === 'impossible') return row.impossibleAgeIssues.length > 0;
    if (filter === 'orphaned') return row.orphanedRelationships > 0;
    if (filter === 'duplicates') return row.duplicateRisk !== 'Low';
    return true;
  }), [rows, filter]);
  const scoped = useScopedRows(filteredRows, {
    entityType: 'Person',
    rowIds: (row) => row.personId,
  });

  const summary = useMemo(() => ({
    attention: rows.filter((row) => row.attentionScore > 0).length,
    unsourced: rows.filter((row) => row.sourceState !== 'Supported').length,
    unplaced: rows.filter((row) => row.unplacedEvents > 0).length,
    parents: rows.filter((row) => row.parentCount === 0).length,
    impossible: rows.filter((row) => row.impossibleAgeIssues.length > 0).length,
    duplicates: rows.filter((row) => row.duplicateRisk !== 'Low').length,
  }), [rows]);

  const stateLabel = (state) => {
    if (state === 'Supported') return t('personAnalysis.stateSupported');
    if (state === 'Weak') return t('personAnalysis.stateWeak');
    return t('personAnalysis.stateUnsourced');
  };

  const onBuildMatrix = async () => {
    setMatrixLoading(true);
    try {
      const ids = scoped.rows.slice(0, 8).map((row) => row.personId);
      setMatrix(await buildRelationshipMatrix(ids, { maxPeople: 8, maxDepth: 8 }));
    } finally {
      setMatrixLoading(false);
    }
  };

  const riskLabel = (risk) => t(`personAnalysis.risk${risk}`, { defaultValue: risk });

  const columns = useMemo(() => [
    {
      key: 'personName',
      label: t('personAnalysis.person'),
      alwaysVisible: true,
      render: (row) => <Link to={`/person/${row.personId}`} className="text-primary hover:underline">{row.personName}</Link>,
    },
    {
      key: 'age',
      label: t('personAnalysis.age'),
      sortValue: (row) => row.age ?? -1,
      render: (row) => row.ageLabel,
    },
    {
      key: 'missingDateLabel',
      label: t('personAnalysis.missingDates'),
      sortValue: (row) => row.missingDates.length,
      render: (row) => row.missingDates.length ? row.missingDateLabel : <span className="text-muted-foreground">{t('personAnalysis.noneShort')}</span>,
    },
    {
      key: 'orphanedRelationships',
      label: t('personAnalysis.researchGaps'),
      render: (row) => row.orphanedRelationships ? (
        <div>
          <div>{row.orphanedRelationships}</div>
          <div className="text-xs text-muted-foreground mt-1">{row.relationshipIssues.slice(0, 2).join('; ')}</div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          {row.parentCount === 0 ? t('personAnalysis.noParents') : t('personAnalysis.parents', { count: row.parentCount })}
          {row.unplacedEvents ? ` · ${t('personAnalysis.unplaced', { count: row.unplacedEvents })}` : ''}
          {row.impossibleAgeIssues.length ? ` · ${row.impossibleAgeIssues[0]}` : ''}
        </div>
      ),
    },
    {
      key: 'sourceState',
      label: t('personAnalysis.evidence'),
      sortValue: (row) => row.sourceCount,
      render: (row) => (
        <div>
          <span className={`inline-block text-[10px] font-bold uppercase tracking-wide rounded border px-2 py-0.5 ${
            row.sourceState === 'Supported' ? 'text-emerald-600 border-emerald-600/40' : row.sourceState === 'Weak' ? 'text-amber-500 border-amber-500/40' : 'text-destructive border-destructive/40'
          }`}>
            {stateLabel(row.sourceState)}
          </span>
          <div className="mt-1 text-xs text-muted-foreground">{t('personAnalysis.sourceLinks', { count: row.sourceCount })}</div>
        </div>
      ),
    },
    {
      key: 'duplicateRisk',
      label: t('personAnalysis.duplicateRisk'),
      render: (row) => (
        <span className={`inline-block text-[10px] font-bold uppercase tracking-wide rounded border px-2 py-0.5 min-w-[62px] text-center ${RISK_CLASS[row.duplicateRisk]}`}>
          {riskLabel(row.duplicateRisk)}
        </span>
      ),
    },
    {
      key: 'action',
      label: t('personAnalysis.action'),
      sortable: false,
      export: false,
      render: (row) => <Link to={`/person/${row.personId}`} className="text-xs text-primary hover:underline">{t('personAnalysis.openPerson')}</Link>,
    },
    { key: 'personId', label: t('personAnalysis.personId'), defaultVisible: false },
  ], [t]);

  if (loading) return <div className="p-10 text-muted-foreground">{t('personAnalysis.loading')}</div>;

  const filters = (
    <>
    <div className="ms-auto flex flex-wrap gap-2">
      {FILTER_IDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => setFilter(id)}
          className={`${listToolbarButtonClass} ${filter === id ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
        >
          {t(`personAnalysis.filters.${id}`)}
        </button>
      ))}
      <button
        type="button"
        onClick={onBuildMatrix}
        disabled={matrixLoading || scoped.rows.length < 2}
        className={listToolbarButtonClass}
      >
        {matrixLoading ? 'Matrix...' : 'Relationship Matrix'}
      </button>
    </div>
    <ScopeFilterSelect
      value={scoped.scopeId}
      onChange={scoped.setScopeId}
      scopes={scoped.scopes}
      loading={scoped.loading}
      error={scoped.error}
      label={t('personAnalysis.personScope')}
    />
    </>
  );

  return (
    <div className="flex flex-col h-full">
      <ListPageHeader
        title={t('personAnalysis.title')}
        subtitle={t('personAnalysis.subtitle')}
        count={scoped.rows.length}
        total={rows.length}
      />
      <div className="grid grid-cols-2 gap-3 border-b border-border bg-card px-5 py-3 md:grid-cols-6">
        {SUMMARY_KEYS.map((key) => (
          <div key={key} className="rounded-md border border-border bg-background px-3 py-2">
            <div className="text-lg font-semibold tabular-nums">{summary[key]}</div>
            <div className="text-[11px] text-muted-foreground">{t(`personAnalysis.summary.${key}`)}</div>
          </div>
        ))}
      </div>
      <ConfigurableListTable
        listId="person-analysis"
        rows={scoped.rows}
        columns={columns}
        initialSortKey="orphanedRelationships"
        initialSortDirection="desc"
        sortProfile={sortProfile}
        searchPlaceholder={t('personAnalysis.searchPlaceholder')}
        toolbar={filters}
        emptyTitle={t('personAnalysis.emptyTitle')}
        emptyHint={t('personAnalysis.emptyHint')}
      />
      {matrix && (
        <div className="border-t border-border bg-background p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Relationship Matrix</div>
              <div className="text-xs text-muted-foreground">First {matrix.people.length} people in the current scoped result.</div>
            </div>
            <button type="button" className={listToolbarButtonClass} onClick={() => setMatrix(null)}>Close</button>
          </div>
          <div className="overflow-auto rounded-md border border-border">
            <table className="min-w-full text-xs">
              <thead className="bg-card">
                <tr>
                  <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">Person</th>
                  {matrix.people.map((person) => (
                    <th key={person.id} className="px-3 py-2 text-left font-medium whitespace-nowrap">{person.person?.displayName || person.id}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <th className="sticky left-0 bg-background px-3 py-2 text-left font-medium whitespace-nowrap">{row.person?.displayName || row.id}</th>
                    {row.cells.map((cell) => (
                      <td key={`${cell.from}-${cell.to}`} className="px-3 py-2 align-top">
                        <div>{cell.label}</div>
                        {cell.distance != null && <div className="text-[10px] text-muted-foreground">{cell.distance} link{cell.distance === 1 ? '' : 's'}</div>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
