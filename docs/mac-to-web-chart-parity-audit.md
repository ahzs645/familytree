# MacFamilyTree 11 to web chart parity audit

Source app bundle:

- `/Users/ahmadjalil/Downloads/family tree/app/MacFamilyTree 11/Contents`
- Primary extraction note: `/Users/ahmadjalil/Downloads/family tree/app/MacFamilyTree 11/Contents/Resources/mac_chart_decompile_extraction.md`

Web app target:

- `/Users/ahmadjalil/github/familytree`
- Main chart UI: `src/components/charts/ChartsApp.jsx`
- Shared SVG viewer/editor: `src/components/charts/ChartCanvas.jsx`
- Saved chart import adapter: `src/lib/chartContainerLoader.js`

## Executive comparison

The web app already has the right high-level chart surface: it exposes most Mac chart mode names, renders them in SVG, supports pan/zoom, overlays, saved web chart documents, templates, and basic export.

The main gap is depth. The Mac app is builder/compositor driven:

1. chart mode/controller
2. chart-specific builder configuration
3. `ChartBuilderItemsContainer`
4. `ChartCompositorObjectsContainer`
5. CoreAnimation viewer/editor
6. serialized saved chart object container

The web app is currently mostly:

1. chart type dropdown
2. one root person, optional second person, one generation count
3. direct React layout/render component
4. generic overlay array
5. shallow document save/load

So the web app has breadth, but not the Mac app's per-chart builder configuration, compositor object model, full edit lifecycle, property inspector, page/export settings, or native saved-chart restore fidelity.

## Web implementation inventory

### Present in web

- Chart mode switch includes:
  - `ancestor`
  - `descendant`
  - `hourglass`
  - `tree`
  - `double-ancestor`
  - `fan`
  - `circular`
  - `symmetrical`
  - `distribution`
  - `timeline`
  - `genogram`
  - `sociogram`
  - `fractal-h-tree`
  - `square-tree`
  - `fractal-tree`
  - `relationship`
  - `virtual`
- Shared pan/zoom/export surface in `ChartCanvas.jsx`.
- Overlay commands in `useChartObjectCommands.js`: text, line, image, delete, undo, redo, align, distribute, bring to front, send to back.
- Basic chart documents in `chartDocuments.js`: chart type, root, second person, theme, generations, virtual options, page, overlays.
- Basic templates in `chartTemplates.js`.
- Mac saved chart import adapter in `chartContainerLoader.js`, but only best-effort.
- Interactive tree route at `/tree` using `InteractiveTreeApp.jsx` and a Three.js view in `ThreeDTreeView.jsx`.
- Separate statistics route in `src/routes/Statistics.jsx`.

### Missing or shallow in web

- No chart builder/compositor document model equivalent to Mac `ChartBuilderItemsContainer` and `ChartCompositorObjectsContainer`.
- No chart-specific configuration panes matching Mac `Chart`, `Theme`, `Style`, path, and page setup panes.
- No edit session lifecycle: explicit edit mode, finish, dirty prompt, save new/edited chart prompt, read-only guard.
- No object property inspector for selected people/connections/overlays.
- No page-aware realign modes:
  - Mac: move objects away from page breaks.
  - Mac: distribute objects border-to-border.
- No full export/page setup:
  - separate pages
  - margins
  - page overlap
  - print page numbers
  - cut marks
  - omit empty pages
  - JPEG quality
  - export format choice
  - scaling
  - export background toggle
- No explicit share flow.
- Imported Mac saved charts are not decoded as native compositor objects; only shallow hints/overlays are inferred when possible.

## Per-chart comparison

### Ancestor

Mac evidence:

- `AncestorChartBuilder`
- `AncestorChartBuilderConfiguration`
- branch traversal settings:
  - only maternal
  - only paternal
  - maternal and paternal
  - paternal/maternal from start person
- sibling toggles:
  - brothers/sisters of ancestors
  - brothers/sisters of start person

Web now:

- `buildAncestorTree(rootId, generations)` in `src/lib/treeQuery.js`.
- `AncestorChart.jsx` plus `layoutAncestors`.
- Single generation count.

