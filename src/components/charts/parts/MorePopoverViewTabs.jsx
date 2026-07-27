/**
 * View / Layout / Page tabs of the chart "More" popover.
 * Pure presentation: each value/setter prop keeps the exact name of the
 * ChartsApp state it mirrors, so these stay thin controlled surfaces.
 */
import React from 'react';
import { Section } from './FormFields.jsx';
import { Select } from '../../ui/Select.jsx';
import { Input } from '../../ui/Input.jsx';
import { Button } from '../../ui/Button.jsx';
import { ChartBackgroundSheet } from '../ChartBackgroundSheet.jsx';
import { THEMES } from '../theme.js';
import { COMPLETENESS_COLOR_MODES, COMPLETENESS_LEGEND } from '../../../lib/researchCompleteness.js';
import { COMPACT_SELECT_TRIGGER } from './controlStyles.js';

export function MoreViewTab({
  themeId, setThemeId,
  completenessColorMode, setCompletenessColorMode,
  chartClickAction, setChartClickAction,
}) {
  return (<>
    <Section label="Theme">
      <Select
        value={themeId}
        onChange={setThemeId}
        options={THEMES.map((themeOption) => ({ value: themeOption.id, label: themeOption.name }))}
        triggerClassName={COMPACT_SELECT_TRIGGER}
      />
    </Section>
    <Section label="Research overlay">
      <Select
        value={completenessColorMode}
        onChange={setCompletenessColorMode}
        options={COMPLETENESS_COLOR_MODES.map((mode) => ({ value: mode.id, label: mode.label }))}
        triggerClassName={COMPACT_SELECT_TRIGGER}
      />
      {COMPLETENESS_LEGEND[completenessColorMode] && (
        <div className="mt-2 grid gap-1">
          {COMPLETENESS_LEGEND[completenessColorMode].map(([color, label]) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
              {label}
            </div>
          ))}
        </div>
      )}
    </Section>

    <Section label="Chart interaction">
      <Select
        value={chartClickAction}
        onChange={setChartClickAction}
        options={[
          { value: 'reroot', label: 'Click person to re-root' },
          { value: 'panel', label: 'Click person to inspect' },
        ]}
        triggerClassName={COMPACT_SELECT_TRIGGER}
      />
    </Section>
  </>);
}

