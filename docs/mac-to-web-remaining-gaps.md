# MacFamilyTree 11 remaining gaps audit

This document is intentionally **narrow**: it only catalogs surfaces not already covered by the earlier parity audits.

Do **not** duplicate items from these docs when extending the backlog:

- `docs/mac-to-web-chart-parity-audit.md` — all chart modes, chart document schema, builder/compositor, page/export/share.
- `docs/mac-to-web-views-parity-audit.md` — persons/families/places/media/sources/todos/research/search/settings/favorites/FamilySearch/reports/books/publish/author.
- `docs/macfamilytree-parity-todo.md` — active backlog (FamilySearch deep workflows, Photos/scanner docs, Contact Picker, richer file lifecycle, desktop function configuration, chart share flows, Arabic smoke checks).

Evidence source paths:

- Bundle: `/Users/ahmadjalil/Downloads/family tree/app/MacFamilyTree 11/Contents`
- App-level strings: `Contents/Resources/en.lproj/*.strings`
- Framework strings: `Contents/Frameworks/MacFamilyTreeCore.framework/Versions/A/Resources/en.lproj/*.strings`
- NIB filenames: `Contents/Resources/Base.lproj/*.nib`
- Framework symbol strings: `strings Contents/Frameworks/MacFamilyTreeCore.framework/Versions/A/MacFamilyTreeCore`

## Executive summary

The chart and views audits cover the breadth of MacFamilyTree surfaces, but several **edit-adjacent** and **housekeeping** panes are either shallow or entirely absent in the web app. The biggest uncovered clusters are (a) Database Maintenance depth — only 3 of ~15 Mac tools exist; (b) a true Smart Filters / saved-search editor (only evaluation lives in `smartScopes.js`, no authoring UI); (c) the Welcome/startup multi-tree library UI with rename/favorite/sort/label; (d) the Backup pane — web has single-shot JSON export/import, Mac has configurable backup frequency, retention, multi-tree backup browser, and restore-per-date; (e) AI image editing (colorize / background remove / restore) which is never mentioned in the existing audits. Also newly surfaced: a full Change Log purge tool, conflict resolution UI for merge/import, and a number of modal flows the Mac uses (Apple Media Library sheet, Scanner sheet, Slice/Subtree export wizard, Slideshow configuration) that deserve documentation even if some are intentionally out of scope in a browser.

## Gaps grouped by functional area

