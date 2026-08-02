import { getAppDataClient } from './data/AppDataClient.js';
import { DEFAULT_FAVORITE_FUNCTIONS } from './functionCatalog.js';
import {
  CALENDAR_OPTIONS,
  DEFAULT_LOCALIZATION,
  DIRECTION_OPTIONS,
  NUMBERING_SYSTEM_OPTIONS,
  detectedLocalization,
  normalizeLocale,
  persistLocalization,
} from './i18n.js';
import {
  ADDITIONAL_NAME_DISPLAY,
  DEFAULT_ADDITIONAL_NAME_DISPLAY,
  DEFAULT_DISPLAY_FORMAT,
  DEFAULT_SORT_FORMAT,
  NAME_FORMAT_LABELS,
  setActiveNameFormats,
} from './nameFormat.js';
import {
  DEFAULT_MEDIA_SLIDESHOW_SETTINGS,
  normalizeMediaSlideshowSettings,
} from './mediaPresentation.js';
import {
  DEFAULT_MEDIA_GALLERY_PREFERENCES,
  normalizeMediaGalleryPreferences,
} from './mediaManagement.js';
import {
  DEFAULT_VITAL_DISPLAY,
  normalizeVitalDisplay,
  setActiveVitalDisplay,
} from './vitalFormat.js';
import { setCatalogLabelPreferences } from './catalogs.js';
import { privacyPolicyFromPreferences, DEFAULT_PRIVACY_POLICY } from './privacy.js';

const META_KEY = 'appPreferences';
export const APP_PREFERENCES_EVENT = 'cloudtreeweb:app-preferences-changed';

const DEFAULT_APP_PREFERENCES = {
  general: {
    startRoute: '/tree',
    confirmDeletes: true,
    autoSaveEditors: false,
    showPrivateRecords: false,
    compactLists: false,
  },
  formats: {
    nameOrder: 'given-family',
    surnameCase: 'as-entered',
    nameDisplayFormat: DEFAULT_DISPLAY_FORMAT,
    nameSortFormat: DEFAULT_SORT_FORMAT,
    additionalNameDisplay: DEFAULT_ADDITIONAL_NAME_DISPLAY,
    dateDisplayFormat: 'YYYY-MM-DD',
    readableDateFormats: 'YYYY-MM-DD\nDD MM YYYY\nMM/DD/YYYY',
    partialDateEntry: {
      allowYearOnly: true,
      allowYearMonth: true,
      allowCalendarPrefixes: true,
    },
    vitalDisplay: DEFAULT_VITAL_DISPLAY,
  },
  arabicIslamic: {
    preferArabicCatalogLabels: false,
  },
  treeLayout: {
    atharaCoupleSafeguards: true,
    cycleProtection: true,
    singleParentCoupleFallback: true,
  },
  // Seeded from the browser's languages so a first-time visitor lands in
  // their own language; anything they save afterwards overrides it.
  localization: detectedLocalization(),
  appearance: {
    accentColor: '#2563eb',
    chartTheme: 'auto',
    reportBackground: 'none',
  },
  media: {
    gallery: DEFAULT_MEDIA_GALLERY_PREFERENCES,
    slideshow: DEFAULT_MEDIA_SLIDESHOW_SETTINGS,
  },
  pdf: {
    pageSize: 'letter',
    orientation: 'portrait',
    margin: 48,
    embedFonts: true,
    includeBookmarks: true,
    compressImages: true,
  },
  history: {
    showWorldEventsInTimeline: true,
    worldHistoryCategories: ['politics', 'science', 'culture'],
    lifespanYearsBeforeBirth: 5,
    lifespanYearsAfterDeath: 5,
  },
  contentDownload: {
    autoDownloadHistory: true,
    autoDownloadFamilySearchSources: false,
    concurrency: 3,
    wifiOnly: false,
  },
  editControllers: {
    eventTypesCollapsed: false,
    factTypesCollapsed: false,
    defaultEventType: 'Birth',
    defaultFactType: 'Occupation',
    defaultFamilyEventType: 'Marriage',
    applyDefaultEvents: false,
  },
  categoryConfigurations: {
    labelOrder: 'alphabetical',
    groupOrder: 'custom',
    hiddenCategories: [],
  },
  exportDefaults: {
    includePrivate: false,
    includeMedia: true,
    gedcomEncoding: 'utf-8',
    websiteTheme: 'classic',
    csvSeparator: ',',
  },
  importDefaults: {
    gedcomEncoding: 'auto',
    gedcomMode: 'review',
  },
  privacy: {
    hideMarkedPrivate: true,
    hideLivingPersons: false,
    hideLivingDetailsOnly: false,
    livingPersonThresholdYears: 110,
  },
  plausibility: {
    enabled: {
      'death-before-birth': true,
      'lifespan-over-120': true,
      'birth-year-suspicious': true,
      'marriage-too-young': true,
      'parent-too-young': true,
      'parent-too-old': true,
      'child-after-parent-death': true,
      'event-outside-lifespan': true,
      'birth-order-mismatch': true,
    },
    thresholds: {
      maxLifespan: 120,
      minMarriageAge: 12,
      minParentAge: 12,
      maxParentAge: 70,
    },
  },
  webSearch: {
    provider: 'familysearch',
    customUrl: '',
    openInNewTab: true,
  },
  familySearch: {
    defaultTaskType: 'match-review',
    showMatched: true,
    showUnmatched: true,
  },
  functions: {
    favorites: DEFAULT_FAVORITE_FUNCTIONS,
    hidden: [],
    emphasized: ['/tree', '/persons', '/charts', '/search'],
  },
};

