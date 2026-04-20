/**
 * VirtualTreeDiagram — generic hierarchical diagram with configurable orientation
 * and spacing. Accepts either a descendant tree or an ancestor tree and converts
 * it to a flat hierarchy via the layout helpers.
 */
import React, { useMemo } from 'react';
import { ChartCanvas } from './ChartCanvas.jsx';
import { PersonNode } from './PersonNode.jsx';
import { DEFAULT_THEME } from './theme.js';
import {
  layoutVirtualTree,
  hierarchyFromDescendants,
  hierarchyFromAncestors,
} from './layouts/virtualTreeLayout.js';

const PADDING = 30;

export function VirtualTreeDiagram({ tree, source = 'descendant', virtualTreeData, onPersonClick, theme = DEFAULT_THEME, options = {}, page, overlays, onOverlaysChange, chartCanvasRef, ...overlayProps }) {
  const hierarchy = useMemo(() => {
    if (!tree) return null;
    return source === 'ancestor' ? hierarchyFromAncestors(tree) : hierarchyFromDescendants(tree);
  }, [tree, source]);
  const { nodes, links } = useMemo(() => layoutVirtualTree(hierarchy, theme, options), [hierarchy, theme, options]);

  // virtualTreeData is the record-backed count of people/connections reachable
  // from the root (via buildVirtualTreeData). We render it as a small badge
  // so the user can see how much of the underlying graph this 2D SVG layout
  // is displaying — useful when the layout caps generations but records keep
  // extending further.
  const recordNodeCount = Array.isArray(virtualTreeData?.nodes) ? virtualTreeData.nodes.length : null;
  const recordConnectionCount = Array.isArray(virtualTreeData?.connections) ? virtualTreeData.connections.length : null;

  if (!tree) return <div style={{ padding: 24, color: theme.textMuted }}>No person selected.</div>;

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
        {recordNodeCount != null && (
          <text x={0} y={-8} fill={theme.textMuted} fontSize={11} fontFamily={theme.fontFamily}>
            {recordNodeCount} people · {recordConnectionCount} connections (from records)
          </text>
        )}
        {links.map((l, i) => (
          <path key={i} d={l.d} fill="none" stroke={theme.connector} strokeWidth={theme.connectorWidth} />
        ))}
        {nodes.map((n) => (
          <PersonNode
            key={n.id}
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

export default VirtualTreeDiagram;
