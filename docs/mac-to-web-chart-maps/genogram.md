# Genogram chart map

## Mac evidence
- Native chart name is exposed as `GenogramChartPane`, `_FunctionTitle_GenogramChartPaneName`, `GenogramChartMaskIcon`, and `GenogramChart`.
- App/menu evidence includes `createGenogramChart:` and `_BasePersonAwareEditPane_CreateGenogramChartMenu`.
- Core builder symbols include `GenogramChartBuilder`, `GenogramChartBuilderConfiguration`, `GenogramPersonBuilderItemGeneratorChartCompositorObject`, and `GenogramPersonBuilderItemGeneratorChartCompositorObjectConfiguration`.
- Core config keys include `_GenogramPersonBuilderItemGeneratorChartCompositorObjectConfiguration_EventPosition`, `_..._EventPosition_Right`, `_..._EventsPosition_Below`, `_..._EventsBackground`, `_..._EventsBackground_None`, and `_..._EventsBackground_Filled`.

## Web implementation today
- Switch entry: `id: 'genogram'`.
- Render path: `GenogramChart` in `src/components/charts/SpecializedCharts.jsx`.
- Layout currently derives from descendant layout with altered connector/path styling.

## Mac ⇄ web mapping
- Mac `GenogramChartBuilder` -> web `chartType === 'genogram'`.
- Mac genogram person generator -> web should support event/fact placement around person boxes.
- Mac event background/position options -> currently not represented in web document state.

## Parity focus
- Add genogram options for event/fact visibility, event position, and event background style.
- Preserve and rehydrate node/line/event style fields from container payload into `GenogramChart`.
- Use person events/facts rather than only descendant tree structure when building genogram detail.
