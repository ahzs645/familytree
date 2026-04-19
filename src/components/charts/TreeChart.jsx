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
import { layoutAncestorsUpward } from './layouts/ancestorUpwardLayout.js';
import { layoutDescendants } from './layouts/descendantLayout.js';

const PADDING = 30;
const HALF_GAP = 40;

export function TreeChart({ ancestorTree, descendantTree, generations = 4, onPersonClick, theme = DEFAULT_THEME, page, overlays, onOverlaysChange, variant = 'horizontal', chartCanvasRef, ...overlayProps }) {
  if (variant === 'symmetrical') {
    return (
      <SymmetricalTree
        ancestorTree={ancestorTree}
        descendantTree={descendantTree}
        generations={generations}
        onPersonClick={onPersonClick}
        theme={theme}
        page={page}
        overlays={overlays}
        onOverlaysChange={onOverlaysChange}
        chartCanvasRef={chartCanvasRef}
        {...overlayProps}
      />
    );
  }
  return (
    <HorizontalTree
      ancestorTree={ancestorTree}
      descendantTree={descendantTree}
      generations={generations}
      onPersonClick={onPersonClick}
      theme={theme}
      page={page}
      overlays={overlays}
      onOverlaysChange={onOverlaysChange}
      chartCanvasRef={chartCanvasRef}
      {...overlayProps}
    />
  );
}

function HorizontalTree({ ancestorTree, descendantTree, generations = 4, onPersonClick, theme = DEFAULT_THEME, page, overlays, onOverlaysChange, chartCanvasRef, ...overlayProps }) {
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

    // Descendant layout starts at x=0; drop the root (same person as the ancestor
    // proband) and anchor the rest just to the right of it.
    const rootNode = descendants.nodes[0];
    const rootId = rootNode?.id;
    const probandNode = mirrored.nodes.find((n) => n.id === '0-0');
    const probandX = probandNode?.x ?? 0;
    const probandY = probandNode?.y ?? 0;
    const descRootX = rootNode?.x ?? 0;
    const descRootY = rootNode?.y ?? 0;
    // Shift so the descendant root position coincides with the proband, then the
    // root's children fall one generation to its right.
    const dx = probandX - descRootX;
    const dy = probandY - descRootY;

    const descNodes = descendants.nodes
      .filter((n) => n.id !== rootId)
      .map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
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
    <ChartCanvas
      ref={chartCanvasRef}
      theme={theme}
      page={page}
      overlays={overlays}
      onOverlaysChange={onOverlaysChange}
      {...overlayProps}
    >
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

function SymmetricalTree({ ancestorTree, descendantTree, generations, onPersonClick, theme, page, overlays, onOverlaysChange, chartCanvasRef, ...overlayProps }) {
  const layout = useMemo(() => {
    const upper = layoutAncestorsUpward(ancestorTree, generations, theme);
    const descendants = layoutDescendants(descendantTree, theme);

    const rootNode = descendants.nodes[0];
    const rootId = rootNode?.id;
    const dx = rootNode ? (upper.probandX - theme.nodeWidth / 2) - rootNode.x : 0;
    const dy = rootNode ? upper.probandY - rootNode.y : upper.probandY;
    const lowerNodes = descendants.nodes
      .filter((n) => n.id !== rootId)
      .map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
    const lowerLinks = descendants.links.map((l) => ({
      d: l.d
        .replace(/M ([\d.]+) ([\d.]+)/g, (_m, x, y) => `M ${parseFloat(x) + dx} ${parseFloat(y) + dy}`)
        .replace(/H ([\d.]+)/g, (_m, x) => `H ${parseFloat(x) + dx}`)
        .replace(/V ([\d.]+)/g, (_m, y) => `V ${parseFloat(y) + dy}`),
    }));

    return {
      nodes: [...upper.nodes, ...lowerNodes],
      links: [...upper.links, ...lowerLinks],
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

export default TreeChart;
