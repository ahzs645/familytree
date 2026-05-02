# MacFamilyTree 11 to Web Option-Depth Parity Audit

Date: 2026-05-02

This audit compares the current web app against the local MacFamilyTree 11 bundle at:

`/Users/ahmadjalil/Downloads/family tree/app/MacFamilyTree 11/Contents`

It focuses on areas where the web app already has the broad feature, but is still missing Mac-style presentation depth, configuration sheets, option breadth, or workflow placement.

## Explicitly Out of Scope

Per request, this audit ignores:

- AI image editing depth.
- Native Photos.app browsing, scanner, and ImageCaptureCore support.
- Browser Contact Picker import.
- FamilySearch deep parity.
- CloudTree, iCloud, MacFamilyTree.com, CloudKit sharing, invitations, and conflict handling.
- Offline geographic database download management.

## High-Level Pattern

The web app now covers a large amount of the Mac feature map: smart filters, custom types, backups, change history, subtree tooling, media capture, ToDo creation, schema migration, charts, books, reports, websites, maps, places, sources, and broad editor workflows are present.

The remaining gaps are mostly not missing routes. They are missing the Mac app's dense configuration surfaces: reusable scope popups, sectioned multi-column list controls, per-report and per-book style sheets, export sheets, chart option drawers, interactive tree visual controls, media selection/slideshow controls, editor action rails, and deeper template/key editors.

## Priority Backlog

1. Standardize all list pages on a Mac-style list surface: search, smart filter scope, column chooser, saved sort profile, export, multi-select, and row actions.
2. Add shared presentation/export settings for reports and books: page, theme/style, language, author metadata, filename, PDF background, privacy toggles, and print/share behavior.
3. Upgrade books from inline manual composition to Mac-like setup and section configuration sheets.
4. Add chart and visual-view option drawers: theme/style/export/page settings, native object inspector, interactive tree options, virtual tree options, globe/map scope and display controls.
5. Add editor contextual actions: map, timeline, history, plausibility, chart/report/web-search shortcuts, and duplicate actions.
6. Deepen media gallery/slideshow controls and source/place template authoring.
7. Make settings/preferences actually feed the relevant surfaces consistently.

## Lists, Search, and Smart Filters

### Reusable List Scope Picker

Mac evidence:

- Large multi-column list NIBs for person, family, place, source, and ToDo lists include `ScopeSelectionPopupButton`.
- `VirtualGlobePane.strings` includes no-results language for search/scope filtering.

Current web coverage:

- Smart scope consumption appears in `src/components/search/SearchApp.jsx`.
- Generic list table behavior is in `src/components/lists/SortableListTable.jsx`.
- Many list routes still use local fixed filters.

Gap:

The smart-filter/scope picker is not applied across persons, families, places, sources, todos, events, facts, anniversaries, marriages, plausibility, analysis, maps, charts, and reports. Mac treats scope as a standard list/view control.

Recommendation:

Add a reusable list toolbar scope selector backed by `listAllScopes` / `runScope`, then wire it into every entity list and visual/report surface that can reasonably be scoped.

### Column Chooser and Column Catalogs

Mac evidence:

- Dedicated large list widgets exist for people, families, places, sources, and todos.
- `CoreSectionedList.strings` includes broad column/grouping concepts: age, event dates/places, family count, picture, number system, creation/change date, notes/media/source/coordinates, labels, assigned entries, status, priority, type, repository, template, event count, and more.

Current web coverage:

- `src/components/lists/ColumnChooser.jsx` exists.
- `src/routes/Persons.jsx` uses it, but with a small column set.
- Other list routes often use fixed columns.

Gap:

Column visibility is shallow and mostly person-list specific. Mac list depth is cross-entity and includes many hidden-by-default administrative and genealogy fields.

Recommendation:

Promote column visibility into `SortableListTable`, define richer column catalogs per entity, and include optional fields such as IDs, labels, private/bookmarked flags, creation/change dates, places, certainty/status, linked owner names, media/source flags, and repository/template fields.

### Sort Profiles and Search Criteria

Mac evidence:

- The Mac app has typed large-list surfaces and add-filter/search-criteria sheets.
- `SearchPaneAddFilterContextMenuWidget.nib` and `EditFiltersViewAddFilterWidget.nib` expose an add-filter catalog rather than a small field dropdown.

Current web coverage:

- `SortableListTable.jsx` supports basic column sorting.
- `src/components/lists/useSortProfile.js` exists but is not consistently wired.
- `src/lib/search.js` has a static, relatively small field list.
- `SmartFilters.jsx` has authoring and preview, but still exposes raw-ish fields and limited path hops.