Bring over next:

- Branch traversal selector.
- Sibling inclusion/scaling.
- Separate builder config persisted in chart documents.

### Descendant

Mac evidence:

- `DescendantChartBuilder`
- `DescendantChartBuilderConfiguration`
- partner controls:
  - show partners of start item
  - indent partners
  - partner indentation slider
- child generation controls.

Web now:

- `buildDescendantTree(rootId, generations)` in `treeQuery.js`.
- `DescendantChart.jsx` plus `layoutDescendants`.
- Descendant build is capped to `Math.min(generations, 4)` in `ChartsApp.jsx`.

Bring over next:

- Remove or make explicit the generation cap.
- Add partner show/indent settings.
- Persist descendant builder options.

### Complete Tree

Mac evidence:

- `TreeChartBuilder`
- `TreeChartBuilderConfiguration`
- `TreeChartBuilderSubTree`
- separated tree alignment:
  - by generation
  - shortest distance to origin

Web now:

- `TreeChart.jsx` combines ancestor and descendant layouts around the selected person.
- This is useful, but it is not a true complete-tree/subtree builder.

Bring over next:

- Build a graph-wide tree/subtree model.
- Handle disconnected/separated subtrees.
- Add subtree alignment modes.

### Fan

Mac evidence:

- `FanChartBuilder`
- `FanChartBuilderConfiguration`
- mode:
  - ancestors
  - descendants
- start angle / angle controls.
- expand very small fan items.
- multiple dedicated fan styles.

Web now:

- `FanChart.jsx` and `layoutFan`.
- It renders ancestor fan only unless the data source is manually changed in code.
- `arcDegrees` exists as a prop, but is not exposed in `ChartsApp` state/UI.

Bring over next:

- Fan mode: ancestors vs descendants.
- Start angle and arc angle controls.
- Expand-small-slices option.
- Persist fan-specific options in documents/templates.

### Hourglass

Mac evidence:

- `HourglassChartBuilder`
- selected/ordinary/connection item classes.
- separate settings:
  - ancestor generations
  - descendant generations
  - ancestors of partner generations
  - alignment
  - connection item width/corner radius

Web now:

- `HourglassChart.jsx` combines `layoutAncestorsUpward` and `layoutDescendants`.
- Uses one shared `generations` value.

Bring over next:

- Separate ancestor/descendant/partner-ancestor generation settings.
- Dedicated selected-person and connection styling.
- Hourglass alignment option.

### Double Ancestor

Mac evidence:

- `DoubleAncestorChartBuilder`
- `DoubleAncestorChartBuilderConfiguration`
- father/mother generation settings.

Web now:

- `DoubleAncestorChart.jsx` renders two selected persons' ancestor trees side-by-side.
- Uses one shared generation value for both sides.

Bring over next:

- Father and mother generation controls.
- Better pair validation/messaging.
- Persist pair-specific connector/layout style.

### Relationship

Mac evidence:

- `FindRelationshipPathsController`
- `RelationshipChartBuilder`
- `RelationshipChartBuilderPath`
- `RelationshipChartBuilderPathElement`
- path popup.
- `Only traverse direct blood lines`.
- no-relation and same-person error strings.

Web now:

- `findRelationshipPath(start, end)` returns one shortest BFS path.
- Supports parent, child, spouse edges.
- `RelationshipPathChart.jsx` renders one horizontal chain.

Bring over next:

- Return multiple selectable paths.
- Add bloodline-only filtering.
- Add selected-path document state.
- Add max relationship steps if desired.
- Add Mac-like no-relation / same-person messages.

### Interactive Tree

Mac evidence:

- Separate editable browser:
  - `InteractiveTreeView`
  - `InteractiveTreeViewTreeBuilder`
  - `InteractiveTreeViewAssociatePersonsBuilder`
  - `InteractiveTreeViewFlatViewer`
  - `InteractiveTreeView3DViewer`
- Add/edit/delete/focus/context delegate actions.
- Flat and 3D viewer modes.
- Many options: kinships, birth/death dates, person groups, connection width, camera modes, generation bands, FamilySearch actions.

