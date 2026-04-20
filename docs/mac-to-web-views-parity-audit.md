# MacFamilyTree 11 to web non-chart views parity audit

Source app bundle:

- `/Users/ahmadjalil/Downloads/family tree/app/MacFamilyTree 11/Contents`
- App binary: `Contents/MacOS/MacFamilyTree 11`
- Core framework: `Contents/Frameworks/MacFamilyTreeCore.framework/Versions/A`
- Primary sibling note: `docs/mac-to-web-chart-parity-audit.md`

Web app target:

- `/Users/ahmadjalil/github/familytree`
- Routes directory: `src/routes/`
- Component hubs: `src/components/books/`, `src/components/reports/`, `src/components/search/`

## Executive comparison

The web app already has a dedicated route for almost every MacFamilyTree 11 non-chart pane: persons, families, places, sources, media, todos, research, family-search, search, statistics, reports, books, websites/publish, settings, favorites, and author information all exist. Breadth parity is good.

Depth parity is uneven. The Mac app ships these panes with three things the web mostly does not yet have:

1. A consistent edit-session model — every editor pane has an explicit Edit / Finish lifecycle, dirty-save prompts, read-only guards, and a dedicated `_EditXController_Title` surface.
2. A configuration/style/theme/page split — Reports, Books, Virtual Globe, Virtual Tree, Maps, and Media panes all share a tab structure of `Options`, `Style`, `Theme`, `Page`, `Background`, `Language`, and `Pagination`.
3. Wizard/sheet flows — New Book Assistant, ToDo Wizard, Add Media Sheet, Place Lookup Sheet, Research Assistant options, FamilySearch match/merge/ordinance/memory sheets are all driven by dedicated `*Sheet.nib` files.

The web app is mostly one-page editors with inline save, no dirty-state prompts, and limited style/page configuration. That is the structural gap the rest of this audit maps out.

## Web implementation inventory

### Present in web

- `/persons` — list and filters in `src/routes/Persons.jsx`, sharing `loadPersonRows()` for rows, plus CSV/JSON export and active-person selection.
- `/person/:id` — full person editor in `src/routes/PersonEditor.jsx` with names, events, facts, notes, sources, influential persons, labels, reference numbers, bookmarks, private flag, and change-log wiring.
- `/family/:id` — `src/routes/FamilyEditor.jsx` with man/woman panels, children reorder, family events, media, notes, sources, influential persons.
- `/places` — `src/routes/Places.jsx` with place template picker, DMS coordinates, map widget, place-details sub-list, and `lookupPlaceCandidates` / `batchLookupMissingCoordinates` hooks in `src/lib/placeGeocoding.js`.
- `/statistics` — `src/routes/Statistics.jsx` backed by `computeStatistics()` in `src/lib/statistics.js`.
- `/reports` — `src/components/reports/ReportsApp.jsx` with multiple report types and PDF/HTML/RTF/CSV/text export.
- `/books` — `src/components/books/BooksApp.jsx` with section-based book composition.
- `/publish` and `/websites` — `src/routes/Publish.jsx`, `src/routes/Websites.jsx`, driven by `src/lib/websiteExport.js` and `src/lib/publishTargets.js`.
- `/media` and `/views/media-gallery` — `src/routes/Media.jsx` with type filter, caption/description editor, and `createMediaRecordsFromFiles`.
- `/sources` — `src/routes/Sources.jsx` with source template picker, referenced-entries computation, full info fields.
- `/todos` — `src/routes/ToDos.jsx` with `ToDoRelation` target picker across Person/Family/Source/Place/Event/Media.
- `/research` — `src/routes/Research.jsx` with heuristic suggestions plus persisted done/ignored state.
- `/search` — `src/components/search/SearchApp.jsx` with multi-criteria filters and smart scopes.
- `/settings` — `src/routes/Settings.jsx` with General, Formats, Maps, Export, Integrations, Functions tabs.
- `/favorites` — `src/routes/Favorites.jsx` with favorite functions and bookmark jump lists.
- `/familysearch` — `src/routes/FamilySearch.jsx` with tasks, local filter modes, and compare/merge/ordinance placeholders through `src/lib/familySearchApi.js`.
- `/author` — `src/routes/AuthorInformation.jsx`.
- Home dashboard at `/` — `src/routes/Home.jsx` with shortcut cards to every major function.

### Missing or shallow in web

- No shared `_EditXController` / `_EditXPane_ShouldSave*` dirty-prompt pattern across editors.
- No explicit `Edit` / `Finish Editing` mode toggle on editor panes; all routes are always-editable.
- No `Style` / `Theme` / `Page` / `Background` / `Language` / `Pagination` tab split on reports/books/websites beyond ad-hoc options objects.
- No wizard/sheet presenter infrastructure: no equivalent of `BooksPaneNewBookConfigurationSheet`, `ToDoWizardSheet`, `AddMediaSheet`, `PlaceLookupSheet`.
- Research assistant is heuristic-only; no `ResearchAssistantPane_Question` / `_Context` / `_QuestionList` three-way layout.
- Media pane has no Grouping & Style mode, no Export-selected-media flow, no Open-in-Preview affordance.
- FamilySearch pane does not expose the Mac `Overview`, `Matches`, `Auto-Matches`, `Ordinance Opportunities`, `Memories`, `Records`, `Change History`, `Statistics`, `Discussions`, `Batch Download` sub-panes as explicit sub-routes.
- Places pane has no batch place lookup sheet, place-detail convert flow, feature-code filter, or download-geographical-data prompt; web only exposes batch coordinate lookup.
- Sources pane has no source-template editor (`EditSourceTemplatesSheet`) or source-repository sheet (`EditSourceRepositoriesSheet`).
- No Search-and-Replace pane (`_SearchAndReplacePaneName`).
- No explicit `FamilyQuiz`, `VirtualGlobe`, `MapsDiagram` / `StatisticMaps`, `WorldHistory`, `ChangeLog` parity with the Mac pane-level configuration surfaces.

