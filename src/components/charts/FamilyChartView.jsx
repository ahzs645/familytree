import React, { useMemo, useState } from 'react';
import { Edit3, Eye, GitMerge } from 'lucide-react';
import { ChartCanvas } from './ChartCanvas.jsx';
import { ChartEmptyState } from './ChartEmptyState.jsx';
import { DEFAULT_THEME } from './theme.js';
import { lifeSpanLabel } from '../../models/index.js';
import { textDirection, wrapGraphemes } from '../../lib/i18n.js';
import { layoutFamilyChart } from './layouts/familyChartLayout.js';

const PADDING = 8;

export function FamilyChartView({
  ancestorTree,
  descendantTree,
  rootId,
  onPersonClick,
  onInspectPerson,
  onEditPerson,
  theme = DEFAULT_THEME,
  page,
  overlays,
  onOverlaysChange,
  chartCanvasRef,
  colorForPerson,
  spacing,
  showKinships = false,
  collapseDuplicates = true,
  editable = true,
  ...overlayProps
}) {
  const [duplicatesCollapsed, setDuplicatesCollapsed] = useState(collapseDuplicates);
  const layout = useMemo(() => layoutFamilyChart({
    ancestorTree,
    descendantTree,
    rootId,
    theme,
    spacing,
    collapseDuplicates: duplicatesCollapsed,
    showKinships,
  }), [ancestorTree, descendantTree, rootId, theme, spacing, duplicatesCollapsed, showKinships]);

  if (!ancestorTree && !descendantTree) {
    return <ChartEmptyState theme={theme} />;
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
        {layout.links.map((link, index) => (
          <path
            key={`${link.kind}-${index}`}
            d={link.d}
            fill="none"
            stroke={link.kind?.includes('duplicate') ? theme.textMuted : theme.connector}
            strokeWidth={link.kind?.includes('marriage') ? Math.max(1, theme.connectorWidth) : theme.connectorWidth}
            strokeDasharray={link.kind?.includes('duplicate') || link.kind === 'secondary-child' ? '5 4' : 'none'}
            opacity={link.kind?.includes('duplicate') || link.kind === 'secondary-child' ? 0.8 : 1}
            title={link.label || undefined}
          />
        ))}
        {layout.nodes.map((node, index) => (
          <FamilyChartNode
            key={`${node.id}-${index}`}
            node={node}
            theme={theme}
            onClick={onPersonClick}
            onInspect={onInspectPerson}
            onEdit={onEditPerson}
            colorOverride={colorForPerson?.(node.person)}
            editable={editable}
          />
        ))}
      </g>
      <foreignObject x={18} y={18} width={320} height={52}>
        <div xmlns="http://www.w3.org/1999/xhtml" style={floatingToolbar}>
          <button
            type="button"
            onClick={() => setDuplicatesCollapsed((value) => !value)}
            style={toolbarButton}
            title="Collapse repeated spouse branches"
          >
            <GitMerge size={14} />
            <span>{duplicatesCollapsed ? 'Duplicates collapsed' : 'Duplicates expanded'}</span>
          </button>
          {layout.duplicateCount > 0 && <span style={toolbarMeta}>{layout.duplicateCount}</span>}
        </div>
      </foreignObject>
    </ChartCanvas>
  );
}

