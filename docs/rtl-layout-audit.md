# RTL Layout Audit

Audit date: 2026-04-18

## Current Status

The app now has locale and direction preferences, root `lang`/`dir` wiring, bidi-safe labels in core list/search/chart paths, localized sorting/search helpers, MapLibre RTL plugin loading, and RTL-aware report/website HTML output.

The high-priority physical layout cleanup has been completed. A follow-up scan for physical direction styles now only reports data structure keys (`left`/`right` in chart math), DOM geometry (`getBoundingClientRect().left`), and a generated record id prefix (`mr-imp`) that should stay unchanged.

## Completed Files

- `src/routes/Media.jsx` now uses logical detail-panel borders.
- `src/components/editors/MasterDetailList.jsx` now uses logical active-row borders and master/detail pane borders.
- `src/components/books/BooksApp.jsx`, `src/components/charts/ChartsApp.jsx`, `src/components/reports/ReportsApp.jsx`, and `src/components/reports/ReportPreview.jsx` now use logical sidebars, margins, table alignment, and localized count formatting.
- `src/routes/WorldHistory.jsx`, `src/components/MiniTimeline.jsx`, and slideshow controls now use logical timeline/absolute placement.
- CRUD-heavy routes such as `ToDos`, `Labels`, `DNAResults`, `SourceRepositories`, `Stories`, `PersonGroups`, `FamilySearch`, and `Favorites` now use `ms-*`, `me-*`, and `text-start` utilities.

## Remediation Pattern

- Replace `ml-*`/`mr-*` with logical Tailwind utilities such as `ms-*`, `me-*`, `ms-auto`, and `me-auto`.
- Replace `pl-*`/`pr-*` with `ps-*`/`pe-*`.
- Replace `text-left`/`text-right` with `text-start`/`text-end`.
- Replace inline `marginLeft`/`marginRight`/`paddingLeft`/`paddingRight` with `marginInlineStart`/`marginInlineEnd`/`paddingInlineStart`/`paddingInlineEnd`.
- Replace inline `borderLeft`/`borderRight` with `borderInlineStart`/`borderInlineEnd`.
- For absolute controls, use `insetInlineStart` and `insetInlineEnd` unless coordinates are mathematical canvas/chart positions.

## Verification Checklist

- Arabic locale with forced RTL: people list, search, FamilySearch, media, books, reports, charts, websites, and maps.
- Mixed Arabic/English names render inside `bdi` or `dir="auto"` containers.
- Tables use start/end alignment.
- Report/book/PDF previews preserve number and punctuation order.
- Chart labels use grapheme-aware wrapping for long Arabic names.