## Per-view comparison

### People list / person editor

Mac evidence:

- `CoreFunctionPaneNames.strings`: `_FunctionTitle_PersonListPaneName` = "Edit Persons", `_FunctionTitle_PersonListPaneName_Abbreviation` = "Persons".
- `CoreEdit.strings`: `_EditPersonController_Title` = "Edit Person", `_EditPersonEventController_Title` = "Edit Person Event", `_EditPersonFactController_Title` = "Edit Person Fact", `_EditCommon_PrivateFlagLabel` = "Private".
- `_BaseEditController_DeletePersonQuestionMessage` / `_BaseEditController_DeletePersonQuestionInformative` for delete confirm.
- `LargeSectionedMultiColumnPersonListWidget.nib` — multi-column sectioned list widget.
- `PersonContextWidget.nib`, `PersonRelativesSelectionSheet.nib`, `PersonRelativesAncestorsSelectionView.nib`, `PersonRelativesDescendantsSelectionView.nib`, `PersonGroupSelectionSheet.nib`, `PersonScopeWidget.nib`.
- `PreferencePaneNameFormat.nib` for name formatting defaults.

Web now:

- `src/routes/Persons.jsx` — simple list with sort/filter, CSV/JSON export.
- `src/routes/PersonEditor.jsx` — full field set: names, events, facts, notes, sources, influential, labels, reference numbers, bookmarks, private, last edited. Uses `saveWithChangeLog`.
- Supporting: `src/lib/catalogs.js` for type pickers, `src/components/editors/RelatedRecordEditors.jsx` for associate/media/citations editors.

Missing or shallow:

- No shared `_EditPersonController_Title` top bar / Edit / Finish lifecycle.
- No Person Relatives Selection sheet equivalent for bulk ancestor/descendant selection (`PersonRelativesAncestorsSelectionView.nib`).
- No Person Group selection sheet for assigning people to groups in bulk.
- No "Edit Person Event" / "Edit Person Fact" modal as its own controller — event edits happen inline or via the separate `/events` route.
- No multi-column sectioned list widget parity (sectioned by birth decade, place, person group).
- No delete-confirm dialog with Mac-style `_DeletePersonAlertMessage` wording.

Bring over next:

- Add Edit / Finish toggle and dirty-save prompt on person editor.
- Add a Person Relatives Selection sheet reusable inside Reports, Books, and Charts.
- Add sectioned person list widget (by gender / decade / place / group / label) as an alternative list view.
- Add dedicated delete-person confirm matching Mac strings.

### Family editor

Mac evidence:

- `CoreFunctionPaneNames.strings`: `_FunctionTitle_FamilyListPaneName` = "Edit Families".
- `CoreEdit.strings`: `_EditFamilyController_Title` = "Edit Family", `_EditFamilyEventController_Title` = "Edit Family Event".
- `FamilySelectionWidget.nib`, `LargeSectionedMultiColumnFamilyListWidget.nib`.
- Family-scoped sheets for book/report embeds: `BookFamilySectionItemConfigurationSheet.nib`.

Web now:

- `src/routes/FamilyEditor.jsx` — man/woman panels, children reorder, events, media, notes, sources, influential persons.
- `PersonPicker.jsx` used for spouse/child selection.

Missing or shallow:

- No dedicated Families list route (only via person editor links or direct URL).
- No Family Event edit controller (events are inline in the family editor).
- No Family selection widget for reuse in reports/books/charts.
- No sectioned family list (by decade of marriage, place of marriage).

Bring over next:

- Add a `/families` list route with sort/filter like `/persons`.
- Extract a Family Selection widget from `FamilyEditor.jsx` for reuse.
- Add explicit Family Event edit controller backed by schema typed as `FamilyEvent`.

### Places

Mac evidence:

- `CoreFunctionPaneNames.strings`: `_FunctionTitle_PlaceListPaneName` = "Edit Places".
- `CorePlaceLookup.strings`: `_PlaceLookupControllerPinQuery_PlaceOrPOILabel`, `_PlaceLookupControllerPinQuery_AdministrativeDivisionsLabel`, `_PlaceLookupControllerPinQuery_CountryLabel`, `_PlaceLookupControllerPinQuery_IncludedPlaceFeatureCodes` with `OnlyPlaces` vs `Everything`, `_PlaceLookup_DownloadRequired_Title` / `_SubTitle`.
- `CorePlaceTemplates.strings`: `PlaceTemplate_Generic`, `PlaceTemplate_Generic_ThreeComponents`, country-specific templates (Germany, France, United Kingdom, Spain, Italy, Czechia, Slovakia, Hungary, Finland, …).
- NIBs: `PlaceLookupSheet.nib`, `PlaceLookupView.nib`, `PlaceLookupAddPlaceControllerFreeformControlsSheet.nib`, `BatchPlaceLookupSheet.nib`, `PlaceSelectionWidget.nib`, `PlaceConvertToPlaceDetailSheet.nib`, `EditEventPlaceSheet.nib`, `EditPlacePane_MapSubView.nib`, `EditPlaceTemplatesSheet.nib`, `EditPlaceTemplateKeysSheet.nib`, `PlaceWebLinksResultImageWidget.nib`.
- `CoordinateWidget.nib` for DMS input.

Web now:

- `src/routes/Places.jsx` — list + editor, place template picker, DMS display, map widget, place-details sub-list.
- `src/lib/placeGeocoding.js` — `lookupPlaceCandidates`, `batchLookupMissingCoordinates`, `lookupGeoNameId`, `placeDetailsFromComponents`, map preferences.

Missing or shallow:

- No PlaceLookupSheet equivalent — the web has a backend function but no pin query UI with POI filter, preferred-short-name toggles, or freeform controls.
- No batch place lookup sheet (evidence: `BatchPlaceLookupSheet.nib`).
- No Place Convert to Place Detail sheet (`PlaceConvertToPlaceDetailSheet.nib`).
- No Edit Place Templates / Template Keys sheets — the web uses `PLACE_TEMPLATE_FIELDS` statically without editor.
- No download-geographical-data prompt or offline dataset reference (`_PlaceLookup_DownloadRequired_*`).

