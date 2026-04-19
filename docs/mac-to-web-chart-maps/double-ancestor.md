# Double Ancestor chart map

## Mac evidence
- `_BaseChartFunctionPaneController_DoubleAncestor` key and likely `show...` selector path are present.
- Mac logic in extraction references two-person selection flows and double-side layouting in chart UI context.

## Web implementation today
- Switch entry: `id: 'double-ancestor'`.
- Data source: `rootId` and `secondId` each run through `buildAncestorTree`.
- Render path: `DoubleAncestorChart` (`src/components/charts/DoubleAncestorChart.jsx`).
- Layout function: `layoutAncestors` (once for each side, one mirrored).

## Mac ⇄ web mapping
- `needsSecond: true` in web mirrors Mac requirement for pair selection.
- `perform*` object command layer exists (`add/remove/align/...`) but no direct second-chart-specific property inspector for spouse/probands.
- Native style path (`openChartCompositorStyleConfiguration`) is only generic and not wired for this mode.

## Parity focus
- Persist and restore double-ancestor pair-specific options from container schema (`chartObjectsContainerData`), especially relation line style and marriage connector settings.
- Add explicit second-person selection validation and selection messaging if a pair is incompatible.
- Add share/share-as-image/pdf parity in chart actions for this mode.
