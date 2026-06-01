import { afterEach, beforeAll, describe, expect, it } from 'vitest';

// Shim browser globals before importing the module under test. treeLibrary
// only touches them inside its functions (not at import time), so as long as
// the globals exist when the functions run, the imports succeed.
function memoryStorage() {
  const map = new Map();
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    clear() { map.clear(); },
  };
}

const dispatched = [];
const eventTarget = {
  dispatchEvent(event) { dispatched.push(event); return true; },
  addEventListener() {},
  removeEventListener() {},
};

beforeAll(() => {
  globalThis.localStorage = memoryStorage();
  globalThis.window = eventTarget;
  if (typeof globalThis.CustomEvent !== 'function') {
    globalThis.CustomEvent = class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    };
  }
});

afterEach(() => {
  dispatched.length = 0;
  globalThis.localStorage.clear();
});

// Import after the shims are in place. Static imports work because treeLibrary
// only reads localStorage/window inside its function bodies.
const { ACTIVE_TREE_CHANGED_EVENT, getActiveTreeId, setActiveTreeId } = await import('./treeLibrary.js');

describe('treeLibrary active-tree pointer', () => {
  it('returns null when no active tree has been set', () => {
    expect(getActiveTreeId()).toBeNull();
  });

  it('round-trips through setActiveTreeId', () => {
    setActiveTreeId('tree-abc');
    expect(getActiveTreeId()).toBe('tree-abc');
  });

  it('clears the pointer when set to null', () => {
    setActiveTreeId('tree-xyz');
    setActiveTreeId(null);
    expect(getActiveTreeId()).toBeNull();
  });

  it('dispatches a change event carrying the new id (or null) on every set', () => {
    setActiveTreeId('tree-evt');
    setActiveTreeId(null);
    const ids = dispatched
      .filter((e) => e.type === ACTIVE_TREE_CHANGED_EVENT)
      .map((e) => e.detail?.id);
    expect(ids).toEqual(['tree-evt', null]);
  });
});