Bring over next:

- Add a Place Lookup sheet UI wired to `lookupPlaceCandidates` covering POI, administrative divisions, country, and feature-code filter.
- Add a Batch Place Lookup sheet using `batchLookupMissingCoordinates` with progress.
- Add Place Template editor equivalent to `EditPlaceTemplatesSheet` (create/rename/edit components).
- Add Convert-to-Place-Detail flow.

### Statistics

Mac evidence:

- `CoreFunctionPaneNames.strings`: `_FunctionTitle_StatisticsChartPaneName` = "Statistics" (this is the chart-mode statistics view, distinct from Reports).
- Report-side statistics pane: `CoreStatusReport.strings` includes `_Reports_StatusReport_ShowPersonRelatedInformation`, `_ShowFamilyRelatedInformation`, `_ShowUnconnectedPersons`, `_ShowEmptyFamilies`, `_ShowEventsAndFactsCount`, `_EarliestPerson_Key`, `_LatestPerson_Key`, `_LivingPersons_Key`, `_DiedPersons_Key`, `_EarliestMarriageFamilies_Key`, `_LatestMarriageFamilies_Key`.
- Core chart: `StatisticsChartBuilder`, `TableGraphChartBuilderItem` (see chart audit §Statistics).

Web now:

- `/statistics` route — counts by type, gender split, births/deaths by century, top surnames, lifespan, places by country, missing data.
- `computeStatistics()` in `src/lib/statistics.js` already covers most of the status-report data buckets.

Missing or shallow:

- No parity with Mac's dual-surfacing: desktop exposes Statistics as both a chart mode and a Status Report; web has only a standalone page.
- No Earliest/Latest Person, Earliest/Latest Marriage families stats matching the Status Report keys.
- No drilldown from a stat bucket into its persons list.
- No Empty Families / Unconnected Persons mode selector (`_EmptyFamiliesMode_NoManWoman`, `_NoManWomanChildren`).

Bring over next:

- Extend `computeStatistics()` with earliest/latest person, earliest/latest marriage, empty-families mode, events-and-facts count.
- Add drilldown links from each stat to the matching filtered `/persons` view.
- Expose Statistics as a chart mode (already on chart-audit backlog) reusing this data.

### Reports

Mac evidence:

- `CoreFunctionPaneNames.strings`: `_FunctionTitle_PersonListReportPaneName`, `_PersonReportPaneName`, `_StoryReportPaneName`, `_PersonEventsReportPaneName`, `_FamilyGroupReportPaneName`, `_KinshipReportPaneName`, `_NarrativeReportPaneName`, `_MediaGalleryReportPaneName`, `_StatusReportPaneName`, `_TodayReportPaneName`, `_TimelineReportPaneName`, `_ChangesListReportPaneName`, `_ChangeLogReportPaneName`, `_PlacesListReportPaneName`, `_MapReportPaneName`, `_EventsListReportPaneName`, `_FactsListReportPaneName`, `_DistinctivePersonsListReportPaneName`, `_AnniversaryListReportPaneName`, `_PersonAnalysisListReportPaneName`, `_SourcesListReportPaneName`, `_MarriageListReportPaneName`, `_ToDoListReportPaneName`, `_AhnentafelReportPaneName`, `_PlausibilityListReportPaneName`, `_DescendancyReportPaneName`, `_RegisterReportPaneName`, `_LDSOrdinancesListReportPaneName`, `_SavedReportsPaneName`.
- `ReportPanes.strings`: `_BaseReportFunctionPaneController_Save`, `SaveAsHTML`, `SaveAsPDF`, `SaveAsCSV`, `SaveAsPlainText`, `SaveAsRTFText`, `SaveAsReportMenuItem`, `ShareButton`, `EditButton`, `StyleButton`, `PageStyleButton`, `ReportOptionsButton`, `ReportThemesButton`, `PaginationButton`, `LanguageButton`, `PageBackgroundButton`, `ChartConfigurationsButton`, `ChartCompositorConfiguration`, `ChartBuilderConfiguration`, `ChartStylerConfiguration`.
- Edit lifecycle: `_EditReportPane_FinishEditing`, `_UndoButton`, `_RedoButton`, `_RemoveButton`, `_ShouldSaveEditedReportMessage`, `_ShouldSaveEditedReportInformative`, `_ShouldSaveNewReportMessage`, `_ShouldSaveNewReportInformative`.
- `CoreReports.strings` minor groups include General, Columns, Localization, Colors, Fonts, Style Options, Themes, Citations, Events, Page Style, Page Margins, Watermark, World History.
- NIBs: `SavedReportsPane.nib`, `SavedReportsPaneCollectionViewItem.nib`.

Web now:

- `src/components/reports/ReportsApp.jsx` — multi-report surface with PDF/HTML/RTF/CSV/text export (per `macfamilytree-parity-todo.md` line 84-87).
- Dedicated routes for many list reports already exist: `AnniversaryList.jsx`, `DistinctivePersons.jsx`, `Duplicates.jsx`, `FactsList.jsx`, `LdsOrdinances.jsx`, `MarriageList.jsx`, `PersonAnalysis.jsx`, `Plausibility.jsx`, `PlausibilityList.jsx`, `Lists.jsx`, `Events.jsx`, `WorldHistory.jsx`, `ChangeLog.jsx`.
- Saved charts UI in `SavedCharts.jsx`; saved reports coverage lives inside the reports app.

Missing or shallow:

