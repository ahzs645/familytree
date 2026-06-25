# Disconnected Interfaces Audit — 2026-06-25

> **Primary focus (per the request): screens that DISPLAY database data but give
> the user no way to edit, add, or change it.** That CRUD-gap audit is **section
> 4** below. Sections 1–3 are a related sweep (dead code, write-only settings,
> unreachable routes) done first under a broader reading of "not connected".

Audit of UI/code "interfaces that are not actually connected" across the
CloudTreeWeb reconstruction. Four passes were run:

1. **Orphaned modules** — files never imported anywhere (static import graph).
2. **Write-only settings** — controls that render and persist but whose value
   is never read, so toggling them has no effect.
3. **Unreachable routes / no-op actions** — views with no inbound navigation
   and buttons whose handlers do nothing.
4. **Read-only screens that should be editable** — screens showing DB records
   with no add/edit/change path (the main request).

Every claim below was verified by grepping the whole repo (not just `src/`).
A ✅ in the **Done** column means it was fixed in this branch; ⏳ means it
needs a larger build or a product decision (see *Remaining work*).

---

## 1. Orphaned modules (never imported)

| Module | What it is | Verdict | Done |
|---|---|---|---|
| `components/MediaCaptureSheet.jsx` | Unified capture sheet (picture/audio/video/scan) | DELETE — dead | ✅ |
| `components/editors/SubRecordList.jsx` | Reusable sub-record list editor | DELETE — dead | ✅ |
| `components/heritageTree/gedcomParser.js` | GEDCOM→tree parser, superseded by `appTreeAdapter.js` | DELETE — dead | ✅ |
| `components/index.js` | Barrel re-export of ~40 components; nothing imports the dir | DELETE — unused barrel | ✅ |
| `components/ui/TimePicker.jsx` | Custom HH:MM picker popover | DELETE — dead | ✅ |
| `contexts/DatabaseContext.js` | Legacy React context; app uses a different mechanism | DELETE — dead | ✅ |
| `utils/analytics.js` | GA4/gtag wrapper; no callers | DELETE — dead | ✅ |
| `utils/helpers.js` | Deobfuscation-era runtime polyfills; no callers | DELETE — dead | ✅ |
| `utils/titleCase.js` | Title-case formatter; a local dup in `placeGeocoding.js` is the used one | DELETE — dead | ✅ |
| `components/books/BookSectionConfigSheet.jsx` | Modal wrapper around inline `SectionEditor`; config already works inline; its reorder buttons are no-ops | DELETE — dead (flagged in gap-audit doc) | ✅ |
| `lib/geneweb/index.js` | Barrel for the GeneWeb import/export feature | Barrel deleted (tests import submodules directly); **feature itself is unwired** — see Remaining work | ✅ (barrel) |
| `lib/CloudKitAdapter.js` | CommonJS CloudKit shim | **KEEP** — used by `scripts/patch-bundle.js` (build), not an ES import | — |

---

## 2. Write-only settings (persist but never read)

Each control renders, writes to the prefs store, and survives reload — but no
code reads the value, so it has **zero functional effect**. Severity is
"misleading" in every case (looks like a working, saved setting).

### Whole panels effectively non-functional
- **General** (except Theme): `startRoute`, `confirmDeletes`, `autoSaveEditors`,
  `showPrivateRecords`, `compactLists` — `GeneralPanel.jsx:21-34`. Theme works
  (via `ThemeContext`, not prefs).
- **Tree Layout**: `atharaCoupleSafeguards`, `cycleProtection`,
  `singleParentCoupleFallback` — `TreeLayoutPanel.jsx:12-23`. No graph builder
  reads them.
- **PDF**: `pageSize`, `orientation`, `margin`, `embedFonts`, `includeBookmarks`,
  `compressImages` — `PdfPanel.jsx:10-36`. PDF/report generation never reads them.
