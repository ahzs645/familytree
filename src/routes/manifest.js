/**
 * Route manifest — single source of truth for the SPA's lazy-loaded routes.
 *
 * The manifest is a flat list of `{ path, loader, alias?, children? }` entries
 * that App.jsx unrolls into <Route> elements. Aliases are rendered as
 * <Navigate replace /> so old URLs keep redirecting (e.g. `/marriages` →
 * `/marriage-list`). Children belong to the nested <Views> outlet.
 */
import { lazy } from 'react';

const lazyRoute = (importer) => lazy(importer);

export const ROUTE_MANIFEST = [
  { path: 'welcome', loader: () => import('./Welcome.jsx') },
  { path: 'about', alias: '/author' },
  { path: 'help', alias: '/actions' },
  { path: 'tree', loader: () => import('./Tree.jsx') },
  { path: 'heritage-tree', loader: () => import('./HeritageTree.jsx') },
  { path: 'persons', loader: () => import('./Persons.jsx') },
  { path: 'families', loader: () => import('./Families.jsx') },
  { path: 'lists', loader: () => import('./Lists.jsx') },
  { path: 'charts', loader: () => import('./Charts.jsx') },
  { path: 'search', loader: () => import('./Search.jsx') },
  { path: 'duplicates', loader: () => import('./Duplicates.jsx') },
  { path: 'reports', loader: () => import('./Reports.jsx') },
  { path: 'books', loader: () => import('./Books.jsx') },
  { path: 'publish', loader: () => import('./Publish.jsx') },
  { path: 'websites', loader: () => import('./Websites.jsx') },
  { path: 'change-log', loader: () => import('./ChangeLog.jsx') },
  { path: 'person/new', loader: () => import('./NewPerson.jsx') },
  { path: 'person/:id', loader: () => import('./PersonEditor.jsx') },
  { path: 'family/:id', loader: () => import('./FamilyEditor.jsx') },
  { path: 'places', loader: () => import('./Places.jsx') },
  { path: 'sources', loader: () => import('./Sources.jsx') },
  { path: 'events', loader: () => import('./Events.jsx') },
  { path: 'family-events', loader: () => import('./FamilyEvents.jsx') },
  { path: 'media', loader: () => import('./Media.jsx') },
  { path: 'map', loader: () => import('./MapView.jsx') },
  { path: 'globe', loader: () => import('./Globe.jsx') },
  { path: 'maps-diagram', loader: () => import('./MapsDiagram.jsx') },
  { path: 'statistic-maps', loader: () => import('./MapsDiagram.jsx') },

  {
    path: 'views',
    loader: () => import('./Views.jsx'),
    indexRedirect: 'virtual-map',
    children: [
      { path: 'virtual-map', loader: () => import('./MapView.jsx') },
      { path: 'map', alias: '../virtual-map' },
      { path: 'virtual-globe', loader: () => import('./Globe.jsx') },
      { path: 'globe', alias: '../virtual-globe' },
      { path: 'statistic-maps', loader: () => import('./MapsDiagram.jsx') },
      { path: 'maps-diagram', alias: '../statistic-maps' },
      { path: 'media-gallery', loader: () => import('./Media.jsx') },
      { path: 'media', alias: '../media-gallery' },
      { path: 'family-quiz', loader: () => import('./Quiz.jsx') },
      { path: 'quiz', alias: '../family-quiz' },
    ],
  },

  { path: 'saved-charts', loader: () => import('./SavedCharts.jsx') },
  { path: 'chart-split', loader: () => import('./ChartSplitWizard.jsx') },
  { path: 'reference-numbering', loader: () => import('./ReferenceNumbering.jsx') },
  { path: 'lineages', loader: () => import('./Lineages.jsx') },
  { path: 'custom-validation', loader: () => import('./CustomValidationSchemas.jsx') },
  { path: 'statistics', loader: () => import('./Statistics.jsx') },
  { path: 'plausibility', loader: () => import('./Plausibility.jsx') },
  { path: 'plausibility-list', loader: () => import('./PlausibilityList.jsx') },
  { path: 'marriages', loader: () => import('./MarriageList.jsx') },
  { path: 'marriage-list', loader: () => import('./MarriageList.jsx') },
  { path: 'facts', loader: () => import('./FactsList.jsx') },
  { path: 'facts-list', loader: () => import('./FactsList.jsx') },
  { path: 'anniversaries', loader: () => import('./AnniversaryList.jsx') },
  { path: 'anniversary-list', loader: () => import('./AnniversaryList.jsx') },
  { path: 'distinctive-persons', loader: () => import('./DistinctivePersons.jsx') },
  { path: 'person-analysis', loader: () => import('./PersonAnalysis.jsx') },
  { path: 'lds-ordinances', loader: () => import('./LdsOrdinances.jsx') },
  { path: 'maintenance', loader: () => import('./Maintenance.jsx') },
  { path: 'smart-filters', loader: () => import('./SmartFilters.jsx') },
  { path: 'custom-types', loader: () => import('./CustomTypes.jsx') },
  { path: 'bookmarks', loader: () => import('./Bookmarks.jsx') },
  { path: 'todos', loader: () => import('./ToDos.jsx') },
  { path: 'stories', loader: () => import('./Stories.jsx') },
  { path: 'groups', loader: () => import('./PersonGroups.jsx') },
  { path: 'tribal-affiliations', loader: () => import('./TribalAffiliations.jsx') },
  { path: 'dna', loader: () => import('./DNAResults.jsx') },
  { path: 'repositories', loader: () => import('./SourceRepositories.jsx') },
  { path: 'slideshow', loader: () => import('./Slideshow.jsx') },
  { path: 'world-history', loader: () => import('./WorldHistory.jsx') },
  { path: 'research', loader: () => import('./Research.jsx') },
  { path: 'templates', loader: () => import('./Templates.jsx') },
  { path: 'labels', loader: () => import('./Labels.jsx') },
  { path: 'quiz', loader: () => import('./Quiz.jsx') },
  { path: 'backup', loader: () => import('./Backup.jsx') },
  { path: 'export', loader: () => import('./Export.jsx') },
  { path: 'subtree', loader: () => import('./SubtreeWizard.jsx') },
  { path: 'actions', loader: () => import('./Actions.jsx') },

  {
    path: 'settings',
    loader: () => import('./Settings.jsx'),
    indexRedirect: 'general',
    children: [
      { path: 'general', loader: () => import('../components/settings/panels/GeneralPanel.jsx') },
      { path: 'formats', loader: () => import('../components/settings/panels/FormatsPanel.jsx') },
      { path: 'colors', loader: () => import('../components/settings/panels/ColorsPanel.jsx') },
      { path: 'arabic-islamic', loader: () => import('../components/settings/panels/ArabicIslamicPanel.jsx') },
      { path: 'tree-layout', loader: () => import('../components/settings/panels/TreeLayoutPanel.jsx') },
      { path: 'maps', loader: () => import('../components/settings/panels/MapsPanel.jsx') },
      { path: 'media', loader: () => import('../components/settings/panels/MediaSlideshowPanel.jsx') },
      { path: 'pdf', loader: () => import('../components/settings/panels/PdfPanel.jsx') },
      { path: 'history', loader: () => import('../components/settings/panels/HistoryPanel.jsx') },
      { path: 'content-download', loader: () => import('../components/settings/panels/ContentDownloadPanel.jsx') },
      { path: 'edit-controllers', loader: () => import('../components/settings/panels/EditControllersPanel.jsx') },
      { path: 'categories', loader: () => import('../components/settings/panels/CategoriesPanel.jsx') },
      { path: 'export', loader: () => import('../components/settings/panels/ExportPanel.jsx') },
      { path: 'privacy', loader: () => import('../components/settings/panels/PrivacyPanel.jsx') },
      { path: 'plausibility', loader: () => import('../components/settings/panels/PlausibilityPanel.jsx') },
      { path: 'integrations', loader: () => import('../components/settings/panels/IntegrationsPanel.jsx') },
      { path: 'functions', loader: () => import('../components/settings/panels/FunctionsPanel.jsx') },
    ],
  },

  { path: 'author', loader: () => import('./AuthorInformation.jsx') },
  { path: 'author-information', loader: () => import('./AuthorInformation.jsx') },
  { path: 'web-search', loader: () => import('./WebSearch.jsx') },
  { path: 'familysearch', loader: () => import('./FamilySearch.jsx') },
  { path: 'family-search', loader: () => import('./FamilySearch.jsx') },
  { path: 'search-and-replace', loader: () => import('./Search.jsx') },
  { path: 'favorites', loader: () => import('./Favorites.jsx') },
];

export const SHARE_PREVIEW_ROUTE = {
  path: 'view/:token',
  loader: () => import('./ChartPreview.jsx'),
};

/**
 * Memoized React.lazy wrapper around `loader`. We memoize on the function
 * identity so repeated reads of the manifest don't create new lazy refs
 * (which would defeat Suspense's caching).
 */
const lazyCache = new WeakMap();
export function memoLazy(loader) {
  if (!loader) return null;
  let cached = lazyCache.get(loader);
  if (!cached) {
    cached = lazyRoute(loader);
    lazyCache.set(loader, cached);
  }
  return cached;
}
