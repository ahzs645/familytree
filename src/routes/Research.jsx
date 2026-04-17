/**
 * Research Assistant — heuristic suggestions per person, sorted by gap count.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateResearchSuggestions } from '../lib/researchSuggestions.js';

export default function Research() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let cancel = false;
    (async () => {
      const list = await generateResearchSuggestions();
      if (!cancel) setItems(list);
    })();
    return () => { cancel = true; };
  }, []);

  if (!items) return <div className="p-10 text-muted-foreground">Analyzing tree…</div>;
  const visible = filter ? items.filter((i) => i.suggestions.some((s) => s.toLowerCase().includes(filter.toLowerCase())) || i.fullName.toLowerCase().includes(filter.toLowerCase())) : items;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">Research Assistant</h1>
        <span className="text-xs text-muted-foreground">{items.length} persons with open questions</span>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…"
          className="ml-auto bg-secondary border border-border rounded-md px-3 py-1.5 text-sm w-64" />
      </header>
      <main className="flex-1 overflow-auto p-5 bg-background">
        <div className="max-w-3xl mx-auto space-y-2">
          {visible.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">No matching suggestions.</div>
          ) : visible.slice(0, 200).map((it) => (
            <div key={it.recordName} className="bg-card border border-border rounded-md p-4">
              <div className="flex items-baseline justify-between mb-2">
                <button onClick={() => navigate(`/person/${it.recordName}`)} className="text-sm font-semibold text-primary hover:underline text-left">
                  {it.fullName}
                </button>
                <span className="text-xs text-muted-foreground">{it.suggestions.length} open</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                {it.suggestions.map((s, i) => <li key={i}>· {s}</li>)}
              </ul>
            </div>
          ))}
          {visible.length > 200 && <div className="text-xs text-muted-foreground text-center">… +{visible.length - 200} more</div>}
        </div>
      </main>
    </div>
  );
}
