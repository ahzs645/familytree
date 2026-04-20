# Fractal H-Tree chart map

## Mac evidence
- Native chart name is exposed as `FractalHTreeChartPane`, `_FunctionTitle_FractalHTreeChartPaneName`, and `FractalHTreeChartMaskIcon`.
- Core builder symbols include `BaseFractalChartsBuilder`, `BaseFractalChartsBuilderConfiguration`, `FractalHTreeChartsBuilder`, `FractalHTreeChartsBuilderConfiguration`, and `FractalChartPersonBuilderItem`.
- The shared fractal symbol `alignFractalTreeSubItemsOfItem:withPreviousItem:withNormalizedIncomingVector:inContainer:withMaximumGeneration:` indicates recursive vector-based placement.

## Web implementation today
- Switch entry: `id: 'fractal-h-tree'`.
- Render path: `FractalAncestorChart` variant `'h-tree'` from `SpecializedCharts.jsx`.
- Layout is in the local `layout` block inside `FractalAncestorChart`.

## Mac ⇄ web mapping
- Mac `FractalHTreeChartsBuilder` -> web `FractalAncestorChart` with `variant='h-tree'`.
- Mac base fractal builder/configuration -> web currently has only generation count and generic theme/page settings.

## Parity focus
- Persist fractal variant and layout parameters explicitly in chart documents/templates.
- If imported payloads expose a fractal builder class name, map `FractalHTreeChart` to `chartType: 'fractal-h-tree'`.
- Keep shared static chart editor/export/page lifecycle aligned with the regular chart compositor.