- No Style / Theme / Page / Pagination / Page Background / Language tab split on the reports surface matching `ReportPanes.strings` buttons.
- No explicit Share button path (`_ShareButton` with tooltip "Save, Print or Share this Report").
- No Save-as-Report dirty prompt (`_ShouldSaveEditedReportMessage`, `_ShouldSaveNewReportMessage`).
- No Chart Theme / Options / Style sheet embeds for reports that contain charts (`_ChartCompositorConfiguration`, `_ChartBuilderConfiguration`, `_ChartStylerConfiguration`).
- Backlog note `macfamilytree-parity-todo.md:88` still calls out book sections for saved chart and saved report embeds.

Bring over next:

- Add Style / Theme / Page / Pagination / Background / Language tab controls to the reports app container.
- Add Save-as-Report dirty prompt and new-report save prompt with Mac copy.
- Add Share action for reports via Web Share API / copy-link / download-and-open fallback.
- Wire chart-in-report configuration sheets through the same chart configuration schema being planned in the chart parity audit.

### Books

Mac evidence:

- `BooksPane.strings` is minimal; the action surface lives in `CoreBooks.strings`.
- `CoreBooks.strings`: `_Books_OpenBook`, `_DuplicateBook`, `_DeleteBook`, `_BookEditorPaneName` = "Book Editor", `_BooksStartView_YourBooks`, `_BooksStartView_BookTemplates`, `_BookTemplate_BlackAndWhite`, `_Forest`, `_PictureWithWhiteText`, `_Modern`, `_Magenta`, `_Pure`.
- Book types: `_BookType_EmptyBook`, `_PersonBook`, `_FamilyBook`, `_TimeBasedBook`, `_CompleteBook` each with a `_Description_*` key.
- Generated chapter names: `_BookGenerator_Diagrams_ChapterTitle`, `_Families_ChapterTitle`, `_EventsAndPlaces_ChapterTitle`, `_PersonBook_Closest_Relatives`, `_HisParents_ChapterTitle`, `_HerParents_ChapterTitle`, `_HisChildren_ChapterTitle`, `_HerChildren_ChapterTitle`, `_InterestingFacts_ChapterTitle`, `_IntroductionText`, `_StatisticsSection_NumberOfChildren`, `_AgeAtMarriage`.
- Section configuration sheets (NIBs): `BookChapterItemConfigurationSheet`, `BookChartPageSectionConfigurationSheet`, `BookFamilySectionItemConfigurationSheet`, `BookPersonSectionItemConfigurationSheet`, `BookPersonBasedChartPageSectionConfigurationSheet`, `BookRelationshipChartPageSectionConfigurationSheet`, `BookSavedChartPageReportBuilderSectionSheet`, `BookSavedReportSectionConfigurationSheet`, `BookBaseObjectsBasedReportBuilderSectionItemConfigurationSheet`, `BookObjectBasedReportBuilderSectionItemConfigurationSheet`, `BookCustomTitleConfigurationSheet`, `BookHasErrorsSheet`, `BooksPaneNewBookConfigurationSheet`.
- Edit lifecycle: `_BookEditor_ShouldSaveEditedBookMessage`, `_ShouldSaveNewBookMessage`, `_ShouldSaveEditedReportInBookMessage`.
- Filters and sort in object-based sections: `_OnlyLivingPersons`, `_OnlyDeadPersons`, `_OnlyMarriedPersonsFamilies`, `_OnlyDivorcedPersonsFamilies`, `_SelectPersonsFromScope`, `_SortByName`, `_SortByBirthDateAscending`, `_SortByGender`, `_SortByFamilyLastName`.
- Title page config: `_BookEditor_TitlePageReportBuilderConfiguration_BookTitle`, `_BookSubTitle`, `_Author`, `_Date`, `_TitlePageImage`, `_FamilyCrest`.

Web now:

- `src/components/books/BooksApp.jsx` — section-based book composition with cover metadata and publish bundle export.
- `macfamilytree-parity-todo.md` lines 84-89 confirm additional report types, theme/style/page controls, and saved report fidelity are done, but book sections for saved chart/report embeds remain open.

Missing or shallow:

- No New Book Assistant sheet (empty / person / family / time-based / complete book types with descriptions).
- No Saved Chart and Saved Report book-section embed sheets (`BookSavedChartPageReportBuilderSectionSheet`, `BookSavedReportSectionConfigurationSheet`).
- No Chapter Item / Chart Page / Family Section / Person Section / Object-based-section configuration sheets with filters and sort options.
- No book-has-errors pre-export verification sheet (`BookHasErrorsSheet` / `_Books_BookHasErrorsSheet_Header`).
- No book-level theme templates (`BlackAndWhite`, `Forest`, `PictureWithWhiteText`, `Modern`, `Magenta`, `Pure`).
- No dirty-prompt for edited/new books.

Bring over next:

- Add New Book Assistant covering five book types and their descriptions.
- Add Saved Chart and Saved Report embed sections (also on existing todo backlog).
- Add a book-has-errors pre-export pass listing missing pictures/sources/deleted persons with deep links.
- Add book theme presets and title-page configuration.

### Publish / website export

Mac evidence:

- `CoreFunctionPaneNames.strings`: `_FunctionTitle_WebSiteExportWebSitesPaneName` = "Websites", `_WebSitePaneName` = "Website".
- `CoreWebSiteExport.strings`: `_WebSiteExport_Inspector_WebSiteSettingsTitle` = "Website", `_ThemesTitle` = "Themes", `_NoWebSitesPlaceholder_AddWebSiteButton` = "Add First Website", `_ShouldSaveModifiedWebSite_MessageText` = "Save changes to Website?", `_WebSite_CreationDate`, `_WebSite_ChangeDate`, `_LoadingFamilyTreeData`.
- Export prompts: `_WebSitesController_ExportWebSiteToFolder_ForLocalViewing`, `_ForWebServer`, `_ExportWebSiteToShare_Question_Informative`, `_LimitedPersonsForPreview_Question_Informative` ("This preview only displays a maximum of 500 persons. Your exported website will contain all selected persons, though.").
- Progress: `_WebSiteExport_Progress_CreatingWebsiteHeadline`.
- NIBs: `BurnWebSiteExportPublishSheet`, `FTPWebSiteExportPublishSheet`, `MacFamilyTreeComWebSiteExportPublishSheet`, `ManageWebSiteThemesSheet`, `ManageMacFamilyTreeComSheet`.

