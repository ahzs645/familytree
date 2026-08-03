// @ts-check

import { computePageTiles, getContentRect } from './pageLayout.js';

/** @typedef {{ x: number, y: number, width: number, height: number }} Rect */
/** @typedef {{ id: string, kind: 'person'|'overlay', bounds: Rect }} PageBreakObject */

/**
 * Return the smallest per-object translations that place editable chart
 * objects wholly inside one printable tile. Objects larger than the printable
 * area are deliberately left alone because no useful one-page placement
 * exists for them.
 *
 * @param {PageBreakObject[]} objects
 * @param {Record<string, any>} pageSetup
 * @param {Rect} contentBounds
 * @returns {Array<{ id: string, kind: 'person'|'overlay', dx: number, dy: number }>}
 */
export function computePageBreakAdjustments(objects, pageSetup = {}, contentBounds) {
  const content = getContentRect(pageSetup);
  if (content.width <= 0 || content.height <= 0 || !validRect(contentBounds)) return [];

  const tiles = computePageTiles(contentBounds, pageSetup);
  if (!tiles.length) return [];

  return (Array.isArray(objects) ? objects : []).flatMap((object) => {
    const rect = object?.bounds;
    if (!object?.id || !validRect(rect) || rect.width > content.width || rect.height > content.height) return [];

    let best = null;
    for (const tile of tiles) {
      // A physical page always has the full printable area. computePageTiles
      // shortens the final tile's chart rect to the remaining chart bounds,
      // which is useful for cropping but not for placement.
      const pageRect = {
        x: tile.chart.x,
        y: tile.chart.y,
        width: content.width,
        height: content.height,
      };
      const dx = axisAdjustment(rect.x, rect.width, pageRect.x, pageRect.width);
      const dy = axisAdjustment(rect.y, rect.height, pageRect.y, pageRect.height);
      const distance = Math.abs(dx) + Math.abs(dy);
      if (!best || distance < best.distance) best = { dx, dy, distance };
      if (distance === 0) break;
    }

    if (!best || (!best.dx && !best.dy)) return [];
    return [{ id: String(object.id), kind: object.kind, dx: best.dx, dy: best.dy }];
  });
}

/** @param {number} start @param {number} size @param {number} pageStart @param {number} pageSize */
function axisAdjustment(start, size, pageStart, pageSize) {
  const pageEnd = pageStart + pageSize;
  if (start < pageStart) return pageStart - start;
  if (start + size > pageEnd) return pageEnd - (start + size);
  return 0;
}

/** @param {unknown} value */
function validRect(value) {
  if (!value || typeof value !== 'object') return false;
  const rect = /** @type {Record<string, unknown>} */ (value);
  return ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(Number(rect[key])))
    && Number(rect.width) >= 0
    && Number(rect.height) >= 0;
}

/** @param {Rect} a @param {Rect} b */
export function rectsIntersect(a, b) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}