Gap:

Search and smart-filter authoring work, but Mac has a broader criteria catalog, better labels, reusable scope placement, and list-integrated saved scopes. Saved searches and smart filters are also split into separate models in the web app.

Recommendation:

Unify saved searches and smart filters behind one model, or explicitly bridge them as first-class scope objects. Replace raw field/path editing with typed field pickers, human labels, and entity/relationship grouped criteria. Expand path hops beyond person/family to events, sources, media, todos, and places.

## Reports

Mac evidence:

- `ReportPanes.strings` exposes report themes, style, page style, page background, pagination, language, zoom, CSV/HTML/PDF/plain text/RTF exports, print, and share.
- `CoreReports.strings` includes page background styles, watermark options, colors, fonts, citations, table node style, table layout, grid, repeated headers, page type/order, report style/theme/pagination/language controls.

Current web coverage:

- `src/components/reports/ReportsApp.jsx` has report generation, page size/orientation/background/margins/header/pagination.
- `src/lib/reports/export.js` supports multiple export formats.

Gap:

Reports are present, but Mac-style presentation controls are thinner: no named report themes, style presets, zoom UI, per-report language selector, chart-theme/style handoff, watermark controls, table styling controls, CSV delimiter/newline/header controls, or rich export sheet.

Recommendation:

Create a persisted `reportStyle` / `PresentationExportSettings` object and map it through preview/export renderers. Add report-specific theme/style/page/background/pagination/language panels and a common export sheet with filename template, author metadata, PDF background toggle, print/share, and CSV options.

## Books

Mac evidence:

- `CoreBooks.strings` and `BooksPaneNewBookConfigurationSheet.strings` expose book assistant/templates, title/subtitle/author/date, book type, start person/family, language, included people, born-before/after filters, chapter time spans, preface/TOC/appendix toggles, section fonts/colors/numeral type, separate pages, privacy/localization/page setup/theme, and dirty-save prompts.
- Section configuration NIBs exist for person, family, object-based reports, relationship charts, available/selected entries, sort, labels, and targets.

Current web coverage:

- `src/components/books/BooksApp.jsx`, `src/components/books/SectionEditor.jsx`, and `src/lib/books.js` implement manual section composition, validation, title page presets in data, and export/build helpers.

Gap:

The web book builder has the feature foundation but lacks the Mac setup wizard and per-section configuration depth. Title page presets exist in code but are not fully surfaced. Saved chart/report sections are metadata-forward rather than fully Mac-composited.

Recommendation:

Add a New Book configuration flow that seeds sections from book type, start person/family, language, included-person scope, birth date range, chapter time span, preface, TOC, and appendix. Replace expanding inline rows with section-specific config sheets for object selection, sort, labels, targets, relationship chart target, family-specific sections, title page preset, cover image/crest fields, per-section style overrides, and an error review sheet before export.

## Website Export and Publishing

Mac evidence:

- `CoreWebSiteExport.strings` exposes theme management, custom home page image/family crest/start person, export-person modes, hide details/living/private, inclusion toggles for audio, DNA, GEDCOM, labels, person groups, PDFs, pictures, saved charts, sources, stories, URLs, videos, event/family/home/imprint/page settings, fonts, colors, link colors, animations, statistics charts, and chart styling.
- `ManageWebSiteThemesSheet.nib` supports adding/reordering themes and treating the first as default.
- FTP publish sheets include server, port, user, password, path, TLS/SSL, upload. MacFamilyTree.com/iCloud areas are out of scope.

Current web coverage:

- `src/routes/Websites.jsx` and `src/lib/websiteExport.js` generate entity pages and support title/tagline/accent/theme/private/assets.
- `src/lib/publishTargets.js` includes FTP/SFTP-ish target records and webhook publishing.

Gap:

Websites are functional, but theme management and content/privacy controls are thinner. Some privacy defaults exist but are not clearly surfaced. FTP/SFTP targets prepare download packages rather than actually uploading, while webhook is the real remote publish path.

Recommendation:

Add persisted `siteThemes[]`, reorder/default behavior, import/add theme, and per-export theme CSS variants. Surface privacy and content controls: hide living, hide living details, threshold, private flags, notes/media inclusion, people/families/places/sources/media/stories/indexes/related sections, author/footer, labels, person groups, saved charts, GEDCOM/DNA inclusion where supported. Label FTP/SFTP as "prepare upload package" unless a backend/native helper implements actual upload.

## Charts and Saved Chart Fidelity

Mac evidence:

