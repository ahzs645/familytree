import React, { useEffect, useState } from 'react';
import { listAllPersons } from '../lib/treeQuery.js';
import { NUMBERING_SYSTEMS, calculateReferenceNumbers } from '../lib/referenceNumbering.js';

export default function ReferenceNumbering() {
  const [persons, setPersons] = useState([]);
  const [rootId, setRootId] = useState('');
  const [system, setSystem] = useState('ahnentafel');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const list = await listAllPersons();
      setPersons(list);
      setRootId(list[0]?.recordName || '');
    })();
  }, []);

  const run = async () => {
    if (!rootId) return;
    setBusy(true);
    try {
      setRows(await calculateReferenceNumbers(rootId, system));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { if (rootId) run(); }, [rootId, system]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-6xl mx-auto p-5">
        <header className="mb-5">
          <h1 className="text-xl font-bold">Reference Numbering</h1>
          <p className="text-sm text-muted-foreground mt-1">Calculate Ahnentafel, d'Aboville, Henry, or generation-relative numbers from a selected person.</p>
        </header>

        <section className="rounded-md border border-border bg-card p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3">
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Root person
              <select value={rootId} onChange={(e) => setRootId(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm normal-case font-normal">
                {persons.map((person) => <option key={person.recordName} value={person.recordName}>{person.fullName}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              System
              <select value={system} onChange={(e) => setSystem(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm normal-case font-normal">
                {NUMBERING_SYSTEMS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <button onClick={run} disabled={busy || !rootId} className="self-end rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {busy ? 'Calculating...' : 'Refresh'}
            </button>
          </div>
        </section>

        <div className="rounded-md border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-2">Number</th>
                <th className="text-left p-2">Person</th>
                <th className="text-left p-2">Generation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.personId}-${row.number}`} className="border-t border-border">
                  <td className="p-2 font-mono text-xs">{row.number}</td>
                  <td className="p-2">{row.name}</td>
                  <td className="p-2 text-muted-foreground">{row.generation}</td>
                </tr>
              ))}
              {rows.length === 0 ? <tr><td colSpan="3" className="p-8 text-center text-muted-foreground">No numbers calculated.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
