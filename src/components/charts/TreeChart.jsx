/**
 * TreeChart — horizontal multi-generational view.
 * Ancestors extend to the LEFT of the proband; descendants extend to the RIGHT.
 * Distinct from Hourglass (which is vertical).
 */
import React, { useMemo } from 'react';
import { ChartCanvas } from './ChartCanvas.jsx';
import { PersonNode } from './PersonNode.jsx';
import { DEFAULT_THEME } from './theme.js';
import { layoutAncestors } from './layouts/ancestorLayout.js';
import { layoutDescendants } from './layouts/descendantLayout.js';

const PADDING = 30;
const HALF_GAP = 40;

export function TreeChart({ ancestorTree, descendantTree, generations = 4, onPersonClick, theme = DEFAULT_THEME }) {
  const layout = useMemo(() => {
    const ancestors = layoutAncestors(ancestorTree, generations, theme);
    const descendants = layoutDescendants(descendantTree, theme);

    // Ancestor layout grows left→right; we want it to grow right→left.
    // Mirror x-coords around ancestors.width.
    const mirrored = {
      nodes: ancestors.nodes.map((n) => ({ ...n, x: ancestors.width - n.x - theme.nodeWidth })),
      links: ancestors.links.map((l) => ({
        from: { x: ancestors.width - l.from.x, y: l.from.y },
        toFather: { x: ancestors.width - l.toFather.x - theme.nodeWidth, y: l.toFather.y },
        toMother: { x: ancestors.width - l.toMother.x - theme.nodeWidth, y: l.toMother.y },
      })),
    };

    // Descendant layout starts at x=0; shift right of ancestor span.
    const dx = ancestors.width + HALF_GAP;
    // Vertical centering: align ancestor proband (rightmost) with descendant root (top-left).
    const probandY = mirrored.nodes.find((n) => n.id === '0-0')?.y ?? 0;
    const descRootY = descendants.nodes[0]?.y ?? 0;
    const dy = probandY - descRootY;

    const descNodes = descendants.nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
    const descLinks = descendants.links.map((l) => ({
      d: l.d
        .replace(/M ([\d.]+) ([\d.]+)/g, (_m, x, y) => `M ${parseFloat(x) + dx} ${parseFloat(y) + dy}`)
        .replace(/H ([\d.]+)/g, (_m, x) => `H ${parseFloat(x) + dx}`)
        .replace(/V ([\d.]+)/g, (_m, y) => `V ${parseFloat(y) + dy}`),
    }));

    return { ancestor: mirrored, descNodes, descLinks };
  }, [ancestorTree, descendantTree, generations, theme]);

  if (!ancestorTree) return <div style={{ padding: 24, color: theme.textMuted }}>No person selected.</div>;

  return (
    <ChartCanvas theme={theme}>
      <g transform={`translate(${PADDING},${PADDING})`}>
        {layout.ancestor.links.map((l, i) => {
          const midX = (l.from.x + l.toFather.x) / 2;
          return (
            <g key={'a' + i} fill="none" stroke={theme.connector} strokeWidth={theme.connectorWidth}>
              <path d={`M ${l.from.x} ${l.from.y} H ${midX}`} />
              <path d={`M ${midX} ${l.toFather.y} H ${l.toFather.x + theme.nodeWidth}`} />
              <path d={`M ${midX} ${l.toMother.y} H ${l.toMother.x + theme.nodeWidth}`} />
              <path d={`M ${midX} ${l.toFather.y} V ${l.toMother.y}`} />
            </g>
          );
        })}
        {layout.descLinks.map((l, i) => (
          <path key={'d' + i} d={l.d} fill="none" stroke={theme.connector} strokeWidth={theme.connectorWidth} />
        ))}
        {layout.ancestor.nodes.map((n) => (
          <PersonNode
            key={'an-' + n.id}
            x={n.x}
            y={n.y}
            person={n.person}
            placeholder={n.placeholder}
            theme={theme}
            onClick={onPersonClick}
          />
        ))}
        {layout.descNodes.map((n, i) => (
          <PersonNode
            key={'dn-' + n.id + '-' + i}
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

export default TreeChart;
