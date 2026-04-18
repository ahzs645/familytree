import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadListCounts } from '../lib/listData.js';

const LIST_CARDS = [
  { to: '/persons', title: 'Persons', key: 'persons', body: 'Dedicated person master-detail list with export and editor jumps.' },
  { to: '/places', title: 'Places', key: 'places', body: 'Existing place list and editor with coordinates and place templates.' },
  { to: '/sources', title: 'Sources', key: 'sources', body: 'Existing source list and editor with citation details.' },
  { to: '/events', title: 'Events', key: 'events', body: 'Person and family events with event-type and owner editing.' },
  { to: '/media', title: 'Media', key: 'media', body: 'Media gallery for pictures, PDFs, URLs, audio, and video.' },
  { to: '/todos', title: 'To-Dos', key: 'todos', body: 'Research task list with status, priority, and related records.' },
  { to: '/change-log', title: 'Changes', key: 'changes', body: 'Change log entries grouped by date with field-level details.' },
  { to: '/plausibility-list', title: 'Plausibility', key: 'plausibility', body: 'Rule-based data quality warnings as a sortable list.' },
  { to: '/anniversaries', title: 'Anniversary', key: 'anniversary', body: 'Birth and death anniversaries by month and day.' },
  { to: '/facts', title: 'Facts', key: 'facts', body: 'Person facts with fact type and date filters.' },
  { to: '/marriages', title: 'Marriage', key: 'marriage', body: 'Family partner pairs with row-level partner links.' },
];

const ANALYSIS_CARDS = [
  { to: '/distinctive-persons', title: 'Distinctive Persons', body: 'Rule-based distinctive person list with marker detection.' },
  { to: '/person-analysis', title: 'Person Analysis', body: 'Age, missing dates, orphaned relationships, and duplicate risks.' },
  { to: '/lds-ordinances', title: 'LDS Ordinances', body: 'Schema-gated LDS-oriented ordinance list.' },
];

export default function Lists() {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await loadListCounts();
      if (!cancelled) setCounts(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8 pb-16">
        <section className="mb-8">
          <h1 className="text-3xl font-bold mb-3">Lists</h1>
          <p className="text-muted-foreground leading-relaxed max-w-3xl">
            Direct entry points for desktop-equivalent list surfaces. These routes open independently from Reports and
            link rows back to the relevant editors.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Core Lists</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
            {LIST_CARDS.map((card) => (
              <ListCard key={card.to} card={card} count={counts?.[card.key]} loading={!counts} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Analysis Lists</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
            {ANALYSIS_CARDS.map((card) => (
              <Link
                key={card.to}
                to={card.to}
                className="p-4 rounded-lg border border-border bg-card hover:border-muted-foreground/50 transition-colors"
              >
                <div className="text-base font-semibold flex justify-between mb-1.5">
                  {card.title} <span className="text-primary">-&gt;</span>
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">{card.body}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ListCard({ card, count, loading }) {
  return (
    <Link to={card.to} className="p-4 rounded-lg border border-border bg-card hover:border-muted-foreground/50 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="text-base font-semibold">{card.title}</div>
        <div className="text-sm font-semibold text-primary tabular-nums">{loading ? '...' : Number(count || 0).toLocaleString()}</div>
      </div>
      <div className="text-xs text-muted-foreground leading-relaxed">{card.body}</div>
    </Link>
  );
}
