# MacFamilyTree Web Parity Todo

This backlog tracks MacFamilyTree 11 feature gaps that should be brought into the web app. The current pass starts with narrow correctness fixes for existing features; larger desktop-grade workflows are listed here for follow-up implementation.

## Chart Editing

- Add saved chart documents, not only reusable chart templates.
- Add object editing for chart overlays: text, images, lines, and selectable objects.
- Add alignment, bring-to-front/send-to-back, undo/redo, and delete controls.
- Add background editing, richer chart theme/style controls, and pagination/page setup.
- Add export/share flows for image, PDF, print, and browser-native sharing where available.

## Reports And Books

- Add additional report types from MacFamilyTree, including person list, distinctive persons, and richer narrative reports.
- Add report theme/style/page/background controls beyond current simple pagination.
- Improve saved reports so they preserve full report configuration and preview state.
- Improve book sections to support saved charts/reports, richer custom pages, and desktop-grade export/print behavior.
- Evaluate optional speech support for narrative reports through the Web Speech API.

## Places And Geocoding

- Add place lookup and create-from-lookup workflows.
- Add batch coordinate lookup for places without coordinates.
- Add GeoName ID lookup from coordinates and place names.
- Add convert-place-to-place-detail support.
- Add map preferences for provider/style/default zoom behavior.

## Search And Replace

- Add a dedicated search-and-replace tool for batch field updates.
- Support dry-run previews, per-record selection, undo/change-log entries, and field scoping.
- Reuse search field aliases so imported MacFamilyTree fields are included.

## Merge And Import Workflows

- Add merge-another-family-tree flow with progress and failure handling.
- Add GEDCOM import warnings/issues review before records are committed.
- Add GEDCOM media-folder selection and media relation handling.
- Add duplicate merge review screens closer to MacFamilyTree, including side-by-side decisions and progress.
- Keep relationship-safe merge rewiring tracked separately from this list, per current project scope.

## Preferences

- Add a settings/preferences surface.
- Cover general, database/local storage, name formats, date formats, maps, colors, PDF/export defaults, edit/function configuration, downloads, FamilySearch, and CloudTree placeholders or integrations.
- Store preferences in IndexedDB metadata so views share defaults.

## Research Assistant

- Replace purely heuristic suggestions with persisted research questions and completion state.
- Surface research context, question rows, answer/completion dates, and per-person completed-question masks.
- Add options for question generation, filtering, and ToDo creation from research questions.

## Current Implementation Fixes

- [x] Fix flat map coordinate lookup so `MapView` reads separate `Coordinate` records as well as direct place coordinates.
- [x] Fix smart scopes to normalize string and object references with `refToRecordName`.
- [x] Align search fields with imported MacFamilyTree aliases such as `geonameID`, `placeName`, and `cached_standardizedLocationString`.
- [x] Enforce private-record filtering consistently in charts, reports, tree traversal, and exports.
- [x] Replace editor placeholders with real attach/detach workflows for media, source citations, notes, and influential persons.
- [x] Promote generic CRUD screens for ToDos, DNA results, labels, groups, stories, and repositories into domain-specific workflows.
