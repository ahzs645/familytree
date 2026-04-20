/**
 * AppShell — left navigation drawer + routed outlet.
 * Desktop shows the drawer; mobile keeps the overlay menu pattern.
 */
import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { APP_PREFERENCES_EVENT, getAppPreferences } from '../lib/appPreferences.js';
import { applyDocumentLocalization, formatInteger, resolveLocalization } from '../lib/i18n.js';
import { useIsMobile } from '../lib/useIsMobile.js';
import { cn } from '../lib/utils.js';
import { NavigationDrawer } from './NavigationDrawer.jsx';
import { CommandPalette } from './CommandPalette.jsx';
import { useKeyboardShortcuts } from '../lib/useKeyboardShortcuts.js';
import { useNavigate } from 'react-router-dom';

const MOBILE_PRIMARY_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/persons', label: 'Persons' },
  { to: '/tree', label: 'Tree' },
  { to: '/charts', label: 'Charts' },
  { to: '/views', label: 'Views' },
  { to: '/lists', label: 'Lists' },
  { to: '/places', label: 'Places' },
  { to: '/sources', label: 'Sources' },
  { to: '/events', label: 'Events' },
  { to: '/search', label: 'Search' },
  { to: '/publish', label: 'Publish' },
  { to: '/statistics', label: 'Stats' },
  { to: '/favorites', label: 'Favorites' },
  { to: '/settings', label: 'Settings' },
  { to: '/export', label: 'Import & export' },
  { to: '/backup', label: 'Backup' },
];

const DRAWER_COLLAPSED_KEY = 'app.drawer.collapsed';

function MobileMenu({ links }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-10 h-10 rounded-md border border-border bg-secondary text-secondary-foreground"
        aria-label="Open navigation menu"
        aria-expanded={open}
      >
        <Menu size={20} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30 bg-black/40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="fixed top-0 end-0 z-40 h-full w-[min(280px,80vw)] overflow-y-auto bg-popover text-popover-foreground shadow-xl border-s border-border py-3"
            style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            <div className="px-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Navigate</div>
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) => cn(
                  'block px-4 py-3 text-base',
                  isActive || location.pathname === l.to
                    ? 'bg-accent text-foreground font-semibold'
                    : 'text-foreground hover:bg-accent'
                )}
              >
                {l.label}
              </NavLink>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function AppShell() {
  const { hasData, summary, loading } = useDatabaseStatus();
  const { theme, toggle } = useTheme();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState(null);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(DRAWER_COLLAPSED_KEY) === '1'; } catch { return false; }
  });

  useKeyboardShortcuts({
    'ctrl+f': () => navigate('/search'),
    'g t': () => navigate('/tree'),
    'g p': () => navigate('/persons'),
    'g c': () => navigate('/charts'),
    'g s': () => navigate('/search'),
    'g b': () => navigate('/bookmarks'),
    'g r': () => navigate('/reports'),
    'g ,': () => navigate('/settings'),
    '?': () => navigate('/settings'),
  });

  useEffect(() => {
    let cancelled = false;
    getAppPreferences().then((next) => {
      if (!cancelled) {
        setPreferences(next);
        applyDocumentLocalization(next.localization);
      }
    });
    const onPreferences = (event) => {
      setPreferences(event.detail);
      applyDocumentLocalization(event.detail?.localization);
    };
    window.addEventListener(APP_PREFERENCES_EVENT, onPreferences);
    return () => {
      cancelled = true;
      window.removeEventListener(APP_PREFERENCES_EVENT, onPreferences);
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(DRAWER_COLLAPSED_KEY, collapsed ? '1' : '0'); } catch {}
  }, [collapsed]);

  const localization = resolveLocalization(preferences?.localization);
  const recordCountLabel = loading
    ? 'Loading…'
    : hasData
      ? `${formatInteger(summary?.total || 0, localization)} records`
      : 'No data';
  const statusState = loading ? 'loading' : hasData ? 'ok' : 'empty';
  const hiddenRoutes = new Set(preferences?.functions?.hidden || []);
  const emphasizedRoutes = new Set(preferences?.functions?.emphasized || []);
  const mobileLinks = MOBILE_PRIMARY_LINKS.filter((l) => l.to === '/' || !hiddenRoutes.has(l.to));

  const palette = <CommandPalette />;

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-background text-foreground" lang={localization.locale} dir={localization.direction}>
        {palette}
        <header
          className="flex items-center gap-3 px-4 h-13 border-b border-border bg-card flex-shrink-0"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <span className="text-sm font-bold text-foreground shrink-0">CloudTreeWeb</span>
          <div className="flex items-center gap-2 ms-auto">
            <span
              className={cn(
                'inline-block w-2 h-2 rounded-full',
                statusState === 'loading' ? 'bg-muted-foreground' : statusState === 'ok' ? 'bg-emerald-500' : 'bg-destructive'
              )}
              title={recordCountLabel}
            />
            <button
              onClick={toggle}
              className="rounded-md border border-border bg-secondary text-secondary-foreground hover:bg-accent flex items-center justify-center w-10 h-10 text-sm"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? '☀︎' : '☾'}
            </button>
            <MobileMenu links={mobileLinks} />
          </div>
        </header>
        <main className="flex-1 relative overflow-hidden">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground" lang={localization.locale} dir={localization.direction}>
      {palette}
      <NavigationDrawer
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        hiddenRoutes={hiddenRoutes}
        emphasizedRoutes={emphasizedRoutes}
        recordCountLabel={recordCountLabel}
        statusState={statusState}
      />
      <main className="flex-1 relative overflow-hidden min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

export default AppShell;
