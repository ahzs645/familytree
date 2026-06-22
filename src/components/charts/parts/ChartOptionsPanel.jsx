/**
 * Floating options panel that pops up over the chart canvas.
 * Tabs: General (generations, recursion, kinships), Spacing,
 * Person Groups, and Localization.
 */
import React from 'react';
import { chartOptionsPanelStyle, optionSelect } from './styles.js';
import { RangeField, CheckOption, SelectOption } from './FormFields.jsx';
import { CHART_COLORING_MODES } from '../coloring.js';
import { DISTRIBUTION_TYPES } from '../../../lib/chartData/distributionBuilder.js';

// Chart types that have dedicated options on the "Chart" tab.
const CHART_TAB_TYPES = new Set(['distribution', 'sociogram', 'timeline']);

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
  chartType,
  distributionType,
  onDistributionTypeChange,
  distributionRelativeValues,
  onDistributionRelativeValuesChange,
  distributionGraphType,
  onDistributionGraphTypeChange,
  distributionFromYear,
  onDistributionFromYearChange,
  distributionToYear,
  onDistributionToYearChange,
  sociogramConfig,
  onSociogramConfigChange,
  timelineGrouping,
  onTimelineGroupingChange,
  timelineCollapse,
  onTimelineCollapseChange,
  timelineMarkerMode,
  onTimelineMarkerModeChange,
}) {
  const content = chartContent || { showPortraits: false, showLifespan: true, showIds: false };
  const setContent = (key, value) => onChartContentChange?.({ ...content, [key]: value });
  const socio = sociogramConfig || {};
  const setSocio = (key, value) => onSociogramConfigChange?.({ ...socio, [key]: value });
  const showChartTab = CHART_TAB_TYPES.has(chartType);
  const tabs = [
    ['general', 'General'],
    ...(showChartTab ? [['chart', 'Chart']] : []),
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
      {tab === 'chart' && showChartTab && (
        <div style={{ display: 'grid', gap: 10 }}>
          {chartType === 'distribution' && (
            <>
              <SelectOption
                label="Distribution Type"
                value={distributionType || 'gender'}
                onChange={onDistributionTypeChange}
                options={DISTRIBUTION_TYPES.map((type) => [type.id, type.label])}
              />
              <SelectOption
                label="Graph Type"
                value={distributionGraphType || 'bar'}
                onChange={onDistributionGraphTypeChange}
                options={[['bar', 'Bars'], ['line', 'Lines']]}
              />
              <CheckOption
                label="Show Relative Values (%)"
                checked={Boolean(distributionRelativeValues)}
                onChange={onDistributionRelativeValuesChange}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                  <span>From Year</span>
                  <input
                    type="number"
                    value={distributionFromYear ?? ''}
                    onChange={(event) => onDistributionFromYearChange?.(event.target.value)}
                    placeholder="any"
                    style={optionSelect}
                  />
                </label>
                <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                  <span>To Year</span>
                  <input
                    type="number"
                    value={distributionToYear ?? ''}
                    onChange={(event) => onDistributionToYearChange?.(event.target.value)}
                    placeholder="any"
                    style={optionSelect}
                  />
                </label>
              </div>
            </>
          )}
          {chartType === 'sociogram' && (
            <>
              <CheckOption label="Show Parents" checked={socio.showParents !== false} onChange={(v) => setSocio('showParents', v)} />
              <CheckOption label="Show Grandparents" checked={Boolean(socio.showGrandparents)} onChange={(v) => setSocio('showGrandparents', v)} />
              <CheckOption label="Show Partners" checked={socio.showPartners !== false} onChange={(v) => setSocio('showPartners', v)} />
              <CheckOption label="Show Children" checked={socio.showChildren !== false} onChange={(v) => setSocio('showChildren', v)} />
              <CheckOption label="Associate Relations of Start Person" checked={socio.showAssociateRelationsOfStartPerson !== false} onChange={(v) => setSocio('showAssociateRelationsOfStartPerson', v)} />
              <CheckOption label="Associate Relations of Partners" checked={Boolean(socio.showAssociateRelationsOfPartners)} onChange={(v) => setSocio('showAssociateRelationsOfPartners', v)} />
              <CheckOption label="Associate Relations of Children" checked={Boolean(socio.showAssociateRelationsOfChildren)} onChange={(v) => setSocio('showAssociateRelationsOfChildren', v)} />
              <RangeField
                label="Associated Persons Spacing"
                value={Number.isFinite(socio.associatedPersonsSpacing) ? socio.associatedPersonsSpacing : 80}
                min={10}
                max={400}
                onChange={(v) => setSocio('associatedPersonsSpacing', v)}
              />
            </>
          )}
          {chartType === 'timeline' && (
            <>
              <SelectOption
                label="Grouping"
                value={timelineGrouping || 'none'}
                onChange={onTimelineGroupingChange}
                options={[
                  ['none', 'No Grouping'],
                  ['lastName', 'Last Name'],
                  ['gender', 'Gender'],
                  ['birthPlace', 'Birth Place'],
                  ['birthCountry', 'Birth Country'],
                  ['deathPlace', 'Death Place'],
                  ['deathCountry', 'Death Country'],
                ]}
              />
              <SelectOption
                label="Event Markers"
                value={timelineMarkerMode || 'bar'}
                onChange={onTimelineMarkerModeChange}
                options={[['bar', 'Dots'], ['event', 'Lines']]}
              />
              <CheckOption
                label="Collapse for Best Fit"
                checked={timelineCollapse !== false}
                onChange={onTimelineCollapseChange}
              />
            </>
          )}
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
