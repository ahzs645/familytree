/**
 * Home route — import card + live tree stats + shortcut cards.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ImportDropZone } from '../components/ImportDropZone.jsx';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';
import { useModal } from '../contexts/ModalContext.jsx';
import { loadSampleTree } from '../lib/sampleTree.js';
import {
  deleteTreeSnapshot,
  listTreeSnapshots,
  renameTreeSnapshot,
  restoreTreeSnapshot,
  setTreeSnapshotFavorite,
  setTreeSnapshotLabel,
} from '../lib/treeLibrary.js';

const SECTIONS = [
  { to: '/tree', title: 'Interactive Tree', body: '3D family explorer with live search, plus parents / partners / children for the focused person.' },
  { to: '/charts', title: 'Charts', body: 'Ancestor, descendant, hourglass, tree, fan, double-ancestor, relationship-path, and configurable virtual-tree views.' },
  { to: '/views', title: 'Views', body: 'Desktop-style visual modes: Virtual Map, Virtual Globe, Statistic Maps, Media Gallery, and Family Quiz.', focusRoutes: ['/views', '/map', '/globe', '/maps-diagram', '/statistic-maps', '/media', '/quiz'] },
  { to: '/views/virtual-map', title: 'Virtual Map', body: 'Every place in your tree plotted on an interactive base map. Click a marker to jump to its record.', focusRoutes: ['/map'] },
  { to: '/views/virtual-globe', title: 'Virtual Globe', body: 'Event locations plotted on a globe projection for drag-to-rotate visual exploration.', focusRoutes: ['/globe'] },
  { to: '/places', title: 'Places', body: 'List, search, and edit place records — names, normalized form, GeoName ID, coordinates, place templates.' },
  { to: '/sources', title: 'Sources', body: 'Manage citation sources — title, author, date, full text, bookmarks.' },
  { to: '/events', title: 'Events', body: 'Browse, edit, create, or delete person and family events.' },
  { to: '/views/media-gallery', title: 'Media Gallery', body: 'Gallery view of pictures, PDFs, URLs, audio, and video records.', focusRoutes: ['/media'] },
  { to: '/search', title: 'Search', body: 'Multi-criteria filters across every entity type, plus smart scopes (childless persons, 19th-century births…).' },
  { to: '/duplicates', title: 'Find Duplicates', body: 'Scan for duplicate persons, families, or sources and merge them side-by-side.' },
  { to: '/reports', title: 'Reports', body: 'Person summaries, ancestor / descendant narratives, family group sheets. Export to PDF / HTML / RTF / CSV / text.' },
  { to: '/publish', title: 'Publish', body: 'Orchestrate distributable websites and books from one explicit publish hub.' },
  { to: '/websites', title: 'Websites', body: 'Configure branding, privacy filters, validation, and static website zip generation.' },
  { to: '/books', title: 'Books', body: 'Compose multi-section books with cover metadata, TOC options, report sections, and publish bundles.' },
  { to: '/change-log', title: 'Change Log', body: 'Browse every edit to the tree, grouped by date with field-level before/after detail.' },
  { to: '/statistics', title: 'Statistics', body: 'Counts by type, births by century, top surnames, gender split, lifespan stats, geographic spread.' },
  { to: '/plausibility', title: 'Plausibility checker', body: 'Flags improbable data — death before birth, marriage at age 8, lifespan over 120, and more.' },
  { to: '/maintenance', title: 'Database maintenance', body: 'Reformat names and dates, find unreadable dates, remove empty entries, fix gender mismatches.' },
  { to: '/bookmarks', title: 'Bookmarks', body: 'Quick-jump list of every bookmarked person, family, place, or source.' },
  { to: '/todos', title: 'ToDos', body: 'Track research tasks with status, priority, and due dates.' },
  { to: '/stories', title: 'Stories', body: 'Narrative text attached to people, families, or events.' },
  { to: '/groups', title: 'Person groups', body: 'Ad-hoc collections of persons (e.g. "cousins on dad\'s side").' },
  { to: '/dna', title: 'DNA results', body: 'Catalog of DNA test records with kit numbers, haplogroups, notes.' },
  { to: '/repositories', title: 'Source repositories', body: 'Physical archives — name, address, contact, notes.' },
  { to: '/slideshow', title: 'Slideshow', body: 'Auto-advancing display of media records.' },
  { to: '/views/statistic-maps', title: 'Statistic Maps', body: 'Every event with coordinates plotted on a map, filtered by type and timeline.', focusRoutes: ['/maps-diagram', '/statistic-maps'] },
  { to: '/world-history', title: 'World history', body: 'Curated world events interleaved with a person\'s life events on one timeline.' },
  { to: '/research', title: 'Research assistant', body: 'Heuristic suggestions per person — missing dates, unknown parents, no photo.' },
  { to: '/familysearch', title: 'FamilySearch', body: 'Review FamilySearch IDs, unmatched people, person search links, and local FamilySearch tasks.' },
  { to: '/web-search', title: 'Web Search', body: 'Launch person-aware genealogy searches and insert confirmed values back into people, events, places, or notes.' },
  { to: '/author', title: 'Author Information', body: 'Tree-level author, contact, copyright, and presentation metadata.' },
  { to: '/favorites', title: 'Favorites', body: 'Configurable function shortcuts plus bookmarked records.' },
  { to: '/settings', title: 'Settings', body: 'Shared local preferences for display, formats, maps, exports, integrations, and function visibility.' },
  { to: '/views/family-quiz', title: 'Family quiz', body: 'Multiple-choice questions generated from your tree. Test your knowledge.', focusRoutes: ['/quiz'] },
  { to: '/templates', title: 'Templates &amp; types', body: 'Manage source / place templates and event / fact / additional-name types.' },
  { to: '/labels', title: 'Custom labels', body: 'Add custom colored labels beyond the built-in three.' },
  { to: '/backup', title: 'Backup &amp; restore', body: 'Download your entire database as a JSON file. Restore on any device.' },
  { to: '/export', title: 'Import / export', body: 'GEDCOM in/out, full backup, merge previews, and subtree data transfer tools.' },
];

const LIST_SECTIONS = [
  { to: '/lists', title: 'Lists Hub', body: 'Coverage view with counts for every dedicated list surface.' },
  { to: '/persons', title: 'Persons List', body: 'Master-detail person list with CSV / JSON export and editor jumps.' },
  { to: '/marriages', title: 'Marriage List', body: 'Partner rows with direct links to each person and family editor.' },
  { to: '/facts', title: 'Facts List', body: 'Person facts with fact type and date filters.' },
  { to: '/anniversaries', title: 'Anniversary List', body: 'Birth and death anniversaries filtered by month or day.' },
  { to: '/plausibility-list', title: 'Plausibility List', body: 'Checker output as a sortable route with record links.' },
  { to: '/distinctive-persons', title: 'Distinctive Persons', body: 'Marker-aware person list with manual rule criteria.' },
  { to: '/person-analysis', title: 'Person Analysis', body: 'Age, missing dates, orphaned links, and duplicate risks.' },
  { to: '/lds-ordinances', title: 'LDS Ordinances', body: 'Schema-gated LDS list with clear empty state when unavailable.' },
];

export function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasData, summary, refresh, clear } = useDatabaseStatus();
  const modal = useModal();
  const focusRoute =
    location.state?.focusRoute ||
    new URLSearchParams(location.search).get('focusRoute') ||
    (location.hash ? location.hash.replace(/^#/, '') : '');

  const [sortBy, setSortBy] = useState(() => {
    try { return localStorage.getItem('treeLibrary.homeSortBy') || 'favorites'; } catch { return 'favorites'; }
  });
  const [snapshots, setSnapshots] = useState([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setSnapshots(await listTreeSnapshots({ sortBy }));
  }, [sortBy]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    try { localStorage.setItem('treeLibrary.homeSortBy', sortBy); } catch {}
  }, [sortBy]);

  const withBusy = (fn) => async (...args) => {
    setBusy(true);
    try { await fn(...args); } finally { setBusy(false); }
  };

  const onFavorite = withBusy(async (snapshot) => {
    await setTreeSnapshotFavorite(snapshot.id, !snapshot.favorite);
    await reload();
  });

  const onRename = withBusy(async (snapshot) => {
    const name = await modal.prompt('Rename tree:', snapshot.name, { title: 'Rename tree' });
    if (!name) return;
    await renameTreeSnapshot(snapshot.id, name);
    await reload();
  });

  const onLabel = withBusy(async (snapshot) => {
    const label = await modal.prompt('Label (active, draft, archived…):', snapshot.label || '', { title: 'Set label' });
    if (label === null) return;
    await setTreeSnapshotLabel(snapshot.id, label);
    await reload();
  });

  const onRestore = withBusy(async (snapshot) => {
    if (!(await modal.confirm(`Replace the current database with "${snapshot.name}"?`, { title: 'Open tree', okLabel: 'Replace' }))) return;
    await restoreTreeSnapshot(snapshot.id);
    await refresh();
    await reload();
  });

  const onDelete = withBusy(async (snapshot) => {
    const answer = await modal.prompt(`Type the tree name to permanently delete it:\n\n${snapshot.name}`, '', { title: 'Delete tree', okLabel: 'Delete', placeholder: snapshot.name });
    if (answer === null) return;
    if (answer.trim() !== snapshot.name.trim()) {
      await modal.alert('Name did not match — delete canceled.');
      return;
    }
    await deleteTreeSnapshot(snapshot.id);
    await reload();
  });

  return (
    <div className="px-6 py-8 pb-16 h-full overflow-auto">
      <section className="mb-8">
        <h1 className="text-3xl font-bold mb-3">Your family tree, in the browser</h1>
        <p className="text-muted-foreground leading-relaxed max-w-3xl">
          Import a MacFamilyTree <code>.mftpkg</code> once, then explore it through every view without another round-trip.
          Everything runs locally — no account, no upload, no sync.
        </p>
      </section>

      <section className="mb-8">
        <ImportDropZone onImported={() => navigate('/tree')} />
        {!hasData ? (
          <div className="mt-3 flex items-center justify-center gap-3 text-sm">
            <span className="text-muted-foreground">or</span>
            <button
              type="button"
              onClick={async () => {
                const count = await loadSampleTree();
                if (count) navigate('/tree');
              }}
              className="bg-secondary border border-border rounded-md px-3 py-1.5 hover:bg-accent"
            >
              Load sample tree
            </button>
            <span className="text-xs text-muted-foreground">A small demo family (3 generations, 8 persons) with Arabic and English names.</span>
          </div>
        ) : null}
      </section>

      {snapshots.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">My Family Trees</h2>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-secondary border border-border rounded-md px-2 py-1 text-xs"
              aria-label="Sort trees"
            >
              <option value="favorites">Favorites first</option>
              <option value="updatedAt">Change date</option>
              <option value="name">Name</option>
            </select>
          </div>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
            {snapshots.map((snapshot) => (
              <li key={snapshot.id} className="p-4 rounded-xl border border-border bg-card">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">
                      {snapshot.favorite && <span aria-hidden className="text-yellow-500 me-1">★</span>}
                      {snapshot.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {snapshot.recordCount.toLocaleString()} records · {snapshot.assetCount.toLocaleString()} assets
                      {snapshot.label ? ` · ${snapshot.label}` : ''}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Updated {new Date(snapshot.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onFavorite(snapshot)}
                    disabled={busy}
                    title={snapshot.favorite ? 'Unmark favorite' : 'Mark as favorite'}
                    className="text-lg text-muted-foreground hover:text-yellow-500"
                  >
                    {snapshot.favorite ? '★' : '☆'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <button onClick={() => onRestore(snapshot)} disabled={busy} className="text-xs bg-primary text-primary-foreground rounded-md px-2.5 py-1 font-medium">Open</button>
                  <button onClick={() => onRename(snapshot)} disabled={busy} className="text-xs border border-border bg-secondary rounded-md px-2.5 py-1 hover:bg-accent">Rename</button>
                  <button onClick={() => onLabel(snapshot)} disabled={busy} className="text-xs border border-border bg-secondary rounded-md px-2.5 py-1 hover:bg-accent">Label</button>
                  <button onClick={() => onDelete(snapshot)} disabled={busy} className="text-xs border border-border bg-transparent text-destructive rounded-md px-2.5 py-1 hover:bg-destructive/10 ms-auto">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

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
              if (await modal.confirm('Clear all local data?', { title: 'Clear data', okLabel: 'Clear', destructive: true })) await clear();
            }}
            className="rounded-md border border-border bg-transparent text-destructive px-3 py-2 text-xs hover:bg-destructive/10"
          >
            Clear data
          </button>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Lists</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
          {LIST_SECTIONS.map((s) => (
            <div
              key={s.to}
              onClick={() => navigate(s.to)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(s.to);
                }
              }}
              role="button"
              tabIndex={0}
              className="p-4 rounded-xl border border-border bg-card cursor-pointer hover:border-muted-foreground/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <div className="text-base font-semibold flex justify-between mb-1.5">
                {s.title} <span className="text-primary">→</span>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Sections</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5">
          {SECTIONS.map((s) => {
            const focused = focusRoute && (
              focusRoute === s.to ||
              s.focusRoutes?.some((route) => focusRoute === route || focusRoute.startsWith(`${route}/`))
            );
            return (
            <div
              key={s.to}
              onClick={() => navigate(s.to)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(s.to);
                }
              }}
              role="button"
              tabIndex={0}
              aria-current={focused ? 'true' : undefined}
              className={`p-4 rounded-xl border bg-card cursor-pointer hover:border-muted-foreground/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${focused ? 'border-primary' : 'border-border'}`}
            >
              <div className="text-base font-semibold flex justify-between mb-1.5">
                {s.title} <span className="text-primary">→</span>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">{s.body}</div>
            </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default Home;
