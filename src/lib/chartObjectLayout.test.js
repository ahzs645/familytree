import { describe, expect, it } from 'vitest';
import { computePageBreakAdjustments, rectsIntersect } from './chartObjectLayout.js';

const pageSetup = {
  width: 200,
  height: 160,
  margins: { top: 10, right: 10, bottom: 10, left: 10 },
};

describe('computePageBreakAdjustments', () => {
  it('nudges a box crossing a vertical page break by the smallest distance', () => {
    const result = computePageBreakAdjustments([
      { id: 'p1', kind: 'person', bounds: { x: 170, y: 20, width: 40, height: 40 } },
    ], pageSetup, { x: 0, y: 0, width: 400, height: 140 });

    expect(result).toEqual([{ id: 'p1', kind: 'person', dx: 10, dy: 0 }]);
  });

  it('nudges on both axes when an object crosses two page breaks', () => {
    const result = computePageBreakAdjustments([
      { id: 'note', kind: 'overlay', bounds: { x: 170, y: 130, width: 40, height: 30 } },
    ], pageSetup, { x: 0, y: 0, width: 400, height: 300 });

    expect(result).toEqual([{ id: 'note', kind: 'overlay', dx: 10, dy: 10 }]);
  });

  it('does not move objects already contained by a page or too large to fit', () => {
    const result = computePageBreakAdjustments([
      { id: 'inside', kind: 'person', bounds: { x: 20, y: 20, width: 40, height: 40 } },
      { id: 'huge', kind: 'overlay', bounds: { x: 20, y: 20, width: 190, height: 40 } },
    ], pageSetup, { x: 0, y: 0, width: 400, height: 140 });

    expect(result).toEqual([]);
  });

  it('treats overlap as reusable page area', () => {
    const result = computePageBreakAdjustments([
      { id: 'overlap-fit', kind: 'person', bounds: { x: 160, y: 20, width: 30, height: 40 } },
    ], { ...pageSetup, overlap: 30 }, { x: 0, y: 0, width: 400, height: 140 });

    expect(result).toEqual([]);
  });
});

describe('rectsIntersect', () => {
  it('requires positive area overlap', () => {
    expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 9, y: 9, width: 2, height: 2 })).toBe(true);
    expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 2, height: 2 })).toBe(false);
  });
});
