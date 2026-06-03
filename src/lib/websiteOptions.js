import { getLocalDatabase } from './LocalDatabase.js';
import {
  DEFAULT_LOCALIZATION,
  directionForLocale,
  getCurrentLocalization,
  normalizeLocale,
} from './i18n.js';

const META_KEY = 'websiteExportOptions';

export const SITE_THEME_PRESETS = Object.freeze([
  {
    id: 'classic',
    label: 'Classic',
    description: 'Clean cards and a neutral public-family-tree layout.',
    colors: {
      background: '#f8fafc',
      card: '#ffffff',
      text: '#18202f',
      muted: '#667085',
      border: '#e2e8f0',
    },
  },
  {
    id: 'journal',
    label: 'Journal',
    description: 'A lighter editorial style for stories and biographies.',
    colors: {
      background: '#fbfbf8',
      card: '#ffffff',
      text: '#18202f',
      muted: '#667085',
      border: '#e2e8f0',
    },
  },
  {
    id: 'archive',
    label: 'Archive',
    description: 'Warm archive colors for source-heavy family sites.',
    colors: {
      background: '#f4f1ea',
      card: '#fffaf0',
      text: '#2d261d',
      muted: '#736a5d',
      border: '#d8cbb8',
    },
  },
]);

export const DEFAULT_CONTENT_SECTIONS = Object.freeze({
  people: true,
  families: true,
  places: true,
  sources: true,
  media: true,
  stories: true,
  relatedMedia: true,
  relatedSources: true,
  relatedStories: true,
  author: true,
});

export const DEFAULT_SITE_OPTIONS = Object.freeze({
  siteTitle: 'Family Tree',
  tagline: '',
  baseUrl: '',
  allowSearchIndexing: false,
  theme: 'classic',
  siteThemes: SITE_THEME_PRESETS,
  accentColor: '#2563eb',
  includePrivate: false,
  hideLiving: false,
  hideLivingDetailsOnly: false,
  livingThresholdYears: 110,
  includeAssets: true,
  contentSections: DEFAULT_CONTENT_SECTIONS,
  locale: DEFAULT_LOCALIZATION.locale,
  direction: DEFAULT_LOCALIZATION.direction,
  numberingSystem: DEFAULT_LOCALIZATION.numberingSystem,
  calendar: DEFAULT_LOCALIZATION.calendar,
});

export async function getWebsiteOptions() {
  const saved = await getLocalDatabase().getMeta(META_KEY);
  return normalizeWebsiteOptions(saved || DEFAULT_SITE_OPTIONS);
}

export async function saveWebsiteOptions(options) {
  const normalized = normalizeWebsiteOptions(options);
  await getLocalDatabase().setMeta(META_KEY, normalized);
  return normalized;
}

export function normalizeWebsiteOptions(options = {}) {
  const currentLocalization = getCurrentLocalization();
  const locale = normalizeLocale(options.locale || currentLocalization.locale || DEFAULT_SITE_OPTIONS.locale);
  const directionPreference = options.direction || currentLocalization.direction || DEFAULT_SITE_OPTIONS.direction;
  const siteThemes = normalizeSiteThemes(options.siteThemes);
  const theme = siteThemes.some((item) => item.id === options.theme)
    ? options.theme
    : siteThemes[0]?.id || DEFAULT_SITE_OPTIONS.theme;

  return {
    ...DEFAULT_SITE_OPTIONS,
    ...options,
    siteThemes,
    theme,
    accentColor: normalizeColor(options.accentColor || DEFAULT_SITE_OPTIONS.accentColor, DEFAULT_SITE_OPTIONS.accentColor),
    siteTitle: String(options.siteTitle || DEFAULT_SITE_OPTIONS.siteTitle).trim() || DEFAULT_SITE_OPTIONS.siteTitle,
    tagline: String(options.tagline || '').trim(),
    baseUrl: normalizeBaseUrl(options.baseUrl),
    allowSearchIndexing: options.allowSearchIndexing === true,
    includePrivate: !!options.includePrivate,
    hideLiving: !!options.hideLiving,
    hideLivingDetailsOnly: !!options.hideLivingDetailsOnly,
    livingThresholdYears: Number.isFinite(+options.livingThresholdYears) ? +options.livingThresholdYears : DEFAULT_SITE_OPTIONS.livingThresholdYears,
    includeAssets: options.includeAssets !== false,
    contentSections: normalizeContentSections(options.contentSections),
    locale,
    direction: directionForLocale(locale, directionPreference),
    numberingSystem: options.numberingSystem || currentLocalization.numberingSystem || DEFAULT_SITE_OPTIONS.numberingSystem,
    calendar: options.calendar || currentLocalization.calendar || DEFAULT_SITE_OPTIONS.calendar,
  };
}

