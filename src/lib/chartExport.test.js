import { describe, expect, it } from 'vitest';
import { buildChartPagePlan, safeFilename } from './chartExport.js';

describe('buildChartPagePlan', () => {
  const page = {
    width: 200,
    height: 160,
    margins: { top: 10, right: 10, bottom: 10, left: 10 },
  };

  it('creates row-major physical page tiles using margins and overlap', () => {
    const plan = buildChartPagePlan({ x: 0, y: 0, width: 400, height: 240 }, { ...page, overlap: 20 });
    expect(plan.dimensions).toMatchObject({ width: 200, height: 160 });
    expect(plan.margins).toEqual({ top: 10, right: 10, bottom: 10, left: 10 });
    expect(plan.tiles).toHaveLength(6);
    expect(plan.tiles.map((tile) => [tile.row, tile.col])).toEqual([
      [0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2],
    ]);
  });

  it('omits empty tiles and renumbers the remaining pages', () => {
    const plan = buildChartPagePlan(
      { x: 0, y: 0, width: 360, height: 140 },
      { ...page, omitEmptyPages: true },
      [{ x: 200, y: 20, width: 20, height: 20 }],
    );
    expect(plan.tiles).toHaveLength(1);
    expect(plan.tiles[0].pageNumber).toBe(1);
    expect(plan.tiles[0].col).toBe(1);
  });

  it('keeps empty tiles when omission is disabled', () => {
    const plan = buildChartPagePlan(
      { x: 0, y: 0, width: 360, height: 140 },
      { ...page, omitEmptyPages: false },
      [{ x: 200, y: 20, width: 20, height: 20 }],
    );
    expect(plan.tiles).toHaveLength(2);
  });
});

describe('safeFilename', () => {
  it('normalizes unsafe filename characters', () => {
    expect(safeFilename('Family / Chart', 'pdf')).toBe('Family_Chart.pdf');
  });
});