Web now:

- `src/routes/Publish.jsx` — hub to Websites, Books, Import/Export.
- `src/routes/Websites.jsx` + `src/lib/websiteExport.js` + `src/lib/publishTargets.js` — branding, privacy filters, validation, zip export, webhook publish.

Missing or shallow:

- No Inspector tab split of Website vs Themes sections.
- No manage-themes sheet (`ManageWebSiteThemesSheet`).
- No explicit FTP publish path (Mac has `FTPWebSiteExportPublishSheet`) — web only has a webhook publish target.
- No burn-to-folder-or-server chooser sheet (`_ExportWebSiteToFolder_ForLocalViewing` vs `_ForWebServer`).
- No preview-500-persons warning sheet.
- No creation/change date display on sites.

Bring over next:

- Add Inspector layout with Website vs Themes tabs.
- Add FTP / S3 / webhook publish target chooser sheet and merge into `publishTargets.js`.
- Add preview-limit warning matching `_LimitedPersonsForPreview_Question_Informative`.
- Add site-level creation/change date metadata.

### Media

Mac evidence:

- `CoreFunctionPaneNames.strings`: `_FunctionTitle_EditMediaPaneName` = "Edit Media", `_MediaGalleryName` = "Media Gallery", `_FunctionTitle_MediaGalleryReportPaneName` = "Media Gallery Report".
- `EditMediaPanes.strings`: `_EditMediaPane_Zoom_Auto`, `_Zoom_Custom`, `_EditMediaPane` = "Media", `_EditMediaPaneWithEntryName` = "Media of '%@'", `_FurtherActionsButton` = "Actions…", `_AddButton` = "Add Media…", `_RemoveButton` = "Delete Media…", `_SelectMediaTypesButton` = "Media Types", `_SelectSortingAndGroupingButton` = "Grouping & Style", `_ExportMenuItem` = "Export selected Media…", `_OpenInPreview` = "Open in Preview…", `_TooManyMediaSelectedForDisplay`.
- Placeholders: `_SelectDifferentMediaTypesPlaceholder`, `_NoMediaForSearchPlaceholder`, `_SelectMediaByClickingOnItPlaceholder`, `_NoMediaInTreePlaceholder`.
- `_AddMediaSheet_Title`, `_AddMediaSheet_AddMediaTopMessage`, `_AddMediaSheetDroppedFilesView_DropTargetMessage`.
- `CoreMedia.strings`: `_MediaContainerListController_DeleteMediaOrRelationMessage`, `_DeleteMediaOrRelationInformative`, `_DeleteMediaButton`, `_DeleteMediaRelationButton`, `_SortingMode_ByTitle`, `_SortingMode_ByDate`, `_NoDateTitle`.
- NIBs: `EditMediaPane.nib`, `EditMediaPane_MediaListSubView.nib`, `EditMediaPane_MediaSubView.nib`, `MediaGalleryPane.nib`, `MediaSelectionWidget.nib`, `AddMediaSheet.nib`, `AddURLSheet.nib`, `ImageEditingSheet.nib`, `RecordAudioSheet.nib`, `RecordPictureSheet.nib`, `RecordVideoSheet.nib`, `ScanPictureSheet.nib`, `AppleMediaLibrarySheet.nib`.

Web now:

- `src/routes/Media.jsx` — gallery of MediaPicture/PDF/URL/Audio/Video, filter by type, caption/description edit, `createMediaRecordsFromFiles`.
- Slideshow at `src/routes/Slideshow.jsx`.

Missing or shallow:

- No Grouping & Style sheet (sort by title/date, group options).
- No Add Media sheet with container picker (`_AddMediaSheet_SelectedMediaContainerButtonMessage`).
- No Add URL / Record Audio / Record Picture / Record Video / Scan Picture sheets.
- No Apple Media Library sheet equivalent (browser equivalent would be file picker + iCloud Photos API, out of scope, but worth tracking).
- No distinct delete-media vs delete-relation decision dialog.
- No Image editing sheet (`ImageEditingSheet`).
- No Open-in-Preview / Export-selected-media affordance.

Bring over next:

- Add Grouping & Style controls: sort by title vs date, group by type vs date bucket.
- Add dedicated Add Media sheet with target-container picker replacing inline add.
- Add Add URL sub-sheet.
- Add Image editing sheet with crop/rotate (there is already `waifu_noise*_scale*.mlmodelc` in the Mac bundle, Web equivalent would be a Canvas-based editor).
- Add delete-media-or-relation choice dialog matching Mac copy.

### Sources

Mac evidence:

- `CoreFunctionPaneNames.strings`: `_FunctionTitle_SourceListPaneName` = "Edit Sources", `_SourcesListReportPaneName` = "Sources List".
- `CoreSources.strings`: `_Source_Abbreviation`, `_Source_Agency`, `_Source_Author`, `_Source_Publication`, `_Source_ReferenceNumber`, `_Source_ReferenceType`, `_Source_ReferencedObjects`, `_Source_SourceRepository`.
- `CoreSourceRepositories.strings`: `_SourceRepositoryName` = "Source Repository".
- `CoreSourceTemplates.strings`: `SourceTemplate_Generic`, `FamilySearch`, `Book`, `CDROM`, `Deed`, `EmailMessage`, `FamilyBible`, `Letter`, `Newspaper`, `Periodical`, `TaxList`, `VitalRecord`, `WebSite`, `Will`, `AddressBook`, `ManuscriptRecord`, `PersonalBible`, `Portrait`, `ResearchReport_Digital`, `ResearchReport_PhysicalCopy`, `ResearchReport_Microfilm`, `UnpublishedNarrative`, `VerticalFile`.
- NIBs: `SourceSelectionWidget.nib`, `LargeSectionedMultiColumnSourceListWidget.nib`, `EditSourceRepositoriesSheet.nib`, `EditSourceTemplatesSheet.nib`, `EditSourceTemplateKeysSheet.nib`, `EditSourceTemplatesSheetCitationsView.nib`.

