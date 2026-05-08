import en from '../locales/en.json';
import ar from '../locales/ar.json';
import { DEFAULT_LOCALIZATION, languageCode, resolveLocalization } from './i18n.js';

export const MESSAGE_CATALOGS = { en, ar };

export function catalogForLocale(locale) {
  const lang = languageCode(locale || DEFAULT_LOCALIZATION.locale);
  return MESSAGE_CATALOGS[lang] || MESSAGE_CATALOGS.en;
}

export function getMessage(catalog, key) {
  return String(key || '').split('.').reduce((cursor, part) => (
    cursor && Object.prototype.hasOwnProperty.call(cursor, part) ? cursor[part] : undefined
  ), catalog);
}

export function translate(key, params = {}, options = {}) {
  const localization = resolveLocalization(options.localization || {});
  const catalog = catalogForLocale(localization.locale);
  const fallbackCatalog = MESSAGE_CATALOGS.en;
  const raw = getMessage(catalog, key) ?? getMessage(fallbackCatalog, key);
  if (raw == null) {
    // When the key is missing from every catalog, prefer the caller's
    // defaultValue (passed via params.defaultValue) over showing the raw key.
    if (params && Object.prototype.hasOwnProperty.call(params, 'defaultValue')) {
      return interpolate(String(params.defaultValue ?? ''), params);
    }
    return String(key || '');
  }
  const value = typeof raw === 'object' && raw !== null
    ? pluralMessage(raw, params.count, localization.locale)
    : raw;
  return interpolate(String(value), params);
}

function pluralMessage(forms, count, locale) {
  const category = new Intl.PluralRules(locale).select(Number(count ?? 0));
  return forms[category] ?? forms.other ?? forms.one ?? Object.values(forms)[0] ?? '';
}

function interpolate(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (_match, name) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : ''
  ));
}

export function flattenKeys(object, prefix = '') {
  const out = [];
  for (const [key, value] of Object.entries(object || {})) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !isPluralObject(value)) out.push(...flattenKeys(value, next));
    else out.push(next);
  }
  return out;
}

function isPluralObject(value) {
  const pluralKeys = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
  return Object.keys(value || {}).some((key) => pluralKeys.has(key));
}
