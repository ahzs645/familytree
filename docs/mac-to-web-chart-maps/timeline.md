# Timeline chart map

## Mac evidence
- Native chart name is exposed as `TimelineChartPane`, `_FunctionTitle_TimelineChartPaneName`, `TimelineChartMaskIcon`, and `TimelineChart`.
- Core builder symbols include `TimelineChartBuilder`, `TimelineChartBuilderConfiguration`, `TimelinePersonChartBuilderItem`, `TimelineHistoryPersonChartBuilderItem`, `TimelineItemGroupChartBuilderItem`, and `TimelineChartBuilder_HistoryPersons_Key`.
- Core style/config symbols include `TimelineBarChartCompositorStyleConfiguration`, `TimelineFromToChartCompositorStyleConfiguration`, and `TimelineBoxBackgroundGroupBuilderItemGeneratorChartCompositorObjectConfiguration`.
- `CoreCharts.strings` exposes grouping by birth/death country or place, last name, gender, or sort-by-date, plus `CollapseAllGroupsForBestFit`, history/famous-person groups, from/to dates, graph/bar/text/event-marker options.

## Web implementation today
- Switch entry: `id: 'timeline'`.
- Data source: both `buildAncestorTree` and `buildDescendantTree` merged in `TimelineChart`.
- Render path: `TimelineChart` in `src/components/charts/SpecializedCharts.jsx`.

## Mac ⇄ web mapping
- Mac `TimelineChartBuilder` -> web timeline chart generation.
- Mac timeline item groups/history persons -> web currently has no persisted timeline group item model.
- Mac bar/from-to compositor styles -> web currently renders simplified timeline rows.

## Parity focus
- Build timeline from person events, family events, optional history events, and date ranges, not only ancestor/descendant nodes.
- Persist grouping mode, date range, collapse-for-fit, marker mode, and style fields in chart documents.
- Add support for famous/history rows if those records are available from imported data.
