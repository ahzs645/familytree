# FamilyTree Web — Interface Notes (Actionable Gaps)

Focus: web version UX gaps and “must-have” interaction improvements (as opposed to parity-only parity list items).

## 1) Navigation discoverability (high priority)

- AppShell currently surfaces only a narrow route set, while many routes are only discoverable from the Home screen.
- Current snapshot: ~35 route paths in the router, but only 17 app-shell links.
- Add a grouped nav pattern in AppShell:
  - Core data: Tree, People, Families, Events, Places, Sources, Media, Labels, Repositories
  - Analysis: Search, Statistics, Reports, Charts, Books
  - Data hygiene: Duplicates/Merge, ToDos, Backups, Maintenance/Validation
  - Context actions: Imports/Exports, Settings, Change Log
- Add a “More” overflow + quick jump/search to reduce hidden feature dead-ends.
- Routes currently not in top nav include:
  - `/duplicates`, `/maps-diagram`, `/plausibility`, `/maintenance`, `/stories`, `/groups`, `/dna`, `/repositories`, `/slideshow`, `/world-history`, `/research`, `/templates`, `/labels`, `/quiz`, `/backup`, `/export`, `/classic`.

## 2) Search experience

- Add per-entity search presets (People/Places/Events/Media/Sources with saved filters).
- Add row open action directly from search results so users can navigate to the matched record in one click.
- Increase visible result columns or provide a column chooser (currently constrained in `SearchResults`).
- Add:
  - result count + pagination controls
  - row selection + bulk actions
  - clear filter chips
  - saved search history

## 3) Map & places workflow

- Map marker click should deep-link to the selected place record instead of only opening `/places`.
- Add map preferences/control bar:
  - basemap + theme choice
  - marker clustering/labels toggles
  - near-by search radius filter
  - recenter + reset controls
- Add address/geocode workflow from Place view:
  - place lookup by text
  - batch geocoding for missing coordinates
  - geocode quality indicator (verified/approximate/manual)

## 4) Import/Export reliability

- GEDCOM import currently appends records with minimal preflight.
- Add import “review screen” before commit:
  - file summary (counts by type, duplicates risk score)
  - warnings (missing dates, unresolved persons/places/media, duplicate candidates)
  - rollback/undo preview path
- Add import profile presets (merge behavior, conflict strategy, media directory binding).
- Surface explicit progress + success/failure report after import.

## 5) Duplicates and merge

- Merge UI works at pair level; users still need stronger global workflow.
- Add merge queue/stack:
  - candidate list with confidence score
  - next/previous navigation
  - merge lock state/skip decisions
  - post-merge summary report + reversible action log

## 6) Research + ToDo integration

- Research suggestions should be actionable:
  - per-suggestion completion tracking
  - “Create ToDo from suggestion” in one click
  - person-scoped research status in People/Family context
- Add filters: open/overdue/recently closed and “linked entity” pivot.

## 7) Editor quality-of-life

- Add unsaved-changes guard on all editors:
  - dirty state badge
  - save/discard prompts
- Keep jump-to-related-record actions consistent across entity editors.
- Add optional inline edit mode for fields already supported in list views.

## 8) Settings & preferences surface

- Add Settings route:
  - theme
  - name/date display formats
  - map defaults
  - data behavior defaults (confirm on delete, auto-save strategy, private-record visibility)
- Persist preferences in existing metadata store so behavior is consistent across views.

## 9) Charts UX improvements (next phase)

- Chart overlay usability is functional but thin:
  - overlay inspect/edit/delete
  - ordering (bring-forward/send-back)
  - lock/selection states
  - undo/redo
- Add chart presets and quick presets in a side panel.

## 10) Quick metrics

- “Open-to-action” gap is largest in non-core tasks; a top-row quick actions bar (import/cleanup/search/backup/merge) would materially reduce friction.
- Home is doing most of the discoverability right now; AppShell should become the durable control surface for repeat workflows.
- Priority order for next iteration:
  1. navigation + search deep actions
  2. import validation + map deep-linking
  3. settings + research→ToDo integration
  4. duplicate merge queue and chart overlay polish

