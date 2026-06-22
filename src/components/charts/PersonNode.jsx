/**
 * Card representing a single person inside a chart.
 * Colors come from the active theme.
 */
import React from 'react';
import { lifeSpanLabel } from '../../models/index.js';
import { personDisplayName } from '../../lib/personDisplayName.js';
import { textDirection, wrapGraphemes } from '../../lib/i18n.js';
import { DEFAULT_THEME } from './theme.js';
import { useChartSelection } from './ChartSelectionContext.jsx';
import { useChartContent } from './ChartContentContext.jsx';

export function PersonNode({
  x,
  y,
  person,
  onClick,
  placeholder = false,
  theme = DEFAULT_THEME,
  highlighted = false,
  colorOverride = null,
}) {
  const { openPerson } = useChartSelection();
  const { content, photoFor } = useChartContent();

  if (!person && !placeholder) return null;
  const colors = theme.gender[person?.gender ?? 0] || theme.gender[0];
  const display = (person ? personDisplayName(person) : '') || 'No name recorded';
  const photo = content.showPortraits && person ? photoFor(person.recordName) : null;
  const refId = content.showIds && person ? (person.referenceNumber || person.gedcomId || person.familySearchID || '') : '';
  const baseSpan = person && content.showLifespan ? lifeSpanLabel(person) : '';
  const span = [baseSpan, refId && `#${refId}`].filter(Boolean).join(' · ');
  const portraitSize = Math.min(theme.nodeHeight - 8, 34);
  const displayDirection = textDirection(display, 'ltr');
  const spanDirection = textDirection(span, displayDirection);
  const displayX = displayDirection === 'rtl' ? theme.nodeWidth - 12 : 12;
  const spanX = spanDirection === 'rtl' ? theme.nodeWidth - 12 : 12;
  const displayLines = wrapGraphemes(display, 20, 2);
  const wrappedDisplay = displayLines.length > 1;
  const fill = placeholder ? theme.placeholderFill : colorOverride?.fill || colors.fill;
  const stroke = highlighted ? '#ffd166' : placeholder ? theme.placeholderStroke : colorOverride?.stroke || colors.stroke;
  const strokeWidth = highlighted ? 2.5 : 1.5;

  const interactive = (onClick || openPerson) && person;

  const handleClick = () => {
    if (!person) return;
    if (openPerson) openPerson(person);
    else if (onClick) onClick(person);
  };

  return (
    <g
      transform={`translate(${x},${y})`}
      style={{
        cursor: interactive ? 'pointer' : 'default',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onClick={handleClick}
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
      {photo && (
        <image
          href={photo}
          x={theme.nodeWidth - portraitSize - 4}
          y={4}
          width={portraitSize}
          height={portraitSize}
          preserveAspectRatio="xMidYMid slice"
          rx={4}
          style={{ outline: `1px solid ${stroke}` }}
        />
      )}
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
