/**
 * ChartStage — renders the chart component matching the selected chart type,
 * wired to the trees/builder data produced by useChartData. Everything here is
 * a controlled pass-through from ChartsApp: prop names match the ChartsApp
 * value names one-to-one, and `virtualOptions` is the useVirtualTreeOptions()
 * result object spread into the Virtual Tree renderers.
 */
import React from 'react';
import { AncestorChart } from './AncestorChart.jsx';
import { DescendantChart } from './DescendantChart.jsx';
import { HourglassChart } from './HourglassChart.jsx';
import { TreeChart } from './TreeChart.jsx';
import { FamilyChartView } from './FamilyChartView.jsx';
import { DoubleAncestorChart } from './DoubleAncestorChart.jsx';
import { FanChart } from './FanChart.jsx';
import { RelationshipPathChart } from './RelationshipPathChart.jsx';
import { VirtualTreeDiagram } from './VirtualTreeDiagram.jsx';
import { VirtualTree3D } from './VirtualTree3D.jsx';
import {
  CircularAncestorChart,
  DistributionChart,
  TimelineChart,
  RadialDescendantTimelineChart,
  LifespanDescendantChart,
  GenogramChart,
  SociogramChart,
  FractalAncestorChart,
} from './SpecializedCharts.jsx';
import { StatisticsChart } from './StatisticsChart.jsx';
import { VirtualTreeOptionsPanel } from './parts/VirtualTreeOptionsPanel.jsx';

