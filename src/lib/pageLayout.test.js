import { describe, expect, it } from 'vitest';
import {
  normalizePageDimensions,
  normalizeMargins,
  normalizeOverlap,
  getContentRect,
  computePageTiles,
  applyOmitEmptyPages,
  summarizePageLayout,
} from './pageLayout.js';

describe('pageLayout dimensions', () => {
  it('returns landscape letter by default', () => {
    const dims = normalizePageDimensions({});
    expect(dims.width).toBeGreaterThan(dims.height);
    expect(dims.paperSize).toBe('letter');
    expect(dims.orientation).toBe('landscape');
    expect(dims.isCustom).toBe(false);
  });

  it('switches to portrait when requested', () => {
    const dims = normalizePageDimensions({ paperSize: 'letter', orientation: 'portrait' });
    expect(dims.width).toBeLessThan(dims.height);
    expect(dims.orientation).toBe('portrait');
  });

  it('supports a4', () => {
    const dims = normalizePageDimensions({ paperSize: 'a4', orientation: 'portrait' });
    expect(dims.paperSize).toBe('a4');
    expect(dims.width).toBeLessThan(dims.height);
  });

  it('honors custom width/height', () => {
    const dims = normalizePageDimensions({ width: 500, height: 1200 });
    expect(dims.width).toBe(500);
    expect(dims.height).toBe(1200);
    expect(dims.isCustom).toBe(true);
    expect(dims.orientation).toBe('portrait');
  });

  it('falls back to letter when paperSize is unknown', () => {
    const dims = normalizePageDimensions({ paperSize: 'mystery' });
    expect(dims.paperSize).toBe('mystery');
    expect(dims.width).toBeGreaterThan(0);
    expect(dims.height).toBeGreaterThan(0);
  });
});

describe('pageLayout margins', () => {
  it('defaults all margins to 36px', () => {
    expect(normalizeMargins({})).toEqual({ top: 36, right: 36, bottom: 36, left: 36 });
  });

  it('clamps negative margins to 0', () => {
    const margins = normalizeMargins({ margins: { top: -10, right: -1, bottom: -5, left: -100 } });
    expect(margins).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('clamps very large margins to 400', () => {
    const margins = normalizeMargins({ margins: { top: 9999 } });
    expect(margins.top).toBe(400);
  });

  it('passes through valid margins', () => {
    const margins = normalizeMargins({ margins: { top: 10, right: 20, bottom: 30, left: 40 } });
    expect(margins).toEqual({ top: 10, right: 20, bottom: 30, left: 40 });
  });
});

describe('pageLayout overlap', () => {
  it('defaults overlap to 0', () => {
    expect(normalizeOverlap({})).toBe(0);
  });

  it('clamps overlap to 200', () => {
    expect(normalizeOverlap({ overlap: 5000 })).toBe(200);
  });

  it('rejects negative overlap', () => {
    expect(normalizeOverlap({ overlap: -10 })).toBe(0);
  });

  it('rounds fractional overlap', () => {
    expect(normalizeOverlap({ overlap: 12.7 })).toBe(13);
  });
});

describe('getContentRect', () => {
  it('subtracts margins from page dimensions', () => {
    const content = getContentRect({
      paperSize: 'letter',
      orientation: 'landscape',
      margins: { top: 50, right: 60, bottom: 70, left: 80 },
    });
    const full = normalizePageDimensions({ paperSize: 'letter', orientation: 'landscape' });
    expect(content.x).toBe(80);
    expect(content.y).toBe(50);
    expect(content.width).toBe(full.width - 80 - 60);
    expect(content.height).toBe(full.height - 50 - 70);
  });
});

describe('computePageTiles', () => {
  it('fits one tile when content matches page content area', () => {
    const content = getContentRect({});
    const tiles = computePageTiles({ x: 0, y: 0, width: content.width, height: content.height }, {});
    expect(tiles).toHaveLength(1);
    expect(tiles[0].pageNumber).toBe(1);
  });

  it('splits into multiple tiles for wide content', () => {
    const content = getContentRect({});
    const tiles = computePageTiles({ x: 0, y: 0, width: content.width * 2.5, height: content.height }, {});
    expect(tiles.length).toBeGreaterThanOrEqual(3);
  });

  it('applies overlap between tiles when requested', () => {
    const content = getContentRect({});
    const plain = computePageTiles({ x: 0, y: 0, width: content.width * 2, height: content.height }, {});
    const overlapping = computePageTiles(
      { x: 0, y: 0, width: content.width * 2, height: content.height },
      { overlap: 40 }
    );
    expect(overlapping.length).toBeGreaterThanOrEqual(plain.length);
  });

  it('handles zero-size content gracefully', () => {
    const tiles = computePageTiles({ x: 0, y: 0, width: 0, height: 0 }, {});
    expect(Array.isArray(tiles)).toBe(true);
    expect(tiles.length).toBe(0);
  });

  it('returns empty list when margins swallow a small custom page', () => {
    const tiles = computePageTiles(
      { x: 0, y: 0, width: 100, height: 100 },
      { width: 200, height: 200, margins: { top: 200, right: 200, bottom: 200, left: 200 } }
    );
    expect(tiles).toEqual([]);
  });
});

describe('applyOmitEmptyPages', () => {
  it('leaves tiles alone when omitEmptyPages disabled', () => {
    const tiles = [{ pageNumber: 1 }, { pageNumber: 2 }];
    const out = applyOmitEmptyPages(tiles, { omitEmptyPages: false }, () => true);
    expect(out).toHaveLength(2);
  });

  it('removes empty pages and renumbers', () => {
    const tiles = [{ pageNumber: 1, x: 1 }, { pageNumber: 2, x: 2 }, { pageNumber: 3, x: 3 }];
    const out = applyOmitEmptyPages(tiles, { omitEmptyPages: true }, (t) => t.x === 2);
    expect(out).toHaveLength(2);
    expect(out.map((t) => t.pageNumber)).toEqual([1, 2]);
  });
});

describe('summarizePageLayout', () => {
  it('collects dimensions, margins, overlap, and flags', () => {
    const summary = summarizePageLayout({
      paperSize: 'a4',
      orientation: 'portrait',
      margins: { top: 10, right: 20, bottom: 30, left: 40 },
      overlap: 25,
      printPageNumbers: true,
      cutMarks: true,
      omitEmptyPages: false,
      backgroundColor: '#eee',
    });
    expect(summary.dimensions.paperSize).toBe('a4');
    expect(summary.margins.top).toBe(10);
    expect(summary.overlap).toBe(25);
    expect(summary.printPageNumbers).toBe(true);
    expect(summary.cutMarks).toBe(true);
    expect(summary.omitEmptyPages).toBe(false);
    expect(summary.backgroundColor).toBe('#eee');
  });
});