Web now:

- `src/routes/Sources.jsx` — list + editor, source template picker, referenced-entries computation.
- `src/routes/SourceRepositories.jsx` — repositories CRUD.

Missing or shallow:

- No Edit Source Templates sheet — web uses `humanizeTemplateName` on template record names rather than letting the user edit templates.
- No Edit Source Template Keys sheet for defining template-specific citation fields.
- No Source Template Citations view.
- No sectioned source list widget.

Bring over next:

- Add an Edit Source Templates sheet that lets users add/rename/edit templates and their keys.
- Expose Source Repository as a relation control on the Source editor (currently referenced only via `/repositories`).
- Add a sectioned source list by template / by author / by publication year.

### ToDos / tasks

Mac evidence:

- `CoreFunctionPaneNames.strings`: `_FunctionTitle_ToDosPaneName` = "Edit ToDo List", `_ToDoListReportPaneName` = "To Do List".
- `CoreToDo.strings`: types `_ToDo_Type_FurtherResearch`, `_Verify`, `_MissingEvents`, `_MissingNames`, `_CleanUp`, `_Plausibility`, `_SourceMissing`; priorities `_Low`, `_Medium`, `_High`; statuses `_NotDone`, `_OnHold`, `_InProgress`, `_Done`; sorting `_DueDateElapsedSortingString`, `_DueDateNotElapsedSortingString`.
- ToDo Wizard: `_ToDoWizard_ToDosToBeCreated_Singular`, `_Plural`, `_None`, `_CreateToDosButton`, `_ShowAffectedEntriesButton`, `_ToDoWizardConfiguration_Type`, `_ToDoWizardBaseCreator_ToDoPropertiesGroupName`, `_LabelToAssignToCreatedToDos`, `_TypeToAssignToCreatedToDos`, `_PriorityToAssignToCreatedToDos`, `_ToDoWizardBasePersonCreator_Persons`.
- NIBs: `ToDoSelectionWidget.nib`, `ToDoWizardSheet.nib`, `LargeSectionedMultiColumnToDoListWidget.nib`.

Web now:

- `src/routes/ToDos.jsx` — ToDo CRUD with ToDoRelation target pick across Person/Family/Source/Place/Event/Media.

Missing or shallow:

- No explicit Type / Priority / Status enum pickers matching Mac labels (web uses free-text title).
- No Due Date tracking or Due-Date-Expired grouping.
- No ToDo Wizard sheet to create many ToDos from a selection (e.g. "Missing Events" ToDos for all persons without a birth).
- No sectioned ToDo list widget.

Bring over next:

- Add Type / Priority / Status / Due Date columns and pickers matching `CoreToDo.strings` keys.
- Add ToDo Wizard modal covering Mac wizard types (missing events, missing names, plausibility, verify, source-missing).
- Add sectioned ToDo list by type / priority / overdue / by target type.

### Research assistant

Mac evidence:

- `CoreFunctionPaneNames.strings`: `_FunctionTitle_ResearchAssistantPaneName` = "Research Assistant".
- `ResearchAssistantPane.strings`: `_ResearchAssistantPaneName`, `_NoMoreQuestions`, `_NoMoreQuestionsForPerson`, `_UseAllObjectsButton` = "Include all persons", `ResearchAssistantPane_QuestionListName` = "Question List", `_IgnoreObjectForFurtherQuestionsMenuItem`, `_IgnoreThisQuestionMenuItem`, `ResearchAssistantPane_QuestionName` = "Question", `ResearchAssistantPane_ContextName` = "Context", `_SelectPersonButton`, `_SelectPersonTooltip`, `_SelectExistingPlaceButtonName`, `_SelectExistingSourceButtonName`, `_IgnorePersonOption`, `_IgnoreFamilyOption`, `_IgnoreOtherObjectOption`, `_EditPersonOption`, `_EditFamilyOption`, `_EditOtherObjectOption`.
- `CoreResearchAssistant.strings`: answer buttons `_Buttons_OK`, `_Later`, `_DontKnow`, `_No`, `_NoPartner`, `_NotDead`, `_NotChistened`, `_NotMarried`, `_NoEducation`, `_NoSource`; properties `_Person_FirstName`, `_LastName`, `_BirthLastName`, `_BirthDate`, `_DeathDate`, `_BurialDate`, `_Gender`, `_Family_MarriageDate`, `_ChristeningDate`, `_EyeColor`, `_HairColor`, `_Education`, `_Source_Title`, `_PlaceTemplate`.
- NIBs: `ResearchAssistantOptionsPresenter.nib`, `ResearchAssistantPane_Context.nib`, `ResearchAssistantPane_Question.nib`, `ResearchAssistantPane_QuestionList.nib`.

Web now:

- `src/routes/Research.jsx` — heuristic suggestions from `generateResearchSuggestions()`, persisted done/ignored state in IndexedDB.
- Imports `ResearchAssistantQuestionInfo` records for hydrated imported questions.

Missing or shallow:

- No three-pane layout matching `QuestionList` / `Question` / `Context` NIBs.
- No answer buttons for in-place data entry (`_Buttons_OK`, `_NotDead`, `_NotMarried`, `_NoEducation`, `_NoSource`).
- No Select-Existing-Place / Select-Existing-Source buttons when answering a question.
- No `_ResearchAssistantPane_SelectPersonButton` to focus research on one person.
- No Options presenter (`ResearchAssistantOptionsPresenter.nib`) for question generation policy.

Bring over next:

- Convert `/research` into the three-pane layout: QuestionList (left), Question + answer buttons (center), Context (right).
- Add answer buttons that write data directly into the record.
- Add Options presenter for question filtering (persons only, ancestors-of vs descendants-of start person, exclude ignored).
- Add Select-Person bottom-bar filter.

