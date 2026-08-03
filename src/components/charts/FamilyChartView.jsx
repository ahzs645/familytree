import React, { useMemo, useState } from 'react';
import { Edit3, Eye, GitMerge } from 'lucide-react';
import { ChartCanvas } from './ChartCanvas.jsx';
import { ChartEmptyState } from './ChartEmptyState.jsx';
import { ChartConnection } from './ChartConnection.jsx';
import { useChartSelection } from './ChartSelectionContext.jsx';
import { useChartContent } from './ChartContentContext.jsx';
import { DEFAULT_THEME } from './theme.js';
import { lifeSpanLabel } from '../../models/index.js';
import { textDirection, wrapGraphemes } from '../../lib/i18n.js';
import { layoutFamilyChart } from './layouts/familyChartLayout.js';
import { localizeNoName, noNameLabel } from '../../lib/personDisplayName.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

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
          <ChartConnection
            key={`${link.kind}-${index}`}
            id={`family-${link.kind}-${index}`}
            d={link.d}
            theme={theme}
            color={link.kind?.includes('duplicate') ? theme.textMuted : theme.connector}
            width={link.kind?.includes('marriage') ? Math.max(1, theme.connectorWidth) : theme.connectorWidth}
            dashArray={link.kind?.includes('duplicate') || link.kind === 'secondary-child' ? '5 4' : 'none'}
            opacity={link.kind?.includes('duplicate') || link.kind === 'secondary-child' ? 0.8 : 1}
            label={link.label || undefined}
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
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card p-1.5 text-xs text-card-foreground shadow-lg"
        >
          <button
            type="button"
            onClick={() => setDuplicatesCollapsed((value) => !value)}
            className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent px-1 py-0.5 text-inherit"
            title="Collapse repeated spouse branches"
          >
            <GitMerge size={14} />
            <span>{duplicatesCollapsed ? 'Duplicates collapsed' : 'Duplicates expanded'}</span>
          </button>
          {layout.duplicateCount > 0 && (
            <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-secondary text-xs text-muted-foreground">
              {layout.duplicateCount}
            </span>
          )}
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
  const { t } = useTranslation();
  const { selectedObject, selectObject, objectStyles } = useChartSelection();
  const { content, photoFor } = useChartContent();
  const { person, placeholder } = node;
  const objectId = String(person?.recordName || node.id);
  const objectStyle = objectStyles?.[objectId] || {};
  const photoEnabled = objectStyle.showPhoto == null ? content.showPortraits : Boolean(objectStyle.showPhoto);
  const photo = photoEnabled && person ? photoFor(person.recordName) : null;
  const display = person?.fullName ? localizeNoName(person.fullName) : (node.role === 'placeholder-spouse' ? t('editor.person.unknownPartner', { defaultValue: 'Unknown partner' }) : noNameLabel());
  const span = person ? lifeSpanLabel(person) : '';
  const displayDirection = textDirection(display, 'ltr');
  const spanDirection = textDirection(span, displayDirection);
  const hasActions = Boolean(person?.recordName);
  const actionsOnLeft = displayDirection === 'rtl';
  const actionWidth = hasActions ? 46 : 0;
  const textInset = 12;
  const portraitInset = photo ? 34 : 0;
  const displayX = displayDirection === 'rtl'
    ? theme.nodeWidth - textInset
    : textInset + (actionsOnLeft ? actionWidth : 0) + portraitInset;
  const spanX = spanDirection === 'rtl'
    ? theme.nodeWidth - textInset
    : textInset + (actionsOnLeft ? actionWidth : 0) + portraitInset;
  const usableTextWidth = Math.max(9, Math.floor((theme.nodeWidth - textInset * 2 - actionWidth - portraitInset) / 8));
  const displayLines = wrapGraphemes(display, Math.min(20, usableTextWidth), 2);
  const wrappedDisplay = displayLines.length > 1;
  const colors = theme.gender[person?.gender ?? 2] || theme.gender[2] || theme.gender[0];
  const fill = objectStyle.fill || (placeholder ? theme.placeholderFill : colorOverride?.fill || colors.fill);
  const stroke = objectStyle.borderColor || (node.role === 'root'
    ? '#ffd166'
    : node.collapsedDuplicate
      ? theme.textMuted
      : placeholder
        ? theme.placeholderStroke
        : colorOverride?.stroke || colors.stroke);
  const textColor = objectStyle.textColor || theme.text;
  const fontScale = Math.max(0.5, Math.min(2, Number(objectStyle.fontScale) || 1));
  const offsetX = Number(objectStyle.offsetX) || 0;
  const offsetY = Number(objectStyle.offsetY) || 0;
  const selected = selectedObject?.kind === 'person' && selectedObject.id === objectId;
  const textY = wrappedDisplay ? 16 : 22;
  const actionX = actionsOnLeft ? 7 : theme.nodeWidth - 47;

  const handleClick = (event) => {
    if (!person) return;
    event.stopPropagation();
    selectObject?.({ id: objectId, kind: 'person', label: display });
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
      transform={`translate(${node.x + offsetX},${node.y + offsetY})`}
      data-chart-object-kind={person ? 'person' : undefined}
      data-chart-object-id={person ? objectId : undefined}
      style={{ cursor: person ? 'pointer' : 'default', userSelect: 'none' }}
      onClick={handleClick}
      onDoubleClick={(event) => { event.stopPropagation(); if (person) onClick?.(person); }}
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
      {photo && (
        <image
          href={photo}
          x={4}
          y={4}
          width={34}
          height={34}
          preserveAspectRatio="xMidYMid slice"
          rx={4}
        />
      )}
      <text
        x={displayX}
        y={textY}
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
          y={wrappedDisplay ? 45 : 39}
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
      {selected && (
        <rect data-export-exclude="true" x={-3} y={-3} width={theme.nodeWidth + 6} height={theme.nodeHeight + 6} rx={theme.nodeRadius + 2} fill="none" stroke="#1e88e5" strokeWidth={2} strokeDasharray="5 3" pointerEvents="none" />
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

export default FamilyChartView;