Web now:

- `/tree` route with `InteractiveTreeApp.jsx`.
- Person list plus focus/details.
- Three.js tree in `ThreeDTreeView.jsx`.
- Click to select/focus person.

Bring over next:

- Add relatives actions.
- Edit/delete person/family actions from tree context.
- Show/hide kinships, dates, person groups, labels, media notes.
- Add flat viewer mode, not only 3D/details.
- Add camera presets matching Mac: front, top-down, isometric, top-left/right.
- Add associate/influential persons mode.

### Virtual Tree

Mac evidence:

- Separate 3D/Metal renderer:
  - `VirtualTreeBuilder`
  - `VirtualTreeConfiguration`
  - `VirtualTreeMetalRenderer`
  - person/family/connection objects
  - draw/compute encoders
- Rotation and zoom tracking nib.
- Collect modes:
  - two generations
  - three generations
  - all generations
- Person/family symbols, color modes, relationship-path highlighting, depth of field, shadows, AR strings.

Web now:

- `/charts?type=virtual` is a configurable 2D SVG hierarchy using `VirtualTreeDiagram.jsx`.
- `/tree` has a separate Three.js interactive tree, closer to Mac Interactive Tree than Virtual Tree.

Bring over next:

- Decide whether web Virtual Tree should move to Three.js/WebGL.
- Add collect mode, symbol mode, color mode, connection style, relationship path highlighting.
- Reuse `ThreeDTreeView.jsx` infrastructure for camera/orbit/rendering.

### Fractal variants

Mac evidence:

- Shared `BaseFractalChartsBuilder`.
- Dedicated builders:
  - `FractalHTreeChartsBuilder`
  - `FractalHVTreeChartsBuilder`
  - `FractalFractalTreeChartsBuilder`
  - `FractalCircularTreeChartsBuilder`
  - `FractalSymmetricalTreeChartsBuilder`
- Dedicated layout methods for circular and symmetrical variants.

Web now:

- `FractalAncestorChart` covers:
  - h-tree
  - square
  - fractal
- `CircularAncestorChart` covers circular.
- `TreeChart` symmetrical mode is not the same as Mac's fractal symmetrical builder.

Bring over next:

- Treat all fractal variants as one family with shared config.
- Map imported Mac class hints to web chart types in `chartContainerLoader.js`.
- Replace the current symmetrical layout with a closer fractal symmetrical layout or rename current mode if it is semantically different.

### Genogram

Mac evidence:

- `GenogramChartBuilder`
- `GenogramPersonBuilderItemGeneratorChartCompositorObject`
- event/fact position controls:
  - right
  - below
- event/fact background:
  - none
  - filled
- common events/facts and influential relation style groups.

Web now:

- `GenogramChart` reuses descendant layout and basic node/link styling.
- No event/fact rendering around person boxes.

Bring over next:

- Query `PersonEvent`, `FamilyEvent`, and `PersonFact`.
- Render event/fact badges/rows around person nodes.
- Add event position/background controls.
- Add relationship/family symbols if available.

### Sociogram

Mac evidence:

- `SociogramChartBuilder`
- `SociogramAssociatedPersonChartBuilderItem`
- toggles:
  - show parents
  - show grandparents
  - show partners
  - show children
  - show associate relations of start person
  - show associate relations of partners
  - show associate relations of children
  - associated persons spacing

Web now:

- `sociogram` is `GenogramChart` with a flag that changes connector stroke/dash and adds a marker dot.
- It still uses descendant-tree data.

Bring over next:

- Build a real sociogram source from parent/partner/child/associate relation indexes.
- Query `AssociateRelation`.
- Add toggles and associated person spacing.

### Timeline

Mac evidence:

- `TimelineChartBuilder`
- `TimelinePersonChartBuilderItem`
- `TimelineHistoryPersonChartBuilderItem`
- `TimelineItemGroupChartBuilderItem`
- grouping by birth/death country/place, last name, gender, sort by date.
- date range, collapse groups, event marker options.

Web now:

