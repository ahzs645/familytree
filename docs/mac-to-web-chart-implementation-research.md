# MacFamilyTree chart parity implementation research

Source evidence:

- Mac bundle: `/Users/ahmadjalil/Downloads/family tree/app/MacFamilyTree 11/Contents`
- Mac extraction note: `/Users/ahmadjalil/Downloads/family tree/app/MacFamilyTree 11/Contents/Resources/mac_chart_decompile_extraction.md`
- Web app: `/Users/ahmadjalil/github/familytree`
- Baseline audit: `docs/mac-to-web-chart-parity-audit.md`

## Recommended implementation order

1. Relationship path parity.
2. Chart document schema expansion.
3. Page/export/share parity.
4. Distribution/timeline/statistics aggregation builders.
5. Genogram and sociogram real data builders.
6. Interactive Tree actions and flat viewer.
7. Full Virtual Tree WebGL feature.

This order keeps the first work mostly data/model/UI state, then expands chart output fidelity, then moves into larger interaction and rendering systems.

## 1. Relationship path parity

### Mac behavior to bring over

Mac evidence shows `FindRelationshipPathsController`, selectable path results, and NIB actions:

- `selectFromPerson:`
- `selectToPerson:`
- `changedShowOnlyBloodlines:`
- `reset:`
- `pathsPopUpButton`
- `RelationshipChartBuilderPath`

The Mac implementation is path-driven rather than just "find one relationship." Users can choose from multiple discovered paths and can restrict paths to bloodline-only relationships.

### Web status

Current web files:

- `src/lib/relationshipPath.js`
- `src/components/charts/RelationshipPathChart.jsx`
- `src/components/charts/ChartsApp.jsx`
- `src/lib/reports/builders.js` uses `findRelationshipPath` for kinship reporting.

Current implementation returns a single shortest BFS path with edge types:

- `parent`
- `child`
- `spouse`

Missing:

- Multiple candidate paths.
- Bloodline-only toggle.
- Selected path state.
- Path dropdown/list.
- Max search depth and max path count guardrails.
- Direct tests for relationship path discovery.

### Proposed implementation

Add a new relationship-path API while preserving the existing API for callers:

- Keep `findRelationshipPath(startRecordName, endRecordName)` as a compatibility wrapper returning the first result.
- Add `findRelationshipPaths(startRecordName, endRecordName, options)`.
- Options:
  - `bloodlineOnly = false`
  - `maxDepth = 12`
  - `maxPaths = 12`
  - `includeSpouses = !bloodlineOnly`
- Return shape:

```js
{
  paths: [
    {
      id,
      steps,
      label,
      edgeCounts: { parent, child, spouse },
      bloodlineOnly,
    }
  ],
  selectedPathId,
}
```

Update `ChartsApp.jsx`:

- Add `relationshipPaths`, `selectedRelationshipPathId`, `relationshipBloodlineOnly`.
- Fetch `findRelationshipPaths(rootId, secondId, { bloodlineOnly })`.
- Pass selected path to `RelationshipPathChart`.
- Add a small relationship options pane near the second-person picker:
  - from person
  - to person
  - bloodline-only toggle
  - path selector
  - reset

Suggested tests:

- `src/lib/relationshipPath.test.js`
- Cases:
  - direct parent/child path.
  - spouse path appears when `bloodlineOnly: false`.
  - spouse path is removed when `bloodlineOnly: true`.
  - multiple paths are returned when a graph has more than one route.
  - max depth prevents runaway traversal.

### First patch scope

This is the best first implementation task. It is self-contained, high user value, and directly matches confirmed Mac controls.

## 2. Chart document schema expansion

### Mac behavior to bring over

The Mac pipeline separates chart generation and final chart objects:

- chart mode/controller
- chart-specific builder config
- `ChartBuilderItemsContainer`
- `ChartCompositorObjectsContainer`
- CoreAnimation viewer/editor
- serialized saved chart data via `chartObjectsContainerData`