export function MoreLayoutTab({
  chartType,
  generations, setGenerations,
  descendantGenerations, setDescendantGenerations,
  hourglassAncestorGens, setHourglassAncestorGens,
  hourglassDescendantGens, setHourglassDescendantGens,
  doubleAncestorLeftGens, setDoubleAncestorLeftGens,
  doubleAncestorRightGens, setDoubleAncestorRightGens,
  ancestorBranch, setAncestorBranch,
  fanArcDegrees, setFanArcDegrees,
}) {
  return (<>
    <Section label="Generations">
      <Input
        compact
        type="number"
        min={2}
        max={8}
        value={generations}
        onChange={(e) => setGenerations(Math.min(8, Math.max(2, +e.target.value || 5)))}
      />
    </Section>

    {(chartType === 'descendant' || chartType === 'tree' || chartType === 'symmetrical' || chartType === 'family-chart' || chartType === 'radial-descendant' || chartType === 'lifespan' || chartType === 'genogram' || chartType === 'sociogram') && (
      <Section label="Descendant generations">
        <Input
          compact
          type="number"
          min={1}
          max={8}
          value={descendantGenerations}
          onChange={(e) => setDescendantGenerations(Math.min(8, Math.max(1, +e.target.value || 5)))}
        />
      </Section>
    )}

    {chartType === 'hourglass' && (
      <Section label="Hourglass generations">
        <div className="grid grid-cols-2 gap-1.5">
          <label className="block">
            <div className="mb-1 text-xs text-muted-foreground">Ancestors</div>
            <Input
              compact
              type="number"
              min={1}
              max={8}
              value={hourglassAncestorGens}
              onChange={(e) => setHourglassAncestorGens(Math.min(8, Math.max(1, +e.target.value || 4)))}
            />
          </label>
          <label className="block">
            <div className="mb-1 text-xs text-muted-foreground">Descendants</div>
            <Input
              compact
              type="number"
              min={1}
              max={8}
              value={hourglassDescendantGens}
              onChange={(e) => setHourglassDescendantGens(Math.min(8, Math.max(1, +e.target.value || 3)))}
            />
          </label>
        </div>
      </Section>
    )}

    {chartType === 'double-ancestor' && (
      <Section label="Double ancestor generations">
        <div className="grid grid-cols-2 gap-1.5">
          <label className="block">
            <div className="mb-1 text-xs text-muted-foreground">Left / Father</div>
            <Input
              compact
              type="number"
              min={1}
              max={8}
              value={doubleAncestorLeftGens}
              onChange={(e) => setDoubleAncestorLeftGens(Math.min(8, Math.max(1, +e.target.value || 4)))}
            />
          </label>
          <label className="block">
            <div className="mb-1 text-xs text-muted-foreground">Right / Mother</div>
            <Input
              compact
              type="number"
              min={1}
              max={8}
              value={doubleAncestorRightGens}
              onChange={(e) => setDoubleAncestorRightGens(Math.min(8, Math.max(1, +e.target.value || 4)))}
            />
          </label>
        </div>
      </Section>
    )}

    {(chartType === 'ancestor' || chartType === 'fan' || chartType === 'circular' || chartType === 'fractal-tree' || chartType === 'fractal-h-tree' || chartType === 'square-tree') && (
      <Section label="Ancestor branches">
        <Select
          value={ancestorBranch}
          onChange={setAncestorBranch}
          options={[
            { value: 'both', label: 'Maternal and paternal' },
            { value: 'paternal', label: 'Only paternal' },
            { value: 'maternal', label: 'Only maternal' },
            { value: 'paternal-from-start', label: 'Paternal from start person' },
            { value: 'maternal-from-start', label: 'Maternal from start person' },
          ]}
          triggerClassName={COMPACT_SELECT_TRIGGER}
        />
      </Section>
    )}

    {chartType === 'fan' && (
      <Section label="Fan arc">
        <div className="mb-1 text-xs text-muted-foreground">Arc ({fanArcDegrees}°)</div>
        <input
          type="range"
          min={90}
          max={360}
          step={15}
          value={fanArcDegrees}
          onChange={(e) => setFanArcDegrees(+e.target.value)}
          className="w-full"
        />
      </Section>
    )}
  </>);
}

export function MorePageTab({
  chartTitle, setChartTitle,
  chartNote, setChartNote,
  pageSize, setPageSize,
  pageOrientation, setPageOrientation,
  chartBackground, setChartBackground,
  backgroundSheetOpen, setBackgroundSheetOpen,
  setPageSetupSheetOpen,
}) {
  return (<>
    <Section label="Title">
      <Input compact value={chartTitle} onChange={(e) => setChartTitle(e.target.value)} placeholder="Optional title" />
    </Section>

    <Section label="Note">
      <Input compact value={chartNote} onChange={(e) => setChartNote(e.target.value)} placeholder="Optional note" />
    </Section>

    <Section label="Page">
      <div className="grid grid-cols-2 gap-1.5">
        <Select
          value={pageSize}
          onChange={setPageSize}
          options={[
            { value: 'letter', label: 'Letter' },
            { value: 'a4', label: 'A4' },
            { value: 'legal', label: 'Legal' },
          ]}
          triggerClassName={COMPACT_SELECT_TRIGGER}
        />
        <Select
          value={pageOrientation}
          onChange={setPageOrientation}
          options={[
            { value: 'landscape', label: 'Landscape' },
            { value: 'portrait', label: 'Portrait' },
          ]}
          triggerClassName={COMPACT_SELECT_TRIGGER}
        />
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <Input compact value={chartBackground} onChange={(e) => setChartBackground(e.target.value)} placeholder="CSS value or click Edit…" className="flex-1" title="CSS background color" />
        <Button onClick={() => setBackgroundSheetOpen(true)} title="Color / gradient / image background editor">
          Edit…
        </Button>
      </div>
      <ChartBackgroundSheet
        open={backgroundSheetOpen}
        value={chartBackground}
        onApply={(value) => { setChartBackground(value); setBackgroundSheetOpen(false); }}
        onClose={() => setBackgroundSheetOpen(false)}
      />
      <div className="mt-1.5">
        <Button onClick={() => setPageSetupSheetOpen(true)} className="w-full" title="Margins, overlap, cut marks, page numbers, omit empty pages, export format/scale/quality">
          Page setup…
        </Button>
      </div>
    </Section>
  </>);
}
