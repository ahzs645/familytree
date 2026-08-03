/**
 * HourglassChart — ancestors fan UP, descendants fan DOWN, proband in the middle.
 * Uses a dedicated upward-growing ancestor layout so nodes don't overlap after
 * rotating the horizontal pedigree, then stitches on the descendant subtree.
 */
import React, { useMemo } from 'react';
import { ChartCanvas } from './ChartCanvas.jsx';
import { ChartEmptyState } from './ChartEmptyState.jsx';
import { PersonNode } from './PersonNode.jsx';
import { ChartConnection } from './ChartConnection.jsx';
import { DEFAULT_THEME } from './theme.js';
import { layoutDescendants } from './layouts/descendantLayout.js';
import { layoutAncestorsUpward } from './layouts/ancestorUpwardLayout.js';
import { translateSvgPath } from './layouts/pathUtils.js';

const PADDING = 40;

export function layoutHourglass(ancestorTree, descendantTree, partnerAncestorTree, generations, theme, options = {}) {
    const upper = layoutAncestorsUpward(ancestorTree, generations, theme);
    const partnerUpper = partnerAncestorTree
      ? layoutAncestorsUpward(partnerAncestorTree, Math.max(1, options.partnerAncestorGenerations || 1), theme)
      : null;
    const partnerDx = upper.width + 60;
    const partnerDy = partnerUpper ? upper.probandY - partnerUpper.probandY : 0;
    const upperNodes = partnerUpper
      ? [...upper.nodes, ...partnerUpper.nodes.map((node) => ({ ...node, id: `partner-${node.id}`, x: node.x + partnerDx, y: node.y + partnerDy }))]
      : upper.nodes;
    const upperLinks = partnerUpper
      ? [
        ...upper.links,
        ...partnerUpper.links.map((link) => ({ ...link, d: translateSvgPath(link.d, partnerDx, partnerDy) })),
        {
          d: `M ${upper.probandX} ${upper.probandY + theme.nodeHeight / 2} H ${partnerDx + partnerUpper.probandX}`,
          kind: 'partner',
        },
      ]
      : upper.links;
    const descendants = layoutDescendants(descendantTree, theme, { showPartners: !partnerUpper });

    // Align the descendant root horizontally under the upper proband, then push
    // the whole descendant subtree down so it sits below the proband row. Drop
    // the duplicated root node so the proband appears only once.
    const rootNode = descendants.nodes[0];
    const rootId = rootNode?.id;
    const combinedWidth = partnerUpper ? partnerDx + partnerUpper.width : upper.width;
    const targetX = options.alignment === 'start'
      ? upper.probandX - theme.nodeWidth / 2
      : options.alignment === 'end'
        ? combinedWidth - theme.nodeWidth
        : combinedWidth / 2 - theme.nodeWidth / 2;
    const dx = rootNode ? targetX - rootNode.x : 0;
    const dy = rootNode ? upper.probandY - rootNode.y : upper.probandY;
    const lowerNodes = descendants.nodes
      .filter((n) => n.id !== rootId)
      .map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
    const lowerLinks = descendants.links.map((l) => ({
      d: translateSvgPath(l.d, dx, dy),
    }));

    const allNodes = [...upperNodes, ...lowerNodes];
    const width = Math.max(combinedWidth, ...allNodes.map((n) => n.x + theme.nodeWidth));
    return {
      nodes: allNodes,
      links: [...upperLinks, ...lowerLinks],
      width,
    };
}

export function HourglassChart({ ancestorTree, descendantTree, partnerAncestorTree, generations = 4, options = {}, onPersonClick, theme = DEFAULT_THEME, page, overlays, onOverlaysChange, chartCanvasRef, colorForPerson, ...overlayProps }) {
  const layout = useMemo(() => {
    return layoutHourglass(ancestorTree, descendantTree, partnerAncestorTree, generations, theme, options);
  }, [ancestorTree, descendantTree, partnerAncestorTree, generations, theme, options]);

  if (!ancestorTree) return <ChartEmptyState theme={theme} />;

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
          <ChartConnection
            key={i}
            id={`hourglass-${i}`}
            d={l.d}
            theme={theme}
            width={options.connectionWidth || undefined}
            cornerStyle={options.connectionCorners === 'square' ? 'sharp' : undefined}
          />
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
            colorOverride={colorForPerson?.(n.person)}
          />
        ))}
      </g>
    </ChartCanvas>
  );
}

export default HourglassChart;
