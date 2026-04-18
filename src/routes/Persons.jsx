import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PersonList } from '../components/interactive/PersonList.jsx';
import { useActivePerson } from '../contexts/ActivePersonContext.jsx';
import { buildPersonContext } from '../lib/personContext.js';
import { downloadRowsAsCsv, downloadRowsAsJson } from '../lib/listExport.js';
import { loadPersonRows } from '../lib/listData.js';

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
  const { setActivePerson } = useActivePerson();
  const navigate = useNavigate();

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

  return (
    <div className="flex flex-col h-full">
      <header className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <div className="mr-auto min-w-0">
          <h1 className="text-base font-semibold">Persons</h1>
          <div className="text-xs text-muted-foreground mt-1">
            {visiblePersons.length.toLocaleString()} of {persons.length.toLocaleString()} persons
          </div>
        </div>
        <label className="text-xs text-muted-foreground">Filter</label>
        <select value={filter} onChange={(event) => setFilter(event.target.value)} className="bg-secondary text-foreground border border-border rounded-md px-2.5 py-1.5 text-sm">
          <option value="all">All persons</option>
          <option value="bookmarked">Bookmarked</option>
          <option value="start">Start person</option>
          <option value="missing-birth">Missing birth date</option>
          <option value="missing-death">Missing death date</option>
        </select>
        <label className="text-xs text-muted-foreground">Sort</label>
        <select value={sortKey} onChange={(event) => setSortKey(event.target.value)} className="bg-secondary text-foreground border border-border rounded-md px-2.5 py-1.5 text-sm">
          <option value="name">Name</option>
          <option value="birth">Birth year</option>
          <option value="death">Death year</option>
        </select>
        <button onClick={() => downloadRowsAsCsv('persons-list', visiblePersons, EXPORT_COLUMNS)} className="bg-secondary text-foreground border border-border rounded-md px-3 py-1.5 text-xs">
          Export CSV
        </button>
        <button onClick={() => downloadRowsAsJson('persons-list', visiblePersons, EXPORT_COLUMNS)} className="bg-secondary text-foreground border border-border rounded-md px-3 py-1.5 text-xs">
          Export JSON
        </button>
      </header>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="w-[min(320px,48vw)] flex-shrink-0">
          <PersonList persons={visiblePersons} activeId={activeId} onPick={setActiveId} />
        </div>
        <main className="flex-1 min-w-0 overflow-auto">
          {active ? (
            <div className="p-6 max-w-5xl">
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
