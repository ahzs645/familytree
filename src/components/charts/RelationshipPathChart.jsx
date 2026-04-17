/**
 * RelationshipPathChart — horizontal chain showing the BFS path between two persons,
 * with edge labels (parent / child / spouse).
 */
import React from 'react';
import { ChartCanvas } from './ChartCanvas.jsx';
import { PersonNode } from './PersonNode.jsx';
import { DEFAULT_THEME } from './theme.js';

const PADDING = 30;
const STEP_GAP = 60;

const EDGE_GLYPH = {
  parent: '↑ parent',
  child: '↓ child',
  spouse: '↔ spouse',
};

export function RelationshipPathChart({ result, secondPicked, onPersonClick, theme = DEFAULT_THEME }) {
  if (!secondPicked) {
    return <div style={{ padding: 24, color: theme.textMuted }}>Pick a second person to compare against.</div>;
  }
  if (!result || !result.steps || result.steps.length === 0) {
    return <div style={{ padding: 24, color: theme.textMuted }}>No connection found between these persons in the tree.</div>;
  }

  const stepWidth = theme.nodeWidth + STEP_GAP;
  const y = 40;

  return (
    <ChartCanvas theme={theme}>
      <g transform={`translate(${PADDING},${PADDING})`}>
        <text x={0} y={20} fill={theme.text} fontSize={16} fontWeight={600} fontFamily={theme.fontFamily}>
          Relationship: {result.label}
        </text>
        {result.steps.map((step, i) => {
          const x = i * stepWidth;
          return (
            <g key={i}>
              <PersonNode x={x} y={y} person={step.person} theme={theme} onClick={onPersonClick} />
              {i > 0 && step.edgeFromPrev && (
                <g>
                  <path
                    d={`M ${x - STEP_GAP + 4} ${y + theme.nodeHeight / 2} H ${x - 4}`}
                    stroke={theme.connector}
                    strokeWidth={theme.connectorWidth}
                    fill="none"
                    markerEnd="url(#rp-arrow)"
                  />
                  <text
                    x={x - STEP_GAP / 2}
                    y={y + theme.nodeHeight / 2 - 6}
                    fill={theme.textMuted}
                    fontSize={11}
                    fontFamily={theme.fontFamily}
                    textAnchor="middle"
                  >
                    {EDGE_GLYPH[step.edgeFromPrev] || step.edgeFromPrev}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        <defs>
          <marker id="rp-arrow" viewBox="0 0 8 8" refX={6} refY={4} markerWidth={6} markerHeight={6} orient="auto">
            <path d="M 0 0 L 8 4 L 0 8 Z" fill={theme.connector} />
          </marker>
        </defs>
      </g>
    </ChartCanvas>
  );
}

export default RelationshipPathChart;