Each entry: concrete Mac evidence, current web state (grep'd in `src/`), classification (**present / partial / missing**), and a one-line recommendation.

---

### 1. Database Maintenance depth

The existing views audit does not audit Database Maintenance beyond acknowledging its route exists. Mac's `DatabaseMaintenance.strings` (`Contents/Resources/en.lproj/DatabaseMaintenance.strings`) and NIBs (`DatabaseMaintenancePane.nib`, `DatabaseMaintenanceDateFormats.nib`, `DatabaseMaintenanceEmptyEntries.nib`, `DatabaseMaintenanceFailedDates.nib`, `DatabaseMaintenanceFamilyGenderSwitch.nib`, `DatabaseMaintenanceNameFormats.nib`, `DatabaseMaintenanceOptimizeMedia.nib`) expose at least 15 distinct tools. Web `src/routes/Maintenance.jsx` + `src/lib/maintenance.js` implements about 6.

- **Find unreadable dates** — `_DatabaseMaintenance_FailedDatesButton`. **Partial.** Web has `auditUnreadableDates` but no per-entry manual-fix sheet.
- **Adjust date format (mass re-format)** — `_DatabaseMaintenance_DateFormatsButton`, `_DatabaseMaintenanceDateFormats_AdjustDatesCompletedInformative`. **Partial.** Web's `reformatAllDates` exists, but no before/after preview per record.
- **Reformat names** — `_DatabaseMaintenance_NameFormatsButton`. **Present.**
- **Empty entries** — `_DatabaseMaintenance_EmptyEntriesButton`. **Present.**
- **Family gender switch** — `_DatabaseMaintenance_FamilyGenderSwitchButton`. **Present** (audit only; no swap-in-place commit pathway visible).
- **Find duplicate entries** — `_DatabaseMaintenance_DuplicateSearchButton`. **Partial.** Covered by `src/components/duplicates/DuplicatesApp.jsx` but not surfaced from the Maintenance pane.
- **Search and Replace** — `_DatabaseMaintenance_SearchAndReplaceButton`. **Partial.** `src/lib/searchReplace.js` exists; not linked from Maintenance.
- **Optimize Media** — `_DatabaseMaintenance_OptimizeMediaButton`, `DatabaseMaintenanceOptimizeMedia.nib`. **Partial.** Web has `mediaSizeReport` but no compress/strip EXIF flow.
- **Manage Person/Family Event Types** — `_DatabaseMaintenance_EditPersonEventTypesButton`, `_EditFamilyEventTypesButton`, `_EditPersonFactTypesButton`. **Missing.** No custom-event-type editor in web (`ConclusionType_Menus_ManageEventTypes`).
- **Manage Custom Additional Name Types** — `_DatabaseMaintenance_EditAdditionalNameTypesButton`. **Missing.** See `CoreAdditionalNames.strings` for the 13 stock types (`_AdditionalName_MaidenName`, `_Nickname`, etc.) — web uses free-text.
- **Manage Custom ToDo Types / Priorities / Statuses** — `_EditToDoPriorityTypesButton`, `_EditToDoStatusTypesButton`, `_EditToDoTypeTypesButton`. **Missing.** Web's ToDos route uses free-text.
- **Manage Custom Influential Relation Types** — `_EditAssociateRelationConclusionTypesButton`. **Missing.**
- **Source Templates editor** — `_EditSourceTemplateTypesButton`, `EditSourceTemplatesSheet.nib`, `EditSourceTemplateKeysSheet.nib`. **Partial.** `src/routes/Templates.jsx` exists but has not been audited.
- **Place Templates editor** — `_EditPlaceTemplateTypesButton`, `EditPlaceTemplatesSheet.nib`, `EditPlaceTemplateKeysSheet.nib`. **Partial.**
- **Find GeoName IDs for Places** — `_DatabaseMaintenance_FindGeoNameIDsForPlacesButton`. **Missing** from Maintenance pane. (Adjacent work is tracked under Places in the existing audit but not hooked up to Maintenance.)
- **Export Subtree** — `_DatabaseMaintenance_ExportSubtreeButton`, NIBs `SliceSheet.nib`, `SliceProgressView.nib`, `SliceExportSubtreeFinishedView.nib`, strings `CoreSlice.strings`. **Partial.** `src/lib/subtree.js` exists; not wired into a progress-aware wizard.
- **Remove Subtree** — `_DatabaseMaintenance_RemoveSubtreeButton`, `SliceRemoveSubtreeFinishedView.nib`. **Missing.**
- **Merge with other Family Tree** — `_DatabaseMaintenance_MergeButton`, NIBs `MergeSheet.nib`, `MergeSelectMergeModeView.nib`, `MergeSelectDatabaseView.nib`, `MergeProgressView.nib`, `MergeFailedView.nib`, `MergeFinishedView.nib`, strings `CoreMerge.strings`. **Partial.** `src/lib/mergeImport.js` exists but without progress / conflict-resolution sheet.

**Recommendation:** Treat Maintenance as its own backlog. Promote it from "audit-only dry runs" to a wired-together hub that navigates into Duplicates, Search & Replace, Subtree, Merge, Templates, and a new Custom Types editor.

---

### 2. Smart Filters authoring UI (separate from runtime)

- Mac evidence: `CoreScopes.strings` — `_Scopes_EditScopes_HeaderTitle` "Edit Smart Filters", `_Scopes_EditScope_Add_Filter` "Add Filter Component…", `_Scopes_SaveAsScope` "Save as Smart Filter…", `_Scopes_NewScope` "New Smart Filter", `_Scopes_ResetSearch`. NIBs: `ScopesEditSheet.nib`, `EditFiltersViewAddFilterWidget.nib`, `SearchPaneAddFilterContextMenuWidget.nib`.
- Scopes cover 13 entity types: Person, Family, Place, Source, BaseMedia, ToDo, Note, PersonEvent, FamilyEvent, PersonFact, Story, PersonGroup.
- Web state: `src/lib/smartScopes.js` executes built-in scopes; `src/components/search/SearchApp.jsx` uses them read-only. No "Edit Smart Filters" sheet, no "Save current search as Smart Filter", no filter-component builder.
- **Missing.** Existing views audit line 414 briefly notes this ("No Scopes edit sheet") but it has not yet been prioritized.
- **Recommendation:** Add a Smart Filter authoring sheet that (a) saves current `SearchApp` state as a named scope, (b) lets the user compound filter components with and/or grouping, (c) makes scopes selectable from any list widget, not just Search.

---

### 3. Saved searches / named queries

- Mac evidence: Smart Filters double as saved searches on Mac — `_Scopes_SaveScope`, `_Scopes_EditScopes_DiscardUnsavedSearchAlertMessageText`.
- Web state: Grep for `savedSearch`, `SaveSearch` in `src/` — no results. `SearchApp.jsx` does not persist multi-criteria search configurations.
- **Missing.** Not explicitly called out by either existing audit.
- **Recommendation:** Pair this with #2 — a saved search IS a smart filter; persist in IndexedDB metadata and surface in a "Recent & Saved Searches" drawer.

---

### 4. Welcome / startup multi-tree library UI

- Mac evidence: `WelcomeWindow.nib` plus 6 `WelcomeWindowDatabases*FileWidget.nib` variants. `CoreStartupWindow.strings`:
  - `_AvailableDatabasesView_LocalSectionName` "My Family Trees"
  - `_StartupWindow_LabelMenu` "Label", `_StartupWindow_MarkAsFavorite`
  - `_StartupWindow_SortConfig_MainSorting_ByName`, `_ByChangeDate`, `_AlsoSortByFavorites`
  - `_StartupWindow_SendFileShareSheet` "Send File as Copy"
  - `_StartupWindow_BackupSettings` per-tree
  - `_WelcomeWindow_RenameButton`, `_WelcomeWindow_DeleteMessage`, `_WelcomeWindow_ImportGEDCOMButton`, `_WelcomeWindow_ManageBackupsButton`, `_WelcomeWindow_NewTreeButton`, `_WelcomeWindow_RevealInFinderButton`.
- Web state: `src/lib/treeLibrary.js` exists and `Home.jsx` has a tree picker. Grep showed no "StartupWindow" parity. Existing views audit line 466 notes this but does not enumerate per-tree actions (label, favorite, sort, duplicate, send-as-copy).
- **Partial.** Current web shows trees as a flat list; lacks label, favorite, sort mode, rename-tree validation, and per-tree backup settings entry point.
- **Recommendation:** Expand `Home.jsx` tree section (or add `/trees` route) with per-tree favorite, rename, label, delete with typed confirmation, sort (by name / change date / favorite first), and inline "Backup Settings" action.

---

### 5. Backup pane depth

- Mac evidence: `CoreBackupRestoreManager.strings` — `_BackupType_None`, `_Local`, `_LocalAndCustomBackupURL`, `_iCloudDrive`, `_BackupsToKeep` (retention policy), `_ManualSaveTime` / `_AutoSaveTime` / `_CloudKitSaveTime` each selectable from Never / Always / 5/10/15/20/30 min / 1/2/6 hours. NIB: `BackupConfigurationSheet.nib`. `OrganizeBackupsSheet.nib` — `_OrganizeBackupsSheet_Title` "Restore & Manage Backups", selectable per-tree backup history.
- Web state: `src/routes/Backup.jsx` is a single JSON export/import. No retention policy, no auto-backup trigger, no backup history browser, no per-tree scope.
- **Partial.** Existing audits say nothing about backup configuration/history.
- **Recommendation:** Add `BackupSettings.jsx` modal: backup-on-save toggle, retention count, destination (IndexedDB blob vs download), and a history list with restore-per-entry. `BroadcastChannel` / `navigator.storage.estimate()` can surface quota.

---

### 6. Change Log purge tools

- Mac evidence: `_ChangeLogPurgeButton`, `_ChangeLogPurgeButton_PurgeAll`, `_ChangeLogPurgeButton_PurgeAllChangeLogEntriesOfDeletedObjects`, `_ChangeLogPurgeButton_PurgeOlderThanLastYear/Month/Week/Day/Hour`. `_ChangeLogDeleteButton` per-entry. NIBs: `ChangeLogPane.nib`, `ChangeLogWidget.nib`.
- Web state: `src/routes/ChangeLog.jsx` displays entries. Grep for "purge" in `src/` returns nothing.
- **Partial.** Existing views audit mentions ChangeLog route but not the purge model.
- **Recommendation:** Add a purge menu with time-window presets and "purge entries of deleted objects".

---

### 7. Conflict resolution UI for merge/import

- Mac evidence: `CoreMerge.strings` — `_Merge_Conflict_HeaderText`, `_Merge_Conflict_Explanation`, `_Merge_Conflict_LeftSideUserIdentification_CurrentFamilyTree_With_MFTPKG_From_File`, `_Merge_QueryMatchingObject_PersonToMerge_Header`. NIBs: `ConflictResolutionControllerMacUserInterface.nib`, `MergeSelectEntityForDuplicateMergeContentView.nib`, `MergeSheet.nib`. Localizable.strings: `_ConflictResolutionControllerMacUserInterfaceConflictView_UseLeftVersionButton` / `_UseRightVersionButton` / `_ResolveButton`.
- Web state: Grep for `conflict` in `src/` — only shows `duplicates/DuplicatesApp.jsx` which is an in-tree duplicate merger, not an import-time three-way conflict resolver. `mergeImport.js` likely auto-merges.
- **Missing.** Neither existing audit covers this.
- **Recommendation:** Before committing import (GEDCOM or another mftpkg), present a side-by-side conflict sheet driven by the differing fields — pair with #1's "Merge with other Family Tree" wizard.

---

### 8. AI image editing (colorize / restore / background remove)

- Mac evidence: `CoreImageEditingController.strings` — `_ImageEditingControllerImageSettings_ExecuteBackgroundRemove`, `_ImageColorizationController_ColorizationMode_*` (DeOldify, DDColor artistic, disco variants), `_ImageEditingController_Colorize_UploadWarningInformative` (Synium-hosted service). NIB: `ImageEditingSheet.nib`.
- Web state: Grep for `colorize`, `Colorization`, `Background Remove`, `AI image` — **no results** in `src/`. `src/components/ImageEditing*` does basic crop/rotate (already tracked in `macfamilytree-parity-todo.md`).
- **Missing.** Not covered by any existing audit.
- **Recommendation:** Document as out-of-scope for the browser (requires paid Synium API or a self-hosted ONNX/WASM model). If any parity is desired, pick one: client-side background removal via `@imgly/background-removal` (WASM).

---

### 9. Apple Media Library sheet

- Mac evidence: NIB `AppleMediaLibrarySheet.nib`; strings `_AppleMediaLibrarySheet_Title` "Add Media from Photos", `_AllPhotosSection`, `_SmartAlbumsSection`, `_CollectionsSection`.
- Web state: Grep — no match. `ImportDropZone.jsx` covers generic file picker only.
- **Missing.** `macfamilytree-parity-todo.md` only asks to "document unavailable native-only features."
- **Recommendation:** Explicitly document as unreachable in the browser (Photos.app access requires native APIs). If any bridge is desired, use the File System Access API with a user-chosen iCloud Photos mirror folder.

---

### 10. Scanner sheet

- Mac evidence: NIB `ScanPictureSheet.nib`; strings `ScanPictureSheetStrings.strings` — `_ScanPictureSheet_Title` "Scan Image", `_ScanPictureSheet_Flatbed`, `_ColorMode_BlackWhite/Grayscale/Color`.
- Web state: No scanner path.
- **Missing.** Tracked obliquely in `macfamilytree-parity-todo.md` under "unavailable native-only features."
- **Recommendation:** Document as out of scope for browser (no ImageCaptureCore equivalent). Allow manual photo upload + EXIF preservation as the replacement.

---

### 11. Subtree slice wizard (extract / remove)

- Mac evidence: NIBs `SliceSheet.nib`, `SliceProgressView.nib`, `SliceExportSubtreeFinishedView.nib`, `SliceRemoveSubtreeFinishedView.nib`. `CoreSlice.strings` — `_Slice_ExportSubtree_*`, `_Slice_RemoveSubtree_*`. Left/right picker ("Available Persons" / "Persons to be Exported"), "Add Descendants of Person", "Add Ancestors of Person".
- Web state: `src/lib/subtree.js` has logic; no interactive picker UI.
- **Partial.**
- **Recommendation:** Promote subtree to a wizard route with selection columns matching Mac's flow.

---

### 12. Slideshow configuration depth

- Mac evidence: NIB `SlideshowConfigurationSheet.nib`. Strings: `_SlideshowConfigurationSheet_Title`, `_MediaGalleryPane_ConfigureSlideshowButton`, `_StartSlideshowButton`, `_MapDiagramPane_StartSlideshow` (map-context slideshow is a thing).
- Web state: `src/routes/Slideshow.jsx` exists. Not covered in depth by views audit (line 293 just acknowledges it).
- **Partial.**
- **Recommendation:** Add interval, caption-on/off, loop, random, per-event filter, and map-mode slideshow.

---

### 13. Batch Place Lookup sheet

- Mac evidence: NIB `BatchPlaceLookupSheet.nib`. Addressed implicitly by `_DatabaseMaintenance_FindGeoNameIDsForPlacesButton` but the sheet itself is a UI.
- Web state: Likely handled piecewise in Places route; no dedicated batch UI visible.
- **Partial.** `macfamilytree-parity-todo.md` "Places and Geocoding" section has this TODO item.
- **Recommendation:** Already tracked — call out the sheet name for implementer reference.

---

### 14. Image Editing sheet (core) and Record* sheets

- Mac evidence: `ImageEditingSheet.nib`, `RecordPictureSheet.nib`, `RecordAudioSheet.nib`, `RecordVideoSheet.nib`.
- Web state: Camera capture + `MediaRecorder` already in `macfamilytree-parity-todo.md` (marked done). Dedicated "Record Video" UI was not called out.
- **Partial.**
- **Recommendation:** Confirm Record Video flow exists; if not, add it alongside the already-done audio recorder.

---

### 15. Quick Access / Bookmarks editor sheet

- Mac evidence: NIB `QuickAccessControllerEditBookmarks.nib`. Strings: `_QuickAccessControllerEditBookmarksDialog_HeaderTitle` "Manage Bookmarks", separate editors for `_EditBookmarkedPersons/Families/Sources/Medias/Places`.
- Web state: `src/routes/Bookmarks.jsx` — but read-only per-record `isBookmarked` flag. Existing views audit line 467 mentions this.
- **Partial.**
- **Recommendation:** Add reorder + grouping in `Bookmarks.jsx` (lift the noted audit item from views-audit backlog).

---

### 16. Keyboard shortcuts / MainMenu parity

- Mac evidence: `MainMenu.nib`. Tooltips in `Localizable.strings`: `_MainWindow_BookmarksButtonTooltip`, `_LabelsButtonTooltip`, `_BackupButtonTooltip`, `_CloudTreeButtonTooltip`. Mac binds full menu with Cmd-shortcuts.
- Web state: No keyboard shortcut layer found in `src/`. No `useHotkeys`, no command palette.
- **Missing.** Neither existing audit covers keyboard shortcuts.
- **Recommendation:** Add a small `useKeyboardShortcuts` hook + `/shortcuts` help page listing bindings. Good candidates: `⌘K` command palette, `⌘F` focus search, `B` bookmark, `N` new person.

---

### 17. Automation / AppleScript / Shortcuts / Automator

- Mac evidence: Framework strings do not show AppleScript/Automator classes (`strings` grep for `Automator|AppleScript` on `MacFamilyTreeCore` returned no matches in this pass). Mac 11 appears to not ship a public scripting API.
- Web state: n/a.
- **Missing, but also missing upstream.** No action needed — document as not-a-gap.

---

### 18. Memoji / sticker / emoji set for persons

- Mac evidence: Framework grep for `Memoji|Sticker|ImageSticker` — **no matches**. Mac app does not appear to ship a dedicated Memoji feature.
- Web state: n/a.
- **Not a gap.** The user hypothesis here is not supported by the bundle.

---

### 19. Ordinance tracking (LDS) outside FamilySearch

- Mac evidence: NIBs `FamilySearchOrdinanceOpportunitiesListPane.nib`, `FamilySearchOrdinancesReservationListPane.nib`, `FamilySearchPersonOrdinancesContentView.nib`, `FamilySearchOrdinancesPolicySheet.nib`; strings file `CoreLDSOrdinancesListReport.strings`; report `_FunctionTitle_LDSOrdinancesListReportPaneName` "LDS Ordinances List".
- Web state: `src/routes/LdsOrdinances.jsx` exists.
- **Present.** All of Mac's LDS UI is FamilySearch-backed; the standalone list report is covered by the web `LdsOrdinances.jsx` route. No separate non-FamilySearch LDS pane exists on Mac.
- **Not a gap.** Further depth (reservation status, temple assignment) is already tracked under FamilySearch backlog.

---

### 20. Research log separate from ToDos

- Mac evidence: `ResearchAssistantPane.strings`, NIBs `ResearchAssistantOptionsPresenter.nib`, `ResearchAssistantPane_QuestionList.nib`. Adjacent to ToDos but distinct.
- Web state: `src/routes/Research.jsx` exists.
- **Present.** Already audited.
- **Not a gap.**

---

### 21. Tutorial / first-run demo tree

- Mac evidence: `Contents/Resources/Sample Tree.mftpkg` ships in the bundle. Strings: `_EditPlaceholderPane_NewTreeWelcomeMessage` "Welcome to MacFamilyTree 11! To start your research, we recommend to use the Interactive Tree." No dedicated "tutorial" NIB found.
- Web state: `ImportDropZone.jsx` is shown on `Home.jsx` when no tree is present.
- **Partial.** No "load sample tree" button in the web UI.
- **Recommendation:** Ship an Arabic-friendly sample `.mftpkg` (the Arabic fixture from `macfamilytree-parity-todo.md`) and add a "Load Sample Tree" CTA on first run.

---

### 22. Content Download Manager (geographic DB)

- Mac evidence: NIB `PreferencePaneContentDownloadManager.nib`. Strings `CoreContentDownloadManager.strings` — `_ManageDownloadsTitle`, `GeographicDatabaseTitleKey`, Small/Medium/Huge variants, `_EstimatedDownloadSize`.
- Web state: Web uses remote geocoding (Nominatim / MapLibre), no downloaded geo DB. Grep for `ContentDownload` — no match.
- **Not a gap in this form**, but document why: browser geocoding is always online.
- **Recommendation:** Add a one-liner in `Settings.jsx` explaining that place lookups are online-only and no download management is needed.

---

### 23. Family Tree Com / CloudTree web management sheets

- Mac evidence: `MacFamilyTreeComLoginView.nib`, `MacFamilyTreeComTreesListView.nib`, `MacFamilyTreeComEditTreeSheet.nib`, `MacFamilyTreeComEditUserSheet.nib`, `MacFamilyTreeComRegisterNewTreeSheet.nib`, `MacFamilyTreeComRegisterNewUserSheet.nib`, `ManageMacFamilyTreeComSheet.nib`, `MacFamilyTreeComWebSiteExportPublishSheet.nib`.
- Web state: n/a — browser target has no relationship to the closed CloudTree/MFT.com service.
- **Explicitly out of scope** per `macfamilytree-parity-todo.md` line 10. Document for completeness.

---

### 24. History Database (World History) preference / event picker

- Mac evidence: NIBs `HistoryDatabaseCategorySelectorView.nib`, `HistoryDatabaseEventsSelectorView.nib`, `HistoryEventsWidget.nib`, `HistoryWidget.nib`, `PreferencePaneHistory.nib`. Strings `CoreHistoryDatabase.strings` — ~40 categories (Wars, Technology, USA Presidents, Germany Chancellors, Aviation, Apple Inc., Mormon History, Custom).
- Web state: `src/routes/WorldHistory.jsx` exists. Not audited for category filter or toggle persistence.
- **Partial.** Existing views audit line 63 mentions World History only in passing.
- **Recommendation:** Add a category-selector sheet so users can toggle which World History packs appear on charts/timelines.

---

### 25. Plausibility configuration

- Mac evidence: `CorePlausibilityAnalyzer.strings` — 10+ named analyzers (`PersonEvents`, `Lifetime`, `Child Birth Dates`, etc.) and NIB `PlausibilityWidget.nib` for per-person surfaced warnings.
- Web state: `src/routes/Plausibility.jsx`, `src/lib/plausibility.js`. Not audited for per-analyzer enable/disable.
- **Partial.**
- **Recommendation:** Add per-analyzer on/off toggles and thresholds (min marriage age, max lifetime) in Settings.

---

### 26. Person Group selection / bulk assign sheet

- Mac evidence: NIBs `PersonGroupSelectionSheet.nib`, `ManagePersonGroupPersonsSheet.nib`, `PersonRelativesSelectionSheet.nib`. Strings `CorePersonGroupSelection.strings` — left/right column picker with "Add Ancestors/Descendants of Person".
- Web state: `src/routes/PersonGroups.jsx`. Views audit line 88 already flags this.
- **Partial.** Already tracked — keeping here for cross-reference.

---

### 27. Place Convert-to-Detail sheet

- Mac evidence: NIB `PlaceConvertToPlaceDetailSheet.nib`; strings `_PlaceConvertToPlaceDetailSheet_*` referenced by place lookup.
- Web state: No such flow.
- **Missing.** Already flagged under `macfamilytree-parity-todo.md` Places section.

---

### 28. Category/function configuration (preferences)

- Mac evidence: NIB `PreferencePaneCategoryConfigurations.nib`. Strings `_PaneCategoryBaseFunction_Enabled`, `_Emphasized`, `_Favorite` with `_PaneCategoryFunction` framework class.
- Web state: `src/routes/Favorites.jsx` surfaces favorites but does not allow per-function enable/disable or emphasis.
- **Partial.** `macfamilytree-parity-todo.md` line 56 has this as open.
- **Not a new gap** — cross-reference to existing backlog.

---

## Cross-reference notes

To avoid rework, these items are **already on the backlog** or in an existing audit; do not re-raise them:

- Author Information, FamilySearch deep workflows, Contact Picker, richer publishing (`macfamilytree-parity-todo.md`).
- Chart builder/compositor schema, saved chart depth, page/export/share flow, relationship path multi-path (`mac-to-web-chart-parity-audit.md`).
- Person editor depth, Places/Sources/Media/ToDos/Research depth, Favorites/Bookmarks, Settings preferences (`mac-to-web-views-parity-audit.md`).
- Arabic / RTL smoke tests (`macfamilytree-parity-todo.md`).

This document's gaps are primarily **cross-cutting maintenance tooling** and **modal wizards** that the earlier audits stopped short of cataloging.

---

## Prioritized next 5 items to implement

1. **Smart Filter authoring sheet** (#2 + #3) — unlocks saved searches; Mac exposes this across 13 entity types. Highest reuse. Build on `smartScopes.js` + `SearchApp.jsx`.
2. **Database Maintenance hub expansion** (#1) — wire existing `Duplicates`, `searchReplace.js`, `subtree.js`, `mergeImport.js` into the Maintenance route, then add Custom Types editors. Low-risk, high visibility.
3. **Backup pane depth** (#5) — retention policy + backup history + per-tree scope. Users expect this and the current single-shot JSON is a known soft spot.
4. **Change Log purge controls** (#6) — small, self-contained, matches Mac's exact time-window preset UI.
5. **Welcome / Tree Library UI** (#4) — per-tree favorite/label/rename/sort/delete on Home. Direct user-visible polish.

Deferred (track but don't block): AI image editing (#8), Scanner/AppleMediaLibrary sheets (#9, #10, intentionally native-only), Automator/AppleScript (#17, not in bundle), Memoji (#18, not in bundle).

---

## Second-pass findings (2026-04-19)

Scope: a second sweep specifically looking for surfaces not captured by this doc, the chart parity audit, the views parity audit, or items already landed this session (Smart Filter authoring, Custom Types, Backup retention/scheduler/history, Change Log purge, Maintenance hub). Evidence paths:

- `Contents/Frameworks/MacFamilyTreeCore.framework/Versions/A/Resources/en.lproj/*.strings`
- `Contents/Resources/en.lproj/*.strings` and `Contents/Resources/Base.lproj/*.nib`
- Symbol dump: `strings .../MacFamilyTreeCore` (117482 lines, saved to `/tmp/mft_core_strings.txt`)

### 2P.1 Date qualifiers (ABT / BEF / AFT / BET / ranges) in the web DatePicker — **missing**

- Mac evidence: `CoreDateParser.strings` defines `_DateParser_DatePrefixes_Estimates` (`About; After; Before; CA; CIRCA; ABT; INT; EST; CAL; BEF; AFT; Pre; Post; Prior To; By; Perhaps; ~; ?`), `_RangePrefixes` (`Bet; Between; From`), `_RangeSeparators` (`and; to`), and `_EraAD` / `_EraBC`. The date picker NIBs split the sheet into four modes: `DatePickerSheetDayMonthYearContentView`, `DatePickerSheetMonthYearContentView`, `DatePickerSheetYearContentView`, `DatePickerSheetRangeContentView`, plus `DatePickerSheetPrefixesAndSuffixesControl.nib`. `CoreDateParser.strings` exposes `_DatePicker_SelectFullDateButton`, `_SelectMonthYearEraButton`, `_SelectMonthEraButton`, `_SelectDateRangeExplanation`.
- Web evidence: `src/components/ui/DatePicker.jsx` accepts a single ISO string and has no prefix/suffix/range/era model. Grep for `BEF|AFT|ABT|Estimate|Circa` in `src/` returns only the `DNAResults.jsx` `relationshipEstimate` field (unrelated) and `Maintenance.jsx` "before/after" time-window buttons.
- Classification: **missing** (genealogically critical — without qualifiers every GEDCOM round-trip loses `BEF 1820` / `ABT 1650` / `BET 1701 AND 1704`).
- Why it deserves attention: Mac's date model is the vocabulary GEDCOM 5.5.1 uses. Any imported tree with qualifiers silently drops the qualifier on edit.

### 2P.2 Person NameFormat presets — **missing**

- Mac evidence: Symbol table lists nine `_Person_NameFormat_*` enum members (`Title_FirstName_MiddleName_LastName_Suffix`, `LastName_Suffix_FirstName_MiddleName`, `LastName_Suffix_Comma_FirstName_MiddleName`, `Title_LastName_MiddleName_FirstName_Suffix`, `Title_Comma_FirstName_Suffix_Bracket_MiddleName_Bracket`, etc.). NIB: `PreferencePaneNameFormat.nib`. Selector `allAvailablePersonNameFormatEnumNumbers`, preference `defaultNameFormatFromPreferences` / `defaultNameFormatForSortingFromPreferences` (separate display vs. sort format).
- Web evidence: Grep for `nameFormat|formatName` returns only `Maintenance.jsx` (bulk reformat) + `maintenance.js` (the audit job). No per-user display format, no sort format. Existing `src/lib/personContext.js` always composes "First Last".
- Classification: **missing**.
- Why it deserves attention: "Last, First" is required for most library/archive conventions; Arabic trees commonly want `Title FirstName LastName` with title first. Single-line win in Settings.

### 2P.3 Additional-name types (13 stock variants + AdoptiveName / ArtistsName etc.) with preference — **partial**

- Mac evidence: `CoreAdditionalNames.strings` ships 13 stock types (`_AdditionalName_MaidenName` "Name at Birth", `ArtistsName`, `Other`, `MarriedName`, `DoubleBarrelledName`, `FamilyName`, `NameVariation`, `Nickname`, `AdoptiveName`, `FormalName`, `ReligiousName`, `Title`, `ProfessionalName`) plus `_Prefix_MaidenName_ForMale/ForFemale` ("né" / "née") and a `_Person_AdditionalNamePreferenceConfiguration_` enum (All / OnlyMarriedName / OnlyFamilyName / OnlyNickName / None) governing which additional name renders on charts.
- Web evidence: `additionalName` hits show `src/lib/customTypes.js` (this session's Custom Types editor — covers the list) and `src/lib/mftpkgExtractor.js` (import path). The Person editor `PersonEditor.jsx` surfaces additional names, but the **display preference** (which variant to show on a chart label) does not exist — grep for `AdditionalNamePreference` returns zero.
- Classification: **partial**.
- Why: chart labels and narrative reports both consult this preference; without it we always pick the primary name. Two-hour fix in chart renderers + Settings.

### 2P.4 Source Certainty / Quality levels (Original / Derivative / DontKnow) — **missing**

- Mac evidence: `CoreSourceRelations.strings` (symbols 22596–23222 of the dump): `_SourceRelation_Quality_DontKnow`, `_Derivative`, `_Original`, plus three independent axes — `SourceQuality`, `InformationQuality`, `EvidenceQuality` — edited in `EditSourceRelationCertaintySettingsCertaintyViewContentController` (NIB: `EditSourceRelationsSheet.nib`). Selector `localizedCertaintyDescription`, sort key `valueToSortByCertainty`, and list sort option `_EditSourceRelationsContentController_Sorting_ByCertainty`.
- Web evidence: Grep for `certainty|confidence|SourceQuality|_Quality_` in `src/` returns nothing related — `confidence` only appears in FamilySearch imports. `PersonEditor.jsx` has 3 citation rows but no certainty UI.
- Classification: **missing**.
- Why it deserves attention: Evidence Explained / GPS workflows require all three certainty axes; this is the single biggest unmet ask for serious researchers. Schema-small (three enum fields on `sourceRelation`).

### 2P.5 Narrative report sentence templates (per-locale, per-gender, per-tense) — **partial**

- Mac evidence: `CoreNarrativeReport.strings` contains ~600 `NarrativeReportGenerator_<Event>|<Gender>|<Slots>` templates such as `BirthEvent|Male|Place|Date` = "He was born in @Place@ on @Date@". Events: Birth, Christening, Residence, Occupation, Marriage, Death, Burial, Education, plus Occupation with PastTense / PresentTense and Age slot. Configuration keys `_NarrativeReportBuilderConfiguration_ShowBirthInfo / ShowChristeningInfo / ShowParentsOfPersonInfov2 / ShowBrothersAndSistersInfo / ShowPartnersOfPersonInfo / ShowChildsInfo`. Selectors `prepareAndReturnNarrativeReportGeneratorForConfigurationForPerson:`, `stringForNarrativeReportItem:hintsMask:`.
- Web evidence: `src/lib/reports/builders.js` and `src/components/reports/ReportsApp.jsx` mention "narrative", but no template table. Grep of the repo for `NarrativeReportGenerator_` finds zero. Reports emit field lists, not prose.
- Classification: **partial** (report exists as a listing; does not produce prose).
- Why: On Mac the narrative report is the flagship output. Without gendered templates the web report is visibly thinner than any competitor. This is several hundred strings — worth a dedicated PR.

### 2P.6 Privacy model depth — **partial**

- Mac evidence: Multiple privacy concepts in the symbol table: `hidePrivateInformation` (system-wide), `hideLivingPersonDetails`, `hideInfoMarkedAsPrivate`, `showOnlyLivingPersons`, `shouldPersonBeIncludedDueToPrivacy:`, `showConfigurationOptionsForHidePrivateInformation`, `supportsConfigurationOfHidePrivateInformation`, `localizedPrivateInformationHasBeenHiddenStringForDisplay`, `exportPrivateFlags`, `alsoShowIsPrivateFlag`, `generatePrivateFlagsForBaseObject:atTagLevel:`, and a `FlatIsPrivateLockIcon` asset. `EditCommon_PrivateFlagLabel`, `_ObjectProperty_BaseObject_isPrivate`.
- Web evidence: `src/lib/privacy.js` (13 lines) only reads a single boolean. The flag is never propagated to charts, reports, or website export. Grep in the 23 matching files shows chart builders do not consult it.
- Classification: **partial**.
- Why: Mac cleanly separates "living person" (compute from birth year) from "marked private" from "hide at render". The web path treats all three as one boolean and never actually hides anything — a real privacy leak if a user ships their tree to `websiteExport.js`.

### 2P.7 Multi-axis citation model (long/short/bracket/font modes) — **partial**

- Mac evidence: Properties `longCitationBracketMode`, `longCitationEnabled`, `longCitationFontMode`, `longCitationOrder`, `longCitationTrailingMode`, and matching `normalCitation*` siblings. Selectors `getExampleCitationsWithLocalizationManager:`, `citationStringForCitationMode:ofPlace:outputMode:`, `applyCitationsString:toTemplate:withCitationsMode:`. NIBs `EditSourceTemplatesSheet.nib`, `EditSourceTemplateKeysSheet.nib` (template editing), `EditPlaceTemplatesSheetCitationsView.nib`. Strings `_BookEditor_...Citation_*`, `_Book_Citation_Style_*`.
- Web evidence: `citation|Citation` appears in 15 files but as a simple "citation = source + page + note" row. No short vs. long form, no brackets/font toggle, no template-driven rendering.
- Classification: **partial**.
- Why it deserves attention: Books route needs two citation styles (footnote vs. bibliography). `src/lib/books.js` currently cannot render a proper bibliography because of this.

### 2P.8 Column chooser on list widgets — **missing**

- Mac evidence: Large list NIBs — `LargeSectionedMultiColumnPersonListWidget.nib`, `LargeSectionedMultiColumnFamilyListWidget.nib`, `LargeSectionedMultiColumnPlaceListWidget.nib`, `LargeSectionedMultiColumnSourceListWidget.nib`, `LargeSectionedMultiColumnToDoListWidget.nib` — all expose per-column visibility menus via `NSTableView`'s header context menu.
- Web evidence: Grep for `columnChooser|visibleColumns|columnPicker` returns **no matches** in `src/`. Lists in `Persons.jsx`, `Places.jsx`, etc. use fixed column layouts.
- Classification: **missing**.
- Why: Power users building genealogy lists want to show/hide birth place, change date, FamilySearch ID, GEDCOM ID, etc. Generic header-dropdown.

### 2P.9 Per-list sort profile presets (beyond single sort key) — **partial**

- Mac evidence: Each list has a typed set of sort options: `_EditNotesContentController_Sorting_ByCreationDate/ByChangeDate/ByText`; `_BaseEditEventsContentController_Sorting_ByTypeAndDate/ByTypeName/ByDate/ByDescription`; `_EditToDosContentController_Sorting_ByTitle/ByDueDate/ByStatus/ByPriority/ByType`; `_EditSourceRelationsContentController_Sorting_ByTitle/ByCertainty/ByDate/ByPage`; `_EditPlaceEventsAtPlaceContentController_Sorting_ByType/ByDate`.
- Web evidence: `Persons.jsx` has three sort options (name / birth / death). Other list routes use static order. Grep shows no shared `useSortProfile` hook.
- Classification: **partial**.
- Why: Cheap to implement; user-visible everywhere; unblocks list-view certainty sort (#2P.4) and change-log sort.

### 2P.10 Read-only / locked record state (beyond full-DB read-only) — **partial**

- Mac evidence: The symbol table has tree-wide `isInReadOnlyMode`, `zonesAreReadOnly`, `cloudKitReadOnlyMode`, and `setReadOnly:` on individual objects. `shouldBeMarkedAsCompletedDueToDataEnteredInObject:inContext:` and `markAsCompletedForAllQuestions:` suggest a "completed" flag at the object level. `_FamilySearchPersonCompareHandler_LockedHeader` and `_PinnedButLockedToFamilySearch` show record-level locking when pinned to FamilySearch.
- Web evidence: Grep for `readOnly` in `src/` finds only `Home.jsx`, `Favorites.jsx`, `FamilyEditor.jsx`, `gedcomImport.js`, `Settings.jsx` — all at the form-field level. No per-record lock, no "marked complete" column.
- Classification: **partial** (tree-wide only).
- Why: Useful for long collaborative trees where a researcher wants to freeze verified ancestors. Add `isLocked` to base record and make editors respect it.

### 2P.11 Name format for sorting vs. display — **missing**

- Mac evidence: Preferences split display format (`defaultNameFormatFromPreferences`) from sort format (`defaultNameFormatForSortingFromPreferences`, plus `databaseNameFormatForSortingIncludesPrefix`). Two separate menus in `PreferencePaneNameFormat.nib`.
- Web evidence: Repo compares with `compareStrings(a.fullName, b.fullName)` using the primary name. No sort-name override.
- Classification: **missing**.
- Why: Users in regions that sort by family/last name (most genealogy apps default to this) cannot set it. Paired with 2P.2.

### 2P.12 Keyboard shortcuts beyond per-component `onKeyDown` — **missing (confirmed; previous doc flagged it briefly, not actioned)**

- Mac evidence: `MainMenu.nib` binds `⌘N` new tree, `⌘F` search, `⌘S` save, `⌘P` print, `⌘,` preferences, `⌘B` bookmarks, etc. No scripting layer though (Automator/AppleScript absent per the primary doc #17).
- Web evidence: `useHotkeys|useKeyboard|commandPalette|cmd\+k` returns **no matches**. Seven files have ad-hoc `onKeyDown` for dropdown menus.
- Classification: **missing**.
- Why: Previously listed in the primary doc (#16) but not prioritized. Flagging again because a command palette (`⌘K`) would unblock navigation across the 25+ routes the web app now has; no single list is browsable from the keyboard.

### 2P.13 Range/tree comparison and diff — **not a gap upstream**

- Mac evidence: Grep of the symbol dump for `TreeDiff|CompareTree|Diff_Sheet` returns only `runCompare_PersonRoleChild/Parent/Partner/Initial` — these are internal FamilySearch-compare selectors, not a general tree-vs-tree diff.
- Web evidence: n/a.
- Classification: **not a gap** (Mac does not ship a tree-diff view either).
- Why this deserves a line: to close the door on the "tree comparison" task item — the Mac app does not have that feature, so the web app does not need it.

### 2P.14 Notification center / activity feed — **not a gap upstream**

- Mac evidence: The only `NotificationCenter` matches are `startObservingUserDefaultsAndNotificationCenterForCacheChanges` (internal NSNotificationCenter). No user-visible activity feed.
- Web evidence: n/a.
- Classification: **not a gap**.

### 2P.15 Diagnostics / log viewer — **not a gap upstream**

- Mac evidence: Grep for `Diagnostic|LogViewer|ConsolePane|DebugPane` returns zero hits — Mac uses `os_log` / Console.app, not an in-app pane.
- Web evidence: n/a.
- Classification: **not a gap**.

### 2P.16 Printing distinct from export — **partial**

- Mac evidence: `showUIForPrinting`, `supportsPageSetup`, `setDefaultPaginationInformationInChartsObjectsContainerBeforeEditOrUneditedPrinting:`, `omitEmptyPagesWhenPrintingOrExporting`. NIBs honor `NSPrintInfo` dialogs (page setup + printer sheet).
- Web evidence: `chartExport.js` → `printChartViaPdf` opens a new window and calls `window.print()`; `reports/export.js` labels PDF as "PDF (via print)". This works but there is no Page Setup modal, no paginated preview, no "omit empty pages" toggle wired to the flow.
- Classification: **partial**.
- Why: Already half-present in `pageLayout.js`; surfacing `omitEmptyPagesWhenPrintingOrExporting` in a Page Setup modal is a ~150-line change.

### 2P.17 Batch operations on multi-selected persons — **missing**

- Mac evidence: `additionalConfigurationFromMultiSelectedObjects`, `sectionedListControllerShouldAllowMultiSelection:`, `resumeUpdatingFurtherSelectedObjectsForMultiSelection`. List widgets and chart editor both honor multi-select; right-click menu exposes "Add Label to Selected", "Delete Selected", "Export Selected" across persons/families/places/sources/todos.
- Web evidence: `Persons.jsx` has row selection for a detail view but no `selectedIds` set, no bulk-action bar. Grep of the repo for `selectedIds|selectionSet|batchDelete|bulkAssign` returns nothing relevant.
- Classification: **missing**.
- Why: Label-to-many and delete-many are routine cleanup tasks; the lack is a visible efficiency gap. Pair with the Column Chooser gap (#2P.8) as one "list widget upgrade" PR.

### 2P.18 WorldHistory category selector — **partial** (already listed in primary doc #24, reconfirmed)

- Mac evidence: `HistoryDatabaseCategorySelectorView.nib`, `HistoryDatabaseEventsSelectorView.nib`. ~40 categories with independent on/off.
- Web evidence: `src/routes/WorldHistory.jsx` — grep of the file shows no `category` or `toggle` keys. Events render as a flat list.
- Classification: **partial**.
- Why: Reconfirming because this is a low-lift addition and was not yet promoted out of the primary doc.

### 2P.19 Welcome window "label a tree" and per-tree sort/favorite — **partial** (already in primary doc #4, reconfirmed)

- Mac evidence: `_StartupWindow_LabelMenu`, `_MarkAsFavorite`, `_SortConfig_MainSorting_ByName/ByChangeDate/AlsoSortByFavorites`, `_SendFileShareSheet`.
- Web evidence: Home tree list is unsorted/unlabeled.
- Reconfirming — still open.

### 2P.20 Book Title Page Setup presets — **missing**

- Mac evidence: `_BookEditor_BookConfiguration_BookTitlePageSetup_*` — five presets: `Title_SubTitle_Author_Date`, `Title_SubTitle_Image_Author_Date`, `Title_SubTitle_FamilyCrest_Author_Date`, `Image_Title_SubTitle_FamilyCrest_Author_Date`, `FamilyCrest_Title_SubTitle_Author_Date`. NIB `BookCustomTitleConfigurationSheet.nib`.
- Web evidence: `src/lib/books.js` — grep returns no `titlePage|BookTitle|FamilyCrest` keys.
- Classification: **missing**.
- Why: Books route currently emits a bare title page; offering five named presets is a 30-minute layout change.

---

## Second-pass "Next 3 to implement"

Chosen for "achievable in one session each" and highest user-visible impact per hour:

1. **Date qualifier support in the DatePicker (#2P.1).** Extend `src/components/ui/DatePicker.jsx` to accept `{ value, prefix, suffix, era, range }`, persist GEDCOM-style tokens (`ABT 1820`, `BET 1701 AND 1704`, `BEF 1900`), and render them. Gate on `DateParser` strings (shipped list of prefixes). Touches PersonEditor/FamilyEditor event rows, GEDCOM import/export parsers, and the reports renderer. One session because the token vocabulary is fixed and the UI is a single popover widget.

2. **Source Certainty triplet (#2P.4).** Add `sourceQuality` / `informationQuality` / `evidenceQuality` enums (`DontKnow` / `Derivative` / `Original`) to the `sourceRelation` schema; surface a compact 3-dropdown panel under each citation in `PersonEditor.jsx` and `FamilyEditor.jsx`; add "Sort by certainty" to the source list. Single session because it is mostly schema plus a three-select form fragment — no renderer changes required.

3. **Narrative report prose (#2P.5).** Port a minimal slice of `CoreNarrativeReport.strings` (Birth, Marriage, Death, Residence, Occupation for Male/Female, with slots `Name|Date|Year|Place|Age`). Bundle the strings table in `src/lib/reports/narrativeTemplates.js`, wire into `builders.js`. This is the highest-visibility gap the second-pass uncovered and is exactly one session if we limit to five event types and one locale.

Deferred from this pass (not one-session work): Privacy model depth (2P.6 requires touching every chart builder), Multi-axis citation model (2P.7 requires a template language), Column chooser + multi-select batch ops (2P.8 + 2P.17 — cleanest as a combined list-widget PR next session), Name format presets (2P.2/2P.11 — safe but small user win; bundle with a Settings PR).

---

## Third-pass findings (2026-04-20)

Driven from a fresh sweep of `Contents/Resources/en.lproj/*.strings` (Localizable, Edit, EditMediaPanes, ChartPanes, ReportPanes, DatabaseMaintenance, FamilySearch, ResearchAssistantPane, RecordSheets, ScanPictureSheet, InteractiveTreePaneStrings) plus `Contents/Resources/Base.lproj/*.nib`. Items below are not present in passes 1 or 2.

### 3P.1 GEDCOM import issues analyzer sheet — **partial**

- Mac evidence: `GedcomImporterIssuesAnalyzerSheet.nib` with strings `_GedcomImporterIssuesAnalyzerSheet_Title` "GEDCOM Import Issues", `_NoUnparsableGEDCOMTagsFoundMessage`, `_NoUnparsableDatesFoundMessage`; plus `_GedcomImporterWarningSheet_HeaderTitle` "GEDCOM Import Warnings".
- Web state: `src/lib/gedcomImport.js:360-386` collects `issues[]` with severity/line/message and returns `canImport`, but I find no UI that surfaces the list after a successful import — `ImportDropZone.jsx` only blocks on errors. Unparsable dates never appear as a reviewable list.
- **Recommendation:** Add a post-import `GedcomImportReviewSheet.jsx` that shows the warning table (unparsed tags, unreadable dates per record) with "Jump to record" actions, gated behind the existing `issues` array.

### 3P.2 GEDCOM custom character-encoding chooser — **missing**

- Mac evidence: `GedcomCustomEncodingSheet.nib`, `_GedcomCustomEncodingSheet_Title` "GEDCOM Character Encoding".
- Web state: `gedcomImport.js` parses as UTF-8 only; legacy ANSEL / Windows-1252 / UTF-16 files will mojibake silently. No CHAR header handler visible.
- **Recommendation:** Detect `1 CHAR` in the header and, when not UTF-8/ASCII, present an encoding picker (`TextDecoder` covers windows-1252 and utf-16; ANSEL needs a small lookup table).

### 3P.3 Narrative report speech synthesis — **missing**

- Mac evidence: `_NarrativeReportPane_SpeakButton` "Speak", `_NarrativeReportPane_NoLanguageFoundMessage` — reads narrative aloud via macOS voices.
- Web state: no `speechSynthesis` / `SpeechSynthesisUtterance` references under `src/`.
- **Recommendation:** Single Play/Stop button in `ReportsApp` narrative view that feeds the rendered prose through Web Speech API; degrade gracefully when the API is absent.

### 3P.4 Research Assistant — persisted "Ignore" decisions — **missing**

- Mac evidence: `_ResearchAssistantPane_QuestionList_IgnoreObjectForFurtherQuestionsMenuItem`, `_IgnoreThisQuestionMenuItem`, `_IgnorePersonOption`, `_IgnoreFamilyOption`.
- Web state: grep for `ignoreQuestion` / `researchIgnore` in `src/` returns nothing; `researchSuggestions.js` re-derives suggestions on every open with no exclusion set.
- **Recommendation:** Persist an ignore set `{ entityId, questionKey }` in IndexedDB settings and filter at render time. Trivial to add once the key shape is stable.

### 3P.5 ToDo Wizard — **missing**

- Mac evidence: `_EditToDoPane_WizardButton` "ToDo Wizard", `ToDoWizardSheet.nib`, `_ToDosWizardSheet_Title`. Generates canned research ToDos (verify birth, find marriage record, locate obituary, etc.) for a selected person based on missing events/sources.
- Web state: `src/routes/ToDos.jsx` only supports manual add. Related `researchSuggestions.js` could feed this but is not wired.
- **Recommendation:** Merge `researchSuggestions` output into a "Generate ToDos from gaps" wizard — reuses existing plausibility/missing-field logic.

### 3P.6 Maps Diagram year slideshow / "Show all Years" — **missing**

- Mac evidence: `_MapDiagramPane_StartSlideshow`, `_MapDiagramPane_StopSlideshow`, `_MapDiagramPane_ShowAllYearsButton`.
- Web state: `src/routes/MapsDiagram.jsx` grep shows no `Slideshow` / `ShowAllYears` controls. Time-window filter exists but no autoplay.
- **Recommendation:** Add play/pause with configurable step (decade/year) that advances the year filter and replays events on the map.

### 3P.7 FamilySearch "Manage Sources" + Source Folders + Reference Tags — **missing**

- Mac evidence: `_ManageFamilySearchSourcesButton` and NIBs `FamilySearchSourceFoldersSheet.nib`, `FamilySearchSourceFoldersView.nib`, `FamilySearchCreateOrUpdateSourceFolderSheet.nib`, `FamilySearchEditSourceReferenceTagsWidget.nib`, `FamilySearchCreateOrEditSourceDescriptionSheet.nib`.
- Web state: `FamilySearch.jsx` route exists but no FS-specific source manager; `familySearchApi.js` has no folder or tag helpers.
- **Recommendation:** Ship only if FS source-reference parity is needed; defer otherwise. Prior audits list FS workflows but not the source-management branch specifically.

### 3P.8 FamilySearch "Ask for reason" + "Auto-download relatives" sheets — **missing**

- Mac evidence: `FamilySearchAskForReasonSheet.nib`, `_FamilySearchAskForReasonSheet_Title` "Provide Reason for Change" (required audit trail when applying edits). `FamilySearchPersonBatchDownloadSheet.nib`, `_FamilySearchPersonBatchDownloadSheet_Title` "Auto-Download Relatives" (batch import N generations from a matched FS person).
- Web state: neither concept appears in `src/routes/FamilySearch.jsx`.
- **Recommendation:** The reason prompt is low-effort and increases parity when users apply FS merges; the batch downloader is a bigger piece and can wait.

### 3P.9 "Oldest Ancestors" widget — **missing**

- Mac evidence: `_OldestAncestorsWidget_SelectPerson` — side panel that surfaces the oldest known ancestor along each line for the selected person.
- Web state: `src/lib/statistics.js` computes aggregate stats but no per-person oldest-ancestor drill-down widget is wired into `PersonEditor.jsx`.
- **Recommendation:** Reuse existing ancestor walker from `relationshipPath.js`; show a compact 4–6 row list in the person sidebar.

### 3P.10 iCloud-style share-as-link publish — **missing**

- Mac evidence: `_MyDocumentController_iCloudSharing_Message`, `_iCloudSharing_CopyDownloadLinkToClipboard` — publish the current tree and get a sharable download link.
- Web state: the loader already accepts `?url=` (see commit `8e47dac`), but there is no counterpart "publish current tree and copy link" — users must upload to their own hosting first.
- **Recommendation:** A one-click "Copy shareable link" that uploads a serialized snapshot to a configurable endpoint (e.g., a user-provided gist / S3 / Pastebin-like target) and returns a `?url=` deep link.

### 3P.11 Object-level deep link / Handoff parity — **missing**

- Mac evidence: `_MyDocumentController_Handoff_ObjectNotFoundMessage` — deep-link by `{treeId, objectRef}`.
- Web state: the router loads trees but does not route to a specific person/family/source via URL. Grep confirms no `Handoff` / `deepLink` refs.
- **Recommendation:** Extend the query-string loader to accept `&person=<id>` (and family/source/place/media) and route into the correct editor on boot.

### 3P.12 Chart editor "Edit Background" — **partial**

- Mac evidence: `_EditChartPane_EditBackgroundButton` is a dedicated background editor (color, gradient, image, PDF).
- Web state: `ChartsApp.jsx` surfaces `addImage`, `addLine`, `addText` but grep did not return a dedicated "editBackground" action.
- **Recommendation:** Split background styling into its own dialog rather than mixing it into the compositor theme.

### 3P.13 Multi-path relationship finder configuration — **partial**

- Mac evidence: `FindRelationshipPathsConfigurationWidget.nib` — UI to tune how many paths to find, depth limits, inclusion of half/step relations.
- Web state: `src/lib/relationshipPath.js` returns a single shortest path; no configuration surface for alternative paths or half-blood toggles.
- **Recommendation:** Expose depth / alt-path count / half-blood flags on `RelationshipChartPane` so users can explore degenerate cases (common in endogamous trees).

### 3P.14 Database migration dialog — **missing**

- Mac evidence: `_DatabaseMigration_MessageText` "Family Tree Migration" with auto-backup-before-migrate and a change list.
- Web state: schema versioning in `src/lib/schema.js` exists but there is no user-visible migration modal. Silent upgrades risk data loss if a user opens a newer-schema file on an older deploy.
- **Recommendation:** Detect stored-schema < runtime-schema on load and require explicit "Migrate (backup first)" / "Open read-only" choice.

### 3P.15 Book validation "has errors" sheet — **missing**

- Mac evidence: `BookHasErrorsSheet.nib`.
- Web state: `src/routes/Books.jsx` + `src/lib/books.js` generate books but there's no pre-export validation sheet (missing sections, broken references, empty pages).
- **Recommendation:** Small validator that walks the book document and returns fixable issues; block export only on hard errors.

### 3P.16 GEDCOM-adjacent: GedZip media-folder import — **partial**

- Mac evidence: `_MyDocument_GEDCOMImportSelectMediaFolderMessage` — pick the folder of pictures paired with the GEDCOM.
- Web state: `gedcomImport.js:382` mentions GedZip bundles but the `ImportDropZone` only accepts a single file. Drag-and-drop of a GEDCOM + sibling media folder is not supported.
- **Recommendation:** Accept a folder drop (webkitdirectory) and resolve `OBJE` file references relative to the folder root.

### Third-pass "Next 3 to implement"

1. **Research Assistant ignore persistence (#3P.4).** Pure data layer — add `researchIgnores` to preferences, filter before render. One small PR.
2. **Post-import review sheet (#3P.1).** The data is already collected; all that's missing is a list view rendered after a successful import. High-trust win for users debugging messy GEDCOMs.
3. **Object-level deep linking (#3P.11).** Minor router change on top of existing `?url=` support; unlocks shareable "look at this person" links that the team will actually use.

Deferred: encoding chooser (3P.2) is small but benefits a narrow set of users; TTS (3P.3) is fun but cosmetic; maps slideshow (3P.6) and ToDo wizard (3P.5) are each one solid session but lower urgency than the three above.

---

## Fourth-pass reconciliation (2026-04-20)

Verified during an implementation sweep. Several items the earlier passes flagged as **missing / partial** are now actually shipped — worth recording so the next audit doesn't re-propose them.

### Already implemented (recorded here for the record)
- **2P.1 Date qualifiers (ABT/BEF/AFT/BET/FROM…TO/CAL/EST/INT + BC + phrase)** — `src/components/ui/DatePicker.jsx` + `src/lib/dateQualifiers.js`. DatePicker has qualifier dropdown, era toggle, range selector, INT phrase field.
- **2P.4 Source Certainty triplet** — `src/lib/sourceCertainty.js` (CERTAINTY enum + axes + `certaintySortKey`) + `src/components/editors/RelatedRecordEditors.jsx:205-272` wires Original/Derivative/DontKnow dropdowns into citations and sorts relations by combined certainty.
- **2P.5 Narrative prose templates** — `src/lib/reports/narrativeTemplates.js` (Birth/Marriage/Death/Residence/Occupation × Male/Female/Unknown × slot fallbacks) + `builders.js:13,566-579` uses `describeBirth`, `describeDeath`, `describeMarriage` in the narrative report builder.
- **#1 Custom type editors** — `src/routes/CustomTypes.jsx` + `src/lib/customTypes.js` — event/fact/additional-name/ToDo/influential-relation types.
- **#6 Change Log purge tools** — delivered in commit `cb08fa6`.
- **#11 Subtree wizard** — `src/routes/SubtreeWizard.jsx` + `src/lib/subtree.js`.
- **#15 Bookmarks hub** — `src/routes/Bookmarks.jsx`.
- **#19 LDS Ordinances** — `src/routes/LdsOrdinances.jsx`.
- **#25 Plausibility configuration** — `Settings.jsx` Plausibility tab + `src/lib/plausibility.js`.
- **#26 Person groups** — `src/routes/PersonGroups.jsx`.

### Delivered in this session
- **3P.1, 3P.2, 3P.4, 3P.5, 3P.6, 3P.7/3P.8, 3P.9, 3P.10, 3P.11, 3P.12, 3P.13, 3P.14, 3P.15, 3P.16** — see commit history and the files under `src/components/` and `src/lib/` named after each feature.

### Still open (confirmed missing after this pass)
- **#2 Smart Filter authoring** — `src/routes/SmartFilters.jsx` exists but lacks a compound filter-component builder; named "smart filters" only cover built-in scopes today.
- **#3 Saved searches** — no persistence of multi-criteria search state; still a good pairing with #2.
- **#4 Welcome multi-tree library UI** — per-tree label/favorite/sort/rename/delete-with-confirm not yet on `Home.jsx`.
- **#5 Backup pane retention + history browser** — `Backup.jsx` still a single-shot JSON export.
- **#7 Conflict resolution UI on merge** — `MergeConflictSheet.jsx` exists but isn't wired into the merge progress flow.
- **#12 Slideshow configuration depth** — `Slideshow.jsx` route exists; needs `SlideshowConfigurationSheet` parity (interval, transitions, per-media selection).
- **#13 Batch Place Lookup sheet** — missing as a dedicated modal; geocoding helpers exist under `placeGeocoding.js`.
- **#16 Keyboard shortcuts palette** — `src/lib/useKeyboardShortcuts.js` is per-view only; no global palette / help sheet.
- **#20 Research log** — no journal-style log separate from ToDos.
- **#27 Place Convert-to-Detail** — no sheet to collapse a Place into a detail of its parent.
- **3P.3 Narrative TTS** — not yet wired.

### Fourth-pass "Next 3"
1. **#2 Smart Filter authoring sheet** — compound filter builder + "Save current search as smart filter". Pairs naturally with #3 in the same PR.
2. **#4 Welcome multi-tree actions** — rename / favorite / sort / delete-with-typed-confirm on `Home.jsx`.
3. **#16 Global keyboard shortcut palette** — single sheet listing bindings, with `?`-style toggle. Prior audit flagged it; still nothing global.
