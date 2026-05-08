import { afterEach, describe, expect, it } from 'vitest';
import {
  TREE_VIEW_MODE_STORAGE_KEY,
  TREE_VIEW_MODE_STORAGE_VERSION,
  normalizeTreeViewMode,
  persistTreeViewMode,
  readInitialTreeViewMode,
} from './treeViewMode.js';

afterEach(() => {
  globalThis.window = undefined;
});

describe('treeViewMode', () => {
  it('defaults to the 3D tree view', () => {
    expect(normalizeTreeViewMode('missing')).toBe('three');
    expect(readInitialTreeViewMode(new URLSearchParams())).toBe('three');
  });

  it('accepts supported URL view modes', () => {
    expect(readInitialTreeViewMode(new URLSearchParams('view=canvas'))).toBe('canvas');
    expect(readInitialTreeViewMode(new URLSearchParams('view=three'))).toBe('three');
  });

  it('ignores legacy unversioned stored modes', () => {
    const store = new Map([[TREE_VIEW_MODE_STORAGE_KEY, 'canvas']]);
    globalThis.window = { localStorage: makeLocalStorage(store) };
    expect(readInitialTreeViewMode(new URLSearchParams())).toBe('three');
  });

  it('persists and restores versioned supported modes', () => {
    const store = new Map();
    globalThis.window = { localStorage: makeLocalStorage(store) };
    persistTreeViewMode('canvas');
    expect(JSON.parse(store.get(TREE_VIEW_MODE_STORAGE_KEY))).toEqual({
      version: TREE_VIEW_MODE_STORAGE_VERSION,
      viewMode: 'canvas',
    });
    expect(readInitialTreeViewMode(new URLSearchParams())).toBe('canvas');
  });
});

function makeLocalStorage(store) {
  return {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, value),
  };
}
