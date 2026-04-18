/**
 * AppShell — top nav + routed outlet. Uses Tailwind theme tokens so
 * the dark/light toggle drives the chrome.
 */
import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { cn } from '../lib/utils.js';

const PRIMARY_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/tree', label: 'Tree' },
  { to: '/charts', label: 'Charts' },
  { to: '/map', label: 'Map' },
  { to: '/places', label: 'Places' },
  { to: '/sources', label: 'Sources' },
  { to: '/events', label: 'Events' },
  { to: '/media', label: 'Media' },
  { to: '/search', label: 'Search' },
  { to: '/statistics', label: 'Stats' },
];

const MORE_LINKS = [
  { to: '/saved-charts', label: 'Saved charts' },
  { to: '/globe', label: 'Globe' },
  { to: '/maps-diagram', label: 'Maps diagram' },
  { to: '/reports', label: 'Reports' },
  { to: '/books', label: 'Books' },
  { to: '/todos', label: 'ToDos' },
  { to: '/bookmarks', label: 'Bookmarks' },
  { to: '/change-log', label: 'Change log' },
  { to: '/duplicates', label: 'Duplicates' },
  { to: '/plausibility', label: 'Plausibility' },
  { to: '/research', label: 'Research' },
  { to: '/stories', label: 'Stories' },
  { to: '/groups', label: 'Person groups' },
  { to: '/dna', label: 'DNA results' },
  { to: '/repositories', label: 'Repositories' },
  { to: '/slideshow', label: 'Slideshow' },
  { to: '/world-history', label: 'World history' },
  { to: '/templates', label: 'Templates' },
  { to: '/labels', label: 'Labels' },
  { to: '/quiz', label: 'Quiz' },
  { to: '/maintenance', label: 'Maintenance' },
  { to: '/backup', label: 'Backup' },
  { to: '/export', label: 'Import & export' },
];

function MoreMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'px-3 py-3.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors',
          open
            ? 'text-foreground border-primary'
            : 'text-muted-foreground border-transparent hover:text-foreground'
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        More ▾
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-56 max-h-[70vh] overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg py-1"
        >
          {MORE_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'block px-3 py-1.5 text-xs whitespace-nowrap',
                  isActive
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AppShell() {
  const { hasData, summary, loading } = useDatabaseStatus();
  const { theme, toggle } = useTheme();

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center gap-4 px-5 h-13 border-b border-border bg-card flex-shrink-0">
        <span className="text-sm font-bold text-foreground mr-2">CloudTreeWeb</span>
        <nav className="flex gap-1 flex-1 min-w-0 flex-wrap items-center">
          {PRIMARY_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                cn(
                  'px-3 py-3.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors',
                  isActive
                    ? 'text-foreground border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
          <MoreMenu />
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground flex items-center">
            <span
              className={cn(
                'inline-block w-2 h-2 rounded-full mr-2',
                loading ? 'bg-muted-foreground' : hasData ? 'bg-emerald-500' : 'bg-destructive'
              )}
            />
            {loading ? 'Loading…' : hasData ? `${summary?.total || 0} records` : 'No data'}
          </span>
          <button
            onClick={toggle}
            className="rounded-md border border-border bg-secondary text-secondary-foreground hover:bg-accent px-2 py-1 text-xs"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀︎' : '☾'}
          </button>
        </div>
      </header>
      <main className="flex-1 relative overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

export default AppShell;