function FamilyChartNode({
  node,
  theme,
  onClick,
  onInspect,
  onEdit,
  colorOverride,
  editable,
}) {
  const { person, placeholder } = node;
  const display = person?.fullName || (node.role === 'placeholder-spouse' ? 'Unknown partner' : 'No name recorded');
  const span = person ? lifeSpanLabel(person) : '';
  const displayDirection = textDirection(display, 'ltr');
  const spanDirection = textDirection(span, displayDirection);
  const hasActions = Boolean(person?.recordName);
  const actionsOnLeft = displayDirection === 'rtl';
  const actionWidth = hasActions ? 46 : 0;
  const textInset = 12;
  const displayX = displayDirection === 'rtl'
    ? theme.nodeWidth - textInset
    : textInset + (actionsOnLeft ? actionWidth : 0);
  const spanX = spanDirection === 'rtl'
    ? theme.nodeWidth - textInset
    : textInset + (actionsOnLeft ? actionWidth : 0);
  const usableTextWidth = Math.max(9, Math.floor((theme.nodeWidth - textInset * 2 - actionWidth) / 8));
  const displayLines = wrapGraphemes(display, Math.min(20, usableTextWidth), 2);
  const wrappedDisplay = displayLines.length > 1;
  const colors = theme.gender[person?.gender ?? 2] || theme.gender[2] || theme.gender[0];
  const fill = placeholder ? theme.placeholderFill : colorOverride?.fill || colors.fill;
  const stroke = node.role === 'root'
    ? '#ffd166'
    : node.collapsedDuplicate
      ? theme.textMuted
      : placeholder
        ? theme.placeholderStroke
        : colorOverride?.stroke || colors.stroke;
  const textY = wrappedDisplay ? 16 : 22;
  const actionX = actionsOnLeft ? 7 : theme.nodeWidth - 47;

  const handleClick = () => {
    if (person) onClick?.(person);
  };
  const handleInspect = (event) => {
    event.stopPropagation();
    if (person) onInspect?.(person);
  };
  const handleEdit = (event) => {
    event.stopPropagation();
    if (person) onEdit?.(person);
  };

  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      style={{ cursor: person ? 'pointer' : 'default', userSelect: 'none' }}
      onClick={handleClick}
      onDoubleClick={handleEdit}
    >
      <rect
        width={theme.nodeWidth}
        height={theme.nodeHeight}
        rx={theme.nodeRadius}
        ry={theme.nodeRadius}
        fill={fill}
        stroke={stroke}
        strokeWidth={node.role === 'root' ? 2.5 : 1.5}
        strokeDasharray={placeholder || node.collapsedDuplicate ? '4 3' : 'none'}
      />
      <text
        x={displayX}
        y={textY}
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
          y={wrappedDisplay ? 45 : 39}
          fill={theme.textMuted}
          fontSize={11}
          fontFamily={theme.fontFamily}
          direction={spanDirection}
          style={{ unicodeBidi: 'plaintext' }}
        >
          {span}
        </text>
      )}
      {node.kinship && (
        <text
          x={theme.nodeWidth / 2}
          y={theme.nodeHeight + 15}
          fill={theme.textMuted}
          fontSize={10}
          fontFamily={theme.fontFamily}
          textAnchor="middle"
        >
          {node.kinship}
        </text>
      )}
      {node.collapsedDuplicate && (
        <text
          x={theme.nodeWidth / 2}
          y={theme.nodeHeight + (node.kinship ? 29 : 15)}
          fill={theme.textMuted}
          fontSize={10}
          fontFamily={theme.fontFamily}
          textAnchor="middle"
        >
          Duplicate branch hidden
        </text>
      )}
      {hasActions && (
        <g transform={`translate(${actionX},6)`}>
          <IconAction title="Inspect person" onClick={handleInspect} theme={theme}>
            <Eye size={12} />
          </IconAction>
          {editable && (
            <g transform="translate(22,0)">
              <IconAction title="Edit person" onClick={handleEdit} theme={theme}>
                <Edit3 size={12} />
              </IconAction>
            </g>
          )}
        </g>
      )}
    </g>
  );
}

function IconAction({ title, onClick, theme, children }) {
  return (
    <foreignObject width={18} height={18}>
      <button
        xmlns="http://www.w3.org/1999/xhtml"
        type="button"
        title={title}
        onClick={onClick}
        style={{
          width: 18,
          height: 18,
          padding: 0,
          border: `1px solid ${theme.placeholderStroke}`,
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: theme.background,
          color: theme.text,
          cursor: 'pointer',
        }}
      >
        {children}
      </button>
    </foreignObject>
  );
}

const floatingToolbar = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: 6,
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  background: 'hsl(var(--card))',
  color: 'hsl(var(--foreground))',
  boxShadow: '0 10px 22px rgba(0,0,0,0.22)',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  fontSize: 12,
};

const toolbarButton = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: 0,
  background: 'transparent',
  color: 'inherit',
  padding: '2px 4px',
  cursor: 'pointer',
  font: 'inherit',
};

const toolbarMeta = {
  minWidth: 18,
  height: 18,
  borderRadius: 9,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'hsl(var(--secondary))',
  color: 'hsl(var(--muted-foreground))',
  fontSize: 11,
};

export default FamilyChartView;
