/**
 * Reads the user's saved import defaults from app preferences.
 *
 * Wrapped in try/catch so the importer keeps working even if the
 * preferences store can't be opened (e.g. private-mode IndexedDB
 * restrictions). Falls back to the auto/review defaults that match the
 * factory settings.
 */
import { getAppPreferences } from '../appPreferences.js';

export async function getPreferredGedcomEncoding() {
  try {
    const prefs = await getAppPreferences();
    return prefs?.importDefaults?.gedcomEncoding || 'auto';
  } catch {
    return 'auto';
  }
}

export async function getPreferredGedcomMode() {
  try {
    const prefs = await getAppPreferences();
    return prefs?.importDefaults?.gedcomMode || 'review';
  } catch {
    return 'review';
  }
}
