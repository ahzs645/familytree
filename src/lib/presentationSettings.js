export const DEFAULT_PAGE_STYLE = {
  paginate: false,
  background: 'none',
  pageSize: 'letter',
  orientation: 'portrait',
  margin: 48,
};

export const DEFAULT_PRESENTATION_SETTINGS = {
  pageStyle: DEFAULT_PAGE_STYLE,
  themeId: 'plain',
  language: 'system',
  exportSettings: {
    filenameBase: '',
    includeAuthorMetadata: true,
    includePdfBackground: true,
  },
};

export const PRESENTATION_THEMES = [
  { id: 'plain', label: 'Plain' },
  { id: 'soft', label: 'Soft' },
  { id: 'sepia', label: 'Sepia' },
];

export const PRESENTATION_LANGUAGES = [
  { id: 'system', label: 'System' },
  { id: 'en', label: 'English' },
  { id: 'de', label: 'German' },
  { id: 'fr', label: 'French' },
  { id: 'es', label: 'Spanish' },
];

export function normalizePageStyle(pageStyle = {}) {
  const merged = { ...DEFAULT_PAGE_STYLE, ...(pageStyle || {}) };
  const margin = Number(merged.margin);
  return {
    ...merged,
    paginate: !!merged.paginate,
    background: ['none', 'soft', 'sepia'].includes(merged.background) ? merged.background : DEFAULT_PAGE_STYLE.background,
    pageSize: ['letter', 'a4', 'legal'].includes(merged.pageSize) ? merged.pageSize : DEFAULT_PAGE_STYLE.pageSize,
    orientation: merged.orientation === 'landscape' ? 'landscape' : DEFAULT_PAGE_STYLE.orientation,
    margin: Number.isFinite(margin) ? Math.max(24, Math.min(96, margin)) : DEFAULT_PAGE_STYLE.margin,
  };
}

export function normalizePresentationSettings(settings = {}) {
  const themeIds = new Set(PRESENTATION_THEMES.map((theme) => theme.id));
  const languageIds = new Set(PRESENTATION_LANGUAGES.map((language) => language.id));
  const exportSettings = {
    ...DEFAULT_PRESENTATION_SETTINGS.exportSettings,
    ...(settings?.exportSettings || {}),
  };
  return {
    ...DEFAULT_PRESENTATION_SETTINGS,
    ...(settings || {}),
    pageStyle: normalizePageStyle(settings?.pageStyle),
    themeId: themeIds.has(settings?.themeId) ? settings.themeId : DEFAULT_PRESENTATION_SETTINGS.themeId,
    language: languageIds.has(settings?.language) ? settings.language : DEFAULT_PRESENTATION_SETTINGS.language,
    exportSettings: {
      filenameBase: String(exportSettings.filenameBase || ''),
      includeAuthorMetadata: exportSettings.includeAuthorMetadata !== false,
      includePdfBackground: exportSettings.includePdfBackground !== false,
    },
  };
}

export function updatePageStyle(settings = {}, patch = {}) {
  const normalized = normalizePresentationSettings(settings);
  return {
    ...normalized,
    pageStyle: normalizePageStyle({ ...normalized.pageStyle, ...(patch || {}) }),
  };
}
