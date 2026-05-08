import { describe, expect, it } from 'vitest';
import { normalizeTreeViewMode, readInitialTreeViewMode } from './treeViewMode.js';

describe('treeViewMode', () => {
  it('defaults to the 3D tree view', () => {
    expect(normalizeTreeViewMode('missing')).toBe('three');
    expect(readInitialTreeViewMode(new URLSearchParams())).toBe('three');
  });

  it('accepts supported URL view modes', () => {
    expect(readInitialTreeViewMode(new URLSearchParams('view=canvas'))).toBe('canvas');
    expect(readInitialTreeViewMode(new URLSearchParams('view=three'))).toBe('three');
  });
});