## 11) Real app signals (MFT11)

- From the live app shell:
  - Primary module row already exposes grouped flow names in one bar (`Edit`, `Charts`, `Views`, `Reports`, `Lists`, `Publish`, `Favorites`) and includes a built-in “Edit Smart Filters…” action.
  - List side panel in `Lists` mode shows:
    - quick `Find` field
    - smart scope selector (All living, Noteworthy, FS-connected, has picture, No Smart Filter)
    - grouping toggle (`Group by Last Name`) + density/slider control
  - List rows expose metadata badges/icons and are clearly count-tagged by type in the module label (e.g. Persons 123, Places 70, Sources 3, Media 92, Families 41, etc.)
- These patterns suggest web gaps beyond parity:
  - keep a persistent, discoverable “working set”/scope layer instead of only a one-off filter modal
  - expose named smart filters and smart-filter editing as first-class controls
  - surface list grouping + compact/expanded metadata modes on person/place screens

## 12) Full section inventory from live app (MFT11 Navigation menu)

I pulled the full `Navigation` tree from the desktop app and mapped it against current web routes.

- Edit
  - Implemented: Interactive Tree, Persons, Persons Groups, Places, Sources, Stories, ToDo List, Media, Change Log, Research Assistant, Search, Database Maintenance.
  - Partial: Families (no dedicated families list/detail hub; only individual family editor), Edit Smart Filters access.
  - Missing: FamilySearch, Web Search, Author Information.

- Charts
  - Implemented: Complete Tree, Hourglass, Ancestor, Double Ancestor, Descendant, Fan, Distribution, Timeline, Relationship, Sociogram, Square, Circular, Symmetrical, Fractal, Genogram, Saved Charts.
  - Partial: Chart group includes a `Statistics` chart entry (web has a separate Statistics dashboard, not a chart-style variant).

- Views
  - Implemented: Virtual Tree, Virtual Globe, Statistic Maps (desktop menu item), Media Gallery, Family Quiz.
  - Partial: `Statistic Maps` in web is split across `/map` + `/maps-diagram`; there is no dedicated “views” mode shell around each.

- Reports
  - Implemented: Person Report, Person Events Report, Family Report, Ahnentafel, Descendancy, Register, Map, Narrative, Story Report, Kinship Report, Timeline, Today, Status, Saved Reports.
  - Current web workflow includes per-report header help text, saved report restoration for page/report options, and two-person subject selection for Kinship.

- Lists
  - Implemented: Events List, Places List, Sources List, To-Do List, Changes list, Persons List, Marriage List, Facts List, Anniversary List, Plausibility List, Distinctive Persons, Person Analysis, LDS Ordinances.
  - Current web workflow includes a `/lists` hub with counts, list cards on Home, sortable table headers for the dedicated list routes, row-level editor links, and schema-gated empty state for LDS ordinances.

- Publish
  - Implemented: GEDCOM export (route `/export`), static website export, dedicated Website builder (`/websites`), explicit Publish hub (`/publish`), and Family Tree Book authoring/export flow (`/books`).
  - Current web workflow includes site branding/theme options, public/private filtering, media asset bundling, validation/progress/cancel/status states, book cover metadata, TOC styles, report/person-group/source inserts, HTML/PDF export, and website/book bundle export.

- Favorites
  - Implemented: bookmarks surface (`/bookmarks`) with grouped record types.
  - Missing: the multi-category “Favorites” hub with per-function slots shown in desktop.

Top priority gaps from this pass (next 2 sprints):
1. Missing functional sections with no equivalent in web: FamilySearch, Author Info, Web Search.
2. Favorites hub parity beyond the current bookmarks route.
3. Search presets/history and import review depth remain high-value workflow improvements.