- `TimelineChart` merges ancestor and descendant person summaries.
- Uses birth/death years only.
- No event rows, family events, groups, history persons, date range config, or markers.

Bring over next:

- Build timeline from `PersonEvent` and `FamilyEvent`.
- Add grouping mode and from/to date controls.
- Add event marker modes and optional history/famous-person rows.

### Statistics

Mac evidence:

- `StatisticsChartBuilder`
- `TableGraphChartBuilderItem`
- many statistic types including age at death/marriage/divorce, month charts, children per family, gender, names, titles, years, places, facts.

Web now:

- Separate `/statistics` route.
- `computeStatistics()` covers record counts, gender split, births/deaths by century, top surnames, lifespan, missing data, places by country.
- No `/charts` statistics chart mode.

Bring over next:

- Decide if Statistics should become a chart mode or remain a route.
- If chart mode: add selected statistic type, graph type, table values, labels, and export support.
- Reuse `computeStatistics()` as the start, but expand toward Mac statistic types.

### Distribution

Mac evidence:

- `DistributionChartBuilder`
- `DistributionChartBuilderItemValueRange`
- distribution types:
  - birth/death countries and places
  - first/last names
  - gender
  - event values such as occupations and illnesses
  - facts such as eye color, origin, race, skin color, caste
- relative values and graph type bars/lines.

Web now:

- `DistributionChart` has a sidebar with:
  - last names
  - first names
  - genders
  - birth places
  - birth countries
  - death places
- It uses person summaries and birth/death years.

Bring over next:

- Add death countries.
- Add event-value distributions from `PersonEvent`.
- Add fact distributions from `PersonFact`.
- Add graph type and relative-value settings.
- Persist selected distribution category in chart documents.

### Saved Charts

Mac evidence:

- Saved charts store `chartObjectsContainerData`.
- Saved chart pane supports edit/delete/rename.
- Book/report insertion can pick saved charts.
- Mac saved charts preserve compositor objects, not only chart parameters.

Web now:

- Web chart documents are metadata plus overlays.
- Imported Mac saved charts are best-effort decoded by `chartContainerLoader.js`.
- Raw native payload is not reconstructed into a full object container.

Bring over next:

- Preserve native payload metadata explicitly on imported documents.
- Expand class-name inference for all confirmed Mac chart classes.
- Add decoded status and raw-preserved status in Saved Charts UI.
- Add rename flow for saved web chart documents.

## Best work to bring over first

1. Relationship path parity
   - Multiple paths.
   - Bloodline-only toggle.
   - Selected path state.
   - This has the clearest Mac NIB wiring and the web graph code is already close.

2. Chart document schema expansion
   - Add `builderConfig`, `compositorConfig`, `exportSettings`, `pageSetup`, `selectedRelationshipPathId`, and per-chart option blocks.
   - This unlocks saved chart parity and avoids rework as chart options grow.

3. Page/export/share parity
   - Margins, page numbers, cut marks, separate pages, export background, PNG/JPEG choice, scaling, JPEG quality, share.
   - Mac evidence is strong and implementation is mostly UI/schema/export helper work.

4. Sociogram and genogram data builders
   - These are currently the most semantically wrong web chart modes.
   - The needed data already exists in records: `PersonEvent`, `FamilyEvent`, `PersonFact`, `AssociateRelation`.

5. Distribution/timeline/statistics aggregation builders
   - The web has enough raw records, but needs chart-document aggregation models rather than direct component-only calculations.

6. Interactive Tree actions
   - Add relatives, edit/delete person/family, context menu, flat viewer, camera presets.
   - The Three.js base exists, so this can evolve incrementally.

7. Full Virtual Tree
   - Larger effort.
   - Requires treating Mac `VirtualTreeMetalRenderer` as design evidence and building a separate Three.js/WebGL equivalent.

## Important caution

There is no practical source code to literally copy from the Mac app bundle. The useful things to bring over are:

- class and selector names as architecture evidence
- config keys and string-table labels
- NIB action/outlet wiring
- saved payload field names
- mode-specific builder responsibilities
- UI behavior and option taxonomy

Implementation should stay native to this React/Vite codebase.
