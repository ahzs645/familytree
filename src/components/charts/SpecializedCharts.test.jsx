import { describe, expect, it } from 'vitest';
import { layoutFractalAncestors } from './SpecializedCharts.jsx';
import { DEFAULT_THEME } from './theme.js';

function fullAncestorTree(depth, key = 'root') {
  return {
    person: { recordName: key, fullName: key },
    father: depth > 1 ? fullAncestorTree(depth - 1, `${key}F`) : null,
    mother: depth > 1 ? fullAncestorTree(depth - 1, `${key}M`) : null,
  };
}

function overlaps(a, b, gapX = 1, gapY = 1) {
  return (
    a.x < b.x + DEFAULT_THEME.nodeWidth + gapX
    && a.x + DEFAULT_THEME.nodeWidth + gapX > b.x
    && a.y < b.y + DEFAULT_THEME.nodeHeight + gapY
    && a.y + DEFAULT_THEME.nodeHeight + gapY > b.y
  );
}

describe('layoutFractalAncestors', () => {
  for (const variant of ['h-tree', 'square', 'fractal']) {
    it(`keeps ${variant} nodes from overlapping`, () => {
      const layout = layoutFractalAncestors(fullAncestorTree(6), 6, DEFAULT_THEME, variant);

      for (let i = 0; i < layout.nodes.length; i += 1) {
        for (let j = i + 1; j < layout.nodes.length; j += 1) {
          expect(overlaps(layout.nodes[i], layout.nodes[j])).toBe(false);
        }
      }
      expect(layout.links.length).toBe(layout.nodes.length - 1);
    });
  }

  it('routes square-tree connectors around unrelated nodes', () => {
    const layout = layoutFractalAncestors(fullAncestorTree(6), 6, DEFAULT_THEME, 'square');
    const nodesByKey = new Map(layout.nodes.map((node) => [node.key, node]));

    for (const link of layout.links) {
      const segments = squarePathSegments(link.d);
      for (const node of layout.nodes) {
        if (node.key === link.fromKey || node.key === link.toKey) continue;
        for (const segment of segments) {
          expect(segmentIntersectsNode(segment, node)).toBe(false);
        }
      }
      expect(nodesByKey.has(link.fromKey)).toBe(true);
      expect(nodesByKey.has(link.toKey)).toBe(true);
    }
  });
});

function squarePathSegments(path) {
  const tokens = path.match(/[MVH]|-?\d+(?:\.\d+)?/g);
  const segments = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i];
    if (command === 'M') {
      x = Number(tokens[i + 1]);
      y = Number(tokens[i + 2]);
      i += 3;
    } else if (command === 'V') {
      const nextY = Number(tokens[i + 1]);
      segments.push({ x1: x, y1: y, x2: x, y2: nextY });
      y = nextY;
      i += 2;
    } else if (command === 'H') {
      const nextX = Number(tokens[i + 1]);
      segments.push({ x1: x, y1: y, x2: nextX, y2: y });
      x = nextX;
      i += 2;
    } else {
      throw new Error(`Unexpected square path token: ${command}`);
    }
  }
  return segments;
}

function segmentIntersectsNode(segment, node) {
  const left = node.x;
  const right = node.x + DEFAULT_THEME.nodeWidth;
  const top = node.y;
  const bottom = node.y + DEFAULT_THEME.nodeHeight;
  const minX = Math.min(segment.x1, segment.x2);
  const maxX = Math.max(segment.x1, segment.x2);
  const minY = Math.min(segment.y1, segment.y2);
  const maxY = Math.max(segment.y1, segment.y2);
  if (segment.x1 === segment.x2) {
    return segment.x1 > left && segment.x1 < right && maxY > top && minY < bottom;
  }
  return segment.y1 > top && segment.y1 < bottom && maxX > left && minX < right;
}
