import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PersonList } from '../components/interactive/PersonList.jsx';
import { useActivePerson } from '../contexts/ActivePersonContext.jsx';
import { buildPersonContext } from '../lib/personContext.js';
import { downloadRowsAsCsv, downloadRowsAsJson } from '../lib/listExport.js';
import { loadPersonRows } from '../lib/listData.js';
import { useIsMobile } from '../lib/useIsMobile.js';
import { Select } from '../components/ui/Select.jsx';

const EXPORT_COLUMNS = [
  { key: 'fullName', label: 'Name' },
  { key: 'genderLabel', label: 'Gender' },
  { key: 'birthDate', label: 'Born' },
  { key: 'deathDate', label: 'Died' },
  { key: 'bookmarked', label: 'Bookmarked' },
  { key: 'startPerson', label: 'Start Person' },
  { key: 'id', label: 'Record ID' },
];

export default function Persons() {
  const [persons, setPersons] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('name');
  const [filter, setFilter] = useState('all');
  const [mobilePane, setMobilePane] = useState('list');
  const isMobile = useIsMobile();
  const { setActivePerson } = useActivePerson();
  const navigate = useNavigate();

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

  const visiblePersons = useMemo(() => {
    let next = persons.filter((person) => {
      if (filter === 'bookmarked') return person.bookmarked;
      if (filter === 'start') return person.startPerson;
      if (filter === 'missing-birth') return !person.birthDate;
      if (filter === 'missing-death') return !person.deathDate;
      return true;
    });
    next = [...next].sort((a, b) => {
      if (sortKey === 'birth') return (a.birthYear || 99999) - (b.birthYear || 99999) || a.fullName.localeCompare(b.fullName);
      if (sortKey === 'death') return (a.deathYear || 99999) - (b.deathYear || 99999) || a.fullName.localeCompare(b.fullName);
      return a.fullName.localeCompare(b.fullName);
    });
    return next;
  }, [persons, filter, sortKey]);

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

  const openTree = () => {
    if (!activeId) return;
    setActivePerson(activeId);
    navigate('/tree');
  };

  if (loading) return <div className="p-10 text-muted-foreground">Loading persons...</div>;

  const controlClass = 'h-10 rounded-md border border-border bg-secondary text-foreground text-sm px-3 outline-none focus:border-primary';

  const filterOptions = [
    { value: 'all', label: 'All persons' },
    { value: 'bookmarked', label: 'Bookmarked' },
    { value: 'start', label: 'Start person' },
    { value: 'missing-birth', label: 'Missing birth date' },
    { value: 'missing-death', label: 'Missing death date' },
  ];
  const sortOptions = [
    { value: 'name', label: 'Sort: Name' },
    { value: 'birth', label: 'Sort: Birth year' },
    { value: 'death', label: 'Sort: Death year' },
  ];

  return (
    <div className="flex flex-col h-full">
      <header className="border-b border-border bg-card px-4 md:px-5 py-3">
        <div className="flex items-center gap-2 mb-2 md:mb-3">
          <div className="min-w-0 mr-auto">
            <h1 className="text-base font-semibold leading-tight">Persons</h1>
            <div className="text-xs text-muted-foreground">
              {visiblePersons.length.toLocaleString()} of {persons.length.toLocaleString()}
            </div>
          </div>
          <ExportMenu
            onCsv={() => downloadRowsAsCsv('persons-list', visiblePersons, EXPORT_COLUMNS)}
            onJson={() => downloadRowsAsJson('persons-list', visiblePersons, EXPORT_COLUMNS)}
            controlClass={controlClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center md:gap-3">
          <label className="sr-only md:not-sr-only md:text-xs md:text-muted-foreground" htmlFor="persons-filter">Filter</label>
          <Select
            id="persons-filter"
            value={filter}
            onChange={setFilter}
            options={filterOptions}
            ariaLabel="Filter persons"
            className="w-full md:w-48"
          />
          <label className="sr-only md:not-sr-only md:text-xs md:text-muted-foreground" htmlFor="persons-sort">Sort</label>
          <Select
            id="persons-sort"
            value={sortKey}
            onChange={setSortKey}
            options={sortOptions}
            ariaLabel="Sort persons"
            className="w-full md:w-48"
          />
        </div>
      </header>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {(!isMobile || mobilePane === 'list') && (
          <div className={isMobile ? 'w-full' : 'w-[min(320px,48vw)] flex-shrink-0'}>
            <PersonList persons={visiblePersons} activeId={activeId} onPick={pick} />
          </div>
        )}
        {(!isMobile || mobilePane === 'detail') && (
        <main className="flex-1 min-w-0 overflow-auto">
          {active ? (
            <div className="p-4 md:p-6 max-w-5xl">
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setMobilePane('list')}
                  className="mb-3 text-sm text-primary font-semibold py-2 px-1 min-h-10"
                >
                  ← Back to list
                </button>
              )}
              <div className="flex flex-wrap items-start gap-3 mb-5">
                <div className="mr-auto min-w-0">
                  <h2 className="text-2xl font-semibold truncate">{active.fullName}</h2>
                  <div className="text-sm text-muted-foreground mt-1">
                    {active.genderLabel} · {active.birthDate || 'Birth unknown'} - {active.deathDate || 'Death unknown'}
                  </div>
                </div>
                <button onClick={openTree} className="bg-secondary text-foreground border border-border rounded-md px-3 py-2 text-xs">
                  Open in Tree
                </button>
                <Link to={`/person/${active.id}`} className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-xs font-semibold">
                  Open Editor
                </Link>
              </div>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 mb-5">
                <SummaryBox label="Parents" value={context?.parents?.length || 0} />
                <SummaryBox label="Partner Families" value={context?.families?.length || 0} />
                <SummaryBox label="Events" value={context?.events?.length || 0} />
                <SummaryBox label="Facts" value={context?.facts?.length || 0} />
              </div>

              <section className="mb-5">
                <h3 className="text-xs uppercase font-semibold tracking-wide text-muted-foreground mb-2">Parents</h3>
                {context?.parents?.length ? (
                  <div className="grid gap-2">
                    {context.parents.map((family) => (
                      <div key={family.family.recordName} className="border border-border rounded-md p-3 bg-card text-sm">
                        {[family.man, family.woman].filter(Boolean).map((person) => (
                          <Link key={person.recordName} to={`/person/${person.recordName}`} className="text-primary mr-3">
                            {person.fullName}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No parents recorded.</div>
                )}
              </section>

              <section>
                <h3 className="text-xs uppercase font-semibold tracking-wide text-muted-foreground mb-2">Partner Families</h3>
                {context?.families?.length ? (
                  <div className="grid gap-2">
                    {context.families.map((family) => (
                      <div key={family.family.recordName} className="border border-border rounded-md p-3 bg-card">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="text-muted-foreground">With</span>
                          {family.partner ? (
                            <Link to={`/person/${family.partner.recordName}`} className="text-primary">{family.partner.fullName}</Link>
                          ) : (
                            <span>Unknown partner</span>
                          )}
                          <Link to={`/family/${family.family.recordName}`} className="ml-auto text-xs text-primary">Open family</Link>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {family.children.length ? `${family.children.length} child${family.children.length === 1 ? '' : 'ren'}` : 'No children recorded'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No partner families recorded.</div>
                )}
              </section>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">No persons match the current filters.</div>
          )}
        </main>
        )}
      </div>
    </div>
  );
}

function SummaryBox({ label, value }) {
  return (
    <div className="border border-border rounded-md bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1">{Number(value || 0).toLocaleString()}</div>
    </div>
  );
}

function ExportMenu({ onCsv, onJson, controlClass }) {
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
        Export
        <span aria-hidden="true" className="text-xs">▾</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-40 rounded-md border border-border bg-popover text-popover-foreground shadow-lg py-1"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onCsv(); }}
            className="block w-full text-left px-3 py-2 text-sm hover:bg-accent"
          >
            Export CSV
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onJson(); }}
            className="block w-full text-left px-3 py-2 text-sm hover:bg-accent"
          >
            Export JSON
          </button>
        </div>
      ) : null}
    </div>
  );
}
