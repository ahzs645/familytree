/**
 * Card representing a single person inside a chart.
 * Colors come from the active theme.
 */
import React from 'react';
import { DEFAULT_THEME } from './theme.js';

function lifeSpan(p) {
  const b = (p?.birthDate || '').slice(0, 4);
  const d = (p?.deathDate || '').slice(0, 4);
  if (!b && !d) return '';
  return `${b || '?'} – ${d || ''}`.trim();
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export function PersonNode({
  x,
  y,
  person,
  onClick,
  placeholder = false,
  theme = DEFAULT_THEME,
  highlighted = false,
}) {
  if (!person && !placeholder) return null;
  const colors = theme.gender[person?.gender ?? 0] || theme.gender[0];
  const display = person?.fullName || 'No name recorded';
  const span = person ? lifeSpan(person) : '';
  const fill = placeholder ? theme.placeholderFill : colors.fill;
  const stroke = highlighted ? '#ffd166' : placeholder ? theme.placeholderStroke : colors.stroke;
  const strokeWidth = highlighted ? 2.5 : 1.5;

  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ cursor: onClick && person ? 'pointer' : 'default' }}
      onClick={() => onClick && person && onClick(person)}
    >
      <rect
        width={theme.nodeWidth}
        height={theme.nodeHeight}
        rx={theme.nodeRadius}
        ry={theme.nodeRadius}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={placeholder ? '4 3' : 'none'}
      />
      <text x={12} y={22} fill={theme.text} fontSize={13} fontFamily={theme.fontFamily} fontWeight={600}>
        {truncate(display, 22)}
      </text>
      {span && (
        <text x={12} y={40} fill={theme.textMuted} fontSize={11} fontFamily={theme.fontFamily}>
          {span}
        </text>
      )}
    </g>
  );
}

export default PersonNode;