/**
 * Apply the appearance preferences to the live document.
 *
 * The chosen accent remains the solid `primary` fill, with a black or white
 * foreground selected from its actual contrast. Text links and focus rings use
 * separate, theme-specific `interactive` colors derived from the same hue.
 * This avoids the impossible constraint of making one blue both dark enough
 * for white button text and light enough for blue text on a dark card.
 */
// Synchronous mirror of exportDefaults so pure export utilities (listExport.js)
// can read the chosen CSV separator without an async preferences load. Kept up
// to date on every preferences load + change.
let activeExportDefaults = { ...DEFAULT_APP_PREFERENCES.exportDefaults };

export function getActiveExportDefaults() {
  return activeExportDefaults;
}

function setActiveExportDefaults(value) {
  if (value && typeof value === 'object') activeExportDefaults = { ...activeExportDefaults, ...value };
}

// Synchronous mirror of the privacy policy so report/chart/list builders can
// honor "hide marked-private / living" without an async preferences load.
let activePrivacyPolicy = { ...DEFAULT_PRIVACY_POLICY };

export function getActivePrivacyPolicy() {
  return activePrivacyPolicy;
}

function setActivePrivacyPolicy(prefs) {
  if (prefs && typeof prefs === 'object') activePrivacyPolicy = privacyPolicyFromPreferences(prefs);
}

export function applyDocumentAppearance(appearance = {}) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const accent = String(appearance.accentColor || '').trim();
  const tokens = appearanceThemeTokens(accent);
  if (tokens) {
    root.style.setProperty('--primary', tokens.primary);
    root.style.setProperty('--primary-foreground', tokens.primaryForeground);
    root.style.setProperty('--interactive-light', tokens.interactiveLight);
    root.style.setProperty('--interactive-dark', tokens.interactiveDark);
  } else {
    root.style.removeProperty('--primary');
    root.style.removeProperty('--primary-foreground');
    root.style.removeProperty('--interactive-light');
    root.style.removeProperty('--interactive-dark');
  }
}

const LIGHT_INTERACTIVE_SURFACE = hslToRgb(220, 0.14, 0.96);
const DARK_INTERACTIVE_SURFACE = hslToRgb(224, 0.18, 0.17);
const MIN_TEXT_CONTRAST = 4.6;
const BLACK = [0, 0, 0];
const WHITE = [1, 1, 1];

/**
 * Pure token derivation used by applyDocumentAppearance and contrast tests.
 * Returns null for invalid colors so the document falls back to CSS defaults.
 */
export function appearanceThemeTokens(accent) {
  const rgb = hexToRgb(accent);
  if (!rgb) return null;
  const blackContrast = contrastRatio(rgb, BLACK);
  const whiteContrast = contrastRatio(rgb, WHITE);
  const primaryForeground = blackContrast >= whiteContrast ? BLACK : WHITE;
  return {
    primary: rgbToHslTriplet(rgb),
    primaryForeground: rgbToHslTriplet(primaryForeground),
    interactiveLight: rgbToHslTriplet(
      ensureTextContrast(rgb, LIGHT_INTERACTIVE_SURFACE, 'darker')
    ),
    interactiveDark: rgbToHslTriplet(
      ensureTextContrast(rgb, DARK_INTERACTIVE_SURFACE, 'lighter')
    ),
  };
}

