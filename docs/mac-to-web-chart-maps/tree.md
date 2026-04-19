# Tree chart map (horizontal)

## Mac evidence
- Tree chart action is present (`_BaseChartFunctionPaneController_Tree`, `showTreeChart`).

## Web implementation today
- Switch entry: `id: 'tree'` in `CHART_TYPES` (`src/components/charts/ChartsApp.jsx`).
- Data source: ancestor + descendant trees.
- Render path: `TreeChart` variant `'horizontal'` from `src/components/charts/TreeChart.jsx`.
- Layout split: `layoutAncestors` and `layoutDescendants` + `layoutAncestorsUpward` depending side.

## Mac ⇄ web mapping
- `showTreeChart:` -> `chartType === 'tree'` with `variant='horizontal'`.
- No explicit native tree-compositor keys are currently mapped to the web document beyond shared style/page fields.

## Parity focus
- Add tree-compositor fields from container payload to `TreeChart` document state and save pipeline.
- Add native-style edit/session behavior (dirty prompts, read-only copy handling, finish edit mode).
- Keep node-level styles/edge style parity placeholders for connectors and marriage links from native style groups.
