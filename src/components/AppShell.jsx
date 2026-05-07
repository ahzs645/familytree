/**
 * AppShell — left navigation drawer + routed outlet.
 * Desktop shows the drawer; mobile keeps the overlay menu pattern.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, ChevronRight, X, Sun, Moon } from 'lucide-react';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { APP_PREFERENCES_EVENT, getAppPreferences } from '../lib/appPreferences.js';
import { applyDocumentLocalization, resolveLocalization, SUPPORTED_LOCALES } from '../lib/i18n.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { routeLabelKey } from '../lib/navigationLabels.js';
import { useIsMobile } from '../lib/useIsMobile.js';
import { cn } from '../lib/utils.js';
import { NavigationDrawer } from './NavigationDrawer.jsx';
import { CommandPalette } from './CommandPalette.jsx';
import { useKeyboardShortcuts } from '../lib/useKeyboardShortcuts.js';
import { NAV_GROUPS, NAV_PINNED, findGroupForPath, isLinkActive } from '../lib/navigationConfig.js';

const DRAWER_COLLAPSED_KEY = 'app.drawer.collapsed';
const NAV_VISIBILITY_EVENT = 'cloudtreeweb:navigation-visibility';

function MobileMenu({ hiddenRoutes, theme, onToggleTheme, localization, onChangeLocale, statusState, recordCountLabel }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const visiblePinned = useMemo(
    () => NAV_PINNED.filter((l) => l.to === '/' || !hiddenRoutes.has(l.to)),
    [hiddenRoutes]
  );
  const visibleGroups = useMemo(() => NAV_GROUPS.map((group) => ({
    ...group,
    links: group.links.filter((l) => !hiddenRoutes.has(l.to)),
  })).filter((g) => g.links.length > 0), [hiddenRoutes]);

  const [openGroups, setOpenGroups] = useState(() => {
    const current = findGroupForPath(location.pathname);
    return current ? { [current]: true } : {};
  });

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Re-sync the open group on each navigation so the active group is always
  // expanded next time the sheet opens.
  useEffect(() => {
    const current = findGroupForPath(location.pathname);
    if (!current) return;
    setOpenGroups((prev) => (prev[current] ? prev : { ...prev, [current]: true }));
  }, [location.pathname]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-10 h-10 rounded-md border border-border bg-secondary text-secondary-foreground"
        aria-label={t('nav.mobileMenu')}
        aria-expanded={open}
      >
        <Menu size={20} />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="fixed top-0 end-0 z-40 h-full w-[min(320px,86vw)] flex flex-col bg-popover text-popover-foreground shadow-xl border-s border-border"
            style={{
              paddingTop: 'max(12px, env(safe-area-inset-top))',
              paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            }}
          >
            <div className="flex items-center justify-between px-3 pb-2 border-b border-border">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t('nav.navigate')}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={t('common.close', { defaultValue: 'Close' })}
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {/* Pinned shortcuts */}
              {visiblePinned.map((link) => (
                <MobileNavLink key={link.to} link={link} pathname={location.pathname} />
              ))}

              <div className="border-t border-border my-2" />

              {/* Grouped sections */}
              {visibleGroups.map((group) => {
                const isOpen = Boolean(openGroups[group.id]);
                const Icon = group.icon;
                const label = t(group.labelKey, { defaultValue: group.fallbackLabel });
                return (
                  <div key={group.id} className="py-0.5">
                    <button
                      type="button"
                      onClick={() => setOpenGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      aria-expanded={isOpen}
                    >
                      {Icon && <Icon size={15} className="flex-shrink-0" />}
                      <span className="flex-1 text-start truncate">{label}</span>
                      <ChevronRight
                        size={14}
                        className="flex-shrink-0 opacity-70"
                        style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}
                      />
                    </button>
                    {isOpen && (
                      <div className="pb-1">
                        {group.links.map((link) => (
                          <MobileNavLink
                            key={link.to}
                            link={link}
                            indented
                            pathname={location.pathname}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer: status + theme + locale (rarely-used controls live here, not the top bar) */}
            <div className="flex items-center gap-2 border-t border-border px-3 py-2">
              <div className="flex items-center gap-2 flex-1 min-w-0" title={recordCountLabel}>
                <span
                  className={cn(
                    'inline-block w-2 h-2 rounded-full flex-shrink-0',
                    statusState === 'loading' ? 'bg-muted-foreground' : statusState === 'ok' ? 'bg-emerald-500' : 'bg-destructive'
                  )}
                />
                <span className="text-xs text-muted-foreground truncate">{recordCountLabel}</span>
              </div>
              <button
                type="button"
                onClick={onToggleTheme}
                className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <select
                value={localization.locale}
                onChange={(event) => onChangeLocale(event.target.value)}
                className="h-8 rounded-md border border-border bg-secondary px-2 text-xs text-foreground"
                aria-label={t('settings.language')}
              >
                {SUPPORTED_LOCALES.map((locale) => (
                  <option key={locale.value} value={locale.value}>{locale.nativeLabel}</option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function MobileNavLink({ link, indented, pathname }) {
  const { t } = useTranslation();
  const Icon = link.icon;
  const label = t(routeLabelKey(link.to) || link.label, { defaultValue: link.label });
  return (
    <NavLink
      to={link.to}
      end={link.end}
      className={({ isActive }) => {
        const active = isActive || isLinkActive(link, pathname);
        return cn(
          'flex items-center gap-3 px-4 py-2.5 text-[15px]',
          indented && 'ps-10',
          active
            ? 'bg-accent text-foreground font-semibold'
            : 'text-foreground hover:bg-accent'
        );
      }}
    >
      {Icon && !indented && <Icon size={16} className="flex-shrink-0" />}
      {Icon && indented && <Icon size={15} className="flex-shrink-0 opacity-70" />}
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export function AppShell() {
  const { t, localization: liveLocalization, setLocale } = useTranslation();
  const { hasData, summary, loading } = useDatabaseStatus();
  const { theme, toggle } = useTheme();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState(null);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(DRAWER_COLLAPSED_KEY) === '1'; } catch { return false; }
  });
  const [navigationHidden, setNavigationHidden] = useState(false);

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

  useEffect(() => {
    const onNavigationVisibility = (event) => {
      setNavigationHidden(Boolean(event.detail?.hidden));
    };
    window.addEventListener(NAV_VISIBILITY_EVENT, onNavigationVisibility);
    return () => window.removeEventListener(NAV_VISIBILITY_EVENT, onNavigationVisibility);
  }, []);

  const localization = liveLocalization || resolveLocalization(preferences?.localization);
  const recordCountLabel = loading
    ? t('common.loading')
    : hasData
      ? t('common.records', { count: summary?.total || 0 })
      : t('common.noData');
  const statusState = loading ? 'loading' : hasData ? 'ok' : 'empty';
  const hiddenRoutes = new Set(preferences?.functions?.hidden || []);
  const emphasizedRoutes = new Set(preferences?.functions?.emphasized || []);

  const palette = <CommandPalette />;

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-background text-foreground" lang={localization.locale} dir={localization.direction}>
        {palette}
        <header
          className="flex items-center gap-3 px-4 h-12 border-b border-border bg-card flex-shrink-0"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <span className="text-sm font-bold text-foreground shrink-0">CloudTreeWeb</span>
          <span
            className={cn(
              'inline-block w-2 h-2 rounded-full',
              statusState === 'loading' ? 'bg-muted-foreground' : statusState === 'ok' ? 'bg-emerald-500' : 'bg-destructive'
            )}
            title={recordCountLabel}
          />
          <div className="ms-auto">
            <MobileMenu
              hiddenRoutes={hiddenRoutes}
              theme={theme}
              onToggleTheme={toggle}
              localization={localization}
              onChangeLocale={setLocale}
              statusState={statusState}
              recordCountLabel={recordCountLabel}
            />
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
      {!navigationHidden && (
      <NavigationDrawer
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        hiddenRoutes={hiddenRoutes}
        emphasizedRoutes={emphasizedRoutes}
        recordCountLabel={recordCountLabel}
        statusState={statusState}
      />
      )}
      <main className="flex-1 relative overflow-hidden min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

export default AppShell;
