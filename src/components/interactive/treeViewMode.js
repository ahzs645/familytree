export const TREE_VIEW_MODE_STORAGE_KEY = 'cloudtreeweb:interactive-tree-view-mode';
export const TREE_VIEW_MODE_STORAGE_VERSION = 2;

export const TREE_VIEW_MODES = ['three', 'sun', 'family', 'canvas', 'details'];

export function normalizeTreeViewMode(value, fallback = 'three') {
  return TREE_VIEW_MODES.includes(value) ? value : fallback;
}

export function readInitialTreeViewMode(searchParams) {
  const requested = normalizeTreeViewMode(searchParams?.get?.('view'), null);
  if (requested) return requested;
  if (typeof window === 'undefined') return 'three';
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TREE_VIEW_MODE_STORAGE_KEY) || 'null');
    if (parsed?.version !== TREE_VIEW_MODE_STORAGE_VERSION) return 'three';
    return normalizeTreeViewMode(parsed.viewMode);
  } catch {
    return 'three';
  }
}

export function persistTreeViewMode(viewMode) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeTreeViewMode(viewMode, null);
  if (!normalized) return;
  try {
    window.localStorage.setItem(TREE_VIEW_MODE_STORAGE_KEY, JSON.stringify({
      version: TREE_VIEW_MODE_STORAGE_VERSION,
      viewMode: normalized,
    }));
  } catch {
    // Persisting view preference is optional.
  }
}
