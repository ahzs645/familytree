/**
 * Desktop left-nav drawer.
 *
 * Layout: pinned shortcuts (Home / Search / Favorites) on top, then six
 * collapsible groups defined in lib/navigationConfig.js. Drawer can be
 * rail-collapsed to a 56px icon strip; clicking a group icon in rail
 * mode auto-expands the drawer and opens that group.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Sun, Moon, Search } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { cn } from '../lib/utils.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { routeLabelKey } from '../lib/navigationLabels.js';
import { NAV_PINNED, NAV_GROUPS, findGroupForPath, isLinkActive } from '../lib/navigationConfig.js';
import { LanguageSelect } from './LanguageSelect.jsx';

const OPEN_GROUPS_KEY = 'app.drawer.openGroups.v2';
// On the home/empty route findGroupForPath() returns null, which used to leave
// every group collapsed and the lower drawer blank. Fall back to opening the
// most-used group so the drawer always shows navigable links.
const DEFAULT_OPEN_GROUP = 'people';

function readOpenGroups() {
  try {
    const raw = localStorage.getItem(OPEN_GROUPS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
}

function writeOpenGroups(state) {
  try { localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(state)); } catch {}
}

export function NavigationDrawer({
  collapsed,
  onToggleCollapsed,
  hiddenRoutes,
  emphasizedRoutes,
  recordCountLabel,
  statusState,
  onOpenPalette,
}) {
  const { t, localization, setLocale } = useTranslation();
  const { theme, toggle } = useTheme();
  const location = useLocation();

  const [openGroups, setOpenGroups] = useState(() => {
    const stored = readOpenGroups();
    if (stored) return stored;
    const current = findGroupForPath(location.pathname);
    return { [current || DEFAULT_OPEN_GROUP]: true };
  });

  // When the route changes, auto-open the group that contains it (without
  // closing other manually-opened groups).
  useEffect(() => {
    const groupId = findGroupForPath(location.pathname);
    if (!groupId) return;
    setOpenGroups((prev) => (prev[groupId] ? prev : { ...prev, [groupId]: true }));
  }, [location.pathname]);

  useEffect(() => { writeOpenGroups(openGroups); }, [openGroups]);

  const visibleGroups = useMemo(() => NAV_GROUPS.map((group) => ({
    ...group,
    links: group.links.filter((l) => !hiddenRoutes.has(l.to)),
  })).filter((group) => group.links.length > 0), [hiddenRoutes]);

  const visiblePinned = useMemo(
    () => NAV_PINNED.filter((l) => l.to === '/' || !hiddenRoutes.has(l.to)),
    [hiddenRoutes]
  );

  const width = collapsed ? 56 : 240;

  function handleGroupActivate(groupId) {
    if (collapsed) {
      onToggleCollapsed?.();
      setOpenGroups({ [groupId]: true });
    } else {
      setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
    }
  }

  return (
    <aside
      className="flex flex-col flex-shrink-0 border-e border-border bg-card text-foreground overflow-hidden"
      style={{ width, transition: 'width 200ms ease' }}
      aria-label="Primary navigation"
    >
      {/* Brand + collapse toggle */}
      <div
        className="flex items-center gap-2 px-2 py-3 border-b border-border"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        {!collapsed && (
          <div className="flex items-center flex-1 min-w-0 px-1">
            <span className="text-sm font-semibold truncate">CloudTreeWeb</span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            'flex items-center justify-center w-7 h-7 rounded text-muted-foreground hover:bg-accent hover:text-foreground',
            collapsed && 'mx-auto'
          )}
          title={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
          aria-label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
        >
          {collapsed
            ? (localization.direction === 'rtl' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />)
            : (localization.direction === 'rtl' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)}
        </button>
      </div>

      {/* Command palette trigger (⌘K) */}
      {onOpenPalette && (
        <div className={cn('px-2 pt-2', collapsed && 'px-0')}>
          <button
            type="button"
            onClick={onOpenPalette}
            className={cn(
              'flex items-center rounded-md border border-border bg-secondary/60 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
              collapsed
                ? 'justify-center w-7 h-7 mx-auto'
                : 'gap-2 w-full px-2 py-1.5'
            )}
            title={t('commandPalette.ariaLabel', { defaultValue: 'Search commands' })}
            aria-label={t('commandPalette.ariaLabel', { defaultValue: 'Search commands' })}
          >
            <Search size={15} className="flex-shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-start text-[13px] truncate">
                  {t('commandPalette.placeholder')}
                </span>
                <kbd className="text-[10px] font-semibold border border-border rounded px-1.5 py-0.5">⌘K</kbd>
              </>
            )}
          </button>
        </div>
      )}

      {/* Scrollable nav */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        <div className="pb-2">
          {visiblePinned.map((link) => (
            <NavItem
              key={link.to}
              link={link}
              collapsed={collapsed}
              emphasized={emphasizedRoutes.has(link.to)}
              pathname={location.pathname}
            />
          ))}
        </div>

        <div className="border-t border-border my-1" />

        {visibleGroups.map((group) => {
          const isOpen = !collapsed && Boolean(openGroups[group.id]);
          const containsActive = group.links.some((l) => isLinkActive(l, location.pathname));
          return (
            <div key={group.id} className="py-0.5">
              <GroupHeader
                group={group}
                collapsed={collapsed}
                open={isOpen}
                active={containsActive}
                onActivate={() => handleGroupActivate(group.id)}
              />
              {isOpen && (
                <div className="pb-1">
                  {group.links.map((link) => (
                    <NavItem
                      key={link.to}
                      link={link}
                      collapsed={false}
                      indented
                      emphasized={emphasizedRoutes.has(link.to)}
                      pathname={location.pathname}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: status + theme + locale. The top shadow signals the nav list
          above can scroll; the record count gets its own line so the locale
          <select> can't crowd it into a "6585 re…" truncation. */}
      {collapsed ? (
        <div className="flex flex-col items-center gap-2 border-t border-border px-0 py-2 shadow-[0_-4px_8px_-4px_hsl(var(--foreground)/0.12)]">
          <span
            className={cn(
              'inline-block w-2 h-2 rounded-full flex-shrink-0',
              statusState === 'loading' ? 'bg-muted-foreground' : statusState === 'ok' ? 'bg-emerald-500' : 'bg-destructive'
            )}
            title={recordCountLabel}
          />
          <button
            type="button"
            onClick={toggle}
            className="flex items-center justify-center w-7 h-7 rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 border-t border-border px-2 py-2 shadow-[0_-4px_8px_-4px_hsl(var(--foreground)/0.12)]">
          <div className="flex items-center gap-2 min-w-0 px-2" title={recordCountLabel}>
            <span
              className={cn(
                'inline-block w-2 h-2 rounded-full flex-shrink-0',
                statusState === 'loading' ? 'bg-muted-foreground' : statusState === 'ok' ? 'bg-emerald-500' : 'bg-destructive'
              )}
            />
            <span className="text-xs text-muted-foreground truncate">{recordCountLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              className="flex items-center justify-center w-7 h-7 rounded text-muted-foreground hover:bg-accent hover:text-foreground flex-shrink-0"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <LanguageSelect
              value={localization.locale}
              onChange={setLocale}
              className="flex-1 min-w-0"
              triggerClassName="h-7 rounded ps-1.5 pe-7 text-xs"
              ariaLabel={t('settings.language')}
            />
          </div>
        </div>
      )}
    </aside>
  );
}

function GroupHeader({ group, collapsed, open, active, onActivate }) {
  const { t } = useTranslation();
  const Icon = group.icon;
  const label = t(group.labelKey, { defaultValue: group.fallbackLabel });
  return (
    <button
      type="button"
      onClick={onActivate}
      className={cn(
        'flex items-center w-full mx-1 px-2 py-1.5 rounded-md text-[12px] font-semibold uppercase tracking-wide transition-colors',
        // Carve enough horizontal space inside the rail
        collapsed ? 'justify-center w-[calc(100%-8px)]' : 'gap-2',
        active
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
      )}
      title={collapsed ? label : undefined}
      aria-expanded={collapsed ? undefined : open}
    >
      {Icon && <Icon size={15} className="flex-shrink-0" />}
      {!collapsed && (
        <>
          <span className="truncate flex-1 text-start">{label}</span>
          <ChevronRight
            size={12}
            className="flex-shrink-0 opacity-70"
            style={{
              transform: open ? 'rotate(90deg)' : 'none',
              transition: 'transform 150ms',
            }}
          />
        </>
      )}
    </button>
  );
}

function NavItem({ link, collapsed, indented, emphasized, pathname }) {
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
          'relative flex items-center gap-2 mx-1 px-2 py-1.5 rounded-md text-[13px] transition-colors',
          collapsed && 'justify-center',
          indented && !collapsed && 'ms-3 me-1',
          active
            ? 'bg-accent text-foreground font-medium'
            : emphasized
              ? 'text-foreground hover:bg-accent'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        );
      }}
      title={collapsed ? label : undefined}
    >
      {Icon && <Icon size={15} className="flex-shrink-0" />}
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}

export default NavigationDrawer;
