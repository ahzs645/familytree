/**
 * HourglassChart — ancestors fan UP, descendants fan DOWN, proband in the middle.
 * Reuses the ancestor and descendant layouts; the ancestor half is mirrored
 * vertically so its root sits at the bottom of the upper half.
 */
import React, { useMemo } from 'react';
import { ChartCanvas } from './ChartCanvas.jsx';
import { PersonNode } from './PersonNode.jsx';
import { DEFAULT_THEME } from './theme.js';
import { layoutAncestors } from './layouts/ancestorLayout.js';
import { layoutDescendants } from './layouts/descendantLayout.js';

const PADDING = 30;
const SPLIT_GAP = 40;

export function HourglassChart({ ancestorTree, descendantTree, generations = 4, onPersonClick, theme = DEFAULT_THEME, page, overlays, onOverlaysChange }) {
  const layout = useMemo(() => {
    const ancestors = layoutAncestors(ancestorTree, generations, theme);
    const descendants = layoutDescendants(descendantTree, theme);

    // Upper half: rotate ancestor layout 90° (originally left→right) so it grows upward.
    // Conceptually we swap (x, y), then flip y so depth=0 sits at bottom.
    const upperNodes = [];
    const upperLinks = [];
    const ancestorWidth = ancestors.width;
    const ancestorHeight = ancestors.height;

    for (const n of ancestors.nodes) {
      // n.x: 0..ancestorWidth (depth axis); n.y: 0..ancestorHeight (slot axis)
      const px = n.y; // slot becomes horizontal position
      const py = ancestorWidth - n.x - theme.nodeWidth; // depth flipped vertically
      upperNodes.push({ ...n, x: px, y: py });
    }
    for (const l of ancestors.links) {
      const fx = l.from.y;
      const fy = ancestorWidth - l.from.x;
      const ffx = l.toFather.y;
      const ffy = ancestorWidth - l.toFather.x;
      const fmx = l.toMother.y;
      const fmy = ancestorWidth - l.toMother.x;
      const midY = (fy + ffy) / 2;
      upperLinks.push({ d: `M ${fx} ${fy} V ${midY}` });
      upperLinks.push({ d: `M ${ffx} ${midY} V ${ffy}` });
      upperLinks.push({ d: `M ${fmx} ${midY} V ${fmy}` });
      upperLinks.push({ d: `M ${ffx} ${midY} H ${fmx}` });
    }

    const upperWidth = ancestorHeight; // slot count → width
    const upperHeight = ancestorWidth;

    // Find the proband node in upperNodes (gen 0): originally x=0, y=center → after transform: x=center, y=upperHeight - nodeWidth
    const probandUpperX = (upperNodes.find((n) => n.id === '0-0')?.x) ?? 0;
    const probandLowerX =
      descendants.nodes.length > 0
        ? descendants.nodes[0].x // first node is the root
        : 0;

    // Align: shift descendant layout so its root sits below the upper proband.
    const dx = probandUpperX - probandLowerX;
    const lowerNodes = descendants.nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + upperHeight + SPLIT_GAP }));
    const lowerLinks = descendants.links.map((l) => ({
      d: l.d.replace(/M ([\d.]+) ([\d.]+)/g, (m, x, y) => `M ${parseFloat(x) + dx} ${parseFloat(y) + upperHeight + SPLIT_GAP}`)
            .replace(/H ([\d.]+)/g, (m, x) => `H ${parseFloat(x) + dx}`)
            .replace(/V ([\d.]+)/g, (m, y) => `V ${parseFloat(y) + upperHeight + SPLIT_GAP}`),
    }));

    return {
      nodes: [...upperNodes, ...lowerNodes],
      links: [...upperLinks, ...lowerLinks],
      width: Math.max(upperWidth, ...lowerNodes.map((n) => n.x + theme.nodeWidth)),
    };
  }, [ancestorTree, descendantTree, generations, theme]);

  if (!ancestorTree) return <div style={{ padding: 24, color: theme.textMuted }}>No person selected.</div>;

  return (
    <ChartCanvas theme={theme} page={page} overlays={overlays} onOverlaysChange={onOverlaysChange}>
      <g transform={`translate(${PADDING},${PADDING})`}>
        {layout.links.map((l, i) => (
          <path key={i} d={l.d} fill="none" stroke={theme.connector} strokeWidth={theme.connectorWidth} />
        ))}
        {layout.nodes.map((n, i) => (
          <PersonNode
            key={n.id + '-' + i}
            x={n.x}
            y={n.y}
            person={n.person}
            placeholder={n.placeholder}
            theme={theme}
            onClick={onPersonClick}
          />
        ))}
      </g>
    </ChartCanvas>
  );
}

export default HourglassChart;
