/**
 * FamilySearch — Auto-download relatives.
 * Mirrors `FamilySearchPersonBatchDownloadSheet`: walks relatives N generations
 * from a matched FamilySearch ID and stages a local record per hit. Relies on
 * `readFamilySearchPerson` for the underlying fetch so the same API creds work.
 */
import React, { useState } from 'react';
import { getFamilySearchConfig, readFamilySearchPerson } from '../lib/familySearchApi.js';

export function FamilySearchBatchDownloadSheet({ open, onClose }) {
  const [rootId, setRootId] = useState('');
  const [generations, setGenerations] = useState(2);
  const [includeSpouses, setIncludeSpouses] = useState(true);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);

  if (!open) return null;

  const append = (line) => setLog((prev) => [...prev, line]);

  const run = async () => {
    if (!rootId) return;
    setBusy(true);
    setLog([]);
    try {
      const config = await getFamilySearchConfig();
      if (!config?.accessToken) {
        append('No FamilySearch access token configured.');
        setBusy(false);
        return;
      }
      const visited = new Set();
      const queue = [{ id: rootId.trim(), depth: 0 }];
      const results = [];
      while (queue.length > 0) {
        const { id, depth } = queue.shift();
        if (!id || visited.has(id)) continue;
        visited.add(id);
        append(`Fetching ${id} (depth ${depth})…`);
        try {
          const person = await readFamilySearchPerson(config, id);
          results.push({ id, person });
          if (depth >= generations) continue;
          const relatives = extractRelatives(person, { includeSpouses });
          for (const nextId of relatives) {
            if (!visited.has(nextId)) queue.push({ id: nextId, depth: depth + 1 });
          }
        } catch (error) {
          append(`Error for ${id}: ${error?.message || error}`);
        }
      }
      append(`Done. Fetched ${results.length} FamilySearch persons.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-lg">
        <header className="px-5 py-3 border-b border-border flex items-center gap-3">
          <h2 className="text-base font-semibold">Auto-Download Relatives</h2>
          <button onClick={onClose} className="ms-auto text-sm text-muted-foreground hover:text-foreground">Close</button>
        </header>
        <main className="p-5 space-y-3 text-sm">
          <label className="block">
            <span className="text-xs text-muted-foreground">FamilySearch Person ID</span>
            <input
              value={rootId}
              onChange={(e) => setRootId(e.target.value)}
              placeholder="KW1-ABC"
              className="mt-1 w-full bg-background border border-border rounded-md px-2 py-1.5"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Generations to walk</span>
            <input
              type="number"
              min={1}
              max={5}
              value={generations}
              onChange={(e) => setGenerations(Math.min(5, Math.max(1, Number(e.target.value))))}
              className="mt-1 w-24 bg-background border border-border rounded-md px-2 py-1.5"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeSpouses} onChange={(e) => setIncludeSpouses(e.target.checked)} />
            Include spouses
          </label>
          <div className="bg-secondary border border-border rounded-md p-2 text-xs max-h-48 overflow-auto">
            {log.length === 0 ? <span className="text-muted-foreground">Ready.</span> : log.map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </div>
        </main>
        <footer className="px-5 py-3 border-t border-border flex gap-2 justify-end">
          <button onClick={onClose} disabled={busy} className="text-sm border border-border bg-secondary rounded-md px-3 py-1.5">Close</button>
          <button onClick={run} disabled={busy || !rootId} className="text-sm bg-primary text-primary-foreground rounded-md px-3 py-1.5">
            {busy ? 'Running…' : 'Start'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function extractRelatives(person, { includeSpouses }) {
  const ids = [];
  if (!person) return ids;
  const relationships = person.relationships || person._embedded?.relationships || [];
  for (const rel of relationships) {
    const type = rel.type || '';
    if (type === 'http://gedcomx.org/ParentChild' || type === 'http://gedcomx.org/BiologicalParent') {
      if (rel.person1?.resourceId) ids.push(rel.person1.resourceId);
      if (rel.person2?.resourceId) ids.push(rel.person2.resourceId);
    } else if (includeSpouses && type === 'http://gedcomx.org/Couple') {
      if (rel.person1?.resourceId) ids.push(rel.person1.resourceId);
      if (rel.person2?.resourceId) ids.push(rel.person2.resourceId);
    }
  }
  return ids.filter(Boolean);
}

export default FamilySearchBatchDownloadSheet;
