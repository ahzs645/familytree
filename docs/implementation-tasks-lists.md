# Implementation Task List — Lists

## Objective
Implement the missing desktop-equivalent list surfaces and make existing list outputs discoverable.

## Implement now

### 1) Build missing dedicated list views (high priority)
- [x] Add dedicated `Persons` list route: `src/routes/Persons.jsx`.
  - Reuse `src/components/interactive/PersonList.jsx` shell with master-detail row actions.
  - Add export action (CSV/JSON) and jump-to-person editor.
  - Register route and nav in `src/App.jsx` + `src/components/AppShell.jsx`.
- [x] Add `src/routes/MarriageList.jsx` using `buildMarriageListReport` data shape with row-level partner links.
- [x] Add `src/routes/FactsList.jsx` using `buildFactsListReport` and filter by fact type/date.
- [x] Add `src/routes/AnniversaryList.jsx` with month/day filtering and year formatting.
- [x] Add `src/routes/PlausibilityList.jsx` as a dedicated list entry that wraps current plausibility checker output.

Acceptance:
- Every missing list above is directly addressable from nav/shortcut and opens without reports first.

### 2) List hub and quick discoverability
- [x] Add `src/routes/Lists.jsx` as a hub with counts:
  - Persons, Places, Sources, Events, Media, To-Dos, Changes, Plausibility, Anniversary, Facts, Marriage.
- [x] Add list route cards on `/home` for fast entry.

Acceptance:
- Users can see list coverage and jump from one click.

### 3) Implement LDS-oriented and analysis lists where data exists
- [x] Add `Distinctive Persons` list placeholder with a rule-based implementation.
  - If no `distinctive` marker exists, provide a filter-by-criteria interface (manual rules).
- [x] Add `Person Analysis` route with reusable metrics (age, missing dates, orphaned relationships, duplicate risks).
- [x] Evaluate and gate LDS-related lists (`LDS Ordinances`) based on actual schema presence.

Acceptance:
- If model fields are missing, show a clear empty-state/instructions message rather than a dead route.

### 4) Make existing list outputs consistent with route mode
- [x] Convert selected report list builders into dedicated routes with `MasterDetailList` style filters:
  - Current `events`, `places`, `sources`, `to-do`, `changes` routes are used as reference UX patterns.
- [x] Add column/label parity and sortable headers across all list routes.

Acceptance:
- Clicking list rows can open linked editor for the row type.
- Sorting/filtering controls exist on every list route.
