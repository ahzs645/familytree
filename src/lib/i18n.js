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
const ARABIC_CHAR_RE = /[\u0600-\u06ff\ufb50-\ufdff\ufe70-\ufefc]/;
const ARABIC_DIACRITICS_RE = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g;
const COMBINING_MARK_RE = /\p{M}/gu;
const SEARCH_SPLIT_RE = /[^\p{L}\p{N}@_-]+/u;
const LATIN_VOWELS_RE = /[aeiou]/g;
const ARABIZI_CHAR_MAP = Object.freeze({
  2: 'a',
  3: 'a',
  5: 'kh',
  6: 't',
  7: 'h',
  8: 'gh',
  9: 's',
});
const ARABIC_ROMANIZATION = Object.freeze({
  ا: 'a',
  ب: 'b',
  ت: 't',
  ث: 'th',
  ج: 'j',
  ح: 'h',
  خ: 'kh',
  د: 'd',
  ذ: 'dh',
  ر: 'r',
  ز: 'z',
  س: 's',
  ش: 'sh',
  ص: 's',
  ض: 'd',
  ط: 't',
  ظ: 'z',
  ع: 'a',
  غ: 'gh',
  ف: 'f',
  ق: 'q',
  ك: 'k',
  ل: 'l',
  م: 'm',
  ن: 'n',
  ه: 'h',
  و: 'u',
  ي: 'i',
  ء: '',
 });
const COMMON_ARABIC_NAME_VARIANTS = [
  ['احمد', 'ahmad', 'ahmed', 'achmad', 'achmed'],
  ['محمد', 'muhammad', 'mohammad', 'mohammed', 'mohamed', 'mohamad', 'muhamad'],
  ['محمود', 'mahmoud', 'mahmood', 'mahmud'],
  ['عبد', 'abd', 'abdel', 'abdul', 'abdal'],
  ['الله', 'allah', 'alla'],
  ['علي', 'ali', 'aly'],
  ['حسن', 'hasan', 'hassan'],
  ['حسين', 'hussein', 'hussain', 'husayn', 'hosein'],
  ['ابراهيم', 'ibrahim', 'ibraheem', 'ebraheem', 'ebrahim'],
  ['اسماعيل', 'ismail', 'ismael', 'ismaeel'],
  ['يوسف', 'yusuf', 'yousef', 'youssef', 'yosef'],
  ['يونس', 'yunus', 'younes', 'younis'],
  ['عمر', 'omar', 'umar'],
  ['عثمان', 'othman', 'osman', 'uthman'],
  ['خالد', 'khaled', 'khalid'],
  ['طارق', 'tariq', 'tarek', 'tarik'],
  ['جمال', 'jamal', 'gamal'],
  ['جليل', 'jalil', 'jaleel', 'galil'],
  ['رعد', 'raad', 'rad'],
  ['سعيد', 'saeed', 'said', 'sayeed'],
  ['سعد', 'saad', 'sad'],
  ['مصطفي', 'mustafa', 'mustapha', 'mostafa', 'moustafa'],
  ['فاطمه', 'fatima', 'fatimah', 'fatma'],
  ['عائشه', 'aisha', 'aysha', 'ayesha', 'aishah'],
  ['خديجه', 'khadija', 'khadijah', 'khadeeja'],
  ['مريم', 'maryam', 'mariam', 'meryem'],
  ['زينب', 'zainab', 'zeinab', 'zaynab'],
  ['امنه', 'amina', 'aminah', 'amena'],
  ['هاشمي', 'hashimi', 'hashemi', 'hashimy'],
];
const NAME_ALIAS_GROUPS = COMMON_ARABIC_NAME_VARIANTS.map((group) => [...new Set(group)]);
const NAME_ALIAS_INDEX = new Map();
for (const group of NAME_ALIAS_GROUPS) {
  for (const alias of group) NAME_ALIAS_INDEX.set(normalizeSearchText(alias, DEFAULT_LOCALIZATION), group);
}

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

function tokenizeNormalizedSearchText(value, localization = getCurrentLocalization()) {
  return normalizeSearchText(value, localization)
    .split(SEARCH_SPLIT_RE)
    .map((token) => token.trim())
    .filter(Boolean);
}

function latinPhoneticKey(value) {
  return expandArabizi(String(value || ''))
    .replace(/[^a-z0-9]+/g, '')
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/ou/g, 'u')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/q/g, 'k')
    .replace(LATIN_VOWELS_RE, '');
}

