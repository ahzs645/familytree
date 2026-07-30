import React, { useEffect, useMemo, useState } from 'react';
import { listAllPersons } from '../lib/treeQuery.js';
import {
  applyLineageAsPersonGroup,
  calculateLineageAssignments,
  deleteLineageDefinition,
  listLineageDefinitions,
  saveLineageDefinition,
} from '../lib/lineageTracking.js';
import { useModal } from '../contexts/ModalContext.jsx';
import { PageTitle } from '../components/ui/PageTitle.jsx';

const emptyForm = { name: '', rootPersonId: '', type: 'all', description: '' };

export default function Lineages() {
  const modal = useModal();
  const [persons, setPersons] = useState([]);
  const [definitions, setDefinitions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [assignments, setAssignments] = useState([]);
  const [status, setStatus] = useState('');

  const active = useMemo(() => definitions.find((item) => item.id === activeId), [definitions, activeId]);

  const reload = async () => {
    const [people, defs] = await Promise.all([listAllPersons(), listLineageDefinitions()]);
    setPersons(people);
    setDefinitions(defs);
    if (!activeId && defs[0]) setActiveId(defs[0].id);
    if (!form.rootPersonId && people[0]) setForm((current) => ({ ...current, rootPersonId: people[0].recordName }));
  };

  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (active) setForm({ name: active.name, rootPersonId: active.rootPersonId, type: active.type, description: active.description || '' });
  }, [active]);
  useEffect(() => {
    if (!form.rootPersonId) return;
    (async () => setAssignments(await calculateLineageAssignments(form)))();
  }, [form.rootPersonId, form.type]);

  const save = async () => {
    const saved = await saveLineageDefinition({ ...form, id: activeId });
    setActiveId(saved.id);
    await reload();
    setStatus('Lineage saved.');
  };

  const create = () => {
    setActiveId(null);
    setForm({ ...emptyForm, rootPersonId: persons[0]?.recordName || '' });
    setAssignments([]);
  };

  const remove = async () => {
    if (!activeId) return;
    if (!(await modal.confirm('Delete this lineage definition?', { title: 'Delete lineage', okLabel: 'Delete', destructive: true }))) return;
    await deleteLineageDefinition(activeId);
    setActiveId(null);
    await reload();
  };

  const apply = async () => {
    const saved = activeId ? { ...form, id: activeId } : await saveLineageDefinition(form);
    const result = await applyLineageAsPersonGroup(saved);
    setStatus(`Applied ${result.assignments.length} people to Person Group "${saved.name}".`);
    await reload();
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(9rem,min(38dvh,18rem))_minmax(0,1fr)] bg-background lg:grid-cols-[280px_minmax(0,1fr)] lg:grid-rows-1">
      <aside className="min-h-0 overflow-auto border-b border-border bg-card lg:border-b-0 lg:border-e">
        <header className="flex items-center gap-2 p-3 border-b border-border">
          <PageTitle className="text-sm font-semibold">Lineages</PageTitle>
          <button onClick={create} className="ms-auto inline-flex h-8 items-center rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground">New</button>
        </header>
        {definitions.map((item) => (
          <button key={item.id} onClick={() => setActiveId(item.id)} className={`block w-full text-start px-3 py-2 border-b border-border text-sm ${item.id === activeId ? 'bg-primary/10' : 'hover:bg-accent'}`}>
            <div className="font-medium truncate">{item.name}</div>
            <div className="text-xs text-muted-foreground truncate">{item.type}</div>
          </button>
        ))}
      </aside>
      <div className="min-w-0 overflow-auto p-3 sm:p-5">
        <div className="max-w-4xl">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 flex-1 text-xl font-bold">{activeId ? 'Edit lineage' : 'New lineage'}</h2>
            {status ? <span className="text-xs text-muted-foreground">{status}</span> : null}
            <div className="flex w-full flex-wrap gap-2 sm:ms-auto sm:w-auto">
              <button onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save</button>
              <button onClick={apply} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Apply to group</button>
              {activeId ? <button onClick={remove} className="rounded-md border border-destructive px-4 py-2 text-sm text-destructive-text hover:bg-destructive/10">Delete</button> : null}
            </div>
          </div>
          <section className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-md border border-border bg-card p-4 mb-4">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm normal-case font-normal" /></label>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Root person<select value={form.rootPersonId} onChange={(e) => setForm({ ...form, rootPersonId: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm normal-case font-normal">{persons.map((person) => <option key={person.recordName} value={person.recordName}>{person.fullName}</option>)}</select></label>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Type<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm normal-case font-normal"><option value="all">All descendants</option><option value="patrilineal">Patrilineal</option><option value="matrilineal">Matrilineal</option></select></label>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Description<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm normal-case font-normal" /></label>
          </section>
          <section className="rounded-md border border-border bg-card overflow-hidden">
            <header className="p-3 border-b border-border text-sm font-semibold">Preview · {assignments.length} people</header>
            <div className="max-h-[520px] overflow-auto">
              {assignments.map((item) => <div key={item.personId} className="grid grid-cols-[70px_1fr] gap-3 border-b border-border px-3 py-2 text-sm"><span className="font-mono text-xs text-muted-foreground">Gen {item.generation}</span><span>{item.name}</span></div>)}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
