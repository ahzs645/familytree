// @ts-check
import { collectRelatives } from './relationshipPath.js';

export const RELATION_SET_IDS = [
  'ancestors',
  'descendants',
  'siblings',
  'immediateFamily',
  'ancestorsAndDescendants',
  'wholeBranch',
];

/**
 * @typedef {{ id: string, steps: Array<{ edgeFromPrev?: string | null }> }} RelativePath
 * @typedef {{ relationSet?: string, generations?: number, includeRoot?: boolean }} RelativeSelectionOptions
 */

/** @param {RelativePath} relative */
function edgesFor(relative) {
  return (relative?.steps || []).slice(1).map((step) => step.edgeFromPrev);
}

/**
 * @param {string} rootId
 * @param {RelativePath[]} relatives
 * @param {RelativeSelectionOptions} [options]
 */
export function selectRelativeIds(rootId, relatives, { relationSet = 'ancestors', generations = 5, includeRoot = true } = {}) {
  const depth = Math.max(1, Math.min(15, Number(generations) || 1));
  const selected = new Set(includeRoot && rootId ? [rootId] : []);
  for (const relative of relatives || []) {
    const edges = edgesFor(relative);
    if (!relative?.id || edges.length === 0 || edges.length > depth) continue;
    const allParents = edges.every((edge) => edge === 'parent');
    const allChildren = edges.every((edge) => edge === 'child');
    const sibling = edges.length === 2 && edges[0] === 'parent' && edges[1] === 'child';
    const immediate = edges.length === 1;
    const wanted = relationSet === 'ancestors' ? allParents
      : relationSet === 'descendants' ? allChildren
        : relationSet === 'siblings' ? sibling
          : relationSet === 'immediateFamily' ? immediate
            : relationSet === 'ancestorsAndDescendants' ? allParents || allChildren
              : relationSet === 'wholeBranch';
    if (wanted) selected.add(relative.id);
  }
  return selected;
}

/** @param {string} rootId @param {RelativeSelectionOptions} [options] */
export async function resolveRelativeSelection(rootId, options = {}) {
  if (!rootId) return new Set();
  const generations = Math.max(1, Math.min(15, Number(options.generations) || 5));
  const relatives = await collectRelatives(rootId, {
    maxDepth: generations,
    includeSpouses: options.relationSet === 'wholeBranch' || options.relationSet === 'immediateFamily',
  });
  return selectRelativeIds(rootId, relatives, { ...options, generations });
}
