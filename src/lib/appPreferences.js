import { getLocalDatabase } from './LocalDatabase.js';
import { DEFAULT_FAVORITE_FUNCTIONS } from './functionCatalog.js';
import {
  CALENDAR_OPTIONS,
  DEFAULT_LOCALIZATION,
  DIRECTION_OPTIONS,
  NUMBERING_SYSTEM_OPTIONS,
  normalizeLocale,
  persistLocalization,
} from './i18n.js';
import {
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
  DEFAULT_VITAL_DISPLAY,
  normalizeVitalDisplay,
  setActiveVitalDisplay,
} from './vitalFormat.js';
import { setCatalogLabelPreferences } from './catalogs.js';

const META_KEY = 'appPreferences';
export const APP_PREFERENCES_EVENT = 'cloudtreeweb:app-preferences-changed';

export const DEFAULT_APP_PREFERENCES = {
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
  localization: {
    ...DEFAULT_LOCALIZATION,
  },
  appearance: {
    accentColor: '#2563eb',
    chartTheme: 'auto',
    reportBackground: 'none',
  },
  media: {
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

export async function getAppPreferences() {
  const db = getLocalDatabase();
  const prefs = normalizePreferences(await db.getMeta(META_KEY));
  setActiveNameFormats({
    display: prefs.formats.nameDisplayFormat,
    sort: prefs.formats.nameSortFormat,
  });
  setActiveVitalDisplay(prefs.formats.vitalDisplay);
  setCatalogLabelPreferences({
    preferArabicCatalogLabels: prefs.arabicIslamic.preferArabicCatalogLabels,
  });
  return prefs;
}

export async function saveAppPreferences(next) {
  const db = getLocalDatabase();
  const normalized = normalizePreferences(next);
  await db.setMeta(META_KEY, normalized);
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

export function normalizePreferences(value = {}) {
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
  merged.media.slideshow = normalizeMediaSlideshowSettings(merged.media?.slideshow);
  if (!NAME_FORMAT_LABELS[merged.formats.nameDisplayFormat]) merged.formats.nameDisplayFormat = DEFAULT_DISPLAY_FORMAT;
  if (!NAME_FORMAT_LABELS[merged.formats.nameSortFormat]) merged.formats.nameSortFormat = DEFAULT_SORT_FORMAT;
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
    locale: normalizeLocale(value.locale || DEFAULT_LOCALIZATION.locale),
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
  });
  setActiveVitalDisplay(preferences?.formats?.vitalDisplay);
  setCatalogLabelPreferences({
    preferArabicCatalogLabels: !!preferences?.arabicIslamic?.preferArabicCatalogLabels,
  });
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APP_PREFERENCES_EVENT, { detail: preferences }));
}
