# Descendant chart map

## Mac evidence
- Chart button/action is present (`_BaseChartFunctionPaneController_Descendant`, likely `showDescendantChart:`).
- Extracted pipeline shows a generic builder stage with builder container and compositor conversion.
- Overlay edit commands are present in app-level action set (add/move/remove/align/realign/etc.).

## Web implementation today
- Switch entry: `id: 'descendant'` in `CHART_TYPES` (`src/components/charts/ChartsApp.jsx`).
- Data source: `buildDescendantTree(rootId, min(generations, 4))`.
- Render path: `DescendantChart` (`src/components/charts/DescendantChart.jsx`).
- Layout function: `layoutDescendants` (`src/components/charts/layouts/descendantLayout.js`).
- Persistent state: only shallow `page`, `chartTitle`, `chartNote`, overlays in `chartContainerLoader.js`.

## Mac ⇄ web mapping
- `showDescendantChart:` -> `chartType === 'descendant'` in `ChartsApp.jsx`.
- `buildDescendantsSectionForPerson:` (documented symbol cluster style) -> `buildDescendantTree` + `layoutDescendants`.
- Compositor/style save keys (`chartCompositorStyle...`) are currently not reconstructed in web route state.

## Parity focus
- Preserve descendant-specific style/path payload if present in imported `chartObjectsContainerData`.
- Add native-style page setup options (margins/print/background/image/export format) in descendant panel state.
- Add overlay realignment modes (page-aware move away from cuts / border distribute) in `useChartObjectCommands` so descendant overlays match desktop behavior.
