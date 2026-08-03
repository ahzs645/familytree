/**
 * AncestorChart — pedigree layout. Root on the left, ancestors fan out to the right.
 * Generation N has 2^N slots stacked vertically; each slot is a fixed pixel height
 * so connector lines stay clean.
 */
import React, { useMemo } from 'react';
import { ChartCanvas } from './ChartCanvas.jsx';
import { ChartEmptyState } from './ChartEmptyState.jsx';
import { PersonNode } from './PersonNode.jsx';
import { ChartConnection } from './ChartConnection.jsx';
import { DEFAULT_THEME } from './theme.js';
import { layoutAncestors } from './layouts/ancestorLayout.js';

const PADDING = 30;

export function AncestorChart({ tree, generations = 5, onPersonClick, theme = DEFAULT_THEME, page, overlays, onOverlaysChange, chartCanvasRef, colorForPerson, ...overlayProps }) {
  const { nodes, links } = useMemo(() => layoutAncestors(tree, generations, theme), [tree, generations, theme]);
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
        {links.map((l, i) => {
          const midX = (l.from.x + l.toFather.x) / 2;
          return (
            <ChartConnection
              key={i}
              id={`ancestor-${i}`}
              paths={[
                `M ${l.from.x} ${l.from.y} H ${midX}`,
                `M ${midX} ${l.toFather.y} H ${l.toFather.x}`,
                `M ${midX} ${l.toMother.y} H ${l.toMother.x}`,
                `M ${midX} ${l.toFather.y} V ${l.toMother.y}`,
              ]}
              theme={theme}
            />
          );
        })}
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

export default AncestorChart;
