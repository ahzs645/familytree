/**
 * Card representing a single person inside a chart.
 * Colors come from the active theme.
 */
import React from 'react';
import { lifeSpanLabel } from '../../models/index.js';
import { textDirection, wrapGraphemes } from '../../lib/i18n.js';
import { DEFAULT_THEME } from './theme.js';

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
  const span = person ? lifeSpanLabel(person) : '';
  const displayDirection = textDirection(display, 'ltr');
  const spanDirection = textDirection(span, displayDirection);
  const displayX = displayDirection === 'rtl' ? theme.nodeWidth - 12 : 12;
  const spanX = spanDirection === 'rtl' ? theme.nodeWidth - 12 : 12;
  const displayLines = wrapGraphemes(display, 20, 2);
  const wrappedDisplay = displayLines.length > 1;
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
      <text
        x={displayX}
        y={wrappedDisplay ? 17 : 22}
        fill={theme.text}
        fontSize={13}
        fontFamily={theme.fontFamily}
        fontWeight={600}
        direction={displayDirection}
        style={{ unicodeBidi: 'plaintext' }}
      >
        {displayLines.map((line, index) => (
          <tspan key={index} x={displayX} dy={index === 0 ? 0 : 14}>{line}</tspan>
        ))}
      </text>
      {span && (
        <text
          x={spanX}
          y={wrappedDisplay ? 47 : 40}
          fill={theme.textMuted}
          fontSize={11}
          fontFamily={theme.fontFamily}
          direction={spanDirection}
          style={{ unicodeBidi: 'plaintext' }}
        >
          {span}
        </text>
      )}
    </g>
  );
}

export default PersonNode;
