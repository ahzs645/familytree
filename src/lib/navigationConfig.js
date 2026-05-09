/**
 * Single source of truth for the app's left-nav structure.
 *
 * Layout: a small set of pinned shortcuts at the top, then six grouped
 * accordions. Used by both the desktop drawer and the mobile sheet so
 * the IA stays identical at every screen size.
 */
import {
  Home, Users, TreePine, BarChart3, LayoutGrid, MapPin, BookOpen,
  Calendar, Search, Globe2, BarChart2, Star, Map as MapIcon,
  Image as ImageIcon, FileText, Sparkles, BookOpenText, ClipboardList,
  AlertCircle, Dna, Archive, Play, History, Layers, Tag, UserCircle,
  Database, Globe, ListTodo, Bookmark, Copy, ShieldCheck, Microscope,
  FileEdit, UsersRound, Clock, Download, Settings, Wrench, CloudCog,
  HelpCircle, Heart, Presentation, Building2, NotebookPen, Briefcase,
  GitBranch, Activity, CalendarHeart, GraduationCap, Upload, Network, Landmark,
} from 'lucide-react';

export const NAV_PINNED = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/favorites', label: 'Favorites', icon: Star, aliases: ['/bookmarks'] },
];

export const NAV_GROUPS = [
  {
    id: 'people',
    labelKey: 'nav.groupPeople',
    fallbackLabel: 'People',
    icon: UsersRound,
    links: [
      { to: '/persons', label: 'Persons', icon: Users },
      { to: '/tree', label: 'Tree', icon: TreePine },
      { to: '/heritage-tree', label: 'Heritage Tree', icon: GitBranch },
      { to: '/groups', label: 'Person groups', icon: Users },
      { to: '/lineages', label: 'Lineages', icon: Network },
      { to: '/tribal-affiliations', label: 'Tribal affiliations', icon: Landmark },
      { to: '/distinctive-persons', label: 'Distinctive persons', icon: Sparkles },
      { to: '/dna', label: 'DNA results', icon: Dna },
    ],
  },
  {
    id: 'placesEvents',
    labelKey: 'nav.groupPlacesEvents',
    fallbackLabel: 'Places & Events',
    icon: Building2,
    links: [
      { to: '/places', label: 'Places', icon: MapPin },
      { to: '/events', label: 'Events', icon: Calendar },
      { to: '/marriages', label: 'Marriages', icon: Heart },
      { to: '/anniversaries', label: 'Anniversaries', icon: CalendarHeart },
      { to: '/facts', label: 'Facts', icon: ClipboardList },
      { to: '/world-history', label: 'World history', icon: Clock },
    ],
  },
  {
    id: 'research',
    labelKey: 'nav.groupResearch',
    fallbackLabel: 'Sources & Research',
    icon: BookOpenText,
    links: [
      { to: '/sources', label: 'Sources', icon: BookOpen },
      { to: '/repositories', label: 'Repositories', icon: Archive },
      { to: '/research', label: 'Research', icon: NotebookPen },
      { to: '/todos', label: 'ToDos', icon: ListTodo },
      { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
      { to: '/stories', label: 'Stories', icon: FileEdit },
      { to: '/familysearch', label: 'FamilySearch', icon: CloudCog },
      { to: '/web-search', label: 'Web Search', icon: Globe },
    ],
  },
  {
    id: 'viewsReports',
    labelKey: 'nav.groupViewsReports',
    fallbackLabel: 'Views & Reports',
    icon: LayoutGrid,
    links: [
      { to: '/charts', label: 'Charts', icon: BarChart3 },
      { to: '/saved-charts', label: 'Saved charts', icon: Presentation },
      { to: '/reports', label: 'Reports', icon: FileText },
      { to: '/map', label: 'Virtual Map', icon: MapIcon },
      { to: '/globe', label: 'Virtual Globe', icon: Globe },
      { to: '/maps-diagram', label: 'Statistic Maps', icon: Activity },
      { to: '/media', label: 'Media Gallery', icon: ImageIcon },
      { to: '/slideshow', label: 'Slideshow', icon: Play },
      { to: '/books', label: 'Books', icon: Briefcase },
      { to: '/websites', label: 'Websites', icon: Globe2 },
      { to: '/quiz', label: 'Family Quiz', icon: HelpCircle },
      { to: '/statistics', label: 'Stats', icon: BarChart2 },
    ],
  },
  {
    id: 'quality',
    labelKey: 'nav.groupQuality',
    fallbackLabel: 'Quality',
    icon: ShieldCheck,
    links: [
      { to: '/duplicates', label: 'Duplicates', icon: Copy },
      { to: '/plausibility', label: 'Plausibility', icon: ShieldCheck },
      { to: '/plausibility-list', label: 'Plausibility list', icon: AlertCircle },
      { to: '/person-analysis', label: 'Person analysis', icon: Microscope },
      { to: '/change-log', label: 'Change log', icon: History },
    ],
  },
  {
    id: 'settings',
    labelKey: 'nav.groupSettings',
    fallbackLabel: 'Settings & Data',
    icon: Settings,
    links: [
      { to: '/settings', label: 'Settings', icon: Settings },
      { to: '/publish', label: 'Publish', icon: Upload },
      { to: '/backup', label: 'Backup', icon: Database },
      { to: '/export', label: 'Import & export', icon: Download },
      { to: '/maintenance', label: 'Maintenance', icon: Wrench },
      { to: '/templates', label: 'Templates', icon: Layers },
      { to: '/labels', label: 'Labels', icon: Tag },
      { to: '/author', label: 'Author', icon: UserCircle },
      { to: '/lds-ordinances', label: 'LDS ordinances', icon: GraduationCap },
    ],
  },
];

export function findGroupForPath(pathname) {
  for (const group of NAV_GROUPS) {
    if (group.links.some((l) => pathname === l.to || pathname.startsWith(`${l.to}/`))) {
      return group.id;
    }
  }
  return null;
}

export function isLinkActive(link, pathname) {
  if (link.end) return pathname === link.to;
  if (pathname === link.to) return true;
  if (pathname.startsWith(`${link.to}/`)) return true;
  if (link.aliases?.some((a) => pathname === a || pathname.startsWith(`${a}/`))) return true;
  return false;
}
