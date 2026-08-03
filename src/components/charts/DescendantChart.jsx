/**
 * DescendantChart — root at top, descendants spread below.
 * Multiple unions per person are supported (partners shown to the right).
 */
import React, { useMemo } from 'react';
import { ChartCanvas } from './ChartCanvas.jsx';
import { ChartEmptyState } from './ChartEmptyState.jsx';
import { PersonNode } from './PersonNode.jsx';
import { ChartConnection } from './ChartConnection.jsx';
import { DEFAULT_THEME } from './theme.js';
import { layoutDescendants } from './layouts/descendantLayout.js';

const PADDING = 30;

export function DescendantChart({ tree, options, onPersonClick, theme = DEFAULT_THEME, page, overlays, onOverlaysChange, chartCanvasRef, colorForPerson, ...overlayProps }) {
  const { nodes, links } = useMemo(() => layoutDescendants(tree, theme, options), [tree, theme, options]);
  if (!tree) return <ChartEmptyState theme={theme} />;

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
        {links.map((l, i) => (
          <ChartConnection key={i} id={`descendant-${i}`} d={l.d} theme={theme} />
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
            colorOverride={colorForPerson?.(n.person)}
          />
        ))}
      </g>
    </ChartCanvas>
  );
}

export default DescendantChart;
