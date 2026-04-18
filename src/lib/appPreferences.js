import { getLocalDatabase } from './LocalDatabase.js';
import { DEFAULT_FAVORITE_FUNCTIONS } from './functionCatalog.js';

const META_KEY = 'appPreferences';

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
    dateDisplayFormat: 'YYYY-MM-DD',
    readableDateFormats: 'YYYY-MM-DD\nDD MM YYYY\nMM/DD/YYYY',
  },
  appearance: {
    accentColor: '#2563eb',
    chartTheme: 'auto',
    reportBackground: 'none',
  },
  pdf: {
    pageSize: 'letter',
    orientation: 'portrait',
    margin: 48,
  },
  exportDefaults: {
    includePrivate: false,
    includeMedia: true,
    gedcomEncoding: 'utf-8',
    websiteTheme: 'classic',
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
  return normalizePreferences(await db.getMeta(META_KEY));
}

export async function saveAppPreferences(next) {
  const db = getLocalDatabase();
  const normalized = normalizePreferences(next);
  await db.setMeta(META_KEY, normalized);
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
  merged.pdf.margin = clampNumber(merged.pdf.margin, 12, 144, DEFAULT_APP_PREFERENCES.pdf.margin);
  merged.webSearch.openInNewTab = merged.webSearch.openInNewTab !== false;
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
