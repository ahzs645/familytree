/**
 * AppShell — top nav + routed outlet. Uses Tailwind theme tokens so
 * the dark/light toggle drives the chrome.
 */
import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useIsMobile } from '../lib/useIsMobile.js';
import { cn } from '../lib/utils.js';

const PRIMARY_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/persons', label: 'Persons' },
  { to: '/tree', label: 'Tree' },
  { to: '/charts', label: 'Charts' },
  { to: '/views', label: 'Views', aliases: ['/map', '/globe', '/maps-diagram', '/statistic-maps', '/media', '/quiz'] },
  { to: '/lists', label: 'Lists' },
  { to: '/places', label: 'Places' },
  { to: '/sources', label: 'Sources' },
  { to: '/events', label: 'Events' },
  { to: '/search', label: 'Search' },
  { to: '/publish', label: 'Publish', aliases: ['/websites', '/books'] },
  { to: '/statistics', label: 'Stats' },
  { to: '/favorites', label: 'Favorites', aliases: ['/bookmarks'] },
];

const MORE_LINKS = [
  { to: '/saved-charts', label: 'Saved charts' },
  { to: '/map', label: 'Virtual Map' },
  { to: '/globe', label: 'Virtual Globe' },
  { to: '/maps-diagram', label: 'Statistic Maps' },
  { to: '/media', label: 'Media Gallery' },
  { to: '/reports', label: 'Reports' },
  { to: '/marriages', label: 'Marriage list' },
  { to: '/facts', label: 'Facts list' },
  { to: '/anniversaries', label: 'Anniversary list' },
  { to: '/plausibility-list', label: 'Plausibility list' },
  { to: '/distinctive-persons', label: 'Distinctive persons' },
  { to: '/person-analysis', label: 'Person analysis' },
  { to: '/lds-ordinances', label: 'LDS ordinances' },
  { to: '/books', label: 'Books' },
  { to: '/websites', label: 'Websites' },
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
  { to: '/author', label: 'Author information' },
  { to: '/familysearch', label: 'FamilySearch' },
  { to: '/web-search', label: 'Web Search' },
  { to: '/favorites', label: 'Favorites' },
  { to: '/quiz', label: 'Family Quiz' },
  { to: '/maintenance', label: 'Maintenance' },
  { to: '/backup', label: 'Backup' },
  { to: '/export', label: 'Import & export' },
  { to: '/settings', label: 'Settings' },
];

function MoreMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();

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
                  isActive || location.pathname === l.to
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

function MobileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const allLinks = [...PRIMARY_LINKS, ...MORE_LINKS];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-10 h-10 rounded-md border border-border bg-secondary text-secondary-foreground"
        aria-label="Open navigation menu"
        aria-expanded={open}
      >
        <span className="sr-only">Menu</span>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="5" x2="17" y2="5" />
          <line x1="3" y1="10" x2="17" y2="10" />
          <line x1="3" y1="15" x2="17" y2="15" />
        </svg>
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-30 bg-black/40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="fixed top-0 right-0 z-40 h-full w-[min(280px,80vw)] overflow-y-auto bg-popover text-popover-foreground shadow-xl border-l border-border py-3"
            style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            <div className="px-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Navigate</div>
            {allLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'block px-4 py-3 text-base',
                    isActive || location.pathname === l.to
                      ? 'bg-accent text-foreground font-semibold'
                      : 'text-foreground hover:bg-accent'
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function AppShell() {
  const { hasData, summary, loading } = useDatabaseStatus();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header
        className="flex items-center gap-3 px-4 md:px-5 h-13 border-b border-border bg-card flex-shrink-0 overflow-hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <span className="text-sm font-bold text-foreground shrink-0">CloudTreeWeb</span>
        {!isMobile && (
          <nav className="flex gap-1 flex-1 min-w-0 overflow-x-auto items-center [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
            {PRIMARY_LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) => {
                  const active = isActive || l.aliases?.some((alias) => location.pathname === alias || location.pathname.startsWith(`${alias}/`));
                  return cn(
                    'px-3 py-3.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors',
                    active
                      ? 'text-foreground border-primary'
                      : 'text-muted-foreground border-transparent hover:text-foreground'
                  );
                }}
              >
                {l.label}
              </NavLink>
            ))}
            <MoreMenu />
          </nav>
        )}
        <div className="flex items-center gap-2 md:gap-3 ml-auto">
          <span className="text-xs text-muted-foreground hidden sm:flex items-center">
            <span
              className={cn(
                'inline-block w-2 h-2 rounded-full mr-2',
                loading ? 'bg-muted-foreground' : hasData ? 'bg-emerald-500' : 'bg-destructive'
              )}
            />
            {loading ? 'Loading…' : hasData ? `${summary?.total || 0} records` : 'No data'}
          </span>
          <span
            className={cn(
              'sm:hidden inline-block w-2 h-2 rounded-full',
              loading ? 'bg-muted-foreground' : hasData ? 'bg-emerald-500' : 'bg-destructive'
            )}
            title={loading ? 'Loading…' : hasData ? `${summary?.total || 0} records` : 'No data'}
          />
          <button
            onClick={toggle}
            className="rounded-md border border-border bg-secondary text-secondary-foreground hover:bg-accent w-9 h-9 md:w-auto md:h-auto md:px-2 md:py-1 text-sm md:text-xs"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀︎' : '☾'}
          </button>
          {isMobile && <MobileMenu />}
        </div>
      </header>
      <main className="flex-1 relative overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

export default AppShell;
