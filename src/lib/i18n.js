export const APP_LOCALIZATION_STORAGE_KEY = 'cloudtreeweb:localization';

export const DEFAULT_LOCALIZATION = {
  locale: 'en',
  direction: 'auto',
  numberingSystem: 'auto',
  calendar: 'gregory',
};

export const SUPPORTED_LOCALES = [
  { value: 'en', label: 'English', nativeLabel: 'English' },
  { value: 'ar', label: 'Arabic', nativeLabel: 'العربية' },
];

export const DIRECTION_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'ltr', label: 'Left to right' },
  { value: 'rtl', label: 'Right to left' },
];

export const NUMBERING_SYSTEM_OPTIONS = [
  { value: 'auto', label: 'Locale default' },
  { value: 'latn', label: 'Latin digits' },
  { value: 'arab', label: 'Arabic-Indic digits' },
  { value: 'arabext', label: 'Extended Arabic-Indic digits' },
];

export const CALENDAR_OPTIONS = [
  { value: 'gregory', label: 'Gregorian' },
  { value: 'islamic', label: 'Islamic' },
  { value: 'islamic-umalqura', label: 'Islamic Umm al-Qura' },
];

const RTL_LANGUAGE_CODES = new Set(['ar', 'arc', 'ckb', 'dv', 'fa', 'he', 'ku', 'ps', 'syr', 'ur', 'yi']);
const RTL_CHAR_RE = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/;
const ARABIC_DIACRITICS_RE = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g;
const COMBINING_MARK_RE = /\p{M}/gu;

export function normalizeLocale(locale) {
  const raw = String(locale || DEFAULT_LOCALIZATION.locale).trim();
  if (!raw) return DEFAULT_LOCALIZATION.locale;
  try {
    return Intl.getCanonicalLocales(raw)[0] || DEFAULT_LOCALIZATION.locale;
  } catch {
    return raw.toLowerCase();
  }
}

export function languageCode(locale) {
  return normalizeLocale(locale).split('-')[0].toLowerCase();
}

export function directionForLocale(locale, override = 'auto') {
  if (override === 'ltr' || override === 'rtl') return override;
  return RTL_LANGUAGE_CODES.has(languageCode(locale)) ? 'rtl' : 'ltr';
}

export function resolveLocalization(value = {}) {
  const locale = normalizeLocale(value.locale || DEFAULT_LOCALIZATION.locale);
  const rawDirection = value.direction || DEFAULT_LOCALIZATION.direction;
  const directionPreference = rawDirection === 'ltr' || rawDirection === 'rtl' ? rawDirection : 'auto';
  const direction = directionForLocale(locale, directionPreference);
  const numberingSystem = value.numberingSystem || DEFAULT_LOCALIZATION.numberingSystem;
  const calendar = value.calendar || DEFAULT_LOCALIZATION.calendar;
  return { locale, direction, numberingSystem, calendar };
}

export function localeWithExtensions(value = {}) {
  const localization = resolveLocalization(value);
  const extensions = [];
  if (localization.calendar && localization.calendar !== 'auto' && localization.calendar !== 'gregory') {
    extensions.push('ca', localization.calendar);
  }
  if (localization.numberingSystem && localization.numberingSystem !== 'auto') {
    extensions.push('nu', localization.numberingSystem);
  }
  return extensions.length ? `${localization.locale}-u-${extensions.join('-')}` : localization.locale;
}

export function persistLocalization(value = {}) {
  if (typeof localStorage === 'undefined') return;
  try {
    const locale = normalizeLocale(value.locale || DEFAULT_LOCALIZATION.locale);
    localStorage.setItem(APP_LOCALIZATION_STORAGE_KEY, JSON.stringify({
      locale,
      direction: value.direction === 'ltr' || value.direction === 'rtl' ? value.direction : DEFAULT_LOCALIZATION.direction,
      numberingSystem: value.numberingSystem || DEFAULT_LOCALIZATION.numberingSystem,
      calendar: value.calendar || DEFAULT_LOCALIZATION.calendar,
    }));
  } catch {
    /* localStorage can be unavailable in private contexts */
  }
}

export function readStoredLocalization() {
  if (typeof localStorage === 'undefined') return DEFAULT_LOCALIZATION;
  try {
    return resolveLocalization(JSON.parse(localStorage.getItem(APP_LOCALIZATION_STORAGE_KEY) || 'null') || {});
  } catch {
    return DEFAULT_LOCALIZATION;
  }
}

