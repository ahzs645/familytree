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
  - [x] Add API-backed auth URL generation, match search, person compare, merge analysis, and guarded merge submission after credentials and API terms are confirmed.
- [ ] Author Information
  - [x] Add tree-level author/contact/address/copyright metadata.
  - [x] Add tree icon/cover media reference support.
  - [x] Feed author metadata into books, website export, GEDCOM, and report headers where appropriate.
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
  - [x] Add browser-safe file picker flows for pictures, PDFs, audio, video, and URLs.
  - [x] Add camera capture where available through `getUserMedia`.
  - [x] Add audio recording where available through `MediaRecorder`.
  - [x] Add image edit/enhance basics: crop, rotate, caption, and asset replacement.
  - [ ] Document unavailable native-only features such as macOS Photos library and scanner integration.
- [ ] Contacts import equivalent
  - [x] Add CSV/vCard import for people.
  - [ ] Add optional browser Contact Picker support where available.
- [ ] Native document/file lifecycle equivalents
  - [x] Expand import/open coverage beyond current `.mftpkg`, inner `database`, JSON, and GEDCOM subset flows.
  - [x] Add `.uged`, `.uged16`, GedZip, and richer `.mftsql`/`.mft` handling where practical.
  - [x] Import `.mftpkg` folders with resources instead of only the inner database file.
  - [x] Add package round-trip/export for `.mftpkg`-style database plus resources, thumbnails, and metadata.
  - [x] Add GEDCOM media-folder association for OBJE records and imported media references.
  - [x] Add explicit UTF-8/UTF-16 GEDCOM decoding during import.
  - [x] Add clearer tree picker/create/rename/delete workflows for local trees.
- [ ] Publishing target depth
  - [x] Add FTP/SFTP publishing target profiles for website exports; browser builds prepare/download the zip because direct FTP/SFTP sockets require an external uploader or native bridge.
  - [ ] Add richer website theme management.
  - [ ] Add publish status history and validation logs.
- [ ] Desktop-style function configuration
  - [ ] Add per-category function enable/disable/emphasis/favorite controls.
  - [ ] Reflect those settings in navigation, Home, and Favorites.

## Chart Editing

- [x] Add saved chart documents, not only reusable chart templates.
- [x] Add object editing for chart overlays: text, images, lines, and selectable objects.
- [x] Add alignment, bring-to-front/send-to-back, undo/redo, and delete controls.
- [x] Add background editing, richer chart theme/style controls, and pagination/page setup.
- [ ] Add export/share flows for image, PDF, print, and browser-native sharing where available.
- [ ] Bring chart behavior closer to MacFamilyTree 11 chart pipeline. AI task list: [AI chart/view parity task list](./ai-chart-view-parity-task-list.md). Research packet: [MacFamilyTree chart parity implementation research](./mac-to-web-chart-implementation-research.md).
  - [x] Relationship path parity: multiple paths, bloodline-only toggle, selected path state, path reset, and direct relationship-path tests.
  - [ ] Chart document schema expansion: `builderConfig`, `compositorConfig`, `exportSettings`, richer `pageSetup`, per-chart options, and migration from current shallow documents.
  - [ ] Page/export/share parity: margins, page overlap, page numbers, cut marks, omit-empty-pages behavior, JPEG quality, scaling, background toggle, and browser-native share fallback.
  - [ ] Distribution, timeline, and statistics aggregation builders from real `PersonEvent`, `FamilyEvent`, and `PersonFact` records instead of summary-only chart inputs.
  - [ ] Genogram real data builder with family structure, fact/event/label markers, and genogram-specific symbol options.
  - [ ] Sociogram real data builder from `AssociateRelation` plus toggles for parents, grandparents, partners, children, siblings, and associate relation classes.
  - [ ] Interactive Tree actions: add relatives, edit/delete person/family routing, node context menu, flat viewer, and camera presets.
  - [ ] Full Virtual Tree WebGL feature using Three.js, with person/family/connection scene objects, relationship path highlighting, color modes, symbols, depth-of-field/camera controls, and snapshot/export.

## Broader Views Audit

- [ ] Audit non-chart MacFamilyTree views from `/Users/ahmadjalil/Downloads/family tree/app/MacFamilyTree 11/Contents` and compare them to web routes for Views, Lists, Tree, Places, Statistics, Reports, Books, Publish, Media, Sources, and person/family editors.
- [ ] Produce `docs/mac-to-web-views-parity-audit.md` with Mac evidence, current web coverage, gaps, and implementation order.