function expandArabizi(value) {
  return String(value || '').replace(/[2356789]/g, (char) => ARABIZI_CHAR_MAP[char] || char);
}

function romanizeArabicToken(token) {
  let out = '';
  for (const char of token) out += ARABIC_ROMANIZATION[char] ?? char;
  return out.replace(/[^a-z0-9]+/g, '');
}

function addVariant(variants, value, localization = getCurrentLocalization()) {
  const normalized = normalizeSearchText(value, localization);
  if (!normalized) return;
  variants.add(normalized);
  const arabizi = expandArabizi(normalized);
  if (arabizi) variants.add(arabizi);
  const key = latinPhoneticKey(arabizi || normalized);
  if (key) variants.add(key);
}

function addAliasGroupVariants(token, variants, localization = getCurrentLocalization()) {
  const group = NAME_ALIAS_INDEX.get(token);
  if (!group) return;
  for (const alias of group) addVariant(variants, alias, localization);
}

function addArabicTokenVariants(token, variants, localization = getCurrentLocalization()) {
  const romanized = romanizeArabicToken(token);
  addVariant(variants, romanized, localization);
  addAliasGroupVariants(token, variants, localization);

  if (token.startsWith('ال') && token.length > 2) {
    addArabicTokenVariants(token.slice(2), variants, localization);
  }
  if (romanized.startsWith('al') && romanized.length > 2) {
    addVariant(variants, romanized.slice(2), localization);
  }
}

export function searchTokenVariants(token, localization = getCurrentLocalization()) {
  const normalized = normalizeSearchText(token, localization);
  if (!normalized) return [];
  const variants = new Set([normalized]);
  if (ARABIC_CHAR_RE.test(normalized)) {
    addArabicTokenVariants(normalized, variants, localization);
  } else {
    addVariant(variants, normalized, localization);
    addAliasGroupVariants(normalized, variants, localization);
  }
  return [...variants].filter((variant) => variant.length >= 1);
}

export function searchTextForms(value, localization = getCurrentLocalization()) {
  const normalized = normalizeSearchText(value, localization);
  const forms = new Set([normalized]);
  const expandedTokens = [];
  for (const token of tokenizeNormalizedSearchText(value, localization)) {
    const variants = searchTokenVariants(token, localization);
    expandedTokens.push(...variants);
  }
  if (expandedTokens.length) forms.add(expandedTokens.join(' '));
  return [...forms].filter(Boolean);
}

function searchTokenVariantGroups(value, localization = getCurrentLocalization()) {
  return tokenizeNormalizedSearchText(value, localization)
    .map((token) => searchTokenVariants(token, localization));
}

function variantGroupsMatch(leftGroups, rightGroups, length = leftGroups.length) {
  for (let i = 0; i < length; i += 1) {
    const left = leftGroups[i] || [];
    const right = new Set(rightGroups[i] || []);
    if (!left.some((variant) => right.has(variant))) return false;
  }
  return true;
}

export function matchesSearchText(rawValue, query, localization = getCurrentLocalization()) {
  const target = normalizeSearchText(query, localization);
  if (!target) return true;
  const forms = searchTextForms(rawValue, localization);
  if (forms.some((form) => form.includes(target))) return true;

  const queryTokenGroups = searchTokenVariantGroups(query, localization);
  if (!queryTokenGroups.length) return true;
  return queryTokenGroups.every((variants) => (
    variants.some((variant) => forms.some((form) => form.includes(variant)))
  ));
}

export function startsWithSearchText(rawValue, query, localization = getCurrentLocalization()) {
  const target = normalizeSearchText(query, localization);
  if (searchTextForms(rawValue, localization).some((form) => form.startsWith(target))) return true;
  const rawGroups = searchTokenVariantGroups(rawValue, localization);
  const queryGroups = searchTokenVariantGroups(query, localization);
  return queryGroups.length > 0
    && queryGroups.length <= rawGroups.length
    && variantGroupsMatch(queryGroups, rawGroups, queryGroups.length);
}

export function equalsSearchText(rawValue, query, localization = getCurrentLocalization()) {
  if (normalizeSearchText(rawValue, localization) === normalizeSearchText(query, localization)) return true;
  const rawGroups = searchTokenVariantGroups(rawValue, localization);
  const queryGroups = searchTokenVariantGroups(query, localization);
  return queryGroups.length > 0
    && queryGroups.length === rawGroups.length
    && variantGroupsMatch(queryGroups, rawGroups);
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
