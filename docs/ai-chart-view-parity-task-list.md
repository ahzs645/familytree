# AI task list: MacFamilyTree chart and view parity

This is the implementation queue for moving the web app from isolated feature fixes to a MacFamilyTree-style chart/view architecture.

## Original app reference

Use these local MacFamilyTree 11 bundle references as the source of truth:

- App bundle contents: `/Users/ahmadjalil/Downloads/family tree/app/MacFamilyTree 11/Contents`
- Chart extraction note: `/Users/ahmadjalil/Downloads/family tree/app/MacFamilyTree 11/Contents/Resources/mac_chart_decompile_extraction.md`
- Main web repo: `/Users/ahmadjalil/github/familytree`
- Chart parity audit: `docs/mac-to-web-chart-parity-audit.md`
- Chart implementation research: `docs/mac-to-web-chart-implementation-research.md`

When researching the original app, prefer concrete bundle evidence:

- `*.strings` keys for options and user-facing modes.
- `*.nib`/`*.xib` connections through `ibtool --connections`.
- `strings` output from `MacFamilyTreeCore.framework` and the main executable for class/selector names.
- Saved chart payload fields such as `chartObjectsContainerData`.
- Localized resources under `Contents/Resources/en.lproj`.

Do not treat the Mac app as a public API. Use it as design and behavior evidence, then implement browser-safe equivalents.

## 0. Completed baseline

- [x] Bundle-backed chart evidence extracted.
- [x] Per-chart map docs created/updated.
- [x] Chart parity audit created.
- [x] Relationship path parity started and implemented:
  - multiple paths
  - bloodline-only toggle
  - selected path state
  - reset
  - relationship-path tests

## 1. Chart Document Schema V2

- [ ] Add a versioned chart document schema normalizer.
- [ ] Persist `schemaVersion: 2`.
- [ ] Add `roots.primaryPersonId` and `roots.secondaryPersonId`.
- [ ] Add `builderConfig`:
  - common generation/privacy settings
  - relationship options
  - virtual tree options
  - empty per-chart option slots for ancestor, descendant, fan, hourglass, genogram, sociogram, timeline, distribution, statistics
- [ ] Add `compositorConfig`:
  - theme
  - layout mode
  - object styles
  - connection styles
  - overlays
  - selected object IDs
- [ ] Add richer `pageSetup`:
  - paper size
  - orientation
  - custom width/height
  - margins
  - overlap
  - print page numbers
  - cut marks
  - omit empty pages
  - title/note/background
- [ ] Add `exportSettings`:
  - format
  - scale
  - include background
  - JPEG quality
  - file name template
- [ ] Preserve imported Mac metadata in `importedMac`.
- [ ] Migrate old shallow documents while preserving legacy fields for compatibility.
- [ ] Add schema tests.

## 2. Shared Chart Data Builders

- [ ] Add `src/lib/chartData/recordQueries.js`.
- [ ] Add `timelineBuilder`.
- [ ] Add `distributionBuilder`.
- [ ] Add `statisticsBuilder`.
- [ ] Add `genogramBuilder`.
- [ ] Add `sociogramBuilder`.
- [ ] Add `virtualTreeBuilder`.
- [ ] Read real records:
  - `PersonEvent`
  - `FamilyEvent`
  - `PersonFact`
  - `AssociateRelation`
  - `PersonGroupRelation`
  - `LabelRelation`
  - `Family`
  - `ChildRelation`
  - `Place`
- [ ] Reuse report-builder parsing patterns where possible.

## 3. Page, Export, And Share Parity

- [ ] Move export defaults into `exportSettings`.
- [ ] Add page dimension normalization.
- [ ] Add margin handling.
- [ ] Add page overlap support.
- [ ] Add page number/cut mark rendering for print/PDF.
- [ ] Add omit-empty-pages behavior.
- [ ] Add JPEG export with quality.
- [ ] Add export scale.
- [ ] Add include-background toggle.
- [ ] Add Web Share API flow with download fallback.

## 4. Genogram And Sociogram Parity

- [ ] Replace descendant-layout reuse.
- [ ] Build genogram from family/person/fact/event/label data.
- [ ] Add genogram markers for facts, events, labels, and status.
- [ ] Build sociogram from `AssociateRelation`.
- [ ] Add sociogram toggles for:
  - parents
  - grandparents
  - partners
  - children
  - siblings
  - associate relation classes
- [ ] Style typed graph edges.
- [ ] Add builder tests.

## 5. Interactive Tree Parity

- [ ] Add node context menu.
- [ ] Add add-parent/add-partner/add-child flows.
- [ ] Route edit person/family actions to existing editors.
- [ ] Add safe delete routing after relation cleanup is tested.
- [ ] Add flat viewer mode.
- [ ] Add camera presets:
  - fit all
  - ancestors
  - descendants
  - selected family
  - top/front/isometric
- [ ] Add mutation helper tests.

## 6. Full Virtual Tree WebGL

- [ ] Keep current SVG `VirtualTreeDiagram` as lightweight chart.
- [ ] Add separate Three.js virtual tree scene.
- [ ] Build scene objects:
  - person
  - family
  - connection
  - relationship path
  - generation band
  - symbol
- [ ] Add color modes:
  - generation
  - gender
  - branch
  - relationship path
- [ ] Add relationship path highlighting using relationship-path API.
- [ ] Add depth-of-field/camera controls.
- [ ] Add snapshot/export.
- [ ] Add performance guardrails for large trees.

## 7. Broader Views Audit

- [ ] Scan `/Users/ahmadjalil/Downloads/family tree/app/MacFamilyTree 11/Contents` for non-chart views.
- [ ] Extract view pane strings, NIB connections, and controller selectors.
- [ ] Compare against web routes:
  - `/views`
  - `/lists`
  - `/tree`
  - `/places`
  - `/statistics`
  - `/reports`
  - `/books`
  - `/publish`
  - `/media`
  - `/sources`
  - person editor
  - family editor
- [ ] Produce `docs/mac-to-web-views-parity-audit.md`.
- [ ] Add a second task queue for missing non-chart views.

## Current next action

Start with Chart Document Schema V2. It is the container needed by the remaining chart/view work.
