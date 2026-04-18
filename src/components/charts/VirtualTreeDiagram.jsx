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

export function VirtualTreeDiagram({ tree, source = 'descendant', onPersonClick, theme = DEFAULT_THEME, options = {}, page }) {
  const hierarchy = useMemo(() => {
    if (!tree) return null;
    return source === 'ancestor' ? hierarchyFromAncestors(tree) : hierarchyFromDescendants(tree);
  }, [tree, source]);
  const { nodes, links } = useMemo(() => layoutVirtualTree(hierarchy, theme, options), [hierarchy, theme, options]);

  if (!tree) return <div style={{ padding: 24, color: theme.textMuted }}>No person selected.</div>;

  return (
    <ChartCanvas theme={theme} page={page}>
      <g transform={`translate(${PADDING},${PADDING})`}>
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
