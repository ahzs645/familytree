/**
 * Floating options panel that pops up over the chart canvas.
 * Tabs: General (generations, privacy, kinships, duplicate collapsing),
 * Spacing (Family Chart only), Coloring, Content, and Person Groups.
 */
import React from 'react';
import { RangeField, CheckOption, SelectOption } from './FormFields.jsx';
import { Button } from '../../ui/Button.jsx';
import { Input } from '../../ui/Input.jsx';
import { cn } from '../../../lib/utils.js';
import { CHART_COLORING_MODES } from '../coloring.js';
import { DISTRIBUTION_TYPES } from '../../../lib/chartData/distributionBuilder.js';
import { useTranslation } from '../../../contexts/LocalizationContext.jsx';

// Chart types that have dedicated options on the "Chart" tab.
const CHART_TAB_TYPES = new Set(['ancestor', 'descendant', 'tree', 'fan', 'hourglass', 'genogram', 'distribution', 'sociogram', 'timeline']);

export function ChartOptionsPanel({
  tab,
  onTabChange,
  onClose,
  generations,
  onGenerationsChange,
  descendantGenerations,
  onDescendantGenerationsChange,
  hidePrivateChartInfo,
  onHidePrivateChartInfoChange,
  showKinships,
  onShowKinshipsChange,
  collapseDuplicates,
  onCollapseDuplicatesChange,
  spacing,
  onSpacingChange,
  personGroupMode,
  onPersonGroupModeChange,
  coloringMode,
  onColoringModeChange,
  chartContent,
  onChartContentChange,
  chartType,
  ancestorConfig,
  onAncestorConfigChange,
  descendantConfig,
  onDescendantConfigChange,
  treeConfig,
  onTreeConfigChange,
  fanConfig,
  onFanConfigChange,
  fanArcDegrees,
  onFanArcDegreesChange,
  hourglassConfig,
  onHourglassConfigChange,
  genogramConfig,
  onGenogramConfigChange,
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
  const { t } = useTranslation();
  const content = chartContent || { showPortraits: false, showLifespan: true, showIds: false };
  const setContent = (key, value) => onChartContentChange?.({ ...content, [key]: value });
  const socio = sociogramConfig || {};
  const setSocio = (key, value) => onSociogramConfigChange?.({ ...socio, [key]: value });
  const setModeOption = (config, setter, key, value) => setter?.({ ...config, [key]: value });
  const showChartTab = CHART_TAB_TYPES.has(chartType);
  // The spacing controls only affect the Family Chart layout, so hide the tab
  // for every other chart type.
  const showSpacingTab = chartType === 'family-chart';
  const tabs = [
    ['general', 'General'],
    ...(showChartTab ? [['chart', 'Chart']] : []),
    ...(showSpacingTab ? [['spacing', 'Spacing']] : []),
    ['coloring', 'Coloring'],
    ['content', 'Content'],
    ['groups', 'Person Groups'],
  ];
  return (
    <aside className="absolute bottom-[58px] end-[18px] z-30 w-[360px] max-w-[calc(100vw-2rem)] max-h-[min(620px,calc(100vh-8rem))] overflow-auto rounded-md border border-border bg-card p-3.5 text-card-foreground shadow-xl">
      <div className="mb-2.5 flex items-center gap-2">
        <strong className="text-sm">Chart Options</strong>
        <Button onClick={onClose} className="ms-auto">Close</Button>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {tabs.map(([id, label]) => (
          <Button key={id} onClick={() => onTabChange(id)} className={cn(tab === id && 'bg-accent')}>{label}</Button>
        ))}
      </div>
      {tab === 'general' && (
        <div className="grid gap-2.5">
          <RangeField label="Parent Generations" value={generations} min={1} max={10} onChange={onGenerationsChange} />
          <RangeField label="Children Generations" value={descendantGenerations} min={1} max={10} onChange={onDescendantGenerationsChange} />
          <CheckOption label="Hide Information marked as Private" checked={hidePrivateChartInfo} onChange={onHidePrivateChartInfoChange} />
          <CheckOption label="Show Kinships" checked={showKinships} onChange={onShowKinshipsChange} />
          <CheckOption label="Collapse duplicates" checked={collapseDuplicates !== false} onChange={onCollapseDuplicatesChange} />
        </div>
      )}
      {tab === 'chart' && showChartTab && (
        <div className="grid gap-2.5">
          {chartType === 'ancestor' && (
            <>
              <CheckOption label={t('charts.modeOptions.ancestor.showRootSiblings')} checked={Boolean(ancestorConfig?.showRootSiblings)} onChange={(value) => setModeOption(ancestorConfig, onAncestorConfigChange, 'showRootSiblings', value)} />
              <CheckOption label={t('charts.modeOptions.ancestor.showAncestorSiblings')} checked={Boolean(ancestorConfig?.showAncestorSiblings)} onChange={(value) => setModeOption(ancestorConfig, onAncestorConfigChange, 'showAncestorSiblings', value)} />
              <RangeField label={t('charts.modeOptions.ancestor.siblingScale')} value={Math.round((ancestorConfig?.siblingScale ?? 0.5) * 100)} min={25} max={100} onChange={(value) => setModeOption(ancestorConfig, onAncestorConfigChange, 'siblingScale', value / 100)} />
            </>
          )}
          {chartType === 'descendant' && (
            <>
              <CheckOption label={t('charts.modeOptions.descendant.showPartners')} checked={descendantConfig?.showPartners !== false} onChange={(value) => setModeOption(descendantConfig, onDescendantConfigChange, 'showPartners', value)} />
              <CheckOption label={t('charts.modeOptions.descendant.indentPartners')} checked={Boolean(descendantConfig?.indentPartners)} onChange={(value) => setModeOption(descendantConfig, onDescendantConfigChange, 'indentPartners', value)} />
              {descendantConfig?.indentPartners && <RangeField label={t('charts.modeOptions.descendant.partnerIndention')} value={descendantConfig?.partnerIndent ?? 32} min={0} max={160} onChange={(value) => setModeOption(descendantConfig, onDescendantConfigChange, 'partnerIndent', value)} />}
            </>
          )}
          {chartType === 'tree' && (
            <SelectOption label={t('charts.modeOptions.tree.subtreeAlignment')} value={treeConfig?.subtreeAlignment || 'top'} onChange={(value) => setModeOption(treeConfig, onTreeConfigChange, 'subtreeAlignment', value)} options={[
              ['top', t('charts.modeOptions.alignment.top')], ['center', t('charts.modeOptions.alignment.center')],
            ]} />
          )}
          {chartType === 'fan' && (
            <>
              <SelectOption label={t('charts.modeOptions.fan.mode')} value={fanConfig?.mode || 'ancestor'} onChange={(value) => setModeOption(fanConfig, onFanConfigChange, 'mode', value)} options={[
                ['ancestor', t('charts.modeOptions.fan.ancestors')], ['descendant', t('charts.modeOptions.fan.descendants')],
              ]} />
              <RangeField label={t('charts.modeOptions.fan.startAngle')} value={fanConfig?.startAngle ?? -90} min={-180} max={180} onChange={(value) => setModeOption(fanConfig, onFanConfigChange, 'startAngle', value)} />
              <RangeField label={t('charts.modeOptions.fan.arc')} value={fanArcDegrees} min={90} max={360} onChange={onFanArcDegreesChange} />
              <CheckOption label={t('charts.modeOptions.fan.expandSmallSlices')} checked={Boolean(fanConfig?.expandSmallSlices)} onChange={(value) => setModeOption(fanConfig, onFanConfigChange, 'expandSmallSlices', value)} />
            </>
          )}
          {chartType === 'hourglass' && (
            <>
              <RangeField label={t('charts.modeOptions.hourglass.partnerAncestorGenerations')} value={hourglassConfig?.partnerAncestorGenerations ?? 0} min={0} max={8} onChange={(value) => setModeOption(hourglassConfig, onHourglassConfigChange, 'partnerAncestorGenerations', value)} />
              <SelectOption label={t('charts.modeOptions.hourglass.alignment')} value={hourglassConfig?.alignment || 'center'} onChange={(value) => setModeOption(hourglassConfig, onHourglassConfigChange, 'alignment', value)} options={[
                ['start', t('charts.modeOptions.alignment.start')], ['center', t('charts.modeOptions.alignment.center')], ['end', t('charts.modeOptions.alignment.end')],
              ]} />
              <RangeField label={t('charts.modeOptions.hourglass.connectionWidth')} value={hourglassConfig?.connectionWidth ?? 2} min={1} max={8} onChange={(value) => setModeOption(hourglassConfig, onHourglassConfigChange, 'connectionWidth', value)} />
              <SelectOption label={t('charts.modeOptions.hourglass.connectionCorners')} value={hourglassConfig?.connectionCorners || 'rounded'} onChange={(value) => setModeOption(hourglassConfig, onHourglassConfigChange, 'connectionCorners', value)} options={[
                ['rounded', t('charts.modeOptions.hourglass.rounded')], ['square', t('charts.modeOptions.hourglass.square')],
              ]} />
            </>
          )}
          {chartType === 'genogram' && (
            <>
              <SelectOption label={t('charts.modeOptions.genogram.eventPosition')} value={genogramConfig?.eventPosition || 'right'} onChange={(value) => setModeOption(genogramConfig, onGenogramConfigChange, 'eventPosition', value)} options={[
                ['right', t('charts.modeOptions.genogram.right')], ['below', t('charts.modeOptions.genogram.below')],
              ]} />
              <SelectOption label={t('charts.modeOptions.genogram.eventBackground')} value={genogramConfig?.eventBackground || 'none'} onChange={(value) => setModeOption(genogramConfig, onGenogramConfigChange, 'eventBackground', value)} options={[
                ['none', t('charts.modeOptions.genogram.none')], ['filled', t('charts.modeOptions.genogram.filled')],
              ]} />
            </>
          )}
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
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-xs text-muted-foreground">
                  <span>From Year</span>
                  <Input
                    compact
                    type="number"
                    value={distributionFromYear ?? ''}
                    onChange={(event) => onDistributionFromYearChange?.(event.target.value)}
                    placeholder="any"
                  />
                </label>
                <label className="grid gap-1 text-xs text-muted-foreground">
                  <span>To Year</span>
                  <Input
                    compact
                    type="number"
                    value={distributionToYear ?? ''}
                    onChange={(event) => onDistributionToYearChange?.(event.target.value)}
                    placeholder="any"
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
      {tab === 'spacing' && showSpacingTab && (
        <div className="grid gap-2.5">
          <RangeField label="Horizontal Spacing" value={spacing.horizontal} min={8} max={120} onChange={(value) => onSpacingChange({ ...spacing, horizontal: value })} />
          <RangeField label="Vertical Spacing" value={spacing.vertical} min={50} max={220} onChange={(value) => onSpacingChange({ ...spacing, vertical: value })} />
          <RangeField label="Branch Spacing" value={spacing.branch} min={8} max={120} onChange={(value) => onSpacingChange({ ...spacing, branch: value })} />
        </div>
      )}
      {tab === 'coloring' && (
        <div className="grid gap-2.5">
          <SelectOption
            label="Coloring Mode"
            value={coloringMode || 'gender'}
            onChange={onColoringModeChange}
            options={CHART_COLORING_MODES.map((mode) => [mode.id, mode.label])}
          />
          <p className="m-0 text-xs text-muted-foreground">
            Color person boxes by generation, paternal/maternal side, birth year, age at death, or a flat color. By Gender uses the chart theme.
          </p>
        </div>
      )}
      {tab === 'content' && (
        <div className="grid gap-2.5">
          <CheckOption label="Show portraits" checked={content.showPortraits} onChange={(v) => setContent('showPortraits', v)} />
          <CheckOption label="Show birth/death dates" checked={content.showLifespan} onChange={(v) => setContent('showLifespan', v)} />
          <CheckOption label="Show reference / GEDCOM / FS ID" checked={content.showIds} onChange={(v) => setContent('showIds', v)} />
          <p className="m-0 text-xs text-muted-foreground">Portraits load from each person's attached pictures.</p>
        </div>
      )}
      {tab === 'groups' && (
        <SelectOption label="Person Browser Filter" value={personGroupMode} onChange={onPersonGroupModeChange} options={[
          ['all', 'All Persons'],
          ['bookmarked', 'Bookmarked'],
        ]} />
      )}
    </aside>
  );
}
