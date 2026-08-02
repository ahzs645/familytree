import { describe, expect, it } from 'vitest';
import {
  EDITOR_ALWAYS_EDIT_KEY,
  isEditModeShortcut,
  readAlwaysEditPreference,
  writeAlwaysEditPreference,
} from './editorMode.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    values,
  };
}

describe('editor mode preferences', () => {
  it('persists the always-edit preference', () => {
    const storage = memoryStorage();
    writeAlwaysEditPreference(true, storage);
    expect(storage.values.get(EDITOR_ALWAYS_EDIT_KEY)).toBe('true');
    expect(readAlwaysEditPreference(storage)).toBe(true);
    writeAlwaysEditPreference(false, storage);
    expect(readAlwaysEditPreference(storage)).toBe(false);
  });

  it('recognizes Command/Ctrl+E without hijacking modified shortcuts', () => {
    expect(isEditModeShortcut({ key: 'e', metaKey: true })).toBe(true);
    expect(isEditModeShortcut({ key: 'E', ctrlKey: true })).toBe(true);
    expect(isEditModeShortcut({ key: 'e', ctrlKey: true, shiftKey: true })).toBe(false);
    expect(isEditModeShortcut({ key: 'e' })).toBe(false);
  });
});

