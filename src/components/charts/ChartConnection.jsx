import React from 'react';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { useChartSelection } from './ChartSelectionContext.jsx';
import { DEFAULT_THEME } from './theme.js';

export function ChartConnection({
  id,
  d,
  paths,
  theme = DEFAULT_THEME,
  color,
  width,
  dashArray,
  opacity = 1,
  markerEnd,
  label,
  cornerStyle: cornerStyleDefault,
}) {
  const { t } = useTranslation();
  const { selectedObject, selectObject, connectionStyles } = useChartSelection();
  const resolvedId = String(id);
  const style = connectionStyles?.[resolvedId] || {};
  const selected = selectedObject?.kind === 'connection' && selectedObject.id === resolvedId;
  const stroke = style.color || color || theme.connector;
  const strokeWidth = Math.max(0.5, Number(style.lineWidth ?? width ?? theme.connectorWidth) || 1);
  const cornerStyle = style.cornerStyle || cornerStyleDefault || 'rounded';
  const lineJoin = cornerStyle === 'beveled' ? 'bevel' : cornerStyle === 'sharp' ? 'miter' : 'round';
  const lineCap = cornerStyle === 'rounded' ? 'round' : 'butt';
  const accessibleLabel = label || t('charts.objectInspector.connection', { defaultValue: 'Connection' });
  const pathList = Array.isArray(paths) ? paths : [d];

  const select = (event) => {
    event.stopPropagation();
    selectObject?.({ id: resolvedId, kind: 'connection', label: accessibleLabel });
  };

  return (
    <g
      data-chart-object-kind="connection"
      data-chart-object-id={resolvedId}
      data-export-stroke={stroke}
      data-export-stroke-width={strokeWidth}
      role="button"
      tabIndex={0}
      aria-label={accessibleLabel}
      fill="none"
      stroke={selected ? '#1e88e5' : stroke}
      strokeWidth={selected ? strokeWidth + 1 : strokeWidth}
      strokeLinejoin={lineJoin}
      strokeLinecap={lineCap}
      strokeDasharray={dashArray}
      opacity={opacity}
      onClick={select}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          select(event);
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      {pathList.filter(Boolean).map((path, index, visiblePaths) => <path key={index} d={path} markerEnd={index === visiblePaths.length - 1 ? markerEnd : undefined} />)}
      {pathList.filter(Boolean).map((path, index) => (
        <path key={`hit-${index}`} d={path} stroke="transparent" strokeWidth={Math.max(12, strokeWidth + 8)} />
      ))}
    </g>
  );
}

export default ChartConnection;
