# Distribution chart map

## Mac evidence
- Native chart name is exposed as `DistributionChartPane`, `_FunctionTitle_DistributionChartPaneName`, `DistributionChartMaskIcon`, and `DistributionChart`.
- Core builder symbols include `DistributionChartBuilder`, `DistributionChartBuilderConfiguration`, `DistributionChartBuilderItem`, and `DistributionChartBuilderItemValueRange`.
- Core style symbols include `DistributionChartCompositorStyleConfiguration` and `DistributionValuesBarGeneratorChartCompositorObjectConfiguration`.
- Core methods show the aggregation sources: `fillGenderDataIntoDistributionChartBuilderItem:`, `fillNameDataIntoDistributionChartBuilderItem:`, `fillPlaceDataIntoDistributionChartBuilderItem:`, `fillFactsDataIntoDistributionChartBuilderItem:`, and `fillEventValueDataIntoDistributionChartBuilderItem:`.
- `CoreCharts.strings` exposes distribution types for birth/death places and countries, first/last names, gender, occupations, illnesses, eye color, national/tribal origin, race, skin color, and caste name.

## Web implementation today
- Switch entry: `id: 'distribution'`.
- Data source: full persons list from `listAllPersons` in `ChartsApp`.
- Render path: `DistributionChart` in `src/components/charts/SpecializedCharts.jsx`.

## Mac ⇄ web mapping
- Mac `DistributionChartBuilder` -> web should aggregate indexed person/event/fact values into serializable distribution items.
- Mac `DistributionChartBuilderItemValueRange` -> web currently has no equivalent value-range document model.
- Mac bar/line/value-display configuration -> web currently renders a simplified static visualization.

## Parity focus
- Add distribution config fields for selected distribution type, relative/absolute values, graph type, and value labels.
- Build from persons, events, and facts, not persons only.
- Persist generated value ranges in chart documents so saved charts do not depend entirely on live recomputation.
