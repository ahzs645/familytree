/**
 * Publish hub - explicit orchestration surface for distributable artifacts.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';

const CARDS = [
  {
    to: '/websites',
    title: 'Websites',
    body: 'Configure branding, privacy filtering, validation, and static site generation.',
    action: 'Build website',
  },
  {
    to: '/books',
    title: 'Books',
    body: 'Compose a family tree book, preview it, then export HTML, PDF, or a bundle.',
    action: 'Publish book',
  },
  {
    to: '/export',
    title: 'Import & Export',
    body: 'Use GEDCOM, backup, merge, and subtree tools for data transfer rather than publishing.',
    action: 'Open transfers',
  },
];

export default function Publish() {
  const { summary } = useDatabaseStatus();

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-5xl mx-auto p-6">
        <section className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Publish</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Create artifacts meant to be shared or hosted. GEDCOM and backup transfer tools stay separate in Import & Export.
          </p>
        </section>

        <section className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Current tree</div>
          <div className="text-xl font-semibold">{summary?.total?.toLocaleString() || 0} records</div>
          {summary && (
            <div className="text-xs text-muted-foreground mt-1">
              {(summary.types.Person || 0).toLocaleString()} people · {(summary.types.Family || 0).toLocaleString()} families ·{' '}
              {(summary.types.Place || 0).toLocaleString()} places · {(summary.types.Source || 0).toLocaleString()} sources
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CARDS.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className="rounded-lg border border-border bg-card p-5 hover:border-muted-foreground/60 transition-colors"
            >
              <h2 className="text-base font-semibold mb-2">{card.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{card.body}</p>
              <span className="inline-flex rounded-md bg-secondary border border-border px-3 py-1.5 text-xs font-medium">
                {card.action}
              </span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
