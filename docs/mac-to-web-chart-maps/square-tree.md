# Square Tree chart map

## Mac evidence
- Native chart name is exposed as `FractalHVTreeChartPane`, `_FunctionTitle_FractalHVTreeChartPaneName`, `FractalHVTreeChartMaskIcon`, and `FractalHVTreeChart`.
- The extraction note maps this mode label to `Square Tree`.
- Core builder symbols include `FractalHVTreeChartsBuilder`, `FractalHVTreeChartsBuilderConfiguration`, `BaseFractalChartsBuilder`, and `FractalChartPersonBuilderItem`.

## Web implementation today
- Switch entry: `id: 'square-tree'`.
- Render path: `FractalAncestorChart` variant `'square'` in `src/components/charts/SpecializedCharts.jsx`.

## Mac ⇄ web mapping
- Mac `FractalHVTreeChart` -> web `chartType === 'square-tree'`.
- Mac `FractalHVTreeChartsBuilder` -> web square/fractal recursive layout variant.
- Mac builder configuration is not currently mapped into document state.

## Parity focus
- Map imported `FractalHVTreeChart` hints to `square-tree` instead of treating it as an unknown chart.
- Persist square-tree variant configuration explicitly.
- Preserve generic chart compositor/page/export metadata on save/load.