Saved Charts are not just chart parameters; they preserve compositor container data.

### Web status

Current web files:

- `src/lib/chartDocuments.js`
- `src/lib/chartTemplates.js`
- `src/lib/chartContainerLoader.js`
- `src/components/charts/ChartsApp.jsx`
- `src/components/charts/useChartObjectCommands.js`

Current saved document state is shallow:

- `chartType`
- `rootId`
- `secondId`
- `themeId`
- `generations`
- `virtual`
- `page`
- `overlays`

Missing:

- `builderConfig`
- `compositorConfig`
- `exportSettings`
- richer `pageSetup`
- per-chart options
- document schema versioning/migration
- edit lifecycle metadata

### Proposed schema

Add a versioned document shape:

```js
{
  id,
  name,
  schemaVersion: 2,
  chartType,
  roots: {
    primaryPersonId,
    secondaryPersonId,
  },
  builderConfig: {
    common: {
      generations,
      privacyMode,
    },
    ancestor: {},
    descendant: {},
    relationship: {},
    genogram: {},
    sociogram: {},
    timeline: {},
    distribution: {},
    statistics: {},
    virtual: {},
  },
  compositorConfig: {
    themeId,
    layoutMode,
    objectStyles,
    connectionStyles,
    overlays,
    selectedObjectIds,
  },
  pageSetup: {
    paperSize,
    orientation,
    width,
    height,
    margins,
    overlap,
    printPageNumbers,
    cutMarks,
    omitEmptyPages,
    backgroundColor,
    title,
    note,
  },
  exportSettings: {
    format,
    scale,
    includeBackground,
    jpegQuality,
    fileNameTemplate,
  },
  importedMac: {
    sourceRecordName,
    detectedChartClass,
    decodedPayloadSummary,
    unsupportedObjectCount,
  },
  updatedAt,
  createdAt,
}
```

Add helpers:

- `normalizeChartDocument(rawDoc)`
- `createDefaultBuilderConfig(chartType)`
- `createDefaultCompositorConfig(chartType)`
- `createDefaultPageSetup()`
- `createDefaultExportSettings()`
- `migrateChartDocument(rawDoc)`

Keep current documents loadable by migration.

### First patch scope

Do this immediately after relationship paths. Do not wait for every chart option. Add the container fields and migrate old documents, then store relationship path settings in `builderConfig.relationship`.

## 3. Page/export/share parity

### Mac behavior to bring over

Mac chart/export strings and chart UI indicate richer page and export controls:

- separate pages
- margins
- page overlap
- print page numbers
- cut marks
- omit empty pages
- JPEG quality
- format selection
- scaling
- export background toggle
- share flow

### Web status

Current web files:

- `src/components/charts/ChartCanvas.jsx`
- `src/lib/chartExport.js`
- `src/components/charts/ChartsApp.jsx`

Current controls:

- page size: letter/a4/legal
- orientation
- background color
- export SVG
- export PNG
- print/PDF through browser

Missing:

- exported page model separate from viewport.
- margins and page tiling.
- JPEG.
- quality and scale controls.
- background inclusion toggle.
- Web Share API where available.
- persisted export settings.

### Proposed implementation

Add `pageSetup` and `exportSettings` from the schema work before expanding UI.

Implementation steps:

1. Add normalized page dimensions for `letter`, `a4`, `legal`, plus custom width/height.
2. Update `chartExport.js` to accept:
   - `format`
   - `scale`
   - `includeBackground`
   - `jpegQuality`
   - `pageSetup`
3. Add JPEG export using canvas `toBlob('image/jpeg', jpegQuality)`.
4. Add tiled print/PDF helpers later; keep first pass to single-page output plus persisted settings.
5. Add share action:
   - if `navigator.share` and `navigator.canShare` support the generated file, share it.
   - otherwise download.

Suggested tests:

- Unit tests for page dimension normalization.
- Unit tests for export option normalization.
- Manual browser checks for SVG/PNG/JPEG/PDF on light/dark backgrounds.

## 4. Distribution, timeline, and statistics aggregation builders

### Mac behavior to bring over

Mac evidence shows these are aggregation builders, not simple person summaries:

- `TimelineChartBuilder`
- `TimelineHistoryPersonChartBuilderItem`
- `TimelineItemGroupChartBuilderItem`
- distribution/statistics graph builders
- table graph/value range classes

The Mac app builds chart data from events, facts, value ranges, grouping, and history settings.

### Web status

Current web files:

- `src/components/charts/SpecializedCharts.jsx`
- `src/lib/statistics.js`
- `src/routes/Statistics.jsx`
- `src/lib/reports/builders.js`
- `src/lib/personContext.js`
- `src/lib/catalogs.js`

Current web charts:

- `DistributionChart` buckets cached person summaries by first/last name, gender, and cached birth/death places.
- `TimelineChart` mostly uses descendant persons and cached dates.
- `computeStatistics()` counts gender, centuries, surnames, lifespan, living/deceased, missing data, places.
- `buildTimelineReport()` and `buildFactsListReport()` already query `PersonEvent`, `FamilyEvent`, and `PersonFact`.

Missing:

- Chart data builders that query events/facts directly.
- Configurable timeline event types.
- Grouping settings.
- Place/fact/event distributions.
- Shared aggregation output used by both charts and reports.

### Proposed implementation

Create chart data-builder modules:

- `src/lib/chartData/timelineBuilder.js`
- `src/lib/chartData/distributionBuilder.js`
- `src/lib/chartData/statisticsBuilder.js`

Builder inputs:

- database handle or implicit `getLocalDatabase()`
- `rootId`
- `scope`: `all`, `ancestors`, `descendants`, `selectedPersonContext`
- `eventTypes`
- `factTypes`
- date range
- grouping mode

Builder outputs:

- normalized rows with `recordName`, `personRecordName`, `familyRecordName`, `type`, `date`, `year`, `place`, `label`
- aggregate buckets with `key`, `label`, `count`, `minYear`, `maxYear`, `records`

Reuse report query logic from `src/lib/reports/builders.js` rather than duplicating field parsing.

Suggested tests:

- Builder tests with synthetic `PersonEvent`, `FamilyEvent`, and `PersonFact` records.
- Verify unknown dates are grouped explicitly instead of dropped silently.
- Verify scope filtering for all vs ancestors/descendants.

### First patch scope

Start with timeline because `buildTimelineReport()` already proves the data access pattern. Then use the same event/fact row normalizer for distribution and statistics.

## 5. Genogram and sociogram real data builders

### Mac behavior to bring over

Mac evidence:

- `GenogramChartBuilder`
- `GenogramPersonBuilderItemGeneratorChartCompositorObjectConfiguration`
- genogram event/fact placement and background settings
- `SociogramChartBuilder`
- `SociogramAssociatedPersonChartBuilderItem`
- sociogram toggles for parents, grandparents, partners, children, and associate relations

These chart modes have semantics beyond descendant layout. Genogram emphasizes relationship/family structure and individual attributes. Sociogram emphasizes social/associate relationships.

### Web status

Current web files:

- `src/components/charts/SpecializedCharts.jsx`
- `src/lib/personContext.js`
- `src/lib/catalogs.js`
- `src/components/editors/RelatedRecordEditors.jsx`
- `src/routes/PersonEditor.jsx`
- `src/routes/FamilyEditor.jsx`

Current web behavior:

- Genogram and sociogram mostly reuse descendant-style layout/data.
- Person and family editors already load/save:
  - `PersonFact`
  - `PersonEvent`
  - `FamilyEvent`
  - `AssociateRelation`
  - `PersonGroupRelation`
  - `LabelRelation`

Missing:

- `AssociateRelation`-driven sociogram graph.
- Genogram symbols/markers for gender, family, events, facts, labels, status.
- Per-chart toggles for included relation types.
- Edge styling by relationship category.

### Proposed implementation

Create:

- `src/lib/chartData/genogramBuilder.js`
- `src/lib/chartData/sociogramBuilder.js`

Genogram builder:

- Input: root person, generations/scope, included event/fact/label types.
- Output:
  - persons
  - families
  - parent-child edges
  - partner/family edges
  - markers derived from facts/events/labels
- UI toggles:
  - show facts
  - show events
  - show labels
  - show photos
  - generation scope

Sociogram builder:

- Query `AssociateRelation` for person and family relations.
- Include configured family neighbors:
  - parents
  - grandparents
  - partners
  - children
  - siblings
- Output graph nodes and typed edges:
  - family
  - partner
  - parent-child
  - associate/influential person
  - group/label
- UI toggles should match Mac evidence: relation classes are individually selectable.

Suggested tests:

- Sociogram includes associate relation edges from `AssociateRelation`.
- Sociogram blood-family toggles remove corresponding edge classes.
- Genogram marker extraction from `PersonFact`, `PersonEvent`, and labels.

### First patch scope

Implement the builders first and keep the initial SVG visuals simple. This will make the charts semantically correct before investing in high-fidelity symbols.

## 6. Interactive Tree actions and flat viewer

### Mac behavior to bring over

Mac evidence:

- `InteractiveTreeView`
- `InteractiveTreeViewTreeBuilder`
- `InteractiveTreeViewFlatViewer`
- `InteractiveTreeView3DViewer`
- delegate actions for add/edit/delete/focus/context behavior

Interactive Tree is an editable browser, separate from static chart rendering.

### Web status

Current web files:

- `src/components/interactive/InteractiveTreeApp.jsx`
- `src/components/interactive/ThreeDTreeView.jsx`
- `src/components/interactive/PersonFocus.jsx`
- `src/components/interactive/PersonList.jsx`
- `src/routes/PersonEditor.jsx`
- `src/routes/FamilyEditor.jsx`
- `src/lib/LocalDatabase.js`

Current behavior:

- Person list.
- Details pane.
- Three.js viewer.
- Click node to focus.
- Buttons from details to ancestor/descendant charts.

Missing:

- Add relative actions.
- Edit/delete person/family actions.
- Context menu.
- Flat viewer mode.
- Camera presets.
- Relationship/family action routing from nodes/edges.
- Unsaved edit safeguards.

### Proposed implementation

First action layer:

- Add node context menu in `ThreeDTreeView`.
- Actions:
  - focus person
  - open details
  - edit person
  - add parent
  - add partner
  - add child
  - open ancestor chart
  - open descendant chart
- Route edit actions to existing editor pages first.

Then add data mutation helpers:

- `src/lib/treeMutations.js`
- Use existing record schema/reference helpers.
- Start with create person + link as parent/partner/child.
- Defer destructive delete until relation cleanup is well tested.

Flat viewer:

- Add `FlatTreeView.jsx` using the same builder output as `ThreeDTreeView`.
- It should be SVG/HTML, fast, and searchable.
- Segment control: flat, 3D, details.

Camera presets:

- fit all
- ancestors
- descendants
- selected family
- top/front/isometric

Suggested tests:

- Mutation helper tests for add parent/partner/child.
- Manual checks for context menu and routing.
- Browser check that 3D and flat modes render the same active person.

## 7. Full Virtual Tree as Three.js/WebGL

### Mac behavior to bring over

Mac evidence:

- `VirtualTreeBuilder`
- `VirtualTreeMetalRenderer`
- `VirtualTreePersonObject`
- `VirtualTreeFamilyObject`
- `VirtualTreeConnectionObject`
- Metal draw/compute encoders
- rotation and zoom tracking views
- AR strings
- depth of field
- symbols
- family models
- relationship path highlighting

