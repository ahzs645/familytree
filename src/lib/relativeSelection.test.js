import { describe, expect, it } from 'vitest';
import { selectRelativeIds } from './relativeSelection.js';

const relative = (id, edges) => ({
  id,
  steps: [{ recordName: 'root', edgeFromPrev: null }, ...edges.map((edge, index) => ({ recordName: `${id}-${index}`, edgeFromPrev: edge }))],
});

const rows = [
  relative('parent', ['parent']),
  relative('grandparent', ['parent', 'parent']),
  relative('child', ['child']),
  relative('grandchild', ['child', 'child']),
  relative('sibling', ['parent', 'child']),
  relative('spouse', ['spouse']),
  relative('cousin', ['parent', 'parent', 'child', 'child']),
];

describe('relative set selection', () => {
  it('selects bounded ancestor and descendant lines', () => {
    expect([...selectRelativeIds('root', rows, { relationSet: 'ancestors', generations: 1 })]).toEqual(['root', 'parent']);
    expect([...selectRelativeIds('root', rows, { relationSet: 'descendants', generations: 2 })]).toEqual(['root', 'child', 'grandchild']);
  });

  it('selects siblings, immediate family, and a whole branch', () => {
    expect([...selectRelativeIds('root', rows, { relationSet: 'siblings' })]).toEqual(['root', 'sibling']);
    expect([...selectRelativeIds('root', rows, { relationSet: 'immediateFamily' })]).toEqual(['root', 'parent', 'child', 'spouse']);
    expect(selectRelativeIds('root', rows, { relationSet: 'wholeBranch', generations: 4 }).size).toBe(8);
  });
});
