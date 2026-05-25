import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BdiText } from '../components/BdiText.jsx';
import { PersonList } from '../components/interactive/PersonList.jsx';
import { useActivePerson } from '../contexts/ActivePersonContext.jsx';
import { compareStrings, formatInteger, getCurrentLocalization } from '../lib/i18n.js';
import { buildPersonContext } from '../lib/personContext.js';
import { downloadRowsAsCsv, downloadRowsAsJson } from '../lib/listExport.js';
import { loadPersonRows } from '../lib/listData.js';
import { useIsMobile } from '../lib/useIsMobile.js';
import { Select } from '../components/ui/Select.jsx';
import { useListSelection } from '../components/lists/useListSelection.js';
import { useColumnVisibility } from '../components/lists/useColumnVisibility.js';
import { BulkActionBar } from '../components/lists/BulkActionBar.jsx';
import { ColumnChooser } from '../components/lists/ColumnChooser.jsx';
import { ListReportPreview, ListReportToolbar, useListReportOptions } from '../components/lists/ListReportWorkbench.jsx';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { logRecordDeleted } from '../lib/changeLog.js';
import { useModal } from '../contexts/ModalContext.jsx';
import { PersonPicker } from '../components/charts/PersonPicker.jsx';
import { findRelationshipPaths } from '../lib/relationshipPath.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

const ME_PERSON_STORAGE_KEY = 'cloudtreeweb:mePersonId';

const EXPORT_COLUMNS = [
  { key: 'fullName', label: 'Name' },
  { key: 'genderLabel', label: 'Gender' },
  { key: 'arabicPatrilinealName', label: 'Arabic Patrilineal Name' },
  { key: 'birthDate', label: 'Born' },
  { key: 'deathDate', label: 'Died' },
  { key: 'outsideFamily', label: 'Outside Main Family' },
  { key: 'cemetery', label: 'Cemetery' },
  { key: 'cemeteryLocation', label: 'Cemetery Location' },
  { key: 'graveNumber', label: 'Grave Number' },
  { key: 'bookmarked', label: 'Bookmarked' },
  { key: 'startPerson', label: 'Start Person' },
  { key: 'id', label: 'Record ID' },
];

const LIST_COLUMN_DEFS = [
  { key: 'fullName', labelKey: 'persons.columns.fullName', alwaysVisible: true },
  { key: 'arabicPatrilinealName', labelKey: 'persons.columns.arabicPatrilinealName' },
  { key: 'lifespan', labelKey: 'persons.columns.lifespan' },
  { key: 'outsideFamily', labelKey: 'persons.columns.outsideFamilyMarker' },
  { key: 'bookmarked', labelKey: 'persons.columns.bookmarkedMarker' },
  { key: 'startPerson', labelKey: 'persons.columns.startPersonMarker' },
];

