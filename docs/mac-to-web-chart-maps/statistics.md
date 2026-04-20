# Statistics chart map

## Mac evidence
- Native chart name is exposed as `StatisticsChartPane`, `_FunctionTitle_StatisticsChartPaneName`, `StatisticsChartMaskIcon`, and `StatisticsChart`.
- Core builder symbols include `StatisticsChartBuilder`, `StatisticsChartBuilderConfiguration`, `StatisticsChartCompositorStyleConfiguration`, `TableGraphChartBuilderItem`, and `TableGraphChartBuilderItemValue`.
- Core methods include `fillAgeOfDeathDataIntoTableGraphChartBuilderItem:`, `fillBirthMonthDataIntoTableGraphChartBuilderItem:`, `fillGenderDataIntoTableGraphChartBuilderItem:`, and `fillPlacesDataIntoTableGraphChartBuilderItem:`.
- `CoreCharts.strings` exposes statistics types for age at death, marriage, divorce, christening, retirement, parents' age at child birth, child age at parents' death, time between marriage and birth of child, months, children per family, gender, first/last names, titles, years, places, and person facts.

## Web implementation today
- There is no `statistics` chart switch entry in `src/components/charts/ChartsApp.jsx`.
- The app has a separate `src/routes/Statistics.jsx` route and a chart-adjacent `DistributionChart`.

## Mac ⇄ web mapping
- Mac `StatisticsChartBuilder` is an aggregation/table-graph chart path, closer to the web Statistics route than to lineage chart renderers.
- Mac `TableGraphChartBuilderItem` suggests a reusable document model for tabular graph items if this is folded into `/charts`.

## Parity focus
- Decide whether Statistics remains a separate route or becomes a chart mode.
- If added to `/charts`, store selected statistic type, graph type, category labels, table values, and compositor style in the chart document.
- Reuse existing statistics aggregation logic where possible instead of duplicating calculations inside React components.
