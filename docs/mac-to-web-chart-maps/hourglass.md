# Hourglass chart map

## Mac evidence
- `showHourglassChart` / `_BaseChartFunctionPaneController_Hourglass` appears in extraction.
- Symbol set implies shared builder + compositor flow (container rebuild + style/config restoration).

## Web implementation today
- Switch entry: `id: 'hourglass'`.
- Data source: `buildAncestorTree` + `buildDescendantTree`; merged inside `HourglassChart`.
- Layout mix: `layoutAncestorsUpward` + `layoutDescendants`.
- Render file: `src/components/charts/HourglassChart.jsx`.

## Mac ⇄ web mapping
- `showHourglassChart:` -> `chartType === 'hourglass'` in switch.
- Compositor/config data from Mac payload currently discarded in inference layer.
- No native parity controls for hourglass-specific spacing/tuning currently exposed in UI.

## Parity focus
- Thread through hourglass-specific compositor knobs (if present) into `currentDocumentState` + load/save schema.
- Add dedicated save/edit state and read-only behavior for locked charts.
- Add print/share workflow parity (share/save-as-image/pdf) in chart toolbar.