export function ChartStage({
  chartType,
  chartCanvasRef,
  theme,
  chartPage,
  overlays,
  colorForPerson,
  overlayChartProps,
  onPersonClick,
  openPersonInPanel,
  onEditPerson,
  rootId,
  secondId,
  generations,
  hourglassAncestorGens,
  doubleAncestorLeftGens,
  doubleAncestorRightGens,
  fanArcDegrees,
  ancestorTree,
  descendantTree,
  secondAncestorTree,
  partnerAncestorTree,
  completeTreeData,
  ancestorConfig,
  descendantConfig,
  treeConfig,
  fanConfig,
  hourglassConfig,
  genogramConfig,
  chartPersons,
  distributionData,
  distributionType,
  timelineData,
  genogramData,
  sociogramData,
  selectedRelationshipResult,
  relationshipPaths,
  relationshipPathIds,
  chartSpacing,
  showKinships,
  collapseDuplicates,
  isReadOnly,
  virtualOptions,
  virtualLayoutOptions,
}) {
  const {
    virtualSource,
    virtualOrientation,
    virtualHSpacing,
    virtualVSpacing,
    virtualTreeData,
    virtualViewMode,
    virtualSymbolMode,
    virtualColorMode,
    virtualShowGenerationBands,
    virtualDof,
  } = virtualOptions;
  return (
    <div className="relative min-w-0 flex-1 overflow-hidden">
      {chartType === 'ancestor' && (
        <AncestorChart
          chartCanvasRef={chartCanvasRef}
          tree={ancestorTree}
          options={ancestorConfig}
          generations={generations}
          onPersonClick={onPersonClick}
          theme={theme}
          page={chartPage}
          overlays={overlays}
          colorForPerson={colorForPerson}
          {...overlayChartProps}
        />
      )}
      {chartType === 'descendant' && (
        <DescendantChart
          chartCanvasRef={chartCanvasRef}
          tree={descendantTree}
          options={descendantConfig}
          onPersonClick={onPersonClick}
          theme={theme}
          page={chartPage}
          overlays={overlays}
          colorForPerson={colorForPerson}
          {...overlayChartProps}
        />
      )}
      {chartType === 'hourglass' && (
        <HourglassChart
          chartCanvasRef={chartCanvasRef}
          ancestorTree={ancestorTree}
          descendantTree={descendantTree}
          partnerAncestorTree={partnerAncestorTree}
          options={hourglassConfig}
          generations={hourglassAncestorGens}
          onPersonClick={onPersonClick}
          theme={theme}
          page={chartPage}
          overlays={overlays}
          colorForPerson={colorForPerson}
          {...overlayChartProps}
        />
      )}
      {(chartType === 'tree' || chartType === 'symmetrical') && (
        <TreeChart
          chartCanvasRef={chartCanvasRef}
          ancestorTree={ancestorTree}
          descendantTree={descendantTree}
          completeTreeData={completeTreeData}
          options={treeConfig}
          generations={generations}
          onPersonClick={onPersonClick}
          theme={theme}
          page={chartPage}
          overlays={overlays}
          colorForPerson={colorForPerson}
          {...overlayChartProps}
          variant={chartType === 'symmetrical' ? 'symmetrical' : 'horizontal'}
        />
      )}
      {chartType === 'family-chart' && (
        <FamilyChartView
          chartCanvasRef={chartCanvasRef}
          ancestorTree={ancestorTree}
          descendantTree={descendantTree}
          rootId={rootId}
          onPersonClick={onPersonClick}
          onInspectPerson={openPersonInPanel}
          onEditPerson={onEditPerson}
          theme={theme}
          page={chartPage}
          overlays={overlays}
          colorForPerson={colorForPerson}
          spacing={chartSpacing}
          showKinships={showKinships}
          collapseDuplicates={collapseDuplicates}
          editable={!isReadOnly}
          {...overlayChartProps}
        />
      )}
      {chartType === 'double-ancestor' && (
        <DoubleAncestorChart
          chartCanvasRef={chartCanvasRef}
          leftTree={ancestorTree}
          rightTree={secondAncestorTree}
          leftGenerations={doubleAncestorLeftGens}
          rightGenerations={doubleAncestorRightGens}
          onPersonClick={onPersonClick}
          theme={theme}
          page={chartPage}
          overlays={overlays}
          colorForPerson={colorForPerson}
          {...overlayChartProps}
        />
      )}
      {chartType === 'fan' && (
        <FanChart
          chartCanvasRef={chartCanvasRef}
          tree={fanConfig?.mode === 'descendant' ? descendantTree : ancestorTree}
          generations={generations}
          arcDegrees={fanArcDegrees}
          mode={fanConfig?.mode}
          startAngle={fanConfig?.startAngle}
          expandSmallSlices={fanConfig?.expandSmallSlices}
          onPersonClick={onPersonClick}
          theme={theme}
          page={chartPage}
          overlays={overlays}
          colorForPerson={colorForPerson}
          {...overlayChartProps}
        />
      )}
      {chartType === 'circular' && (
        <CircularAncestorChart
          chartCanvasRef={chartCanvasRef}
          tree={ancestorTree}
          generations={generations}
          onPersonClick={onPersonClick}
          theme={theme}
          page={chartPage}
          overlays={overlays}
          colorForPerson={colorForPerson}
          {...overlayChartProps}
        />
      )}
      {chartType === 'radial-descendant' && (
        <RadialDescendantTimelineChart
          chartCanvasRef={chartCanvasRef}
          tree={descendantTree}
          onPersonClick={onPersonClick}
          theme={theme}
          page={chartPage}
          overlays={overlays}
          colorForPerson={colorForPerson}
          {...overlayChartProps}
        />
      )}
      {chartType === 'distribution' && (
        <DistributionChart
          chartCanvasRef={chartCanvasRef}
          persons={chartPersons}
          distributionData={distributionData}
          distributionType={distributionType}
          theme={theme}
          page={chartPage}
          overlays={overlays}
          colorForPerson={colorForPerson}
          {...overlayChartProps}
        />
      )}
      {chartType === 'statistics' && (
        <StatisticsChart chartCanvasRef={chartCanvasRef} theme={theme} />
      )}
      {chartType === 'lifespan' && (
        <LifespanDescendantChart
          chartCanvasRef={chartCanvasRef}
          tree={descendantTree}
          onPersonClick={onPersonClick}
          theme={theme}
          page={chartPage}
          overlays={overlays}
          colorForPerson={colorForPerson}
          {...overlayChartProps}
        />
      )}
      {chartType === 'timeline' && (
        <TimelineChart
          chartCanvasRef={chartCanvasRef}
          ancestorTree={ancestorTree}
          descendantTree={descendantTree}
          timelineData={timelineData}
          theme={theme}
          page={chartPage}
          overlays={overlays}
          colorForPerson={colorForPerson}
          {...overlayChartProps}
        />
      )}
      {chartType === 'genogram' && (
        <GenogramChart
          chartCanvasRef={chartCanvasRef}
          tree={descendantTree}
          genogramData={genogramData}
          options={genogramConfig}
          onPersonClick={onPersonClick}
          theme={theme}
          page={chartPage}
          overlays={overlays}
          {...overlayChartProps}
        />
      )}
      {chartType === 'sociogram' && (
        <SociogramChart
          chartCanvasRef={chartCanvasRef}
          sociogramData={sociogramData}
          onPersonClick={onPersonClick}
          theme={theme}
          page={chartPage}
          overlays={overlays}
          colorForPerson={colorForPerson}
          {...overlayChartProps}
        />
      )}
      {chartType === 'fractal-h-tree' && (
        <FractalAncestorChart
          chartCanvasRef={chartCanvasRef}
          tree={ancestorTree}
          generations={generations}
          onPersonClick={onPersonClick}
          theme={theme}
          page={chartPage}
          variant="h-tree"
          overlays={overlays}
          colorForPerson={colorForPerson}
          {...overlayChartProps}
        />
      )}
      {chartType === 'square-tree' && (
        <FractalAncestorChart
          chartCanvasRef={chartCanvasRef}
          tree={ancestorTree}
          generations={generations}
          onPersonClick={onPersonClick}
          theme={theme}
          page={chartPage}
          variant="square"
          overlays={overlays}
          colorForPerson={colorForPerson}
          {...overlayChartProps}
        />
      )}
      {chartType === 'fractal-tree' && (
        <FractalAncestorChart
          chartCanvasRef={chartCanvasRef}
          tree={ancestorTree}
          generations={generations}
          onPersonClick={onPersonClick}
          theme={theme}
          page={chartPage}
          variant="fractal"
          overlays={overlays}
          colorForPerson={colorForPerson}
          {...overlayChartProps}
        />
      )}
      {chartType === 'relationship' && (
        <RelationshipPathChart
          chartCanvasRef={chartCanvasRef}
          result={selectedRelationshipResult}
          pathCount={relationshipPaths.length}
          secondPicked={!!secondId}
          onPersonClick={onPersonClick}
          theme={theme}
          page={chartPage}
          overlays={overlays}
          colorForPerson={colorForPerson}
          {...overlayChartProps}
        />
      )}
      {chartType === 'virtual' && (
        <div className="flex h-full min-w-0">
          <VirtualTreeOptionsPanel {...virtualOptions} />
          <div className="relative flex-1">
            {virtualViewMode === '3d' ? (
              <VirtualTree3D
                virtualTreeData={virtualTreeData}
                symbolMode={virtualSymbolMode}
                colorMode={virtualColorMode}
                relationshipPathIds={relationshipPathIds}
                dof={virtualDof}
                layoutOptions={virtualLayoutOptions}
                showGenerationBands={virtualShowGenerationBands}
                onPick={(id) => openPersonInPanel({ recordName: id })}
              />
            ) : (
              <VirtualTreeDiagram
                chartCanvasRef={chartCanvasRef}
                tree={virtualSource === 'ancestor' ? ancestorTree : descendantTree}
                source={virtualSource}
                virtualTreeData={virtualTreeData}
                onPersonClick={onPersonClick}
                theme={theme}
                page={chartPage}
                overlays={overlays}
                colorForPerson={colorForPerson}
                {...overlayChartProps}
                options={{ orientation: virtualOrientation, hSpacing: virtualHSpacing, vSpacing: virtualVSpacing }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
