# Implementation Task List — Views

## Objective
Bring the Views section to parity with the desktop menu experience and make map/visual workflows usable end-to-end.

## Implement now

### 1) Create a Views entry point (`/views`) with sub-tabs
- [x] Add `src/routes/Views.jsx` as a layout shell with tabs: Virtual Map, Virtual Globe, Statistic Maps, Media Gallery, Family Quiz.
- [x] Keep existing routes (`/map`, `/globe`, `/maps-diagram`, `/media`, `/quiz`) for backward compatibility.
- [x] Register `/views` + tab routes in `src/App.jsx`.
- [x] Add `Views` to `src/components/AppShell.jsx` primary nav.
- [x] Add route-based focus in `src/routes/Home.jsx` section list.

Acceptance:
- A single place (`/views`) exposes all non-native map/visual modes.
- Existing direct URLs still work.

### 2) Deep-link map markers to place records (high priority)
- [x] Update `src/routes/MapView.jsx` marker `onClick` to navigate to selected place context.
- [x] Update `src/routes/Places.jsx` to accept `placeId` via query and auto-select that record.
- [x] Add fallback message when the target record is not found/filtered out.

Acceptance:
- Clicking a marker moves into Places editor/details for the same place instead of generic places list.

### 3) Make map controls practical (medium priority)
- [x] Add map controls in `src/components/ui/Map.jsx` or view wrappers:
  - basemap/style preset, label toggle, zoom reset, near-center recenter.
  - marker cluster toggle (if many coordinates).
- [x] Persist UI defaults in localStorage/metastore.
- [x] Add optional `MapPreferences` card in `src/routes/Places.jsx` for quick map behavior settings.

Acceptance:
- Preferences survive app reloads and update both map views.

### 4) Statistic Maps polish (`/maps-diagram`)
- [x] Add an explicit heading/action model aligned to desktop “Statistic Maps” wording and route aliases.
- [x] Improve year filter UX (range slider + reset, min/max computed by data, no-off-by-one).
- [x] Add event detail panel for hovered/selected event row.

Acceptance:
- Map legend and filters are discoverable and consistent with other dashboards.

### 5) Media gallery/report as a formal View
- [x] Add a dedicated gallery sub-view shell (even if using existing media list).
- [x] Add quick navigation from selected person/family/events into related media media gallery slice.

Acceptance:
- Media view supports both standalone browse and filtered media-by-subject entry.

## Cross-cutting checks for Views
- [x] Keep interaction model keyboard-friendly and avoid modal/paint regressions on small screens.
- [x] Add lightweight smoke checks in manual QA notes for each visual route.

## Manual QA smoke notes

- `/views` redirects to `/views/virtual-map`; tabs remain keyboard-focusable and direct routes `/map`, `/globe`, `/maps-diagram`, `/media`, and `/quiz` still load.
- `/views/virtual-map`: map controls render, basemap/labels/cluster preferences persist, reset and near-center buttons operate, and a marker opens `/places?placeId=...`.
- `/places?placeId=<id>`: the matching place auto-selects; an unknown ID shows a warning without breaking the list.
- `/views/virtual-globe`: shared basemap/label preferences apply to the globe view.
- `/views/statistic-maps`: type and year-range filters update plotted events; hovering or selecting an event row updates the detail panel.
- `/views/media-gallery`: standalone browse works, and `?targetId=<record>&targetType=<type>` narrows the gallery to related media.
- `/views/family-quiz`: quiz remains available through the Views tab while `/quiz` remains backward-compatible.
