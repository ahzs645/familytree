// @ts-check

export const EDITOR_ALWAYS_EDIT_KEY = 'cloudtreeweb.editor.alwaysEdit';

/** @param {{ getItem: (key: string) => string | null } | undefined} storage */
export function readAlwaysEditPreference(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(EDITOR_ALWAYS_EDIT_KEY) === 'true';
  } catch {
    return false;
  }
}

/** @param {boolean} value @param {{ setItem: (key: string, value: string) => void } | undefined} storage */
export function writeAlwaysEditPreference(value, storage = globalThis.localStorage) {
  try {
    storage?.setItem(EDITOR_ALWAYS_EDIT_KEY, value ? 'true' : 'false');
  } catch {
    // Storage may be unavailable in private browsing. The in-memory state still works.
  }
}

/** @param {Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>} event */
export function isEditModeShortcut(event) {
  return Boolean(String(event?.key || '').toLowerCase() === 'e'
    && (event?.metaKey || event?.ctrlKey)
    && !event?.altKey
    && !event?.shiftKey);
}
