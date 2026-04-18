/**
 * DescendantChart — root at top, descendants spread below.
 * Multiple unions per person are supported (partners shown to the right).
 */
import React, { useMemo } from 'react';
import { ChartCanvas } from './ChartCanvas.jsx';
import { PersonNode } from './PersonNode.jsx';
import { DEFAULT_THEME } from './theme.js';
import { layoutDescendants } from './layouts/descendantLayout.js';

const PADDING = 30;

export function DescendantChart({ tree, onPersonClick, theme = DEFAULT_THEME, page }) {
  const { nodes, links } = useMemo(() => layoutDescendants(tree, theme), [tree, theme]);
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

export default DescendantChart;
