# Genogram chart map

## Mac evidence
- No clear genogram/nomenclature match in extracted chart button keys.
- Native style groups include person/group/link/event/background blocks, so generic mapping may still apply.

## Web implementation today
- Switch entry: `id: 'genogram'`.
- Render path: `GenogramChart` in `src/components/charts/SpecializedCharts.jsx`.
- Layout from `layoutDescendants` with connector/path stroke styling.

## Mac ⇄ web mapping
- No direct selector evidence in current decompile snapshot.
- Could be covered indirectly by generic chart/object config system if payload fields are generic enough.

## Parity focus
- Preserve and rehydrate generic node/line style fields from container payload into genogram render options.
- Decide whether genogram is native-implemented under another chart type in future passes.
- Add missing edit/session UI parity and export path controls.
