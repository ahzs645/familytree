# Saved Charts map

## Mac evidence
- Native pane name is exposed as `SavedChartsPane`, `_FunctionTitle_SavedChartsPaneName`, `SavedChartsMaskIcon`, and `SavedCharts`.
- Resource strings include `SavedChartsPane.strings`, `SavedChartsPaneCollectionViewItem.strings`, edit/remove/rename labels, empty-state text, and delete confirmation text.
- Book insertion uses `BookSavedChartPageReportBuilderSectionSheet.nib` with a `savedChartPopUpButton` plus `done:` and `close:` actions.
- Core object description key: `ObjectProperty_SavedChart_chartObjectsContainerData`.
- App binary methods include `saveAsSavedChart`, `setChartObjectsContainerDataFromSavedChart:`, `chartObjectsContainerDataToUseForEditWithCompletionHandler:`, and `reportNodesContainerDataToUseForEditWithCompletionHandler:`.

## Web implementation today
- Route: `/saved-charts` via `src/routes/SavedCharts.jsx`.
- Web chart documents are stored by `src/lib/chartDocuments.js`.
- Templates are stored by `src/lib/chartTemplates.js`.
- Imported Mac chart payloads are handled by `src/lib/chartContainerLoader.js`, then surfaced from `SavedCharts.jsx`.

## Mac ⇄ web mapping
- Mac `chartObjectsContainerData` -> web should preserve imported raw payload metadata and separately expose decoded web chart state where inference succeeds.
- Mac save-as-chart flow -> web `saveChartDocument`, with a shallower schema.
- Mac book/report saved-chart insertion -> no direct web equivalent today.

## Parity focus
- Keep raw Mac `chartObjectsContainerData` attached to imported saved-chart records when possible.
- Expand `chartContainerLoader.js` inference for confirmed class names: fractal/circular/symmetrical/genogram/sociogram/timeline/statistics/distribution.
- Add rename/delete/edit lifecycle parity and a clearer decoded-vs-preserved status in Saved Charts UI.