## Reports And Books

- [x] Add additional report types from MacFamilyTree, including person list, distinctive persons, and richer narrative reports.
- [x] Add report theme/style/page/background controls beyond current simple pagination.
- [x] Improve saved reports so they preserve full report configuration and preview state.
- [x] Improve book sections to support richer custom pages and desktop-grade export/print behavior.
- [ ] Add book sections for saved chart and saved report embeds.
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
- [x] Add persisted done/ignored state for generated and imported research questions.
- Surface research context, question rows, answer/completion dates, and per-person completed-question masks.
- Add options for question generation, filtering, and ToDo creation from research questions.

## DNA Detail

- [x] Add dedicated ATDNA, MTDNA, and YDNA detail fields.
- [x] Track raw-data file references, MTDNA SNP differences, and YDNA Y-STR markers.
- Add export/report coverage for DNA test summaries.

## Localization

- Add a string catalog layer if multi-language UI becomes a product goal.
- Keep imported localized MacFamilyTree data labels distinct from application UI translations.

## Arabic And RTL Compatibility

webtrees is the strongest genealogy reference for this work: it has Arabic translations, sets `lang`/`dir` at the root layout, uses RTL CSS processing, flips direction-sensitive icons, isolates user-generated text, uses locale-aware sorting, and has explicit report/PDF RTL handling.

- [x] Add a small app i18n layer for active locale, text direction, `Intl.Collator`, `Intl.NumberFormat`, Arabic search normalization, and reusable bidi text isolation.
- [x] Add language/direction preferences, including locale, direction override, numbering system, and calendar.
- [x] Set `document.documentElement.lang` and `document.documentElement.dir` from app preferences instead of leaving the app hard-coded to English/LTR.
- [x] Replace remaining physical left/right styling with logical equivalents such as `start`/`end`, `ms`/`me`, `ps`/`pe`, `text-start`, `border-inline-start`, and `inset-inline-end`. Current audit: [RTL Layout Audit](./rtl-layout-audit.md).
- [x] Upgrade core people/search/list/report/export paths to use locale-aware collation plus normalized Arabic search keys while preserving original stored values.
- [x] Make chart and tree labels bidi-safe and avoid UTF-16 string-length truncation.
- [x] Add grapheme-aware wrapping or measurement for long chart labels.
- [x] Add MapLibre RTL text plugin loading so Arabic and Hebrew map labels render correctly.
- [x] Add `lang`/`dir`, bidi isolation, and logical CSS to static website and report exports.
- [x] Audit generated PDFs/reports/books for RTL text, numbers, punctuation, and table alignment.
- [ ] Add Arabic fixture-driven browser smoke checks for people lists, charts, maps, reports, and exports.

### Next Arabic/RTL Work

- [x] Finish the RTL layout audit across the rest of the app: replace remaining `ml-*`, `mr-*`, `text-left`, `borderLeft`, `borderRight`, and physical timeline/sidebar styles outside the already-converted shell, people, search, and export paths.
- [x] Add Arabic fixture smoke data with Arabic names, mixed Arabic/English names, Arabic places, and date-heavy records.
- [ ] Verify Arabic fixtures in people list search, sorting/grouping, charts/tree labels, reports, website export, and maps.
- [x] Improve chart label wrapping: move beyond bidi-safe grapheme truncation to grapheme-aware wrapping or measured fitting for longer Arabic names.
- [x] Audit reports/books/PDF output for RTL table alignment, punctuation flow, numbered lists, localized numbers, and mixed-direction text.
- [x] Add regression tests for i18n helpers covering alef variants, ta marbuta, diacritics, tatweel, hamza forms, and mixed-direction matching.

## Current Implementation Fixes

- [x] Fix flat map coordinate lookup so `MapView` reads separate `Coordinate` records as well as direct place coordinates.
- [x] Fix smart scopes to normalize string and object references with `refToRecordName`.
- [x] Align search fields with imported MacFamilyTree aliases such as `geonameID`, `placeName`, and `cached_standardizedLocationString`.
- [x] Enforce private-record filtering consistently in charts, reports, tree traversal, and exports.
- [x] Replace editor placeholders with real attach/detach workflows for media, source citations, notes, and influential persons.
- [x] Promote generic CRUD screens for ToDos, DNA results, labels, groups, stories, and repositories into domain-specific workflows.
