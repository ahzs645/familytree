/**
 * HourglassChart — ancestors fan UP, descendants fan DOWN, proband in the middle.
 * Uses a dedicated upward-growing ancestor layout so nodes don't overlap after
 * rotating the horizontal pedigree, then stitches on the descendant subtree.
 */
import React, { useMemo } from 'react';
import { ChartCanvas } from './ChartCanvas.jsx';
import { PersonNode } from './PersonNode.jsx';
import { DEFAULT_THEME } from './theme.js';
import { layoutDescendants } from './layouts/descendantLayout.js';
import { layoutAncestorsUpward } from './layouts/ancestorUpwardLayout.js';

const PADDING = 40;

export function HourglassChart({ ancestorTree, descendantTree, generations = 4, onPersonClick, theme = DEFAULT_THEME, page, overlays, onOverlaysChange, chartCanvasRef, ...overlayProps }) {
  const layout = useMemo(() => {
    const upper = layoutAncestorsUpward(ancestorTree, generations, theme);
    const descendants = layoutDescendants(descendantTree, theme);

    // Align the descendant root horizontally under the upper proband, then push
    // the whole descendant subtree down so it sits below the proband row. Drop
    // the duplicated root node so the proband appears only once.
    const rootNode = descendants.nodes[0];
    const rootId = rootNode?.id;
    const dx = rootNode ? (upper.probandX - theme.nodeWidth / 2) - rootNode.x : 0;
    const dy = rootNode ? upper.probandY - rootNode.y : upper.probandY;
    const lowerNodes = descendants.nodes
      .filter((n) => n.id !== rootId)
      .map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
    const lowerLinks = descendants.links.map((l) => ({
      d: l.d
        .replace(/M ([\d.]+) ([\d.]+)/g, (_, x, y) => `M ${parseFloat(x) + dx} ${parseFloat(y) + dy}`)
        .replace(/H ([\d.]+)/g, (_, x) => `H ${parseFloat(x) + dx}`)
        .replace(/V ([\d.]+)/g, (_, y) => `V ${parseFloat(y) + dy}`),
    }));

    const allNodes = [...upper.nodes, ...lowerNodes];
    const width = Math.max(upper.width, ...allNodes.map((n) => n.x + theme.nodeWidth));
    return {
      nodes: allNodes,
      links: [...upper.links, ...lowerLinks],
      width,
    };
  }, [ancestorTree, descendantTree, generations, theme]);

  if (!ancestorTree) return <div style={{ padding: 24, color: theme.textMuted }}>No person selected.</div>;

  return (
    <ChartCanvas
      ref={chartCanvasRef}
      theme={theme}
      page={page}
      overlays={overlays}
      onOverlaysChange={onOverlaysChange}
      {...overlayProps}
    >
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
