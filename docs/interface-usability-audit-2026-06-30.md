# Interface Usability Audit — 2026-06-30

A full pass over the app's interface looking for controls that aren't hooked up,
screens that don't let you actually edit/create, and standard features still
missing. Six route clusters were audited (editing, lists, charts/tree, research/
quality, media/output, settings/data). Overall the app is in good shape — every
record editor, settings panel, export, and data action traces to the real data
layer. The genuine gaps cluster into three themes.

Status legend: **[FIXED]** done on this branch · **[OPEN]** triage / follow-up.

---

## Theme 1 — Creating & editing people (fixed)

These were the headline gaps: you could not create a person or family except
from inside the interactive tree, and several tree context-menu actions silently
did nothing because the editors ignored the query-params the tree sent them.

- **[FIXED] No "New Person" button outside the tree.** `/person/new` was only
  reachable from `InteractiveTreeApp`. Added a **+ New person** button to the
  Persons list toolbar (`Persons.jsx`) and an **Add Person** entry to the command
  palette / function catalog (`functionCatalog.js`).
- **[FIXED] No way to create a Family.** There was no create affordance and no
  `family/new` route — families only appeared as a side effect of linking
  spouses/children. Added a **+ New family** button to the Families list header
  (`Families.jsx`) that creates an empty `Family` record (same pattern as
  `relativeLinks.js`) and opens it in the editor.
- **[FIXED] Tree "Select Existing Person as Father/Mother/Partner/Child" did
  nothing.** The tree navigates to `/person/:id?addRelative=…` or
  `/family/:id?addRelative=…&intent=pickExisting`, but neither editor read the
  params. `PersonEditor` and `FamilyEditor` now read `useSearchParams`: the
  relevant section (inline relative picker / Man / Woman / Children) is scrolled
  into view with a hint banner, and the Person editor's relation-type dropdown is
  preset to match the requested relation.
- **[FIXED] Tree "Add/Edit Influential Persons…" landed on a collapsed section.**
  `/person/:id?section=influential` is now honoured: the Influential Persons
  section force-expands and scrolls into view (new `forceExpand` prop on
  `Section`).

Verified end-to-end with a seeded tree (Playwright): New Person creates a record
and opens its editor; New Family creates and opens; all three deep-link hints
render and the right section is focused/expanded.

---

## Theme 2 — Controls that looked functional but did nothing (fixed)

These rendered as normal toggles/selects but wrote to state nothing consumed.
Each got a wire-up-or-remove decision and is now resolved.

### Charts options (`components/charts/ChartsApp.jsx`, `parts/ChartOptionsPanel.jsx`, `ChartCanvas.jsx`)
- **[FIXED · wired] "Hide Information marked as Private"** — now derives the
  private record-name set and drops those records from the chart's person-backed
  views (browser, pickers, distribution). Defaulted **on**, matching the app's own
  contract ("private persons won't appear in charts or reports"). Note: the
  ancestor/descendant/family tree builders already hard-exclude private records,
  so the toggle is moot for those (and can't reveal them — that lives in
  `treeQuery.js`).
- **[FIXED · removed] "Localization" select** — deep i18n feature; removed the
  control + state rather than ship a half-wired version (global localization
  already handles formatting/RTL).
- **[FIXED · removed] "Alignment of Separated Trees" select** — removed control +
  state (layout-offset feature was out of scope).
- **[FIXED · wired] Object Inspector Weight / Opacity / Stroke-style** —
  `ChartCanvas` overlay renderer now reads the inspector's `fontWeight`/`opacity`/
  `strokeDash` fields (with backward-compat for legacy `bold`), so the edits show
  on canvas and in exports.
- **[FIXED · scoped] Spacing tab** — now only shown for the Family Chart (the only
  chart `chartSpacing` feeds).
- **[FIXED · converted] "Maximum Recursion Depth" slider** — replaced the
  meaningless 0–6 slider with a real **"Collapse duplicates"** checkbox driving
  `collapseDuplicates` (default on, preserving prior behavior).
- **[FIXED · trimmed] "Person Group" select** — removed the never-handled
  `start-family` option (kept All / Bookmarked) and relabelled it "Person Browser
  Filter" to reflect what it scopes.

### List Report customizer (`components/lists/ListReportWorkbench.jsx`)
- **[FIXED · wired] Sorting / sort direction / hide-private** — `sorting` +
  `sortAscending` now actually sort the preview and HTML export (sorted copy,
  numeric-aware compare); `hidePrivate` filters private rows (rows carry a
  `private` flag from `listData.js`).
- **[FIXED · wired] HTML "Save report" blank cells** — `downloadReportHtml` now
  resolves a cell value via `exportValue` / raw key / text-extraction of
  `column.render`, never blank for render-only columns.
- **[FIXED · removed] 12 dead controls** — `smartFilter`,
  `separateNameComponents`, the five `include*` citation toggles,
  `includePictures`, `pictureSize`, `theme`, `style`, `paperSize` had no rendering
  path and were removed (kept `sourceCitations`, `citationMode`,
  `separateSections`, `localization`, `orientation`, `personPictureColumn`,
  `informationColumns`).

---

## Theme 3 — Minor / polish (fixed)

- **[FIXED · wired] Book "Export anyway"** — `BooksApp` now defers the export when
  a warnings-only book is gated and passes `onProceedAnyway` so the sheet's button
  runs it.
- **[FIXED · wired] Globe string-valued coordinates** — `Globe.jsx` now coerces
  lat/lng with a `parseCoord` helper, matching the flat maps.
- **[FIXED · removed] FamilySearch dead `sync` pane key** — orphan entry removed
  from `TASKS_BY_PANE`.
- **[FIXED · wired / N/A] Maintenance** — added a confirm before "Optimize Media".
  The gender-mismatch "open" link was a **false alarm**: `familyRecordName` is
  literally `fam.recordName` (the real id), so the link already worked — left
  unchanged to avoid introducing a bug.
- **[FIXED · partial] Custom Types** — wired the unused `reorderCustomTypes` helper
  to up/down controls on user types and added a read-only "Built-in types"
  listing. The "hide built-ins" toggle was **deliberately skipped**: it can't be
  centralized in `mergeWithBuiltins` (synchronous, no category context) without
  editing every raw-catalog consumer, so a page-only half-version was avoided.
- **[FIXED · wired] Smart Filters** — added a dirty baseline + confirm prompt when
  switching filters (or starting a new one) with unsaved edits.

---

## Verified fully wired (no gaps)

Person/family editors and all sub-record editors; all 17 settings panels; media
upload/capture/caption; reports (30+ builders, export, save/load); books;
websites; backup/export/subtree/actions/maintenance; duplicates merge; ToDos,
Stories, Labels, DNA, Repositories, Tribal Affiliations, Templates CRUD; charts
export/share/QR/save; all six interactive tree view modes; HeritageTree. The
routes not in the left nav (`/lists`, `/chart-split`, `/reference-numbering`,
`/custom-validation`, `/smart-filters`, `/custom-types`) are reachable via the
Command Palette (⌘K) and the Functions/Favorites screens.
