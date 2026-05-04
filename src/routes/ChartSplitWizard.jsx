import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listAllPersons } from '../lib/treeQuery.js';
import { createSplitChartDocuments, previewChartSplit, SPLIT_METHODS } from '../lib/chartSplitWizard.js';

export default function ChartSplitWizard() {
  const navigate = useNavigate();
  const [persons, setPersons] = useState([]);
  const [options, setOptions] = useState({
    method: 'generation',
    rootPersonId: '',
    startPersonId: '',
    endPersonId: '',
    generations: 6,
    generationsPerChart: 3,
    surnames: '',
    namePrefix: 'Split chart',
  });
  const [previews, setPreviews] = useState([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    (async () => {
      const list = await listAllPersons();
      setPersons(list);
      const first = list[0]?.recordName || '';
      setOptions((current) => ({ ...current, rootPersonId: first, startPersonId: first, endPersonId: first }));
    })();
  }, []);

  useEffect(() => {
    if (!options.rootPersonId) return;
    (async () => setPreviews(await previewChartSplit(options)))();
  }, [options]);

  const update = (key, value) => setOptions((current) => ({ ...current, [key]: value }));

  const create = async () => {
    const docs = await createSplitChartDocuments(options);
    setStatus(`Created ${docs.length} saved chart document${docs.length === 1 ? '' : 's'}.`);
    if (docs[0]) navigate('/saved-charts');
  };

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-6xl mx-auto p-5">
        <header className="mb-5">
          <h1 className="text-xl font-bold">Chart Split Wizard</h1>
          <p className="text-sm text-muted-foreground mt-1">Plan and create focused saved chart documents from one large tree.</p>
        </header>

        <section className="rounded-md border border-border bg-card p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Split method<select value={options.method} onChange={(e) => update('method', e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm normal-case font-normal">{SPLIT_METHODS.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}</select></label>
            <PersonSelect label="Root person" value={options.rootPersonId} persons={persons} onChange={(value) => update('rootPersonId', value)} />
            <label className="text-xs font-semibold uppercase text-muted-foreground">Name prefix<input value={options.namePrefix} onChange={(e) => update('namePrefix', e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm normal-case font-normal" /></label>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Generations<input type="number" min="1" max="12" value={options.generations} onChange={(e) => update('generations', e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm normal-case font-normal" /></label>
            {options.method === 'generation' ? <label className="text-xs font-semibold uppercase text-muted-foreground">Generations per chart<input type="number" min="1" max="6" value={options.generationsPerChart} onChange={(e) => update('generationsPerChart', e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm normal-case font-normal" /></label> : null}
            {options.method === 'lineage' ? <><PersonSelect label="Start person" value={options.startPersonId} persons={persons} onChange={(value) => update('startPersonId', value)} /><PersonSelect label="End person" value={options.endPersonId} persons={persons} onChange={(value) => update('endPersonId', value)} /></> : null}
            {options.method === 'surname' ? <label className="md:col-span-2 text-xs font-semibold uppercase text-muted-foreground">Surnames<input value={options.surnames} onChange={(e) => update('surnames', e.target.value)} placeholder="Leave blank for every surname, or comma-separate selected surnames" className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm normal-case font-normal" /></label> : null}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button onClick={create} disabled={previews.length === 0} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Create saved charts</button>
            {status ? <span className="text-xs text-muted-foreground">{status}</span> : null}
          </div>
        </section>

        <section className="rounded-md border border-border bg-card overflow-hidden">
          <header className="p-3 border-b border-border text-sm font-semibold">Preview · {previews.length} chart{previews.length === 1 ? '' : 's'}</header>
          {previews.map((preview) => (
            <div key={preview.id} className="grid grid-cols-[1fr_120px_120px] gap-3 border-b border-border px-3 py-2 text-sm">
              <span>{preview.name}</span>
              <span className="text-muted-foreground">{preview.chartType}</span>
              <span className="text-muted-foreground">{preview.generations} gen.</span>
            </div>
          ))}
          {previews.length === 0 ? <div className="p-8 text-center text-muted-foreground">No chart documents planned for this selection.</div> : null}
        </section>
      </div>
    </div>
  );
}

function PersonSelect({ label, value, persons, onChange }) {
  return (
    <label className="text-xs font-semibold uppercase text-muted-foreground">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm normal-case font-normal">
        {persons.map((person) => <option key={person.recordName} value={person.recordName}>{person.fullName}</option>)}
      </select>
    </label>
  );
}
