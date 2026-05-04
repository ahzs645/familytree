# Interactive Tree Parity Notes

Reference bundle inspected:

`/Users/ahmadjalil/Downloads/family tree/app/MacFamilyTree 11/Contents`

## What The Mac App Uses

The app shell links against `MacFamilyTreeCore.framework` and delegates the tree renderer to compiled Objective-C/Swift-era classes:

- `InteractiveTreeView`
- `InteractiveTreeView3DViewer`
- `InteractiveTreeViewFlatViewer`
- `InteractiveTreeViewTreeBuilder`
- `InteractiveTreeView3DViewerConfiguration`

The 3D viewer is SceneKit-backed. The main binary links `SceneKit.framework`, and the core framework contains `SCNScene`, `SCNNode`, `SCNCamera`, camera mode, lighting mode, zoom, generation band, and model-loading symbols.

Relevant model-loading symbols found in `MacFamilyTreeCore`:

- `cachedFlattenedGeometryFromSceneName:andReturnSize:`
- `loadSceneWithNameAndGetRootNode:`
- `warmupModelLoadingFromBackgroundThread`
- `InteractiveTreeView3DViewerPersonObject(Body)`
- `InteractiveTreeView3DViewerGenerationBandObject`
- `InteractiveTreeView3DViewerFamilyConnectionObject`

The reference bundle ships actual person model assets under:

`Contents/Frameworks/MacFamilyTreeCore.framework/Versions/A/Resources`

The web renderer now syncs and loads these Collada models from `public/mft-models/`:

- `InteractiveTreePersonMale*.dae`
- `InteractiveTreePersonFemale*.dae`
- `InteractiveTreePersonUnknown*.dae`

The `*` variants match the Mac viewer style modes discovered in strings:

- Simplified
- Cartoon
- Gender
- Flat

The same string/symbol sweep also exposed camera and lighting modes. The web renderer now exposes comparable controls for style, camera, and lighting.

## Why The Previous Web Tree Diverged

Before this parity pass, `src/components/interactive/ThreeDTreeView.jsx` rendered procedural Three.js shapes for people. That made the tree functional, but it did not use the Mac app's bundled 3D person assets or its viewer configuration model.

The tree data was already broader than a strict ancestor chart through `buildInteractiveFamilyGraph`, but the rendering layer was still approximate:

- Generated person meshes instead of reference Collada assets.
- A single fixed camera pose instead of Mac-style camera modes.
- A single lighting setup instead of Mac-style lighting modes.
- Procedural connector tubes instead of the full family connection objects from `MacFamilyTreeCore`.

## Current Web Implementation

Main files:

- `src/components/interactive/InteractiveTreeApp.jsx`
- `src/components/interactive/ThreeDTreeView.jsx`
- `src/lib/treeQuery.js`
- `scripts/sync-mft-model-assets.mjs`

Current parity behavior:

- Loads MacFamilyTree person `.dae` assets through `ColladaLoader`.
- Orients the Mac `Y_UP` Collada models onto the web tree's `XY` ground plane with positive X rotation, then normalizes each clone so its base sits on the band/card surface.
- Merges close reference-model vertices, recomputes smooth normals, and renders materials double-sided so heads and extruded bodies do not appear faceted or partially missing at tilted camera angles.
- Falls back to procedural meshes if assets are unavailable.
- Supports person style, camera mode, lighting mode, floor mode, and generation band style controls.
- Persists viewer options plus camera zoom, position, and target per camera mode.
- Preserves manual pan/zoom while models finish loading, hover state changes, or visual style controls change.
- Shows a Mac-like hover card and person context menu directly on 3D nodes with focus, info, edit, select-family, ancestor chart, and descendant chart actions.
- Marks rendered people that have additional parent/child-family branches outside the current interactive-tree depth.
- Loads the MacFamilyTree FamilySearch-specific person `.dae` assets for FamilySearch-linked people, and adds duplicate-risk status badges when imported data exposes those states.
- Renders family links as flat rounded ribbons with soft shadows and caps, closer to the native family connection objects than the earlier cylinder tubes.
- Keeps pan, zoom, fit-to-view, person picking, generation bands, and family graph layout.
- Syncs reference model assets with `npm run sync:mft-models`.

## Remaining Gaps

The following are still not full parity:

- Exact SceneKit camera physics and momentum/gesture tuning.
- Complete Mac app action menu coverage; the web viewer now has first-pass node hover and right-click actions, but not every native command.
- Exact `InteractiveTreeView3DViewerFamilyConnectionObject` geometry; the web renderer now uses flat rounded ribbons, shadows, and caps, but the native SceneKit object is still only approximated.
- Complete further-person, duplicate, and FamilySearch overlays; the web viewer now marks hidden parent/child-family branches, uses the bundled FamilySearch person models, and shows basic duplicate-risk status, but does not yet mirror every native overlay state.
- Mac generation band styles beyond the current raised/flat/pedestal approximations.
- Full material behavior from SceneKit, including the reference renderer's flattening pipeline; the web renderer now preserves bundled FamilySearch model materials while smoothing and retinting standard body materials for gender parity.
