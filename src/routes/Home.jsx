/**
 * Home route — import card + live tree stats + shortcut cards.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ImportDropZone } from '../components/ImportDropZone.jsx';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';

const SECTIONS = [
  { to: '/tree', title: 'Interactive Tree', body: 'Alphabetical person list with live search, plus parents / partners / children for the focused person.' },
  { to: '/charts', title: 'Charts', body: 'Ancestor, descendant, hourglass, tree, fan, double-ancestor, relationship-path, and configurable virtual-tree views.' },
  { to: '/map', title: 'Map', body: 'Every place in your tree plotted on an interactive base map. Click a marker to jump to its record.' },
  { to: '/places', title: 'Places', body: 'List, search, and edit place records — names, normalized form, GeoName ID, coordinates, place templates.' },
  { to: '/sources', title: 'Sources', body: 'Manage citation sources — title, author, date, full text, bookmarks.' },
  { to: '/events', title: 'Events', body: 'Browse, edit, create, or delete person and family events.' },
  { to: '/media', title: 'Media', body: 'Gallery view of pictures, PDFs, URLs, audio, and video records.' },
  { to: '/search', title: 'Search', body: 'Multi-criteria filters across every entity type, plus smart scopes (childless persons, 19th-century births…).' },
  { to: '/duplicates', title: 'Find Duplicates', body: 'Scan for duplicate persons, families, or sources and merge them side-by-side.' },
  { to: '/reports', title: 'Reports', body: 'Person summaries, ancestor / descendant narratives, family group sheets. Export to PDF / HTML / RTF / CSV / text.' },
  { to: '/books', title: 'Books', body: 'Compose multi-section books with custom titles, a TOC, and any number of report sections.' },
  { to: '/change-log', title: 'Change Log', body: 'Browse every edit to the tree, grouped by date with field-level before/after detail.' },
  { to: '/classic', title: 'Classic UI', body: 'The original CloudTreeWeb interface, embedded for any editor not yet rebuilt natively.' },
];

export function Home() {
  const navigate = useNavigate();
  const { hasData, summary, clear } = useDatabaseStatus();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 pb-16 h-full overflow-auto">
      <section className="mb-8">
        <h1 className="text-3xl font-bold mb-3">Your family tree, in the browser</h1>
        <p className="text-muted-foreground leading-relaxed max-w-3xl">
          Import a MacFamilyTree <code>.mftpkg</code> once, then explore it through every view without another round-trip.
          Everything runs locally — no account, no upload, no sync.
        </p>
      </section>

      <section className="mb-8">
        <ImportDropZone onImported={() => navigate('/tree')} />
      </section>

      {hasData && summary && (
        <section className="mb-8 p-5 rounded-xl border border-border bg-card flex items-center gap-5">
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">Loaded</div>
            <div className="text-2xl font-bold">{summary.total.toLocaleString()} records</div>
            <div className="text-xs text-muted-foreground mt-1.5">
              {summary.types.Person || 0} persons · {summary.types.Family || 0} families ·{' '}
              {summary.types.PersonEvent || 0} events · {summary.types.Place || 0} places ·{' '}
              {summary.types.Source || 0} sources
            </div>
          </div>
          <button
            onClick={async () => {
              if (confirm('Clear all local data?')) await clear();
            }}
            className="rounded-md border border-border bg-transparent text-destructive px-3 py-2 text-xs hover:bg-destructive/10"
          >
            Clear data
          </button>
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Sections</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5">
          {SECTIONS.map((s) => (
            <div
              key={s.to}
              onClick={() => navigate(s.to)}
              className="p-4.5 rounded-xl border border-border bg-card cursor-pointer hover:border-muted-foreground/50 transition-colors"
            >
              <div className="text-base font-semibold flex justify-between mb-1.5">
                {s.title} <span className="text-primary">→</span>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">{s.body}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Home;