- **History**: `showWorldEventsInTimeline`, `worldHistoryCategories`,
  `lifespanYearsBeforeBirth`, `lifespanYearsAfterDeath` — `HistoryPanel.jsx`.
  `WorldHistory.jsx` uses hardcoded categories.
- **Content Download**: `autoDownloadHistory`,
  `autoDownloadFamilySearchSources`, `concurrency`, `wifiOnly` —
  `ContentDownloadPanel.jsx:10-15`. No download manager exists.
- **Categories**: `labelOrder`, `groupOrder`, `hiddenCategories` —
  `CategoriesPanel.jsx`. No catalog rendering reads them.

### Individual disconnected controls
- **Formats**: `nameOrder`, `surnameCase`, `dateDisplayFormat`,
  `readableDateFormats`, and the `partialDateEntry.*` trio — `FormatsPanel.jsx`.
  (Sibling keys `nameDisplayFormat`, `nameSortFormat`, `additionalNameDisplay`,
  `vitalDisplay` ARE wired.)
- **Colors**: `appearance.chartTheme`, `appearance.reportBackground` —
  `ColorsPanel.jsx:64-71`. (`accentColor` IS applied.)
- **Export defaults**: `gedcomEncoding`, `websiteTheme`, `includePrivate`,
  `includeMedia` — `ExportPanel.jsx`. (`csvSeparator` IS read by `listExport.js`.)
- **Integrations**: `webSearch.openInNewTab` (`IntegrationsPanel.jsx:39`) ✅ now
  read by `WebSearch.jsx` (controls `window.open` target + history links);
  `familySearch.showMatched` / `showUnmatched` (`:40-41`) ✅ now seed the default
  matched/unmatched filter in `FamilySearch.jsx`.
- **Edit Controllers** (half-connected): `eventTypesCollapsed`,
  `factTypesCollapsed`, `defaultFactType`, `defaultFamilyEventType` are unread.
  (`defaultEventType` + `applyDefaultEvents` ARE wired in `NewPerson.jsx`.)

### Verified correctly connected (checked, not broken)
Theme, `appearance.accentColor`, `localization.*`, the wired `formats.*` name
keys, `arabicIslamic.preferArabicCatalogLabels`, `privacy.*`, `plausibility.*`,
`media.slideshow`, `functions.*`, `webSearch.{provider,customUrl}`,
`familySearch.defaultTaskType`, `importDefaults.*`, `exportDefaults.csvSeparator`,
and the entire Maps panel.

---

## 3. Unreachable routes & no-op actions

### Unreachable routes (registered, no inbound navigation)
- `/chart-split` → `ChartSplitWizard.jsx` (`manifest.js:62`)
- `/reference-numbering` → `ReferenceNumbering.jsx` (`manifest.js:63`)
- `/custom-validation` → `CustomValidationSchemas.jsx` (`manifest.js:65`)

None appeared in `functionCatalog.js`, the nav config, the command palette, or any
in-app `navigate()`/`<Link>`. ✅ Fixed by adding all three to `APP_FUNCTIONS`
(`Split Chart`, `Reference Numbering`, `Custom Validation Schemas`) so they are
now reachable from the Functions/Actions screen and command palette.

### No-op buttons / actions
- **Name Format dropdown** — `ChartOptionsPanel.jsx:237`: `value="display"`
  hardcoded, `onChange={() => {}}`. The 3-option select did nothing. (The
  adjacent Localization select is correctly wired.) ✅ Removed the no-op control;
  chart names already follow the global name-format preference. A per-chart
  override would be a feature, not a wire.
- **Section reorder buttons** inside `BookSectionConfigSheet.jsx:49-50`
  (`onMoveUp/onMoveDown = () => {}`) — moot, the whole sheet was dead and is
  deleted. The live path in `BooksApp.jsx` uses a real `moveSection`.
- **Command palette verb commands** — `CommandPalette` is rendered with no
  `commands` prop (`AppShell.jsx`), so the `/bookmark`, `/toggle theme` verbs and
  `entry.shortcut` rendering documented in the component never appear.

