/**
 * AncestorChart — pedigree layout. Root on the left, ancestors fan out to the right.
 * Generation N has 2^N slots stacked vertically; each slot is a fixed pixel height
 * so connector lines stay clean.
 */
import React, { useMemo } from 'react';
import { ChartCanvas } from './ChartCanvas.jsx';
import { PersonNode } from './PersonNode.jsx';
import { DEFAULT_THEME } from './theme.js';
import { layoutAncestors } from './layouts/ancestorLayout.js';

const PADDING = 30;

export function AncestorChart({ tree, generations = 5, onPersonClick, theme = DEFAULT_THEME }) {
  const { nodes, links } = useMemo(() => layoutAncestors(tree, generations, theme), [tree, generations, theme]);
  if (!tree) return <div style={{ padding: 24, color: theme.textMuted }}>No person selected.</div>;

  return (
    <ChartCanvas theme={theme}>
      <g transform={`translate(${PADDING},${PADDING})`}>
        {links.map((l, i) => {
          const midX = (l.from.x + l.toFather.x) / 2;
          return (
            <g key={i} fill="none" stroke={theme.connector} strokeWidth={theme.connectorWidth}>
              <path d={`M ${l.from.x} ${l.from.y} H ${midX}`} />
              <path d={`M ${midX} ${l.toFather.y} H ${l.toFather.x}`} />
              <path d={`M ${midX} ${l.toMother.y} H ${l.toMother.x}`} />
              <path d={`M ${midX} ${l.toFather.y} V ${l.toMother.y}`} />
            </g>
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
          />
        ))}
      </g>
    </ChartCanvas>
  );
}

export default AncestorChart;
