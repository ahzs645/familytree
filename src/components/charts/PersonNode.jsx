/**
 * Card representing a single person inside a chart.
 * Colors come from the active theme.
 */
import React from 'react';
import { lifeSpanLabel } from '../../models/index.js';
import { localizeNoName, noNameLabel, personDisplayName } from '../../lib/personDisplayName.js';
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
  objectId,
}) {
  const { openPerson, selectedObject, selectObject, objectStyles } = useChartSelection();
  const { content, photoFor } = useChartContent();

  if (!person && !placeholder) return null;
  const colors = theme.gender[person?.gender ?? 0] || theme.gender[0];
  const display = localizeNoName((person ? personDisplayName(person) : '') || noNameLabel());
  const resolvedObjectId = String(objectId || person?.recordName || '');
  const objectStyle = objectStyles?.[resolvedObjectId] || {};
  const photoEnabled = objectStyle.showPhoto == null ? content.showPortraits : Boolean(objectStyle.showPhoto);
  const photo = photoEnabled && person ? photoFor(person.recordName) : null;
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
  const fill = objectStyle.fill || (placeholder ? theme.placeholderFill : colorOverride?.fill || colors.fill);
  const stroke = highlighted ? '#ffd166' : objectStyle.borderColor || (placeholder ? theme.placeholderStroke : colorOverride?.stroke || colors.stroke);
  const strokeWidth = highlighted ? 2.5 : 1.5;
  const textColor = objectStyle.textColor || theme.text;
  const fontScale = Math.max(0.5, Math.min(2, Number(objectStyle.fontScale) || 1));
  const offsetX = Number(objectStyle.offsetX) || 0;
  const offsetY = Number(objectStyle.offsetY) || 0;
  const selected = selectedObject?.kind === 'person' && selectedObject.id === resolvedObjectId;

  const interactive = (onClick || openPerson || selectObject) && person;

  const handleClick = (event) => {
    if (!person) return;
    event?.stopPropagation?.();
    selectObject?.({ id: resolvedObjectId, kind: 'person', label: display });
  };

  const handleOpen = (event) => {
    if (!person) return;
    event?.stopPropagation?.();
    if (openPerson) openPerson(person);
    else onClick?.(person);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick(event);
    }
  };

  return (
    <g
      transform={`translate(${x + offsetX},${y + offsetY})`}
      data-chart-object-kind={person ? 'person' : undefined}
      data-chart-object-id={person ? resolvedObjectId : undefined}
      role={person ? 'button' : undefined}
      tabIndex={person ? 0 : undefined}
      aria-label={person ? display : undefined}
      style={{
        cursor: interactive ? 'pointer' : 'default',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onClick={handleClick}
      onDoubleClick={handleOpen}
      onKeyDown={handleKeyDown}
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
        fill={textColor}
        fontSize={13 * fontScale}
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
          fill={textColor}
          opacity={0.78}
          fontSize={11 * fontScale}
          fontFamily={theme.fontFamily}
          direction={spanDirection}
          style={{ unicodeBidi: 'plaintext' }}
        >
          {span}
        </text>
      )}
      {selected && (
        <rect
          data-export-exclude="true"
          x={-3}
          y={-3}
          width={theme.nodeWidth + 6}
          height={theme.nodeHeight + 6}
          rx={theme.nodeRadius + 2}
          fill="none"
          stroke="#1e88e5"
          strokeWidth={2}
          strokeDasharray="5 3"
          pointerEvents="none"
        />
      )}
    </g>
  );
}

export default PersonNode;
