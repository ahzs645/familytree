import { getLocalDatabase } from './LocalDatabase.js';
import {
  DEFAULT_LOCALIZATION,
  directionForLocale,
  getCurrentLocalization,
  normalizeLocale,
} from './i18n.js';

const META_KEY = 'websiteExportOptions';

// Theme typography presets (mirrors MFT's website font-family choices).
export const SITE_FONT_FAMILIES = Object.freeze([
  { id: 'system', label: 'System', stack: '-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Naskh Arabic",Tahoma,sans-serif' },
  { id: 'serif', label: 'Serif', stack: 'Georgia,"Times New Roman","Noto Naskh Arabic",serif' },
  { id: 'humanist', label: 'Humanist', stack: '"Segoe UI",Verdana,"Noto Naskh Arabic",sans-serif' },
  { id: 'rounded', label: 'Rounded', stack: '"Avenir Next",Avenir,"Trebuchet MS","Noto Naskh Arabic",sans-serif' },
  { id: 'mono', label: 'Monospace', stack: '"SF Mono",Menlo,Consolas,"Noto Naskh Arabic",monospace' },
]);

const FONT_IDS = new Set(SITE_FONT_FAMILIES.map((font) => font.id));
const TEXT_ALIGNMENTS = new Set(['start', 'center', 'end', 'justify']);
const SECTION_PLACEMENTS = new Set(['stacked', 'sidebar']);

