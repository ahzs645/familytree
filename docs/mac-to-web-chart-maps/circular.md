# Circular Tree chart map

## Mac evidence
- Native chart name is exposed as `FractalCircularTreeChartPane`, `_FunctionTitle_FractalCircularTreeChartPaneName`, `FractalCircularTreeChartMaskIcon`, and `FractalCircularTreeChart`.
- Core builder symbols include `FractalCircularTreeChartsBuilder` and `FractalCircularTreeChartsBuilderConfiguration`.
- Core layout/style symbols include `alignCircularTreeParentsOfItem:ringNumber:spotOnRing:withLargestItemSize:`, `CircularPersonChartCompositorStyle`, `CircularPersonBuilderItemGeneratorChartCompositorObject`, and circular style names such as `Light Circular`, `Dark Circular`, `Sunset Circular`, and `Organic Circular`.
- This is part of the shared fractal/static chart family, not the Virtual Tree Metal renderer.

## Web implementation today
- Switch entry: `id: 'circular'`.
- Render path: `CircularAncestorChart` in `src/components/charts/SpecializedCharts.jsx`.
- Layout function: circular fan-like layout in the same file, using `layoutAncestors` source data plus circle math.

## Mac ⇄ web mapping
- Mac `FractalCircularTreeChartPane` -> web `chartType === 'circular'`.
- Mac `FractalCircularTreeChartsBuilder` -> web ancestor traversal plus circular placement.
- Mac circular person compositor/style classes -> currently not mapped; web uses generic chart theme values.

## Parity focus
- Persist circular-specific layout/style fields rather than treating it as a generic fan variant.
- Add support for imported Mac style hints if `FractalCircularTreeChart` or circular compositor class names can be recovered from `chartObjectsContainerData`.
- Keep shared chart lifecycle parity: edit mode, save-as chart, export, print, share, and page-aware realign.
