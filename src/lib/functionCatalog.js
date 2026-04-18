export const APP_FUNCTIONS = [
  { to: '/tree', label: 'Interactive Tree', category: 'Edit' },
  { to: '/persons', label: 'Edit Persons', category: 'Edit' },
  { to: '/groups', label: 'Edit Person Groups', category: 'Edit' },
  { to: '/families', label: 'Edit Families', category: 'Edit', unavailable: true },
  { to: '/places', label: 'Edit Places', category: 'Edit' },
  { to: '/sources', label: 'Edit Sources', category: 'Edit' },
  { to: '/stories', label: 'Edit Stories', category: 'Edit' },
  { to: '/author', label: 'Author Information', category: 'Edit' },
  { to: '/familysearch', label: 'FamilySearch', category: 'Edit' },
  { to: '/web-search', label: 'Web Search', category: 'Edit' },
  { to: '/media', label: 'Edit Media', category: 'Edit' },
  { to: '/todos', label: 'Edit ToDo List', category: 'Edit' },
  { to: '/research', label: 'Research Assistant', category: 'Edit' },
  { to: '/search', label: 'Search', category: 'Edit' },
  { to: '/maintenance', label: 'Database Maintenance', category: 'Edit' },
  { to: '/change-log', label: 'Change Log', category: 'Edit' },

  { to: '/charts', label: 'Charts', category: 'Charts' },
  { to: '/saved-charts', label: 'Saved Charts', category: 'Charts' },

  { to: '/views/virtual-map', label: 'Virtual Map', category: 'Views' },
  { to: '/views/virtual-globe', label: 'Virtual Globe', category: 'Views' },
  { to: '/views/statistic-maps', label: 'Statistic Maps', category: 'Views' },
  { to: '/views/media-gallery', label: 'Media Gallery', category: 'Views' },
  { to: '/views/family-quiz', label: 'Family Quiz', category: 'Views' },

  { to: '/reports', label: 'Reports', category: 'Reports' },
  { to: '/lists', label: 'Lists', category: 'Lists' },
  { to: '/statistics', label: 'Statistics', category: 'Lists' },
  { to: '/plausibility-list', label: 'Plausibility List', category: 'Lists' },
  { to: '/marriages', label: 'Marriage List', category: 'Lists' },
  { to: '/facts', label: 'Facts List', category: 'Lists' },
  { to: '/anniversaries', label: 'Anniversary List', category: 'Lists' },
  { to: '/distinctive-persons', label: 'Distinctive Persons', category: 'Lists' },
  { to: '/person-analysis', label: 'Person Analysis', category: 'Lists' },
  { to: '/lds-ordinances', label: 'LDS Ordinances', category: 'Lists' },

  { to: '/publish', label: 'Publish', category: 'Publish' },
  { to: '/websites', label: 'Websites', category: 'Publish' },
  { to: '/books', label: 'Family Tree Book', category: 'Publish' },
  { to: '/export', label: 'Import and Export', category: 'Publish' },
  { to: '/backup', label: 'Backup and Restore', category: 'Publish' },

  { to: '/favorites', label: 'Favorites', category: 'Favorites' },
  { to: '/bookmarks', label: 'Bookmarks', category: 'Favorites' },
  { to: '/labels', label: 'Labels', category: 'Favorites' },
  { to: '/settings', label: 'Settings', category: 'Favorites' },
];

export const DEFAULT_FAVORITE_FUNCTIONS = [
  '/tree',
  '/persons',
  '/charts',
  '/search',
  '/reports',
  '/web-search',
  '/familysearch',
  '/author',
];

export function functionByRoute(route) {
  return APP_FUNCTIONS.find((item) => item.to === route) || null;
}

export function groupedFunctions(functions = APP_FUNCTIONS) {
  return functions.reduce((groups, item) => {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
    return groups;
  }, {});
}
