# Implementation Task List — Views

## Objective
Bring the Views section to parity with the desktop menu experience and make map/visual workflows usable end-to-end.

## Implement now

### 1) Create a Views entry point (`/views`) with sub-tabs
- [ ] Add `src/routes/Views.jsx` as a layout shell with tabs: Virtual Map, Virtual Globe, Statistic Maps, Media Gallery, Family Quiz.
- [ ] Keep existing routes (`/map`, `/globe`, `/maps-diagram`, `/media`, `/quiz`) for backward compatibility.
- [ ] Register `/views` + tab routes in `src/App.jsx`.
- [ ] Add `Views` to `src/components/AppShell.jsx` primary nav.
- [ ] Add route-based focus in `src/routes/Home.jsx` section list.

Acceptance:
- A single place (`/views`) exposes all non-native map/visual modes.
- Existing direct URLs still work.

### 2) Deep-link map markers to place records (high priority)
- [ ] Update `src/routes/MapView.jsx` marker `onClick` to navigate to selected place context.
- [ ] Update `src/routes/Places.jsx` to accept `placeId` via query and auto-select that record.
- [ ] Add fallback message when the target record is not found/filtered out.

Acceptance:
- Clicking a marker moves into Places editor/details for the same place instead of generic places list.

### 3) Make map controls practical (medium priority)
- [ ] Add map controls in `src/components/ui/Map.jsx` or view wrappers:
  - basemap/style preset, label toggle, zoom reset, near-center recenter.
  - marker cluster toggle (if many coordinates).
- [ ] Persist UI defaults in localStorage/metastore.
- [ ] Add optional `MapPreferences` card in `src/routes/Places.jsx` for quick map behavior settings.

Acceptance:
- Preferences survive app reloads and update both map views.

### 4) Statistic Maps polish (`/maps-diagram`)
- [ ] Add an explicit heading/action model aligned to desktop “Statistic Maps” wording and route aliases.
- [ ] Improve year filter UX (range slider + reset, min/max computed by data, no-off-by-one).
- [ ] Add event detail panel for hovered/selected event row.

Acceptance:
- Map legend and filters are discoverable and consistent with other dashboards.

### 5) Media gallery/report as a formal View
- [ ] Add a dedicated gallery sub-view shell (even if using existing media list).
- [ ] Add quick navigation from selected person/family/events into related media media gallery slice.

Acceptance:
- Media view supports both standalone browse and filtered media-by-subject entry.

## Cross-cutting checks for Views
- [ ] Keep interaction model keyboard-friendly and avoid modal/paint regressions on small screens.
- [ ] Add lightweight smoke checks in manual QA notes for each visual route.