### Search

Mac evidence:

- `CoreFunctionPaneNames.strings`: `_FunctionTitle_SearchPaneName` = "Search", `_FunctionTitle_SearchAndReplacePaneName` = "Search and Replace".
- `SearchPaneStrings.strings`: `_SearchPaneName`, `_SearchAndReplacePaneName`.
- NIBs: `EditFiltersViewAddFilterWidget.nib`, `SearchPaneAddFilterContextMenuWidget.nib`, `ScopesEditSheet.nib`.
- `CoreScopes.strings` provides smart scope labels (referenced by `_ScopeSelectorConfigurationUserInterfaceControlConfiguration_ScopeControlTitle`).

Web now:

- `src/components/search/SearchApp.jsx` — multi-criteria filter plus smart scopes (referenced in Home card).
- `macfamilytree-parity-todo.md` lines 99-103 list Search-and-Replace as pending.

Missing or shallow:

- No Search and Replace pane (`_SearchAndReplacePaneName`).
- No Add-Filter context menu widget mirroring `SearchPaneAddFilterContextMenuWidget.nib`.
- No Scopes edit sheet (`ScopesEditSheet.nib`) — web relies on built-in smart scopes.

Bring over next:

- Add Search-and-Replace tool with dry-run preview, per-record selection, undo / change-log entry (already on TODO).
- Add Add-Filter context menu taxonomy matching Mac filter types.
- Add Scopes edit sheet for authoring smart scopes.

### Settings / preferences

Mac evidence:

- NIBs: `PreferencePaneCategoryConfigurations.nib`, `PreferencePaneCloudKit.nib`, `PreferencePaneColors.nib`, `PreferencePaneContentDownloadManager.nib`, `PreferencePaneDatabase.nib`, `PreferencePaneDateFormats.nib`, `PreferencePaneDefaultValues.nib`, `PreferencePaneEditControllersConfigurations.nib`, `PreferencePaneFamilySearch.nib`, `PreferencePaneGeneral.nib`, `PreferencePaneHistory.nib`, `PreferencePaneMaps.nib`, `PreferencePaneNameFormat.nib`, `PreferencePanePDF.nib`.

Web now:

- `src/routes/Settings.jsx` — tabs: General, Formats, Maps, Export, Integrations, Functions.
- `src/lib/appPreferences.js` plus map prefs in `src/lib/placeGeocoding.js`.

Missing or shallow:

- No Colors preference pane (colored labels, chart defaults).
- No Database preference pane (local database path / backup frequency).
- No Default Values preference pane (default gender, default event types at creation).
- No History preference pane (world history categories enabled for MiniTimeline / World History).
- No Edit Controllers Configurations pane (per-pane category overrides).
- No Category Configurations pane (which panes appear under which tab — this parallels `functionCatalog.js` but is only partially surfaced).
- No PDF preferences pane (font embedding / page defaults).
- No Content Download Manager pane (geonames / history data downloads).

Bring over next:

- Add Colors, Default Values, History, PDF tabs to Settings.
- Add a Content Download Manager for the geographical dataset referenced in `_PlaceLookup_DownloadRequired_Title`.
- Add per-pane Edit Controllers Configurations matching Mac's category editor.

### Favorites / home

Mac evidence:

- `CoreFunctionPaneNames.strings`: `_PaneCategory_Favorites` = "Favorites", `_FunctionTitle_FavoritesFunctionsPlaceholder` = "Favorites Functions Overview".
- `QuickAccessControllerEditBookmarks.nib` for editing quick-access bookmarks.
- `WelcomeWindow*.nib` for welcome / startup UI.

Web now:

- `src/routes/Favorites.jsx` — favorite functions + bookmarked records grouped by type.
- `src/routes/Home.jsx` — dashboard of shortcut cards.
- `src/routes/Bookmarks.jsx` exists separately.

Missing or shallow:

- No Welcome Window / startup recent-files UI (`WelcomeWindow.nib`, `WelcomeWindowDatabasesDatabaseFileWidget.nib`, `WelcomeWindowControllerAcceptCloudKitShareURLSheet.nib`).
- No Quick Access edit-bookmarks sheet — bookmarks are tied to record-level isBookmarked flags.
- No "Favorites" pane category as a distinct overview page matching `_FavoritesFunctionsPlaceholder`.

Bring over next:

- Merge Home and Favorites into a single overview with customizable sections.
- Add a Quick Access bookmarks editor with reorder, rename, and grouping.
- Add a Welcome state when no database is loaded yet (web currently has ImportDropZone inline on Home).

### FamilySearch workspace

Mac evidence:

- `FamilySearch.strings`: `_FamilySearchPersonStatusSectionedView_Title` = "FamilySearch Person Information" with sub-titles `Change History`, `Matches`, `Search for Matches`, `Upload`, `Duplicates`, `Overview`, `Sync`, `Ordinances`, `Pictures`, `Discussions`, `Records`.
- Handler panes: `_FamilySearchOverviewHandlerPaneName` ("FamilySearch Overview"), `_LoginHandlerPaneName`, `_StatisticsHandlerPaneName`, `_PersonSearchPaneName`, `_LocalPersonMatchesListPaneName`, `_LocalPersonAutoMatchedListPaneName`, `_OrdinanceOpportunitiesListPane`, `_OrdinancesReservationListPane`, `_LocalPersonsWithFoundMemoriesListPane`, `_PersonChangeHistoryUpdatesListPane`.
- Sheets: `_FamilySearchAskForReasonSheet_Title`, `_FamilySearchSelectPlaceSheet_Title`, `_FamilySearchMemoryEditSheet_Title`, `_FamilySearchMemoriesPolicySheet_Title`, `_FamilySearchOrdinancesPolicySheet_Title`, `_FamilySearchPersonMergeSheet`, `_FamilySearchPersonCompareSheet`, `_FamilySearchCreateNewDiscussionSheet_Title`.
- NIBs: `FamilySearchAgentView.nib`, `FamilySearchChangeHistoryContentView.nib`, `FamilySearchDiscussionsContentView.nib`, `FamilySearchMemoriesContentView.nib`, `FamilySearchOrdinancesReservationListPane.nib`, `FamilySearchOverviewHandlerPane.nib`, `FamilySearchPersonCompareContentView.nib`, `FamilySearchPersonDuplicatesContentView.nib`, `FamilySearchPersonMatchesContentView.nib`, `FamilySearchPersonMergeSheet.nib`, `FamilySearchPersonSearchResultsView.nib`, `FamilySearchRecordsContentView.nib`, `FamilySearchSourceReferencesContentView.nib`, `FamilySearchStatisticsHandlerPane.nib`, `FamilySearchLoginHandlerPane.nib`, `FamilySearchLocalPersonMatchesListPane.nib`, `FamilySearchLocalPersonRecordMatchesListPane.nib`, `FamilySearchLocalPersonAutoMatchedListPane.nib`, `FamilySearchLocalPersonsWithFoundMemoriesListPane.nib`, `FamilySearchPersonBatchDownloadSheet.nib`.