function hexToRgb(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return [
    ((int >> 16) & 255) / 255,
    ((int >> 8) & 255) / 255,
    (int & 255) / 255,
  ];
}

function rgbToHsl(rgb) {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = l - c / 2;
  let rgb;
  if (hue < 60) rgb = [c, x, 0];
  else if (hue < 120) rgb = [x, c, 0];
  else if (hue < 180) rgb = [0, c, x];
  else if (hue < 240) rgb = [0, x, c];
  else if (hue < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return rgb.map((channel) => channel + m);
}

function rgbToHslTriplet(rgb) {
  const [h, s, l] = rgbToHsl(rgb);
  const round = (value) => Math.round(value * 10) / 10;
  return `${round(h)} ${round(s * 100)}% ${round(l * 100)}%`;
}

function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map((channel) => (
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(first, second) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function ensureTextContrast(rgb, surface, direction) {
  if (contrastRatio(rgb, surface) >= MIN_TEXT_CONTRAST) return rgb;
  const [h, s, initialLightness] = rgbToHsl(rgb);
  if (direction === 'darker') {
    let passing = 0;
    let failing = initialLightness;
    for (let i = 0; i < 24; i += 1) {
      const candidate = (passing + failing) / 2;
      if (contrastRatio(hslToRgb(h, s, candidate), surface) >= MIN_TEXT_CONTRAST) {
        passing = candidate;
      } else {
        failing = candidate;
      }
    }
    return hslToRgb(h, s, passing);
  }

  let failing = initialLightness;
  let passing = 1;
  for (let i = 0; i < 24; i += 1) {
    const candidate = (failing + passing) / 2;
    if (contrastRatio(hslToRgb(h, s, candidate), surface) >= MIN_TEXT_CONTRAST) {
      passing = candidate;
    } else {
      failing = candidate;
    }
  }
  return hslToRgb(h, s, passing);
}

export async function getAppPreferences() {
  const db = getAppDataClient().meta;
  const prefs = normalizePreferences(await db.get(META_KEY));
  setActiveNameFormats({
    display: prefs.formats.nameDisplayFormat,
    sort: prefs.formats.nameSortFormat,
    additionalNames: prefs.formats.additionalNameDisplay,
  });
  setActiveVitalDisplay(prefs.formats.vitalDisplay);
  setActiveExportDefaults(prefs.exportDefaults);
  setActivePrivacyPolicy(prefs);
  setCatalogLabelPreferences({
    preferArabicCatalogLabels: prefs.arabicIslamic.preferArabicCatalogLabels,
    locale: prefs.localization.locale,
  });
  return prefs;
}

export async function saveAppPreferences(next) {
  const db = getAppDataClient().meta;
  const normalized = normalizePreferences(next);
  await db.set(META_KEY, normalized);
  announcePreferences(normalized);
  return normalized;
}

export async function patchAppPreferences(path, value) {
  const prefs = await getAppPreferences();
  const next = setPath(prefs, path, value);
  return saveAppPreferences(next);
}

export async function resetAppPreferences() {
  return saveAppPreferences(DEFAULT_APP_PREFERENCES);
}

function normalizePreferences(value = {}) {
  const merged = deepMerge(DEFAULT_APP_PREFERENCES, value || {});
  merged.functions.favorites = uniqueRoutes(merged.functions.favorites, DEFAULT_FAVORITE_FUNCTIONS);
  merged.functions.hidden = uniqueRoutes(merged.functions.hidden, []);
  merged.functions.emphasized = uniqueRoutes(merged.functions.emphasized, []);
  merged.localization = normalizeLocalization(merged.localization);
  merged.formats.partialDateEntry = normalizePartialDateEntry(merged.formats.partialDateEntry);
  merged.formats.vitalDisplay = normalizeVitalDisplay(merged.formats.vitalDisplay);
  merged.arabicIslamic.preferArabicCatalogLabels = !!merged.arabicIslamic.preferArabicCatalogLabels;
  merged.treeLayout.atharaCoupleSafeguards = merged.treeLayout.atharaCoupleSafeguards !== false;
  merged.treeLayout.cycleProtection = merged.treeLayout.cycleProtection !== false;
  merged.treeLayout.singleParentCoupleFallback = merged.treeLayout.singleParentCoupleFallback !== false;
  merged.pdf.margin = clampNumber(merged.pdf.margin, 12, 144, DEFAULT_APP_PREFERENCES.pdf.margin);
  merged.webSearch.openInNewTab = merged.webSearch.openInNewTab !== false;
  if (!isPlainObject(merged.media)) merged.media = { ...DEFAULT_APP_PREFERENCES.media };
  merged.media.gallery = normalizeMediaGalleryPreferences(merged.media?.gallery);
  merged.media.slideshow = normalizeMediaSlideshowSettings(merged.media?.slideshow);
  if (!NAME_FORMAT_LABELS[merged.formats.nameDisplayFormat]) merged.formats.nameDisplayFormat = DEFAULT_DISPLAY_FORMAT;
  if (!NAME_FORMAT_LABELS[merged.formats.nameSortFormat]) merged.formats.nameSortFormat = DEFAULT_SORT_FORMAT;
  if (!Object.values(ADDITIONAL_NAME_DISPLAY).includes(merged.formats.additionalNameDisplay)) merged.formats.additionalNameDisplay = DEFAULT_ADDITIONAL_NAME_DISPLAY;
  if (!['strict', 'review', 'lenient'].includes(merged.importDefaults?.gedcomMode)) merged.importDefaults.gedcomMode = 'review';
  return merged;
}

export function preferenceDownloadPayload(preferences) {
  return {
    type: 'CloudTreeWebPreferences',
    version: 1,
    exportedAt: new Date().toISOString(),
    preferences: normalizePreferences(preferences),
  };
}

function uniqueRoutes(value, fallback) {
  const list = Array.isArray(value) ? value : fallback;
  return [...new Set(list.filter(Boolean).map(String))];
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeLocalization(value = {}) {
  const directionValues = new Set(DIRECTION_OPTIONS.map((option) => option.value));
  const numberingValues = new Set(NUMBERING_SYSTEM_OPTIONS.map((option) => option.value));
  const calendarValues = new Set(CALENDAR_OPTIONS.map((option) => option.value));
  return {
    locale: normalizeLocale(value.locale || detectedLocalization().locale),
    direction: directionValues.has(value.direction) ? value.direction : DEFAULT_LOCALIZATION.direction,
    numberingSystem: numberingValues.has(value.numberingSystem) ? value.numberingSystem : DEFAULT_LOCALIZATION.numberingSystem,
    calendar: calendarValues.has(value.calendar) ? value.calendar : DEFAULT_LOCALIZATION.calendar,
  };
}

function normalizePartialDateEntry(value = {}) {
  return {
    allowYearOnly: value.allowYearOnly !== false,
    allowYearMonth: value.allowYearMonth !== false,
    allowCalendarPrefixes: value.allowCalendarPrefixes !== false,
  };
}

function deepMerge(base, override) {
  if (!isPlainObject(base)) return override === undefined ? base : override;
  const out = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    out[key] = isPlainObject(base[key]) && isPlainObject(value)
      ? deepMerge(base[key], value)
      : value;
  }
  return out;
}

function setPath(object, path, value) {
  const parts = Array.isArray(path) ? path : String(path).split('.');
  const out = { ...object };
  let cursor = out;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    cursor[key] = { ...(cursor[key] || {}) };
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
  return out;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function announcePreferences(preferences) {
  persistLocalization(preferences?.localization);
  setActiveNameFormats({
    display: preferences?.formats?.nameDisplayFormat,
    sort: preferences?.formats?.nameSortFormat,
    additionalNames: preferences?.formats?.additionalNameDisplay,
  });
  setActiveVitalDisplay(preferences?.formats?.vitalDisplay);
  setActiveExportDefaults(preferences?.exportDefaults);
  setActivePrivacyPolicy(preferences);
  setCatalogLabelPreferences({
    preferArabicCatalogLabels: !!preferences?.arabicIslamic?.preferArabicCatalogLabels,
    locale: preferences?.localization?.locale,
  });
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APP_PREFERENCES_EVENT, { detail: preferences }));
}
