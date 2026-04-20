# Interactive / Virtual Tree map

## Mac evidence
- `Interactive Tree` and `Virtual Tree` are separate Mac surfaces.
- Interactive Tree evidence includes `InteractiveTreePane`, `InteractiveTreeView`, `InteractiveTreeViewTreeBuilder`, `InteractiveTreeViewFlatViewer`, `InteractiveTreeView3DViewer`, and `interactiveTreeClicked:`.
- Virtual Tree evidence includes `showVirtualTreeChart:`, `VirtualTreeDiagramPane`, `VirtualTreeView`, `VirtualTreeBuilder`, `VirtualTreeConfiguration`, `VirtualTreeMetalRenderer`, `VirtualTreePersonObject`, `VirtualTreeFamilyObject`, `VirtualTreeConnectionObject`, and Metal draw/compute encoder classes.
- `VirtualTreeDiagramPane_Navigation.nib` wires `rotationTrackingView` and `zoomTrackingView` to `trackingViewDelegate`.
- `CoreVirtualTree.strings` exposes collect modes, relationship path controls, person/family symbols, color modes, connection colors/widths, depth of field, shadows, light/dark appearance, and AR controls.

## Web implementation today
- Switch entry: `id: 'virtual'`.
- Render path: `VirtualTreeDiagram` plus options sidebar in `ChartsApp.jsx`.
- Layout: `layoutVirtualTree` in `src/components/charts/layouts/virtualTreeLayout.js` and tree conversion helpers.
- Persisted virtual settings currently track `virtual.source`, `virtual.orientation`, `virtual.hSpacing`, and `virtual.vSpacing`.
- Separate interactive tree route exists at `/tree`, with `InteractiveTreeApp.jsx` and `ThreeDTreeView.jsx` using Three.js and `OrbitControls`.

## Mac ⇄ web mapping
- Mac `showVirtualTreeChart:` -> web `chartType === 'virtual'`.
- Mac `VirtualTreeBuilder` -> web `layoutVirtualTree`, but the web renderer is still SVG/configurable hierarchy rather than Metal/3D.
- Mac `VirtualTreeMetalRenderer` and encoder classes -> closest web target is a future Three.js/WebGL virtual tree, not the current `ChartCanvas` static chart renderer.
- Mac relationship-path highlighting -> not yet represented in web virtual-tree state.

## Parity focus
- Decide whether `/charts?type=virtual` remains a 2D configurable hierarchy or becomes a Three.js virtual-tree view.
- Add collect mode, symbol mode, color mode, connection style, relationship-path display, and navigation state to the persisted virtual config.
- If implementing full parity, reuse the existing Three.js route patterns from `ThreeDTreeView.jsx` rather than extending the SVG chart renderer.
