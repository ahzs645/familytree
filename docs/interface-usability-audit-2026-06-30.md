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

## Theme 2 — Controls that look functional but do nothing (open)

These render as normal toggles/selects but write to state nothing consumes. Each
needs a decision: **wire it up** (implement the feature) or **remove** the
misleading control. Left open because that's a product judgment call.

### Charts options (`components/charts/ChartsApp.jsx`, `parts/ChartOptionsPanel.jsx`)
- **[OPEN] "Hide Information marked as Private" checkbox is inert** — a privacy
  control that never masks anything (`hidePrivateChartInfo` is never read).
- **[OPEN] "Localization" select does nothing** (`chartLocalization` unread).
- **[OPEN] "Alignment of Separated Trees" select is inert**
  (`separatedTreeAlignment` unread).
- **[OPEN] Object Inspector Weight / Opacity / Stroke-style edits don't render** —
  `ChartObjectInspector` writes `fontWeight`/`opacity`/`strokeDash`, but
  `ChartCanvas` reads `overlay.bold` and never applies opacity/dash.
- **[OPEN] Spacing tab only affects the Family Chart** — `chartSpacing` is passed
  to one chart; the tab shows for all chart types.
- **[OPEN] "Maximum Recursion Depth" slider value ignored** — only the boolean
  "is ≥ 0" is used (always true).
- **[OPEN] "Person Group" select** — only `bookmarked` works and it filters the
  browser sidebar, not the chart; `start-family` is unhandled.

### List Report customizer (`components/lists/ListReportWorkbench.jsx`)
- **[OPEN] ~15 "Customize" options are dead** — theme, style, paper size, sorting,
  sort direction, smart filter, hide-private, separate-name-components, the
  `include*` citation toggles, include-pictures, picture-size — none are read by
  the preview or HTML export.
- **[OPEN] HTML "Save report" emits blank cells for render-only columns** —
  `downloadReportHtml` uses `row[key] ?? ''` and ignores `column.render`.

---

## Theme 3 — Minor / polish (open)

- **[OPEN] Book "Export anyway" button is unreachable** — `BookHasErrorsSheet`
  supports `onProceedAnyway`, but `BooksApp` never passes it (warnings-only books
  can still export directly, so not blocking).
- **[OPEN] Globe drops string-valued coordinates** — `Globe.jsx` requires numeric
  lat/lng while `MapView`/`MapsDiagram` run them through `parseCoord`; coordinates
  stored as strings plot on the flat maps but vanish on the globe.
- **[OPEN] FamilySearch dead `sync` pane key** — `TASKS_BY_PANE` maps a `sync`
  pane that isn't in `FAMILYSEARCH_PANES`.
- **[OPEN] Maintenance "Optimize Media" has no confirm; gender-mismatch "open"
  link uses a family name where a record id is expected.**
- **[OPEN] Custom Types** can't list/hide built-in catalogs; exported
  `reorderCustomTypes` helper has no UI.
- **[OPEN] Smart Filters** has no unsaved-changes guard when switching filters.

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
