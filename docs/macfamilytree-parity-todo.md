# MacFamilyTree Web Parity Todo

This backlog tracks MacFamilyTree 11 feature gaps that should be brought into the web app. The current pass starts with narrow correctness fixes for existing features; larger desktop-grade workflows are listed here for follow-up implementation.

Detailed bundle audit: [MacFamilyTree 11 Bundle Audit](./macfamilytree-11-bundle-audit.md).

## Scope

- Include MacFamilyTree desktop parity work that can run locally in the browser or through ordinary web integrations.
- Exclude CloudTree/iCloud sync, iCloud Drive state, CloudKit sharing, shared-database permissions, share invitations, and iCloud conflict resolution unless explicitly re-scoped later.

## Missing Desktop Sections

- [ ] FamilySearch workspace and integration
  - [x] Surface existing FamilySearch IDs, unmatched people, and local match status.
  - [x] Add person search links and external search launch from current person data.
  - [x] Track local FamilySearch tasks such as match review, record match review, picture download, and ordinance review.
  - [ ] Add API-backed login/search/compare/merge only after credentials and API terms are confirmed.
- [ ] Author Information
  - [x] Add tree-level author/contact/address/copyright metadata.
  - [x] Add tree icon/cover media reference support.
  - [ ] Feed author metadata into books, website export, GEDCOM, and report headers where appropriate.
- [x] Web Search
  - [x] Add a person-aware external web search pane.
  - [x] Support search-provider templates and custom URLs.
  - [x] Support inserting found/typed values into person fields or notes.
- [x] Favorites hub
  - [x] Add configurable favorite function shortcuts, not just record bookmarks.
  - [x] Add category/function enabled and emphasized state.
  - [x] Keep current record bookmarks as a sub-section.
- [x] Settings and Preferences
  - [x] Add general, database/local storage, display, name format, date format, maps, colors, PDF/export, downloads, edit behavior, Web Search, FamilySearch, and function configuration sections.
  - [x] Store preferences in IndexedDB metadata and let routes read shared defaults.
  - [x] Add import/export of app preferences.
- [ ] Native media acquisition equivalents
  - [ ] Add browser-safe file picker flows for pictures, PDFs, audio, video, and URLs.
  - [ ] Add camera capture where available through `getUserMedia`.
  - [ ] Add audio recording where available through `MediaRecorder`.
  - [ ] Add image edit/enhance basics: crop, rotate, caption, and asset replacement.
  - [ ] Document unavailable native-only features such as macOS Photos library and scanner integration.
- [ ] Contacts import equivalent
  - [ ] Add CSV/vCard import for people.
  - [ ] Add optional browser Contact Picker support where available.
- [ ] Native document/file lifecycle equivalents
  - [ ] Expand import/open coverage beyond current `.mftpkg`, inner `database`, JSON, and GEDCOM subset flows.
  - [ ] Add `.uged`, `.uged16`, GedZip, and richer `.mftsql`/`.mft` handling where practical.
  - [ ] Add package round-trip/export for `.mftpkg`-style database plus resources, thumbnails, and metadata.
  - [ ] Add GEDCOM media-folder association and explicit encoding selection during import.
  - [ ] Add clearer tree picker/create/rename/delete workflows for local trees.
- [ ] Publishing target depth
  - [ ] Add FTP/SFTP publishing option for website exports.
  - [ ] Add richer website theme management.
  - [ ] Add publish status history and validation logs.
- [ ] Desktop-style function configuration
  - [ ] Add per-category function enable/disable/emphasis/favorite controls.
  - [ ] Reflect those settings in navigation, Home, and Favorites.

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
- Cover general, database/local storage, name formats, date formats, maps, colors, PDF/export defaults, edit/function configuration, downloads, and FamilySearch placeholders or integrations. CloudTree/iCloud remains excluded by this pass.
- Store preferences in IndexedDB metadata so views share defaults.

## Research Assistant

- Replace purely heuristic suggestions with persisted research questions and completion state.
- Surface research context, question rows, answer/completion dates, and per-person completed-question masks.
- Add options for question generation, filtering, and ToDo creation from research questions.

## DNA Detail

- Add dedicated ATDNA, MTDNA, and YDNA detail views.
- Track imported raw-data file references, MTDNA SNP differences, and YDNA Y-STR markers.
- Add export/report coverage for DNA test summaries.

## Localization

- Add a string catalog layer if multi-language UI becomes a product goal.
- Keep imported localized MacFamilyTree data labels distinct from application UI translations.

## Current Implementation Fixes

- [x] Fix flat map coordinate lookup so `MapView` reads separate `Coordinate` records as well as direct place coordinates.
- [x] Fix smart scopes to normalize string and object references with `refToRecordName`.
- [x] Align search fields with imported MacFamilyTree aliases such as `geonameID`, `placeName`, and `cached_standardizedLocationString`.
- [x] Enforce private-record filtering consistently in charts, reports, tree traversal, and exports.
- [x] Replace editor placeholders with real attach/detach workflows for media, source citations, notes, and influential persons.
- [x] Promote generic CRUD screens for ToDos, DNA results, labels, groups, stories, and repositories into domain-specific workflows.