export function applyDocumentLocalization(value = {}) {
  if (typeof document === 'undefined') return resolveLocalization(value);
  const localization = resolveLocalization(value);
  document.documentElement.lang = localization.locale;
  document.documentElement.dir = localization.direction;
  persistLocalization(value);
  return localization;
}

export function getCurrentLocalization() {
  if (typeof document === 'undefined') return DEFAULT_LOCALIZATION;
  const stored = readStoredLocalization();
  return resolveLocalization({
    ...stored,
    locale: document.documentElement.lang || stored.locale || DEFAULT_LOCALIZATION.locale,
    direction: document.documentElement.dir || stored.direction || DEFAULT_LOCALIZATION.direction,
  });
}

export function createCollator(value = {}, options = {}) {
  const localization = resolveLocalization(value);
  return new Intl.Collator(localization.locale, {
    numeric: true,
    sensitivity: 'base',
    ...options,
  });
}

export function compareStrings(a, b, value = {}, options = {}) {
  return createCollator(value, options).compare(String(a || ''), String(b || ''));
}

export function formatNumber(value, localization = getCurrentLocalization(), options = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  return new Intl.NumberFormat(localeWithExtensions(localization), options).format(n);
}

export function formatInteger(value, localization = getCurrentLocalization()) {
  return formatNumber(value, localization, { maximumFractionDigits: 0 });
}

export function normalizeSearchText(value, localization = getCurrentLocalization()) {
  const locale = resolveLocalization(localization).locale;
  return String(value ?? '')
    .normalize('NFKD')
    .replace(COMBINING_MARK_RE, '')
    .replace(ARABIC_DIACRITICS_RE, '')
    .replace(/\u0640/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ي')
    .replace(/[ى]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .replace(/[\u200c\u200d]/g, '')
    .toLocaleLowerCase(locale)
    .trim();
}

export function matchesSearchText(rawValue, query, localization = getCurrentLocalization()) {
  const target = normalizeSearchText(query, localization);
  if (!target) return true;
  return normalizeSearchText(rawValue, localization).includes(target);
}

export function startsWithSearchText(rawValue, query, localization = getCurrentLocalization()) {
  return normalizeSearchText(rawValue, localization).startsWith(normalizeSearchText(query, localization));
}

export function equalsSearchText(rawValue, query, localization = getCurrentLocalization()) {
  return normalizeSearchText(rawValue, localization) === normalizeSearchText(query, localization);
}

export function textDirection(value, fallback = 'ltr') {
  const text = String(value ?? '');
  for (const char of text) {
    if (RTL_CHAR_RE.test(char)) return 'rtl';
    if (/[A-Za-z]/.test(char)) return 'ltr';
  }
  return fallback;
}

export function graphemes(value) {
  const text = String(value ?? '');
  if (!text) return [];
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map((part) => part.segment);
    } catch {
      /* fall through */
    }
  }
  return Array.from(text);
}

export function truncateGraphemes(value, maxLength) {
  const parts = graphemes(value);
  if (parts.length <= maxLength) return String(value ?? '');
  return `${parts.slice(0, Math.max(0, maxLength - 1)).join('')}…`;
}

export function wrapGraphemes(value, maxPerLine, maxLines = 2) {
  const text = String(value ?? '').trim();
  if (!text) return [''];
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  const pushCurrent = () => {
    if (!current) return;
    lines.push(current);
    current = '';
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (graphemes(candidate).length <= maxPerLine) {
      current = candidate;
      continue;
    }
    pushCurrent();
    if (graphemes(word).length <= maxPerLine) {
      current = word;
      continue;
    }
    let remaining = word;
    while (remaining && lines.length < maxLines - 1) {
      const part = graphemes(remaining);
      lines.push(part.slice(0, maxPerLine).join(''));
      remaining = part.slice(maxPerLine).join('');
    }
    current = remaining;
  }
  pushCurrent();

  const bounded = lines.map((line) => (
    graphemes(line).length > maxPerLine ? truncateGraphemes(line, maxPerLine) : line
  ));
  if (bounded.length <= maxLines) return bounded;
  const visible = bounded.slice(0, maxLines);
  visible[maxLines - 1] = truncateGraphemes(visible[maxLines - 1], Math.max(1, maxPerLine));
  return visible;
}
