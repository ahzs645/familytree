# Fractal Tree chart map

## Mac evidence
- Native chart name is exposed as `FractalFractalTreeChartPane`, `_FunctionTitle_FractalFractalTreeChartPaneName`, `FractalFractalTreeChartMaskIcon`, and `FractalFractalTreeChart`.
- Core builder symbols include `FractalFractalTreeChartsBuilder`, `FractalFractalTreeChartsBuilderConfiguration`, `BaseFractalChartsBuilder`, and `FractalChartPersonBuilderItem`.
- Shared fractal layout symbol: `alignFractalTreeSubItemsOfItem:withPreviousItem:withNormalizedIncomingVector:inContainer:withMaximumGeneration:`.

## Web implementation today
- Switch entry: `id: 'fractal-tree'`.
- Render path: `FractalAncestorChart` variant `'fractal'` in `src/components/charts/SpecializedCharts.jsx`.

## Mac ⇄ web mapping
- Mac `FractalFractalTreeChartsBuilder` -> web `FractalAncestorChart` with `variant='fractal'`.
- Mac recursive normalized-vector layout -> web recursive fractal point placement.
- Mac compositor style/configuration fields are not currently restored.

## Parity focus
- Map imported `FractalFractalTreeChart` payload hints to `chartType: 'fractal-tree'`.
- Store variant-specific spacing/angle parameters when the web UI exposes them.
- Rehydrate generic chart object styles from Mac saved-chart containers where possible.
