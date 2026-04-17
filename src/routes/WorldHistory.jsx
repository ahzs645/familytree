/**
 * World History — interleave a focus person's life events with curated
 * world events on a single vertical timeline.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActivePerson } from '../contexts/ActivePersonContext.jsx';
import { listAllPersons, findStartPerson } from '../lib/treeQuery.js';
import { buildPersonContext } from '../lib/personContext.js';
import { PersonPicker } from '../components/charts/PersonPicker.jsx';
import { lifeSpanLabel } from '../models/index.js';
import { WORLD_EVENTS } from '../lib/worldHistory.js';

function yearOf(s) { const m = String(s || '').match(/(\d{4})/); return m ? parseInt(m[1], 10) : null; }

export default function WorldHistory() {
  const { recordName, setActivePerson } = useActivePerson();
  const navigate = useNavigate();
  const [persons, setPersons] = useState([]);
  const [context, setContext] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const list = await listAllPersons();
      if (cancel) return;
      setPersons(list);
      if (!recordName) {
        const start = await findStartPerson();
        if (start && !cancel) setActivePerson(start.recordName);
      }
    })();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    if (!recordName) return;
    let cancel = false;
    (async () => {
      const ctx = await buildPersonContext(recordName);
      if (!cancel) setContext(ctx);
    })();
    return () => { cancel = true; };
  }, [recordName]);

  const personEvents = (context?.events || []).map((e) => ({
    kind: 'person',
    year: yearOf(e.fields?.date?.value),
    title: e.fields?.conclusionType?.value || e.fields?.eventType?.value || 'Event',
    sub: e.fields?.date?.value || '',
  })).filter((e) => e.year);

  const personRange = (() => {
    const years = personEvents.map((e) => e.year);
    if (years.length === 0) return null;
    return [Math.min(...years) - 5, Math.max(...years) + 5];
  })();

  const items = [
    ...personEvents,
    ...WORLD_EVENTS.filter((e) => !personRange || (e.year >= personRange[0] && e.year <= personRange[1] + 50)).map((e) => ({
      kind: 'world',
      year: e.year,
      end: e.end,
      title: e.title,
      region: e.region,
      type: e.kind,
    })),
  ].sort((a, b) => a.year - b.year);

  const focusName = context?.selfSummary?.fullName;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">World History</h1>
        <div className="ml-2 max-w-xs">
          <PersonPicker persons={persons} value={recordName} onChange={(id) => setActivePerson(id)} />
        </div>
        {focusName && (
          <span className="text-xs text-muted-foreground">
            Showing alongside {focusName}{lifeSpanLabel(context?.selfSummary) && ` · ${lifeSpanLabel(context?.selfSummary)}`}
          </span>
        )}
      </header>
      <main className="flex-1 overflow-auto p-5 bg-background">
        <div className="max-w-3xl mx-auto">
          {items.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">Pick a person with dated events to see context.</div>
          ) : (
            <ol className="border-l-2 border-border ml-4">
              {items.map((it, i) => (
                <li key={i} className="relative ml-4 pl-4 pb-4">
                  <span className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2 ${it.kind === 'person' ? 'bg-primary border-primary' : 'bg-card border-muted-foreground'}`} />
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums w-16 flex-shrink-0">
                      {it.year}{it.end ? `–${it.end}` : ''}
                    </span>
                    <span className={`text-sm ${it.kind === 'person' ? 'font-semibold text-primary' : 'text-foreground'}`}>{it.title}</span>
                  </div>
                  <div className="text-xs text-muted-foreground ml-[72px]">
                    {it.kind === 'person'
                      ? <>{focusName} · {it.sub}</>
                      : <>{it.region} · {it.type}</>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </main>
    </div>
  );
}