### Dead conditional renders
None found. The only env-gated UI (`REMOTE_IMPORT_ENABLED`, `DEMO_DATA_ENABLED`)
is enabled in dev builds, not statically false.

---

## 4. Read-only screens that should be editable (main request)

Swept ~30 screens that display DB records, checking each against the app's
editable baseline (a row links to an editor — e.g. `/person/:id`, `/family/:id`
— or the screen has Add/Edit/Delete wired to DB writes). Result: the app is in
good shape here — **exactly one genuine gap**, plus a few minor parity nits.

### The one real GAP — fixed ✅
- **LDS Ordinances** (`/lds-ordinances`): displayed ordinance records (ordinance
  type, date, status, temple) pulled from the DB but had **no editor anywhere** —
  the only affordance was a link to the owning person/family editor, which does
  not surface ordinance records. No add/edit/delete.
  **Fix:** rewrote `routes/LdsOrdinances.jsx` into a master/detail editor
  (modeled on `DNAResults.jsx`): create (`+ New ordinance`), edit
  (ordinance/date/status/temple + linked person), and delete, all through
  `saveWithChangeLog` / `db.saveRecord` / `db.deleteRecord`. `loadLdsOrdinanceRows`
  now returns each row's source field keys + an `editable` flag.
  **Safety:** because ordinances are *heuristically detected* across record types,
  the editor only writes to dedicated ordinance-type records. Person/Family
  records that merely contain a matching field stay read-only (with an owner
  link) so the editor can never clobber a person. New records use a canonical
  `LDSOrdinance` type, which also bootstraps the previously schema-gated screen.

### Verified OK (display + working edit/add/delete or click-through)
Persons, Families, PersonGroups, Sources, SourceRepositories, Places, Events,
FamilyEvents, Stories, Labels, CustomTypes, Templates, ToDos, DNAResults,
TribalAffiliations, Lineages, MarriageList, FactsList, DistinctivePersons,
AuthorInformation, Favorites, SmartFilters, Research, Duplicates, SubtreeWizard,
Bookmarks.

### Read-only by design (derived reports / computed views / static data)
AnniversaryList, PersonAnalysis, PlausibilityList (derived — they link to the
underlying record editors), and WorldHistory (events are a hardcoded constant,
not DB records).

### Minor parity nits — fixed ✅
- **Bookmarks**: added an inline "remove bookmark" button on each row that writes
  `isBookmarked=false` via `saveWithChangeLog` and drops the row from the list
  (previously you had to open the record's editor to un-bookmark).
- **PersonGroups** / **Stories**: added a top-level **Delete** button to the
  detail header (mirroring `Labels.jsx`), with a confirm dialog. Deleting a group
  cascades its `PersonGroupRelation` memberships; deleting a story cascades its
  `StorySection` and `StoryRelation` records. Linked persons/records are never
  deleted — only the group/story and its own join records.

## Remaining work (needs a build or a product decision)

These are genuine disconnections but require building the missing consumer or a
decision on intended behavior — they are **not** simple wire-ups:

- **GeneWeb import feature** (`lib/geneweb/*`): fully implemented and tested but
  never surfaced in the import UI. Needs an entry in the import flow.
- **Content Download panel**: there is no download manager to consume the
  settings. Either build it or hide the panel.
- **History / world-events timeline**: `WorldHistory.jsx` hardcodes categories;
  wiring the prefs means refactoring it to read them.
- **PDF panel**: the PDF/report pipeline doesn't accept these options yet.
- **Tree Layout safeguards**: the graph builder would need to honor the flags.
- **Categories ordering/hiding**: catalog rendering would need to consult prefs.
- **Formats (name order / surname case / date display)**: the formatters would
  need to read these instead of the already-wired sibling keys.

**Recommendation:** for each unfinished panel, either schedule the consumer work
or temporarily hide the control so the UI stops advertising a setting that does
nothing. The tractable "missing wire" cases were fixed in this branch (see
*Done* column and the commit history).
