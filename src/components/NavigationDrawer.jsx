/**
 * Left-side navigation drawer — inspired by Twenty CRM's drawer.
 * Replaces the top nav bar. Collapsible to an icon-only rail.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home, Users, TreePine, BarChart3, LayoutGrid, List, MapPin, BookOpen,
  Calendar, Search, Globe2, BarChart2, Star, ChevronLeft, ChevronRight,
  ChevronDown, Map as MapIcon, Image as ImageIcon, FileText, Users2,
  Sparkles, BookOpenText, ClipboardList, AlertCircle, Dna, Archive,
  Play, History, Layers, Tag, UserCircle, Database, Globe, ListTodo,
  Bookmark, Copy, ShieldCheck, Microscope, FileEdit, UsersRound,
  Clock, Download, Upload, Settings, Wrench, CloudCog, HelpCircle,
  Heart, Presentation, Building2, CircleDot, NotebookPen, Briefcase,
  GitBranch, Activity, CalendarHeart, GraduationCap, Languages,
  Sun, Moon,
} from 'lucide-react';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { cn } from '../lib/utils.js';

const WORKSPACE_LINKS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/persons', label: 'Persons', icon: Users },
  { to: '/tree', label: 'Tree', icon: TreePine },
  { to: '/charts', label: 'Charts', icon: BarChart3 },
  { to: '/views', label: 'Views', icon: LayoutGrid, aliases: ['/map', '/globe', '/maps-diagram', '/statistic-maps', '/media', '/quiz'] },
  { to: '/lists', label: 'Lists', icon: List },
  { to: '/places', label: 'Places', icon: MapPin },
  { to: '/sources', label: 'Sources', icon: BookOpen },
  { to: '/events', label: 'Events', icon: Calendar },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/publish', label: 'Publish', icon: Globe2, aliases: ['/websites', '/books'] },
  { to: '/statistics', label: 'Stats', icon: BarChart2 },
  { to: '/favorites', label: 'Favorites', icon: Star, aliases: ['/bookmarks'] },
];

const OTHER_LINKS = [
  { to: '/saved-charts', label: 'Saved charts', icon: Presentation },
  { to: '/map', label: 'Virtual Map', icon: MapIcon },
  { to: '/globe', label: 'Virtual Globe', icon: Globe },
  { to: '/maps-diagram', label: 'Statistic Maps', icon: Activity },
  { to: '/media', label: 'Media Gallery', icon: ImageIcon },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/marriages', label: 'Marriage list', icon: Heart },
  { to: '/facts', label: 'Facts list', icon: ClipboardList },
  { to: '/anniversaries', label: 'Anniversary list', icon: CalendarHeart },
  { to: '/plausibility-list', label: 'Plausibility list', icon: AlertCircle },
  { to: '/distinctive-persons', label: 'Distinctive persons', icon: Sparkles },
  { to: '/person-analysis', label: 'Person analysis', icon: Microscope },
  { to: '/lds-ordinances', label: 'LDS ordinances', icon: GraduationCap },
  { to: '/books', label: 'Books', icon: BookOpenText },
  { to: '/websites', label: 'Websites', icon: Briefcase },
  { to: '/todos', label: 'ToDos', icon: ListTodo },
  { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
  { to: '/change-log', label: 'Change log', icon: History },
  { to: '/duplicates', label: 'Duplicates', icon: Copy },
  { to: '/plausibility', label: 'Plausibility', icon: ShieldCheck },
  { to: '/research', label: 'Research', icon: NotebookPen },
  { to: '/stories', label: 'Stories', icon: FileEdit },
  { to: '/groups', label: 'Person groups', icon: UsersRound },
  { to: '/dna', label: 'DNA results', icon: Dna },
  { to: '/repositories', label: 'Repositories', icon: Archive },
  { to: '/slideshow', label: 'Slideshow', icon: Play },
  { to: '/world-history', label: 'World history', icon: Clock },
  { to: '/templates', label: 'Templates', icon: Layers },
  { to: '/labels', label: 'Labels', icon: Tag },
  { to: '/author', label: 'Author information', icon: UserCircle },
  { to: '/familysearch', label: 'FamilySearch', icon: CloudCog },
  { to: '/web-search', label: 'Web Search', icon: Globe },
  { to: '/quiz', label: 'Family Quiz', icon: HelpCircle },
  { to: '/maintenance', label: 'Maintenance', icon: Wrench },
  { to: '/backup', label: 'Backup', icon: Database },
  { to: '/export', label: 'Import & export', icon: Download },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function NavigationDrawer({
  collapsed,
  onToggleCollapsed,
  hiddenRoutes,
  emphasizedRoutes,
  recordCountLabel,
  statusState, // 'loading' | 'ok' | 'empty'
}) {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const [otherOpen, setOtherOpen] = useState(() => {
    try { return localStorage.getItem('app.drawer.otherOpen') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('app.drawer.otherOpen', otherOpen ? '1' : '0'); } catch {}
  }, [otherOpen]);

  const workspaceLinks = useMemo(
    () => WORKSPACE_LINKS.filter((l) => l.to === '/' || !hiddenRoutes.has(l.to)),
    [hiddenRoutes]
  );
  const otherLinks = useMemo(
    () => OTHER_LINKS.filter((l) => !hiddenRoutes.has(l.to)),
    [hiddenRoutes]
  );

  const width = collapsed ? 56 : 220;

  return (
    <aside
      className="flex flex-col flex-shrink-0 border-e border-border bg-card text-foreground overflow-hidden"
      style={{ width, transition: 'width 200ms ease' }}
      aria-label="Primary navigation"
    >
      {/* Top row: brand + collapse */}
      <div className="flex items-center gap-2 px-2 py-3 border-b border-border" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        {!collapsed && (
          <div className="flex items-center flex-1 min-w-0 px-1">
            <span className="text-sm font-semibold truncate">CloudTreeWeb</span>
          </div>
        )}
        <button
          onClick={onToggleCollapsed}
          className={cn(
            'flex items-center justify-center w-7 h-7 rounded text-muted-foreground hover:bg-accent hover:text-foreground',
            collapsed && 'mx-auto'
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Scrollable link area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        <Section
          label="Workspace"
          collapsed={collapsed}
          open={workspaceOpen}
          onToggle={() => setWorkspaceOpen((v) => !v)}
        >
          {workspaceOpen && workspaceLinks.map((l) => (
            <NavItem
              key={l.to}
              link={l}
              collapsed={collapsed}
              emphasized={emphasizedRoutes.has(l.to)}
              pathname={location.pathname}
            />
          ))}
        </Section>

        <Section
          label="Other"
          collapsed={collapsed}
          open={otherOpen}
          onToggle={() => setOtherOpen((v) => !v)}
        >
          {otherOpen && otherLinks.map((l) => (
            <NavItem
              key={l.to}
              link={l}
              collapsed={collapsed}
              emphasized={emphasizedRoutes.has(l.to)}
              pathname={location.pathname}
            />
          ))}
        </Section>
      </div>

      {/* Footer: status + theme toggle */}
      <div className="flex items-center gap-2 border-t border-border px-2 py-2">
        <div
          className={cn('flex items-center gap-2 flex-1 min-w-0 px-2 py-1', collapsed && 'justify-center px-0')}
          title={recordCountLabel}
        >
          <span
            className={cn(
              'inline-block w-2 h-2 rounded-full flex-shrink-0',
              statusState === 'loading' ? 'bg-muted-foreground' : statusState === 'ok' ? 'bg-emerald-500' : 'bg-destructive'
            )}
          />
          {!collapsed && (
            <span className="text-xs text-muted-foreground truncate">{recordCountLabel}</span>
          )}
        </div>
        <button
          onClick={toggle}
          className="flex items-center justify-center w-7 h-7 rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </aside>
  );
}

function Section({ label, collapsed, open, onToggle, children }) {
  if (collapsed) {
    return <div className="py-1">{children}</div>;
  }
  return (
    <div className="py-1">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 w-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase text-muted-foreground hover:text-foreground"
      >
        <ChevronRight
          size={11}
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}
        />
        <span>{label}</span>
      </button>
      {children}
    </div>
  );
}

function NavItem({ link, collapsed, emphasized, pathname }) {
  const Icon = link.icon;
  return (
    <NavLink
      to={link.to}
      end={link.end}
      className={({ isActive }) => {
        const active = isActive || link.aliases?.some(
          (alias) => pathname === alias || pathname.startsWith(`${alias}/`)
        );
        return cn(
          'relative flex items-center gap-2 mx-1 px-2 py-1.5 rounded-md text-[13px] transition-colors',
          collapsed && 'justify-center',
          active
            ? 'bg-accent text-foreground font-medium'
            : emphasized
              ? 'text-foreground hover:bg-accent'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        );
      }}
      title={collapsed ? link.label : undefined}
    >
      {Icon && <Icon size={15} className="flex-shrink-0" />}
      {!collapsed && <span className="truncate">{link.label}</span>}
    </NavLink>
  );
}

export default NavigationDrawer;
