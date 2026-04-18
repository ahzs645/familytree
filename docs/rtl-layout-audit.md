# RTL Layout Audit

Audit date: 2026-04-18

## Current Status

The app now has locale and direction preferences, root `lang`/`dir` wiring, bidi-safe labels in core list/search/chart paths, localized sorting/search helpers, MapLibre RTL plugin loading, and RTL-aware report/website HTML output.

The remaining RTL work is layout cleanup, not data handling. A scan for physical direction styles still finds `ml-*`, `mr-*`, `text-left`, `text-right`, `borderLeft`, `borderRight`, `marginLeft`, `marginRight`, `paddingLeft`, `paddingRight`, and absolute `left`/`right` placement in route and component files.

## Highest Priority Files

- `src/routes/Media.jsx` uses physical `marginLeft`, `marginRight`, `borderLeft`, and `textAlign: 'left'` in the gallery detail panel.
- `src/components/editors/MasterDetailList.jsx` uses `borderLeft` and `borderRight` for the shared master/detail shell.
- `src/components/books/BooksApp.jsx`, `src/components/charts/ChartsApp.jsx`, `src/components/reports/ReportsApp.jsx`, and `src/components/reports/ReportPreview.jsx` still have physical sidebars, margins, and table alignment.
- `src/routes/WorldHistory.jsx`, `src/components/MiniTimeline.jsx`, and slideshow controls use absolute `left`/`right` positioning that needs mirrored placement.
- CRUD-heavy routes such as `ToDos`, `Labels`, `DNAResults`, `SourceRepositories`, `Stories`, `PersonGroups`, `FamilySearch`, and `Favorites` still use `ml-auto`, `mr-auto`, and `text-left`.

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