export const SITE_THEME_PRESETS = Object.freeze([
  {
    id: 'classic',
    label: 'Classic',
    description: 'Clean cards and a neutral public-family-tree layout.',
    font: 'system',
    colors: {
      background: '#f8fafc', card: '#ffffff', text: '#18202f', muted: '#667085', border: '#e2e8f0',
      link: '#2563eb', linkActive: '#1d4ed8', maleTint: '#e8f0fe', femaleTint: '#fdeef4',
    },
  },
  {
    id: 'journal',
    label: 'Journal',
    description: 'A lighter editorial style for stories and biographies.',
    font: 'serif',
    textAlign: 'start',
    colors: {
      background: '#fbfbf8', card: '#ffffff', text: '#18202f', muted: '#667085', border: '#e2e8f0',
      link: '#9d2235', linkActive: '#7a1a29', maleTint: '#eef2f7', femaleTint: '#f7eef0',
    },
  },
  {
    id: 'archive',
    label: 'Archive',
    description: 'Warm archive colors for source-heavy family sites.',
    font: 'serif',
    colors: {
      background: '#f4f1ea', card: '#fffaf0', text: '#2d261d', muted: '#736a5d', border: '#d8cbb8',
      link: '#8a5a2b', linkActive: '#6f4720', maleTint: '#eee6d6', femaleTint: '#f3e3d8',
    },
  },
  {
    id: 'slate',
    label: 'Slate',
    description: 'Cool grey cards for a calm, modern feel.',
    font: 'humanist',
    colors: {
      background: '#eef1f4', card: '#ffffff', text: '#1f2933', muted: '#5b6b7b', border: '#d5dce3',
      link: '#0f766e', linkActive: '#0b5a54', maleTint: '#e3edf2', femaleTint: '#f1e8ef',
    },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'A dark theme for low-light reading.',
    font: 'system',
    colors: {
      background: '#0f172a', card: '#1e293b', text: '#e2e8f0', muted: '#94a3b8', border: '#334155',
      link: '#60a5fa', linkActive: '#93c5fd', maleTint: '#1d3050', femaleTint: '#3a2440',
    },
  },
  {
    id: 'graphite',
    label: 'Graphite',
    description: 'Near-black surfaces with high-contrast text.',
    font: 'mono',
    colors: {
      background: '#111114', card: '#1c1c20', text: '#f4f4f5', muted: '#a1a1aa', border: '#2e2e33',
      link: '#a78bfa', linkActive: '#c4b5fd', maleTint: '#23283a', femaleTint: '#332433',
    },
  },
  {
    id: 'sepia',
    label: 'Sepia',
    description: 'Soft paper tones for a vintage album look.',
    font: 'serif',
    colors: {
      background: '#f3ead7', card: '#fbf5e7', text: '#3a2e1c', muted: '#7c6a4c', border: '#e0d2b4',
      link: '#a4602a', linkActive: '#834b20', maleTint: '#efe3c8', femaleTint: '#f0e0cd',
    },
  },
  {
    id: 'forest',
    label: 'Forest',
    description: 'Green-tinted cards for nature-leaning family sites.',
    font: 'humanist',
    colors: {
      background: '#eef4ec', card: '#ffffff', text: '#1d2a22', muted: '#5a7060', border: '#cfe0d2',
      link: '#15803d', linkActive: '#106530', maleTint: '#e0efe6', femaleTint: '#efe7ee',
    },
  },
  {
    id: 'ocean',
    label: 'Ocean',
    description: 'Blue-teal palette with a fresh, airy layout.',
    font: 'rounded',
    colors: {
      background: '#ecf4f7', card: '#ffffff', text: '#13303a', muted: '#4f7682', border: '#cde0e7',
      link: '#0e7490', linkActive: '#0a596f', maleTint: '#dcecf2', femaleTint: '#efe4ed',
    },
  },
  {
    id: 'rose',
    label: 'Rose',
    description: 'Warm pink-and-cream styling for celebratory pages.',
    font: 'rounded',
    colors: {
      background: '#fbf0f3', card: '#ffffff', text: '#3a1f2a', muted: '#8a5d6c', border: '#efd6df',
      link: '#be185d', linkActive: '#9c1450', maleTint: '#f3e1ea', femaleTint: '#f7dde8',
    },
  },
  {
    id: 'sunrise',
    label: 'Sunrise',
    description: 'Warm amber accents over a light backdrop.',
    font: 'humanist',
    colors: {
      background: '#fdf6ec', card: '#ffffff', text: '#3a2c14', muted: '#8a734a', border: '#f0e1c6',
      link: '#d97706', linkActive: '#b45f05', maleTint: '#f4ead4', femaleTint: '#f6e3d6',
    },
  },
  {
    id: 'lavender',
    label: 'Lavender',
    description: 'Muted purple tones for an elegant feel.',
    font: 'serif',
    colors: {
      background: '#f3f0fa', card: '#ffffff', text: '#2a2440', muted: '#6f6489', border: '#ddd5ef',
      link: '#7c3aed', linkActive: '#6428c4', maleTint: '#e6e0f5', femaleTint: '#f0e2f0',
    },
  },
  {
    id: 'mono-print',
    label: 'Mono Print',
    description: 'High-contrast black-and-white for print-friendly export.',
    font: 'serif',
    colors: {
      background: '#ffffff', card: '#ffffff', text: '#000000', muted: '#555555', border: '#cccccc',
      link: '#000000', linkActive: '#333333', maleTint: '#f0f0f0', femaleTint: '#f5f5f5',
    },
  },
  {
    id: 'heritage',
    label: 'Heritage',
    description: 'Deep navy and gold for a formal lineage site.',
    font: 'serif',
    colors: {
      background: '#f1f0ea', card: '#fbfaf4', text: '#1c2438', muted: '#5d6273', border: '#d8d4c4',
      link: '#1e3a8a', linkActive: '#a47b1f', maleTint: '#e6e9f1', femaleTint: '#efe6dd',
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
  personGroups: true,
  savedCharts: true,
  charts: true,
  dna: true,
  relatedMedia: true,
  relatedSources: true,
  relatedStories: true,
  author: true,
});

// Per-media-type include toggles (#62) — applied only when the `media` content
// section is enabled. Keys are Media* record types.
export const DEFAULT_MEDIA_TYPES = Object.freeze({
  MediaPicture: true,
  MediaPDF: true,
  MediaAudio: true,
  MediaVideo: true,
  MediaURL: true,
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
  mediaTypes: DEFAULT_MEDIA_TYPES,
  exportPersonsMode: 'all',
  exportScopeId: '',
  includeStatisticsPage: true,
  faviconDataUrl: '',
  homeImageDataUrl: '',
  // Homepage Introduction / Start Person / Bookmarks (#homepage).
  introduction: '',
  startPersonId: '',
  includeBookmarks: true,
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
    mediaTypes: normalizeMediaTypes(options.mediaTypes),
    exportPersonsMode: ['all', 'smartFilter'].includes(options.exportPersonsMode) ? options.exportPersonsMode : 'all',
    exportScopeId: String(options.exportScopeId || ''),
    includeStatisticsPage: options.includeStatisticsPage !== false,
    faviconDataUrl: String(options.faviconDataUrl || ''),
    homeImageDataUrl: String(options.homeImageDataUrl || ''),
    introduction: String(options.introduction || ''),
    startPersonId: String(options.startPersonId || ''),
    includeBookmarks: options.includeBookmarks !== false,
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

export function normalizeMediaTypes(types = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_MEDIA_TYPES).map(([key, defaultValue]) => [
      key,
      typeof types[key] === 'boolean' ? types[key] : defaultValue,
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
  const link = normalizeColor(colors.link || '', '');
  return {
    id,
    label: String(theme.label || id || '').trim(),
    description: String(theme.description || '').trim(),
    // Typography + layout depth (mirrors MFT website theme settings).
    font: FONT_IDS.has(theme.font) ? theme.font : 'system',
    textAlign: TEXT_ALIGNMENTS.has(theme.textAlign) ? theme.textAlign : 'start',
    sectionPlacement: SECTION_PLACEMENTS.has(theme.sectionPlacement) ? theme.sectionPlacement : 'stacked',
    blur: Number.isFinite(+theme.blur) ? Math.max(0, Math.min(24, +theme.blur)) : 0,
    genderTint: theme.genderTint === true,
    // Optional decorative image data URLs (background / header).
    backgroundImage: String(theme.backgroundImage || ''),
    headerImage: String(theme.headerImage || ''),
    colors: {
      background: normalizeColor(colors.background || '#f8fafc', '#f8fafc'),
      card: normalizeColor(colors.card || '#ffffff', '#ffffff'),
      text: normalizeColor(colors.text || '#18202f', '#18202f'),
      muted: normalizeColor(colors.muted || '#667085', '#667085'),
      border: normalizeColor(colors.border || '#e2e8f0', '#e2e8f0'),
      link: link || normalizeColor(colors.background ? '#2563eb' : '#2563eb', '#2563eb'),
      linkActive: normalizeColor(colors.linkActive || '', '') || link || '#1d4ed8',
      maleTint: normalizeColor(colors.maleTint || '#e8f0fe', '#e8f0fe'),
      femaleTint: normalizeColor(colors.femaleTint || '#fdeef4', '#fdeef4'),
    },
  };
}

export function fontStackFor(fontId) {
  return (SITE_FONT_FAMILIES.find((font) => font.id === fontId) || SITE_FONT_FAMILIES[0]).stack;
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