export function normalizeSiteThemes(themes = SITE_THEME_PRESETS) {
  const byId = new Map(SITE_THEME_PRESETS.map((theme) => [theme.id, normalizeTheme(theme)]));
  for (const item of Array.isArray(themes) ? themes : []) {
    const theme = normalizeTheme(item);
    if (!theme.id) continue;
    byId.set(theme.id, { ...(byId.get(theme.id) || {}), ...theme, colors: { ...(byId.get(theme.id)?.colors || {}), ...theme.colors } });
  }
  const requestedOrder = (Array.isArray(themes) ? themes : [])
    .map((theme) => normalizeTheme(theme).id)
    .filter(Boolean);
  const orderedIds = [...new Set([...requestedOrder, ...SITE_THEME_PRESETS.map((theme) => theme.id)])];
  return orderedIds.map((id) => byId.get(id)).filter(Boolean);
}

export function normalizeContentSections(sections = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_CONTENT_SECTIONS).map(([key, defaultValue]) => [
      key,
      typeof sections[key] === 'boolean' ? sections[key] : defaultValue,
    ]),
  );
}

export function resolveSiteTheme(options = {}) {
  const normalized = normalizeWebsiteOptions(options);
  return normalized.siteThemes.find((theme) => theme.id === normalized.theme) || normalized.siteThemes[0] || SITE_THEME_PRESETS[0];
}

export function addSiteTheme(themes, partial = {}) {
  const baseLabel = String(partial.label || 'Custom theme').trim() || 'Custom theme';
  const theme = normalizeTheme({
    id: partial.id || uniqueThemeId(baseLabel, themes),
    label: baseLabel,
    description: partial.description || 'Custom website theme.',
    colors: partial.colors || {},
  });
  return [...normalizeSiteThemes(themes), theme];
}

export function moveSiteTheme(themes, id, direction) {
  const list = normalizeSiteThemes(themes);
  const index = list.findIndex((theme) => theme.id === id);
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || nextIndex < 0 || nextIndex >= list.length) return list;
  const next = [...list];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

export function setDefaultSiteTheme(themes, id) {
  const list = normalizeSiteThemes(themes);
  const index = list.findIndex((theme) => theme.id === id);
  if (index <= 0) return list;
  const next = [...list];
  const [theme] = next.splice(index, 1);
  return [theme, ...next];
}

export function updateSiteTheme(themes, id, patch = {}) {
  return normalizeSiteThemes(themes).map((theme) => (
    theme.id === id
      ? normalizeTheme({ ...theme, ...patch, colors: { ...theme.colors, ...(patch.colors || {}) } })
      : theme
  ));
}

function normalizeTheme(theme = {}) {
  const colors = theme.colors || {};
  const id = String(theme.id || '').trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return {
    id,
    label: String(theme.label || id || '').trim(),
    description: String(theme.description || '').trim(),
    colors: {
      background: normalizeColor(colors.background || '#f8fafc', '#f8fafc'),
      card: normalizeColor(colors.card || '#ffffff', '#ffffff'),
      text: normalizeColor(colors.text || '#18202f', '#18202f'),
      muted: normalizeColor(colors.muted || '#667085', '#667085'),
      border: normalizeColor(colors.border || '#e2e8f0', '#e2e8f0'),
    },
  };
}

function uniqueThemeId(label, themes = []) {
  const base = String(label || 'custom-theme').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'custom-theme';
  const existing = new Set(normalizeSiteThemes(themes).map((theme) => theme.id));
  let candidate = base;
  let suffix = 2;
  while (existing.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function normalizeColor(value, fallback = '#2563eb') {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}