- `CoreCharts.strings` includes theme/style, export as separate pages, bitmap export format, JPEG quality, scaling, cut marks, page numbers, background image modes, connection types, line decorations/dash, media picture assignment modes, additional-name format, place format/detail, branch traversal, color modes, date format, privacy, history, localization, spacing, margins, and fonts.
- Chart editing strings expose add text/line/image, align, realign, bring front/send back, and chart compositor object behavior.

Current web coverage:

- `src/components/charts/ChartsApp.jsx` exposes many chart modes.
- `src/components/charts/ChartCanvas.jsx` exports SVG/PNG/PDF.
- `src/components/charts/useChartObjectCommands.js` and `ChartObjectInspector.jsx` cover overlay editing.
- `src/lib/chartContainerLoader.js` exists for chart container loading.

Gap:

Chart type breadth is mostly present. The missing parity is option depth and saved-chart fidelity: export/page settings are not fully wired, saved native compositor data is shallow, and object editing is stronger for overlays than for native chart people/connections.

Recommendation:

Add explicit Chart, Theme, Style, Pagination, and Export panels. Wire export format, JPEG quality, scaling, separate pages, page numbers, and cut marks into output. Expand saved chart schema around `builderConfig`, `compositorConfig`, `exportSettings`, and raw native payload retention. Add selected person/connection inspectors for size, color, label/date/image, connector style, media assignment mode, and page-aware realignment.

## Interactive Tree, Virtual Tree, Globe, and Maps

Mac evidence:

- `CoreInteractiveTreeView.strings` covers camera, animations, background, ground, generation bands, lighting, sorting, selection, birth/death/event descriptions, labels, media icons, person groups, connection colors, branch spacing, child sorting, and box alignment.
- `CoreVirtualTree.strings` covers collect mode, person/family representation, picture frame representation, person color mode, family representation, connection color/width, and depth of field.
- `CoreVirtualGlobe.strings` covers starry-sky/light-box backgrounds, connection colors/pattern/width, date range, event date colors, events to display, history event date range, pin colors by date/events/person group, sun simulation, and map localization.
- `CoreMapsController.strings` covers heat map data sources, heat map radius/opacity/gradient, connection lines, map types, slideshow settings, and person-group filters.

Current web coverage:

- `src/components/interactive/InteractiveTreeApp.jsx`, `src/components/interactive/ThreeDTreeView.jsx`, `src/components/charts/VirtualTree3D.jsx`, `src/routes/Globe.jsx`, `src/routes/MapsDiagram.jsx`, and `src/components/ui/Map.jsx` provide strong visual foundations.

Gap:

The visual views exist, but the Mac option drawers are much richer. Interactive Tree is mostly 3D/details in web. Virtual Tree has fewer representation/color/connection controls. Globe and maps have fewer scope, event, heatmap, basemap, slideshow, and empty-state controls.

Recommendation:

Add Mac-style Options/Style drawers for interactive tree layout direction, child sorting, person image mode, background/generation bands, connection color mode, and coloring by gender/generation/label/person group. Add virtual tree controls for collect mode, person symbols, family rings/spheres, picture frames, dead-person dimming, connection color/width, and appearance. Add map/globe controls for data source, heat maps, event types, person groups/smart scopes, connection lines, slideshow delay/jump/fit, current-location display where browser permission allows, satellite/hybrid basemaps, and Mac-like empty states.

## Editors and Contextual Actions

Mac evidence:

- `Edit.strings` exposes base editor actions for context, map, timeline, history, plausibility, and actions.
- Person-aware editor strings expose chart/report/web-search/view shortcuts.
- Duplicate actions exist for people, families, sources, and places.

Current web coverage:

- `src/routes/PersonEditor.jsx` and `src/routes/FamilyEditor.jsx` cover core editing.
- `src/components/duplicates/DuplicatesApp.jsx` exists.
- `src/routes/Places.jsx` and `src/routes/Sources.jsx` contain separate management surfaces.

Gap:

Core editing is present, but the Mac editor has persistent action placement. Duplicate workflows are not surfaced from relevant editors, and place duplicate merge remains a gap.

Recommendation:

Add an editor contextual action rail/menu: open map, timeline, history, plausibility, create chart/report, web search, jump to tree/views, and find duplicates. Implement place duplicate scan/merge and source duplicate shortcut where missing.

## Research Assistant and ToDos

Mac evidence:

- `ResearchAssistantPane.strings` and related NIBs show Question List, Question, Context, selected person, ignore options, and options presenter surfaces.
- `CoreToDo.strings` exposes wizard generators for missing family marriage events, missing birth/christening/death, islands/unconnected persons, missing media, missing names, persons without sources, plausibility warnings, incomplete places, places without events, unnecessary families, unparsable dates, scope/person-group filters, and label assignment.
- ToDo edit strings include delete completed and custom ToDo priority/status/type catalogs.

