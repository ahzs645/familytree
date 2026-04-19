# Fan chart map

## Mac evidence
- `_BaseChartFunctionPaneController_Fan` and `showFanChart:` style entry are present.
- Core config strings include arc and style-related chart config clusters (line/label/background/group metadata).

## Web implementation today
- Switch entry: `id: 'fan'`.
- Data source: `buildAncestorTree`.
- Render path: `FanChart` + `layoutFan` (`src/components/charts/FanChart.jsx`, `src/components/charts/layouts/fanLayout.js`).
- `layoutFan` already supports `arcDegrees` option.

## Mac ⇄ web mapping
- `showFanChart:` -> current `ChartsApp` fan branch.
- `arcDegrees` exists in template/commented schema (`src/lib/chartTemplates.js`) but is not currently exposed in UI when loading/saving templates/documents.

## Parity focus
- Add persisted fan-specific fields (`arcDegrees`, label style, slice style, placeholder/hidden behavior) to document/template payloads.
- Add native-style page/export controls for fan charts in this panel.
- Ensure path for realign/distribution actions applies consistently to fan overlay objects.
