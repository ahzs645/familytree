/**
 * Localizer — handles loading and resolving localized strings.
 * Was `Se` / `Te` in the minified code.
 *
 * Loads .strings files from /localizations/{lang}.lproj/ and provides
 * a localize(key, table) function used throughout the app as `_a(key, table)`.
 */

export class Localizer {
  constructor(appController) {
    this.appController = appController;
    this.onLocalizationChange = null;
    this._locale = 'en';
    this._strings = {};
    this._loadedTables = new Set();
  }

  locale() {
    return this._locale;
  }

  setLocale(locale) {
    this._locale = locale;
    this._strings = {};
    this._loadedTables.clear();
    if (this.onLocalizationChange) {
      this.onLocalizationChange();
    }
  }

  /**
   * Localize a key from a string table.
   * @param {string} key - The localization key (e.g., '_PersonsList_Title')
   * @param {string} table - The string table name (e.g., 'CoreCloudTreeWeb')
   * @returns {string} The localized string, or the key if not found.
   */
  localize(key, table) {
    if (!key) return '';
    this._ensureTableLoaded(table);
    const tableStrings = this._strings[table];
    if (tableStrings && tableStrings[key]) {
      return tableStrings[key];
    }
    // Strip leading underscore and convert to readable form
    return key.replace(/^_/, '').replace(/_/g, ' ');
  }

  _ensureTableLoaded(table) {
    if (!table || this._loadedTables.has(table)) return;
    this._loadedTables.add(table);

    // Load asynchronously (fire-and-forget, will re-render when done)
    const lang = this._locale || 'en';
    const url = `/localizations/${lang}.lproj/${table}.strings`;

    fetch(url)
      .then((r) => (r.ok ? r.text() : null))
      .then((text) => {
        if (text) {
          this._strings[table] = parseStringsFile(text);
          if (this.onLocalizationChange) {
            this.onLocalizationChange();
          }
        }
      })
      .catch(() => {});
  }
}

/**
 * Parse an Apple .strings file into a key-value object.
 * Format: "key" = "value";
 */
function parseStringsFile(text) {
  const result = {};
  const regex = /"([^"\\]*(?:\\.[^"\\]*)*)"\s*=\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*;/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    result[match[1]] = match[2].replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }
  return result;
}

export default Localizer;
