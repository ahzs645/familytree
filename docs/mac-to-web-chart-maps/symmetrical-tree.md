# Symmetrical Tree chart map

## Mac evidence
- Native chart name is exposed as `FractalSymmetricalTreeChartPane`, `_FunctionTitle_FractalSymmetricalTreeChartPaneName`, `FractalSymmetricalTreeChartMaskIcon`, and `FractalSymmetricalTreeChart`.
- Core builder symbols include `FractalSymmetricalTreeChartsBuilder` and `FractalSymmetricalTreeChartsBuilderConfiguration`.
- Layout symbols include `alignSymmetricalTreeSubItemsOfItem:withPreviousItem:withNormalizedIncomingVector:inContainer:withMaximumGeneration:`, `calculateSymmetricalTreeBestPointOnRect:...`, and `requiredSymmetricalTreeMoveDistanceForUpVector:...`.

## Web implementation today
- Switch entry: `id: 'symmetrical'` in `CHART_TYPES`.
- Render path: `TreeChart` with `variant='symmetrical'` in `src/components/charts/TreeChart.jsx`.
- Layout uses `layoutAncestorsUpward` and `layoutDescendants`.

## Mac ⇄ web mapping
- Mac `FractalSymmetricalTreeChart` -> web `chartType === 'symmetrical'`.
- Mac collision/placement methods suggest a more specialized layout than the current web tree composition.
- Mac builder configuration is not currently restored.

## Parity focus
- If payload inference sees `FractalSymmetricalTreeChart`, map it to `symmetrical`.
- Add layout spacing/collision settings if they become recoverable from Mac saved chart data.
- Keep generic chart editor/session/export parity aligned with the shared chart compositor.