Web now:

- `src/routes/FamilySearch.jsx` — single-route workspace with task filters (`match-review`, `record-match-review`, `picture-review`, `ordinance-review`, `sync-review`), plus compare/merge/ordinance placeholders through `src/lib/familySearchApi.js`.

Missing or shallow:

- Web has one route; Mac has a sectioned person-status view plus at least ten handler sub-panes. Most of Mac's structure is collapsed into task-type filters in web.
- No dedicated Change History, Discussions, Memories, Records, Ordinances, Duplicates, Overview, Statistics sub-panes.
- No Ask-for-Reason sheet on data changes.
- No Select-Place sheet for FamilySearch place reconciliation.
- No Memory Edit, Memories Policy, Ordinances Policy sheets.
- No batch download-relatives sheet (`FamilySearchPersonBatchDownloadSheet`).
- No auto-matches approval flow (`_ApproveAllAutoMatchesButton`).

Bring over next:

- Split the FamilySearch workspace into sub-routes or tabs: Overview, Matches, Auto-Matches, Record Matches, Ordinances, Memories, Discussions, Change History, Records, Statistics.
- Add Ask-for-Reason sheet for change submission.
- Add Batch Download Relatives sheet with progress.
- Add Auto-Matches approval list with `_ApproveAllAutoMatchesButton`.
- Add Ordinance and Memories policy acceptance flows.

## Best work to bring over first

1. Editor edit-session model
   - Add Edit / Finish mode, dirty flag, and `_ShouldSave*Message` / `_ShouldSave*Informative` save prompts across `PersonEditor.jsx`, `FamilyEditor.jsx`, `Places.jsx`, `Sources.jsx`, `Media.jsx`.
   - This is the single most pervasive Mac pattern missing from web and it unlocks safer long edit sessions.

2. FamilySearch sub-pane split
   - Mac ships ~10 distinct handler panes; web collapses them into task-type filters.
   - Splitting into Overview / Matches / Auto-Matches / Record Matches / Ordinances / Memories / Discussions / Change History / Records / Statistics tabs matches `_FamilySearchPersonStatusSectionedView_Title` and surfaces features already implemented in `familySearchApi.js` that users cannot discover.

3. ToDo Wizard + Type/Priority/Status/Due-Date
   - Strong Mac evidence in `CoreToDo.strings` keys and `ToDoWizardSheet.nib`.
   - Web ToDos currently lack type/priority/status enums, due-date tracking, and any bulk creation flow.

4. Research assistant three-pane layout and answer buttons
   - `ResearchAssistantPane_Question.nib` + `_Context.nib` + `_QuestionList.nib` and the `_Buttons_*` enum in `CoreResearchAssistant.strings` turn Research from a read-only heuristic list into a guided data-entry tool.

5. Book assistant + saved chart/report embeds + error sheet
   - New Book Assistant covers five book types. Saved chart/report embed sheets are already on `macfamilytree-parity-todo.md` line 88.
   - Book-has-errors pre-export sheet (`BookHasErrorsSheet.nib`) is a high-confidence quality gate.

6. Place lookup UI + batch place lookup + template editor
   - Most of the backend already exists in `placeGeocoding.js`; missing is the Mac `PlaceLookupSheet.nib`-style front-end with POI filter, administrative divisions, and preferred-name controls, plus `EditPlaceTemplatesSheet` equivalent.

7. Media Grouping & Style + Add Media sheet + Image editing
   - Currently web's media route is a flat gallery; Mac's `_SelectSortingAndGroupingButton` and `AddMediaSheet.nib` give structured sort/group and safer add semantics.

8. Preferences expansion
   - Add Colors, Default Values, History, PDF, and Content Download Manager tabs matching Mac's preference pane NIB inventory.

## Important caution

Nothing in the Mac bundle is literal source code we can compile or port. The useful artifacts this audit draws on are:

- Pane class names in `Contents/MacOS/MacFamilyTree 11` selectors (read via the existing `mac_chart_decompile_extraction.md`).
- String-table labels and configuration keys in `Contents/Resources/en.lproj/*.strings` and `Contents/Frameworks/MacFamilyTreeCore.framework/Versions/A/Resources/en.lproj/*.strings`.
- NIB names and directly-adjacent widget names in `Contents/Resources/Base.lproj/*.nib`.
- Save / edit / dirty lifecycle copy (`_ShouldSave*Message`, `_FinishEditing`, `_PaneName`).
- Sheet names, wizard names, and sheet-class taxonomies as a guide to modal decomposition.

Everything should stay native to this React / Vite / IndexedDB codebase. The point of this audit is to ensure we keep adopting the desktop app's information architecture and lifecycle contracts, not to copy its Cocoa implementation. Every entry in "bring over next" above cites at least one Mac class name, strings key, or NIB so that later work has a concrete handhold back into the bundle for follow-up research.