Current web coverage:

- `src/routes/Research.jsx` has generated/imported questions, done/ignore, and journal.
- `src/components/ToDoWizardSheet.jsx` bulk-creates ToDos from suggestions.
- `src/routes/ToDos.jsx` supports title/status/priority/due/relations.
- `src/routes/CustomTypes.jsx` exists.

Gap:

Research lacks Mac's selected-question detail/context panes, target-person mode, and generation options. The ToDo wizard is suggestion-based rather than the Mac's explicit generator catalog. Research rows do not expose one-click Create ToDo with editable defaults. ToDo catalogs appear thinner/fixed, and delete-completed is missing.

Recommendation:

Add Research Assistant detail/context panels, target-person mode, and options for generation scope/filtering. Add per-question Create ToDo with type/status/priority/due defaults. Expand the ToDo wizard into explicit generator types and options. Add delete completed. Wire ToDo type/status/priority catalogs into Custom Types or settings.

## Media Gallery and Slideshow

Mac evidence:

- `EditMediaPanes.strings` includes zoom auto/custom, media type selector, use-as-media-for container text, export, and open in Preview.
- `MediaGalleryPane.nib` and slideshow strings expose size presets, configure slideshow, select all, unselect all, interval, loop/random/caption-style flows.

Current web coverage:

- `src/routes/Media.jsx` supports gallery/editor, filters, add/replace/camera/audio, and crop/rotate style browser-safe editing.
- `src/routes/Slideshow.jsx` provides slideshow functionality.

Gap:

Media management exists, but Mac presentation controls are thinner: no thumbnail size/zoom presets, multi-select media-type chooser, "use as entry image" workflow, selected-media export, open asset in a new browser tab, selected-media slideshow config, or select/deselect all gallery flow.

Recommendation:

Add gallery selection mode, select all/unselect all, thumbnail size presets, selected export, open asset, use-as-entry-image action, selected-media slideshow, and slideshow settings for interval, loop, random, and captions.

## Places, Sources, and Templates

Mac evidence:

- Place edit strings expose find GeoName IDs, find coordinates, find missing coordinates for current/all places, convert place to place detail, batch lookup, and place detail conversion sheets.
- Source/place template strings expose template and template-key editors.
- Source template descriptions include fields and citation style in reports.

Current web coverage:

- `src/routes/Places.jsx`, `src/components/BatchPlaceLookupSheet.jsx`, and `src/components/PlaceConvertToDetailSheet.jsx` cover most place lookup and conversion behavior.
- `src/routes/Sources.jsx` is strong for fields, repositories, text, relations, media, labels, and citations.
- `src/routes/Templates.jsx` exists.

Gap:

Places are mostly present, but presentation/action parity remains: separate current-place versus all-place coordinate actions and explicit find-missing-GeoName-ID batch flow. Template authoring is not as deep as Mac's ordered field/key/citation-style editor. Source duplicate shortcut and source-template citation metadata remain thinner.

Recommendation:

Add separate "current place" and "all places" coordinate/GeoName actions. Expand `Templates.jsx` for ordered fields, citation-style metadata, and safe template-key edit/delete migration. Add source duplicate shortcut and richer source/place template key management.

## Settings and Preferences

Mac evidence:

- Preference panes include General, Functions, Edit, Colors, Dates, Names, PDF, Databases, World History, Maps, and Default Values.
- Strings include default value controls and category/function favorite configuration.

Current web coverage:

- `src/routes/Settings.jsx` and `src/lib/appPreferences.js` provide broad settings coverage.

Gap:

The web settings surface is broad but thinner in Colors, Default Values, Databases/tree behavior, edit-controller/function presentation, and preference consumption. Some settings exist but are not consistently consumed by charts, reports, books, websites, editors, and lists.

Recommendation:

Add a Colors tab, default event/fact/person/family values, database/tree behavior settings, richer function favorite ordering, and a preference consumption pass so report/chart/book/list/editor surfaces actually use the saved defaults.

## Implementation Notes

- Several older parity docs are now stale because the web app has implemented many previously missing areas. Treat this document as the current option-depth backlog, not a route-presence checklist.
- Most items can be implemented incrementally by creating reusable primitives:
  - `ScopedListToolbar`
  - `PresentationExportSettings`
  - `EntityColumnCatalog`
  - `SavedSortProfile`
  - `VisualViewOptionsDrawer`
  - `EntityTemplateKeyEditor`
  - `EditorActionRail`
- The best near-term strategy is to build shared controls once, then roll them through the existing routes instead of adding one-off panels per feature.
