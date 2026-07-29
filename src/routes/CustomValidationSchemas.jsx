import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  deleteCustomValidationSchema,
  listCustomValidationSchemas,
  runCustomValidationSchemas,
  saveCustomValidationSchema,
} from '../lib/customValidationSchemas.js';
import { useModal } from '../contexts/ModalContext.jsx';

const starter = {
  name: 'Core person fields',
  enabled: true,
  severity: 'medium',
  scopeType: 'all',
  scopeValue: '',
  requiredFieldsText: 'firstName,lastName',
  propertiesText: '{\n  "cached_birthDate": { "type": "date" },\n  "gender": { "type": "enum", "values": ["0", "1", "2", "3"] }\n}',
  constraintsText: '[\n  { "type": "after", "field": "cached_deathDate", "afterField": "cached_birthDate" }\n]',
};

export default function CustomValidationSchemas() {
  const modal = useModal();
  const navigate = useNavigate();
  const [schemas, setSchemas] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [form, setForm] = useState(starter);
  const [issues, setIssues] = useState([]);
  const [status, setStatus] = useState('');

  const reload = async () => {
    const list = await listCustomValidationSchemas();
    setSchemas(list);
    if (!activeId && list[0]) setActiveId(list[0].id);
  };
  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const active = schemas.find((schema) => schema.id === activeId);
    if (!active) return;
    setForm({
      ...active,
      requiredFieldsText: (active.requiredFields || []).join(','),
      propertiesText: JSON.stringify(active.properties || {}, null, 2),
      constraintsText: JSON.stringify(active.constraints || [], null, 2),
    });
  }, [schemas, activeId]);

  const save = async () => {
    try {
      const saved = await saveCustomValidationSchema({
        ...form,
        id: activeId,
        requiredFields: form.requiredFieldsText.split(',').map((item) => item.trim()).filter(Boolean),
        properties: JSON.parse(form.propertiesText || '{}'),
        constraints: JSON.parse(form.constraintsText || '[]'),
      });
      setActiveId(saved.id);
      await reload();
      setStatus('Rule saved.');
    } catch (error) {
      setStatus(`Save failed: ${error.message}`);
    }
  };

  const run = async () => {
    setIssues(await runCustomValidationSchemas());
    setStatus('Validation complete.');
  };

  const create = () => {
    setActiveId(null);
    setForm(starter);
    setStatus('');
  };

  const remove = async () => {
    if (!activeId) return;
    if (!(await modal.confirm('Delete this custom data rule?', { title: 'Delete rule', okLabel: 'Delete', destructive: true }))) return;
    await deleteCustomValidationSchema(activeId);
    setActiveId(null);
    await reload();
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(9rem,min(38dvh,18rem))_minmax(0,1fr)] bg-background lg:grid-cols-[300px_minmax(0,1fr)] lg:grid-rows-1">
      <aside className="min-h-0 overflow-auto border-b border-border bg-card lg:border-b-0 lg:border-e">
        <header className="flex items-center gap-2 p-3 border-b border-border">
          <h1 className="text-sm font-semibold">Custom Data Rules</h1>
          <button onClick={create} className="ms-auto rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">New</button>
        </header>
        {schemas.map((schema) => (
          <button key={schema.id} onClick={() => setActiveId(schema.id)} className={`block w-full text-start px-3 py-2 border-b border-border text-sm ${schema.id === activeId ? 'bg-primary/10' : 'hover:bg-accent'}`}>
            <div className="font-medium truncate">{schema.name}</div>
            <div className="text-xs text-muted-foreground">{schema.enabled === false ? 'disabled' : schema.scopeType}</div>
          </button>
        ))}
      </aside>
      <div className="min-w-0 overflow-auto p-3 sm:p-5">
        <div className="max-w-5xl">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 flex-1 text-xl font-bold">{activeId ? 'Edit rule' : 'New rule'}</h2>
            {status ? <span className="text-xs text-muted-foreground">{status}</span> : null}
            <div className="flex w-full flex-wrap gap-2 sm:ms-auto sm:w-auto">
              <button onClick={run} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Run all</button>
              <button onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save</button>
              {activeId ? <button onClick={remove} className="rounded-md border border-destructive px-4 py-2 text-sm text-destructive-text hover:bg-destructive/10">Delete</button> : null}
            </div>
          </div>
          <section className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-md border border-border bg-card p-4 mb-4">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Name<input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm normal-case font-normal" /></label>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Severity<select value={form.severity || 'medium'} onChange={(e) => setForm({ ...form, severity: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm normal-case font-normal"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Scope<select value={form.scopeType || 'all'} onChange={(e) => setForm({ ...form, scopeType: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm normal-case font-normal"><option value="all">All persons</option><option value="group">Person group</option><option value="field">Field match</option></select></label>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Scope value<input value={form.scopeValue || ''} onChange={(e) => setForm({ ...form, scopeValue: e.target.value })} placeholder="Group name or field=value" className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm normal-case font-normal" /></label>
            <label className="md:col-span-2 text-xs font-semibold uppercase text-muted-foreground">Required fields<input value={form.requiredFieldsText || ''} onChange={(e) => setForm({ ...form, requiredFieldsText: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm normal-case font-normal" /></label>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Properties JSON<textarea rows={10} value={form.propertiesText || '{}'} onChange={(e) => setForm({ ...form, propertiesText: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm font-mono normal-case font-normal" /></label>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Constraints JSON<textarea rows={10} value={form.constraintsText || '[]'} onChange={(e) => setForm({ ...form, constraintsText: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm font-mono normal-case font-normal" /></label>
          </section>
          <section className="rounded-md border border-border bg-card overflow-hidden">
            <header className="p-3 border-b border-border text-sm font-semibold">Results · {issues.length}</header>
            {issues.map((issue, index) => (
              <div key={`${issue.schemaId}-${issue.recordName}-${index}`} className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-sm sm:gap-3">
                <span className="w-16 shrink-0 text-xs uppercase text-muted-foreground">{issue.severity}</span>
                <span className="min-w-0 flex-1 basis-[12rem] break-words">{issue.message}</span>
                <button onClick={() => navigate(`/person/${issue.recordName}`)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">Open</button>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