Virtual Tree is separate from Interactive Tree. It is a dedicated 3D/WebGL visualization, not a static SVG chart variant.

### Web status

Current web files:

- `src/components/charts/VirtualTreeDiagram.jsx`
- `src/components/interactive/ThreeDTreeView.jsx`
- `src/components/charts/ChartsApp.jsx`

Current behavior:

- `VirtualTreeDiagram` is an SVG-style configurable tree chart.
- `ThreeDTreeView` is the only real Three.js viewer.

Missing:

- Full WebGL virtual tree route/component.
- 3D object model equivalent to person/family/connection objects.
- collect mode / color mode options.
- symbols and family models.
- relationship path highlighting.
- depth of field/camera presets.
- export/snapshot.
- AR is not directly applicable on web, but design evidence can inform camera/world controls.

### Proposed implementation

Do not retrofit the SVG `VirtualTreeDiagram` into WebGL. Create a separate WebGL component and keep the current SVG version as a lightweight chart.

New files:

- `src/components/virtual-tree/VirtualTreeScene.jsx`
- `src/components/virtual-tree/buildVirtualTreeScene.js`
- `src/components/virtual-tree/VirtualTreeControls.jsx`
- `src/lib/chartData/virtualTreeBuilder.js`

Rendering approach:

- Use Three.js because the app already depends on it.
- Use instancing for repeated person/family markers after the first version.
- Build a scene graph with explicit object types:
  - person
  - family
  - connection
  - relationshipPath
  - generationBand
  - symbol
- Keep labels as CSS2D or canvas textures; choose one after a prototype.

First version:

- 3D scene using existing ancestor/descendant builders.
- person/family/connection objects.
- orbit controls.
- focus selected person.
- relationship path highlight using `findRelationshipPaths`.
- color modes:
  - generation
  - gender
  - branch
  - relationship path

Later:

- depth of field.
- symbol packs.
- family model meshes.
- snapshot/export.
- performance work for large trees.

Suggested tests:

- Builder unit tests for object counts and relationship path flags.
- Browser screenshot/canvas-pixel check for nonblank render.
- Manual interaction checks for rotate, zoom, focus, and path highlight.

## Cross-cutting dependencies

### Data access helpers

Before the semantic chart builders, add or centralize helpers for:

- all person events.
- all family events.
- all person facts.
- associate relations by person/family.
- labels/groups by person/family.
- normalized date/year extraction.
- normalized place extraction.

Candidate location:

- `src/lib/chartData/recordQueries.js`

### Config UI

Avoid placing every chart option in `ChartsApp.jsx`. It is already large.

Suggested components:

- `src/components/charts/options/RelationshipOptions.jsx`
- `src/components/charts/options/PageExportOptions.jsx`
- `src/components/charts/options/TimelineOptions.jsx`
- `src/components/charts/options/DistributionOptions.jsx`
- `src/components/charts/options/GenogramOptions.jsx`
- `src/components/charts/options/SociogramOptions.jsx`
- `src/components/charts/options/VirtualTreeOptions.jsx`

### Migration policy

All existing chart documents and templates should still load.

Rules:

- Treat missing `schemaVersion` as version 1.
- Preserve unknown fields.
- Keep the old `generations`, `virtual`, `page`, and `overlays` fields readable until all callers move to version 2.
- When saving, write version 2 but include compatibility fields if cheap.

## Starting checklist

Use this as the first implementation run:

1. Add `findRelationshipPaths()` with tests.
2. Update relationship chart state to support bloodline-only and selected path.
3. Add relationship options UI.
4. Add `schemaVersion: 2` chart document migration helpers.
5. Persist relationship settings under `builderConfig.relationship`.
6. Add page/export settings containers with no broad UI changes yet.

After that, the next clean slice is timeline aggregation builder work because the reports module already has event/fact query patterns that can be reused.
