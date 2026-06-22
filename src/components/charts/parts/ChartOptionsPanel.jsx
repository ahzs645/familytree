/**
 * Floating options panel that pops up over the chart canvas.
 * Tabs: General (generations, recursion, kinships), Spacing,
 * Person Groups, and Localization.
 */
import React from 'react';
import { chartOptionsPanelStyle, optionSelect } from './styles.js';
import { RangeField, CheckOption, SelectOption } from './FormFields.jsx';
import { CHART_COLORING_MODES } from '../coloring.js';

export function ChartOptionsPanel({
  tab,
  onTabChange,
  onClose,
  generations,
  onGenerationsChange,
  descendantGenerations,
  onDescendantGenerationsChange,
  separatedTreeAlignment,
  onSeparatedTreeAlignmentChange,
  hidePrivateChartInfo,
  onHidePrivateChartInfoChange,
  showKinships,
  onShowKinshipsChange,
  maxRecursionDepth,
  onMaxRecursionDepthChange,
  spacing,
  onSpacingChange,
  personGroupMode,
  onPersonGroupModeChange,
  coloringMode,
  onColoringModeChange,
  chartContent,
  onChartContentChange,
  localization,
  onLocalizationChange,
}) {
  const content = chartContent || { showPortraits: false, showLifespan: true, showIds: false };
  const setContent = (key, value) => onChartContentChange?.({ ...content, [key]: value });
  const tabs = [
    ['general', 'General'],
    ['spacing', 'Spacing'],
    ['coloring', 'Coloring'],
    ['content', 'Content'],
    ['groups', 'Person Groups'],
    ['localization', 'Localization & Formats'],
  ];
  return (
    <aside style={chartOptionsPanelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <strong style={{ fontSize: 13 }}>Chart Options</strong>
        <button type="button" onClick={onClose} style={{ ...optionSelect, width: 'auto', marginInlineStart: 'auto' }}>Close</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {tabs.map(([id, label]) => (
          <button key={id} type="button" onClick={() => onTabChange(id)} style={{ ...optionSelect, width: 'auto', background: tab === id ? 'hsl(var(--accent))' : optionSelect.background }}>{label}</button>
        ))}
      </div>
      {tab === 'general' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <RangeField label="Parent Generations" value={generations} min={1} max={10} onChange={onGenerationsChange} />
          <RangeField label="Children Generations" value={descendantGenerations} min={1} max={10} onChange={onDescendantGenerationsChange} />
          <SelectOption label="Alignment of Separated Trees" value={separatedTreeAlignment} onChange={onSeparatedTreeAlignmentChange} options={[
            ['shortest', 'Shortest Distance to Origin'],
            ['centered', 'Centered'],
            ['left', 'Left Aligned'],
          ]} />
          <CheckOption label="Hide Information marked as Private" checked={hidePrivateChartInfo} onChange={onHidePrivateChartInfoChange} />
          <CheckOption label="Show Kinships" checked={showKinships} onChange={onShowKinshipsChange} />
          <RangeField label="Maximum Recursion Depth" value={maxRecursionDepth} min={0} max={6} onChange={onMaxRecursionDepthChange} />
        </div>
      )}
      {tab === 'spacing' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <RangeField label="Horizontal Spacing" value={spacing.horizontal} min={8} max={120} onChange={(value) => onSpacingChange({ ...spacing, horizontal: value })} />
          <RangeField label="Vertical Spacing" value={spacing.vertical} min={50} max={220} onChange={(value) => onSpacingChange({ ...spacing, vertical: value })} />
          <RangeField label="Branch Spacing" value={spacing.branch} min={8} max={120} onChange={(value) => onSpacingChange({ ...spacing, branch: value })} />
        </div>
      )}
      {tab === 'coloring' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <SelectOption
            label="Coloring Mode"
            value={coloringMode || 'gender'}
            onChange={onColoringModeChange}
            options={CHART_COLORING_MODES.map((mode) => [mode.id, mode.label])}
          />
          <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', margin: 0 }}>
            Color person boxes by generation, paternal/maternal side, birth year, age at death, or a flat color. By Gender uses the chart theme.
          </p>
        </div>
      )}
      {tab === 'content' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <CheckOption label="Show portraits" checked={content.showPortraits} onChange={(v) => setContent('showPortraits', v)} />
          <CheckOption label="Show birth/death dates" checked={content.showLifespan} onChange={(v) => setContent('showLifespan', v)} />
          <CheckOption label="Show reference / GEDCOM / FS ID" checked={content.showIds} onChange={(v) => setContent('showIds', v)} />
          <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', margin: 0 }}>Portraits load from each person's attached pictures.</p>
        </div>
      )}
      {tab === 'groups' && (
        <SelectOption label="Person Group" value={personGroupMode} onChange={onPersonGroupModeChange} options={[
          ['all', 'All Persons'],
          ['bookmarked', 'Bookmarked'],
          ['start-family', 'Start-person family'],
        ]} />
      )}
      {tab === 'localization' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <SelectOption label="Localization" value={localization} onChange={onLocalizationChange} options={[
            ['en', 'English'],
            ['ar', 'Arabic'],
            ['he', 'Hebrew'],
            ['system', 'System default'],
          ]} />
          <SelectOption label="Name Format" value="display" onChange={() => {}} options={[
            ['display', 'Display name'],
            ['last-first', 'Last, First'],
            ['given-family', 'Given Family'],
          ]} />
        </div>
      )}
    </aside>
  );
}
