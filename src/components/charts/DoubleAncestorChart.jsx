/**
 * DoubleAncestorChart — two ancestor pedigrees side-by-side for a couple.
 * Each partner sits at the bottom-center of their own ancestor fan; a marriage
 * connector links the two probands.
 */
import React, { useMemo } from 'react';
import { ChartCanvas } from './ChartCanvas.jsx';
import { PersonNode } from './PersonNode.jsx';
import { DEFAULT_THEME } from './theme.js';
import { layoutAncestors } from './layouts/ancestorLayout.js';

const PADDING = 30;
const COUPLE_GAP = 80;

export function DoubleAncestorChart({ leftTree, rightTree, generations = 4, onPersonClick, theme = DEFAULT_THEME, page, overlays, onOverlaysChange, chartCanvasRef, ...overlayProps }) {
  const layout = useMemo(() => {
    const left = layoutAncestors(leftTree, generations, theme);
    const right = layoutAncestors(rightTree, generations, theme);

    // Both layouts grow left→right. Mirror the LEFT one so it grows right→left.
    const leftMirrored = {
      nodes: left.nodes.map((n) => ({ ...n, x: left.width - n.x - theme.nodeWidth })),
      links: left.links.map((l) => ({
        from: { x: left.width - l.from.x, y: l.from.y },
        toFather: { x: left.width - l.toFather.x - theme.nodeWidth, y: l.toFather.y },
        toMother: { x: left.width - l.toMother.x - theme.nodeWidth, y: l.toMother.y },
      })),
    };

    // Shift the right layout to the right of the left one + couple gap.
    const dx = left.width + COUPLE_GAP;
    const rightShifted = {
      nodes: right.nodes.map((n) => ({ ...n, x: n.x + dx })),
      links: right.links.map((l) => ({
        from: { x: l.from.x + dx, y: l.from.y },
        toFather: { x: l.toFather.x + dx, y: l.toFather.y },
        toMother: { x: l.toMother.x + dx, y: l.toMother.y },
      })),
    };

    // Marriage connector between the two probands.
    const leftProband = leftMirrored.nodes.find((n) => n.id === '0-0');
    const rightProband = rightShifted.nodes.find((n) => n.id === '0-0');
    const marriage =
      leftProband && rightProband
        ? {
            d: `M ${leftProband.x} ${leftProband.y + theme.nodeHeight / 2} H ${rightProband.x}`,
          }
        : null;

    return { left: leftMirrored, right: rightShifted, marriage };
  }, [leftTree, rightTree, generations, theme]);

  if (!leftTree || !rightTree) {
    return <div style={{ padding: 24, color: theme.textMuted }}>Pick two persons (a couple) to chart.</div>;
  }

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
        {/* Left side connectors (mirrored geometry) */}
        {layout.left.links.map((l, i) => {
          const midX = (l.from.x + l.toFather.x) / 2;
          return (
            <g key={'l' + i} fill="none" stroke={theme.connector} strokeWidth={theme.connectorWidth}>
              <path d={`M ${l.from.x} ${l.from.y} H ${midX}`} />
              <path d={`M ${midX} ${l.toFather.y} H ${l.toFather.x + theme.nodeWidth}`} />
              <path d={`M ${midX} ${l.toMother.y} H ${l.toMother.x + theme.nodeWidth}`} />
              <path d={`M ${midX} ${l.toFather.y} V ${l.toMother.y}`} />
            </g>
          );
        })}
        {/* Right side connectors (standard ancestor geometry) */}
        {layout.right.links.map((l, i) => {
          const midX = (l.from.x + l.toFather.x) / 2;
          return (
            <g key={'r' + i} fill="none" stroke={theme.connector} strokeWidth={theme.connectorWidth}>
              <path d={`M ${l.from.x} ${l.from.y} H ${midX}`} />
              <path d={`M ${midX} ${l.toFather.y} H ${l.toFather.x}`} />
              <path d={`M ${midX} ${l.toMother.y} H ${l.toMother.x}`} />
              <path d={`M ${midX} ${l.toFather.y} V ${l.toMother.y}`} />
            </g>
          );
        })}
        {layout.marriage && (
          <path
            d={layout.marriage.d}
            fill="none"
            stroke={theme.connector}
            strokeWidth={theme.connectorWidth * 1.5}
            strokeDasharray="4 4"
          />
        )}
        {layout.left.nodes.map((n) => (
          <PersonNode key={'ln-' + n.id} x={n.x} y={n.y} person={n.person} placeholder={n.placeholder} theme={theme} onClick={onPersonClick} />
        ))}
        {layout.right.nodes.map((n) => (
          <PersonNode key={'rn-' + n.id} x={n.x} y={n.y} person={n.person} placeholder={n.placeholder} theme={theme} onClick={onPersonClick} />
        ))}
      </g>
    </ChartCanvas>
  );
}

export default DoubleAncestorChart;