export default function Persons() {
  const { t } = useTranslation();
  const [persons, setPersons] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('name');
  const [filter, setFilter] = useState('all');
  const [mobilePane, setMobilePane] = useState('list');
  const [mePersonId, setMePersonId] = useState(() => {
    try {
      return localStorage.getItem(ME_PERSON_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [kinshipById, setKinshipById] = useState(new Map());
  const isMobile = useIsMobile();
  const { setActivePerson } = useActivePerson();
  const navigate = useNavigate();
  const modal = useModal();
  const localization = getCurrentLocalization();
  const localizationKey = `${localization.locale}|${localization.direction}|${localization.numberingSystem}|${localization.calendar}`;

  const pick = (id) => {
    setActiveId(id);
    if (isMobile) setMobilePane('detail');
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await loadPersonRows();
      if (cancelled) return;
      setPersons(rows);
      setActiveId(rows[0]?.id || null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allVisibleIds = useMemo(() => persons.map((p) => p.id), [persons]);
  const selection = useListSelection(allVisibleIds);
  const listColumns = useMemo(
    () => LIST_COLUMN_DEFS.map((c) => ({ key: c.key, label: t(c.labelKey), alwaysVisible: c.alwaysVisible })),
    [t]
  );
  const columnVisibility = useColumnVisibility('persons', listColumns);
  const report = useListReportOptions();

  const bulkDelete = async () => {
    if (!selection.count) return;
    if (!(await modal.confirm(t('persons.deleteConfirm', { count: selection.count }), { title: t('persons.deleteTitle'), okLabel: t('persons.deleteOk'), destructive: true }))) return;
    const db = getLocalDatabase();
    for (const id of selection.selectedIds) {
      await db.deleteRecord(id);
      await logRecordDeleted(id, 'Person');
    }
    selection.clear();
    const rows = await loadPersonRows();
    setPersons(rows);
  };

  const bulkExport = () => {
    const rows = persons.filter((p) => selection.isSelected(p.id));
    downloadRowsAsCsv('persons-selected', rows, EXPORT_COLUMNS);
  };

  const visiblePersons = useMemo(() => {
    let next = persons.filter((person) => {
      if (filter === 'bookmarked') return person.bookmarked;
      if (filter === 'start') return person.startPerson;
      if (filter === 'missing-birth') return !person.birthDate;
      if (filter === 'missing-death') return !person.deathDate;
      if (filter === 'outside-family') return person.outsideFamily;
      return true;
    });
    next = [...next].sort((a, b) => {
      if (sortKey === 'birth') return (a.birthYear || 99999) - (b.birthYear || 99999) || compareStrings(a.fullName, b.fullName, localization);
      if (sortKey === 'death') return (a.deathYear || 99999) - (b.deathYear || 99999) || compareStrings(a.fullName, b.fullName, localization);
      return compareStrings(a.fullName, b.fullName, localization);
    });
    return next;
  }, [persons, filter, sortKey, localizationKey]);

  useEffect(() => {
    if (!visiblePersons.length) {
      setActiveId(null);
      return;
    }
    if (!activeId || !visiblePersons.some((person) => person.id === activeId)) {
      setActiveId(visiblePersons[0].id);
    }
  }, [activeId, visiblePersons]);

  useEffect(() => {
    if (!activeId) {
      setContext(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const next = await buildPersonContext(activeId);
      if (!cancelled) setContext(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const active = persons.find((person) => person.id === activeId);
  const mePerson = persons.find((person) => person.id === mePersonId) || null;

  useEffect(() => {
    try {
      if (mePersonId) localStorage.setItem(ME_PERSON_STORAGE_KEY, mePersonId);
      else localStorage.removeItem(ME_PERSON_STORAGE_KEY);
    } catch {
      /* localStorage can be unavailable */
    }
  }, [mePersonId]);

  useEffect(() => {
    if (!mePersonId || !visiblePersons.length) {
      setKinshipById(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const pairs = await Promise.all(visiblePersons.map(async (person) => {
        if (person.id === mePersonId) return [person.id, { label: t('common.me'), self: true }];
        const result = await findRelationshipPaths(mePersonId, person.id, {
          maxPaths: 1,
          maxDepth: 8,
          localization,
        });
        return [person.id, result.paths[0] ? { label: result.paths[0].label, path: result.paths[0] } : null];
      }));
      if (!cancelled) setKinshipById(new Map(pairs.filter(([, value]) => value)));
    })();
    return () => {
      cancelled = true;
    };
  }, [mePersonId, visiblePersons, localizationKey]);

  const openTree = () => {
    if (!activeId) return;
    setActivePerson(activeId);
    navigate('/tree');
  };

  if (loading) return <div className="p-10 text-muted-foreground">{t('persons.loading')}</div>;

  const controlClass = 'h-10 rounded-md border border-border bg-secondary text-foreground text-sm px-3 outline-none focus:border-primary';

  const filterOptions = [
    { value: 'all', label: t('persons.all') },
    { value: 'bookmarked', label: t('persons.bookmarked') },
    { value: 'start', label: t('persons.startPerson') },
    { value: 'missing-birth', label: t('persons.missingBirth') },
    { value: 'missing-death', label: t('persons.missingDeath') },
    { value: 'outside-family', label: t('persons.outsideFamily') },
  ];
  const sortOptions = [
    { value: 'name', label: t('persons.sortName') },
    { value: 'birth', label: t('persons.sortBirth') },
    { value: 'death', label: t('persons.sortDeath') },
  ];

  return (
    <div className="flex flex-col h-full">
      <header className="border-b border-border bg-card px-4 md:px-5 py-3">
        <div className="flex flex-wrap items-start gap-2 mb-2 md:mb-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold leading-tight">{t('persons.heading')}</h1>
            <div className="text-xs text-muted-foreground">
              {t('persons.summary', {
                visible: formatInteger(visiblePersons.length, localization),
                total: formatInteger(persons.length, localization),
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ColumnChooser
              columns={listColumns}
              isVisible={columnVisibility.isVisible}
              onToggle={columnVisibility.toggle}
              onReset={columnVisibility.resetToDefaults}
            />
            <ListReportToolbar
              title={t('persons.listTitle')}
              rows={visiblePersons}
              columns={EXPORT_COLUMNS}
              options={report.options}
              update={report.update}
              updateInfoColumn={report.updateInfoColumn}
              onPreviewChange={(previewMode) => report.update('previewMode', previewMode)}
              compact
            />
            <ExportMenu
              onCsv={() => downloadRowsAsCsv('persons-list', visiblePersons, EXPORT_COLUMNS)}
              onJson={() => downloadRowsAsJson('persons-list', visiblePersons, EXPORT_COLUMNS)}
              controlClass={controlClass}
              t={t}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center md:gap-3">
          <label className="sr-only md:not-sr-only md:text-xs md:text-muted-foreground" htmlFor="persons-filter">{t('persons.filter')}</label>
          <Select
            id="persons-filter"
            value={filter}
            onChange={setFilter}
            options={filterOptions}
            ariaLabel={t('persons.filterAria')}
            className="w-full md:w-48"
          />
          <label className="sr-only md:not-sr-only md:text-xs md:text-muted-foreground" htmlFor="persons-sort">{t('persons.sort')}</label>
          <Select
            id="persons-sort"
            value={sortKey}
            onChange={setSortKey}
            options={sortOptions}
            ariaLabel={t('persons.sortAria')}
            className="w-full md:w-48"
          />
          <div className="col-span-2 md:min-w-[280px] md:max-w-[360px]">
            <PersonPicker persons={persons} value={mePersonId} onChange={setMePersonId} />
          </div>
          {mePersonId ? (
            <button type="button" onClick={() => setMePersonId('')} className="h-10 rounded-md border border-border bg-secondary px-3 text-xs text-muted-foreground hover:bg-accent">
              {t('persons.clearMe')}
            </button>
          ) : null}
        </div>
        {mePerson ? (
          <div className="mt-2 text-xs text-muted-foreground">
            {t('persons.meHint', { name: mePerson.fullName })}
          </div>
        ) : null}
      </header>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {(!isMobile || mobilePane === 'list') && (
          <div className={isMobile ? 'w-full' : 'w-[min(320px,48vw)] flex-shrink-0 flex flex-col'}>
            {selection.count > 0 ? (
              <div className="px-3 pt-3">
                <BulkActionBar count={selection.count} onClear={selection.clear}>
                  <button type="button" onClick={bulkExport} className="border border-border rounded-md px-2.5 py-1 text-xs hover:bg-accent">{t('persons.exportCsv')}</button>
                  <button type="button" onClick={bulkDelete} className="border border-destructive text-destructive rounded-md px-2.5 py-1 text-xs hover:bg-destructive/10">{t('common.delete')}</button>
                </BulkActionBar>
              </div>
            ) : null}
            <PersonList
              persons={visiblePersons}
              activeId={activeId}
              onPick={pick}
              selection={new Set(selection.selectedIds)}
              onToggleSelect={selection.toggle}
              visibleColumns={new Set(columnVisibility.visibleColumns.map((c) => c.key))}
              renderBadge={(person) => {
                const kinship = kinshipById.get(person.id);
                if (!kinship) return null;
                return (
                  <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${kinship.self ? 'border-amber-400 bg-amber-100 text-amber-900' : 'border-primary/40 bg-primary/10 text-primary'}`}>
                    <BdiText>{kinship.label}</BdiText>
                  </span>
                );
              }}
            />
          </div>
        )}
        {report.options.previewMode ? (
          <main className="flex-1 min-w-0 overflow-auto">
            <ListReportPreview title={t('persons.listTitle')} rows={visiblePersons} columns={EXPORT_COLUMNS} options={report.options} />
          </main>
        ) : (!isMobile || mobilePane === 'detail') && (
        <main className="flex-1 min-w-0 overflow-auto">
          {active ? (
            <div className="p-4 md:p-6 max-w-5xl">
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setMobilePane('list')}
                  className="mb-3 text-sm text-primary font-semibold py-2 px-1 min-h-10"
                >
                  {t('persons.backToList')}
                </button>
              )}
              <div className="flex flex-wrap items-start gap-3 mb-5">
                <div className="me-auto min-w-0">
                  <h2 className="text-2xl font-semibold truncate"><BdiText>{active.fullName}</BdiText></h2>
                  <div className="text-sm text-muted-foreground mt-1">
                    {active.genderLabel} · {active.birthDate || t('persons.birthUnknown')} - {active.deathDate || t('persons.deathUnknown')}
                  </div>
                  {kinshipById.get(active.id) ? (
                    <div className="mt-2 inline-flex rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                      <BdiText>{kinshipById.get(active.id).label}</BdiText>
                    </div>
                  ) : null}
                  {active.arabicPatrilinealName && !active.nameIsPatrilineal ? (
                    <div className="mt-2 text-sm text-muted-foreground" dir="rtl">
                      <BdiText>{active.arabicPatrilinealName}</BdiText>
                    </div>
                  ) : null}
                  {active.outsideFamily ? (
                    <div className="mt-2 inline-flex rounded-full border border-violet-400/50 bg-violet-500/10 px-2 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300">
                      {t('persons.outsideFamily')}
                    </div>
                  ) : null}
                </div>
                <button onClick={openTree} className="bg-secondary text-foreground border border-border rounded-md px-3 py-2 text-xs">
                  {t('persons.openTree')}
                </button>
                <Link to={`/person/${active.id}`} className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-xs font-semibold">
                  {t('persons.editor')}
                </Link>
              </div>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 mb-5">
                <SummaryBox label={t('persons.parents')} value={context?.parents?.length || 0} localization={localization} />
                <SummaryBox label={t('persons.partnerFamilies')} value={context?.families?.length || 0} localization={localization} />
                <SummaryBox label={t('glossary.event')} value={context?.events?.length || 0} localization={localization} />
                <SummaryBox label={t('glossary.fact')} value={context?.facts?.length || 0} localization={localization} />
                <SummaryBox label={t('persons.milkKinship')} value={context?.milkKinships?.length || 0} localization={localization} />
              </div>

              {(active.cemetery || active.cemeteryLocation || active.graveNumber) ? (
                <section className="mb-5">
                  <h3 className="text-xs uppercase font-semibold tracking-wide text-muted-foreground mb-2">{t('persons.graveCemetery')}</h3>
                  <div className="border border-border rounded-md p-3 bg-card text-sm grid gap-2 sm:grid-cols-3">
                    {active.cemetery ? <InfoCell label={t('persons.cemetery')} value={active.cemetery} /> : null}
                    {active.cemeteryLocation ? <InfoCell label={t('persons.cemeteryLocation')} value={active.cemeteryLocation} /> : null}
                    {active.graveNumber ? <InfoCell label={t('persons.graveNumber')} value={active.graveNumber} /> : null}
                  </div>
                </section>
              ) : null}

              {context?.milkKinships?.length ? (
                <section className="mb-5">
                  <h3 className="text-xs uppercase font-semibold tracking-wide text-muted-foreground mb-2">{t('persons.milkKinshipHeading')}</h3>
                  <div className="grid gap-2">
                    {context.milkKinships.map((milk) => (
                      <div key={milk.recordName} className="border border-border rounded-md p-3 bg-card text-sm">
                        <div className="grid gap-2 sm:grid-cols-3">
                          <InfoCell label={t('persons.nursingMother')} value={milk.nursingMotherName || '—'} />
                          <InfoCell label={t('persons.milkFather')} value={milk.milkFatherName || '—'} />
                          <InfoCell label={t('persons.breastfedChild')} value={milk.childName || '—'} />
                        </div>
                        {(milk.startDate || milk.endDate || milk.notes) ? (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {[milk.startDate, milk.endDate].filter(Boolean).join(' - ')}
                            {milk.notes ? ` · ${milk.notes}` : ''}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="mb-5">
                <h3 className="text-xs uppercase font-semibold tracking-wide text-muted-foreground mb-2">{t('persons.parents')}</h3>
                {context?.parents?.length ? (
                  <div className="grid gap-2">
                    {context.parents.map((family) => (
                      <div key={family.family.recordName} className="border border-border rounded-md p-3 bg-card text-sm">
                        {[family.man, family.woman].filter(Boolean).map((person) => (
                          <Link key={person.recordName} to={`/person/${person.recordName}`} className="text-primary me-3">
                            <BdiText>{person.fullName}</BdiText>
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">{t('common.noData')}</div>
                )}
              </section>

              <section>
                <h3 className="text-xs uppercase font-semibold tracking-wide text-muted-foreground mb-2">{t('persons.partnerFamilies')}</h3>
                {context?.families?.length ? (
                  <div className="grid gap-2">
                    {context.families.map((family) => (
                      <div key={family.family.recordName} className="border border-border rounded-md p-3 bg-card">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="text-muted-foreground">{t('persons.withPartner')}</span>
                          {family.partner ? (
                            <Link to={`/person/${family.partner.recordName}`} className="text-primary"><BdiText>{family.partner.fullName}</BdiText></Link>
                          ) : (
                            <span>{t('persons.unknownPartner')}</span>
                          )}
                          <Link to={`/family/${family.family.recordName}`} className="ms-auto text-xs text-primary">{t('persons.openFamily')}</Link>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {family.children.length ? t('persons.children', { count: family.children.length }) : t('persons.noChildren')}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">{t('persons.noPartnerFamilies')}</div>
                )}
              </section>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">{t('persons.detailEmpty')}</div>
          )}
        </main>
        )}
      </div>
    </div>
  );
}

function SummaryBox({ label, value, localization }) {
  return (
    <div className="border border-border rounded-md bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1">{formatInteger(value || 0, localization)}</div>
    </div>
  );
}

function InfoCell({ label, value }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 break-words"><BdiText>{value}</BdiText></div>
    </div>
  );
}

function ExportMenu({ onCsv, onJson, controlClass, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${controlClass} inline-flex items-center gap-1.5 px-3`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {t('persons.exportLabel')}
        <span aria-hidden="true" className="text-xs">▾</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute end-0 top-full z-20 mt-1 w-40 rounded-md border border-border bg-popover text-popover-foreground shadow-lg py-1"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onCsv(); }}
            className="block w-full text-start px-3 py-2 text-sm hover:bg-accent"
          >
            {t('persons.exportCsv')}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onJson(); }}
            className="block w-full text-start px-3 py-2 text-sm hover:bg-accent"
          >
            {t('persons.exportJson')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
