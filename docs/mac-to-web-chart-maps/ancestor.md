# Ancestor chart map

## Mac evidence
- Chart button/action is present in `ChartPanes.strings` (`_BaseChartFunctionPaneController_AncestorChartButtton`).
- Chart mode selectors include `showAncestorChart:` in binary-level strings.
- General chart build path names include builder-style entries for chart creation in extraction notes.
- Saved/persistence evidence includes `chartObjectsContainerData` and compositor-style restore flow.

## Web implementation today
- Switch entry: `CHART_TYPES` in `src/components/charts/ChartsApp.jsx` has `id: 'ancestor'`.
- Data source: `buildAncestorTree(rootId, generations)` from `src/lib/treeQuery.js`.
- Render path: `ChartsApp` -> `AncestorChart` (`src/components/charts/AncestorChart.jsx`).
- Layout function: `layoutAncestors` (`src/components/charts/layouts/ancestorLayout.js`).
- Persistence mapping currently ignores deeper compositor/config/style layers in `src/lib/chartContainerLoader.js` and writes only generic page + overlays.

## Mac ⇄ web mapping
- `showAncestorChart:` -> web chart switch `chartType === 'ancestor'` in `ChartsApp.jsx`.
- `openChartBuilderConfiguration:` + `openChartCompositor*Configuration:` -> no dedicated web pane yet; overlays/settings UI is consolidated under `ChartsApp` `More` popover.
- `chartCompositorObjectsContainerDataToUseForEditWithCompletionHandler:` -> loader only keeps a lossy best-effort decode in `chartContainerLoader.js`.

## Parity focus
- Add full chart-builder/compositor/state restore mapping for ancestor payload fields beyond `rootId` + `generations`.
- Add native-style edit-mode entry (`editChart`, read-only prompt, finish/cancel flow).
- Surface ancestor-only style/theme knobs inferred from `CoreCharts.strings` names (line/arrow/connector/person groups).
- Add export/page keys missing from ancestor route: separate pages, margins, JPEG quality/format/scaling options, print marks/page numbers.
