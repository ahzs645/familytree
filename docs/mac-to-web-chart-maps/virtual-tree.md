# Interactive / Virtual Tree map

## Mac evidence
- `showVirtualTreeChart:` selector and `InteractiveTreePane.nib` references are explicit.
- `VirtualTreeDiagramPane` and `VirtualTreeDiagramPane_Navigation` indicate a dedicated pane with controls for rotation/zoom/nav.
- Native flow sits under chart function pane and shares chart builder/compositor pipeline.

## Web implementation today
- Switch entry: `id: 'virtual'`.
- Render path: `VirtualTreeDiagram` + options sidebar in `ChartsApp.jsx`.
- Layout: `layoutVirtualTree` in `src/components/charts/layouts/virtualTreeLayout.js` and tree conversion helpers.
- Persisted virtual settings currently tracked in document state (`virtual.source`, `virtual.orientation`, `virtual.hSpacing`, `virtual.vSpacing`).

## Mac ⇄ web mapping
- `showVirtualTreeChart:` -> `chartType === 'virtual'` with source/orientation options.
- Current virtual settings already align better than several other modes, but import side still drops compositor style/state.

## Parity focus
- Expand virtual-tree settings to restore native equivalents (if any) from container payload: page-like metadata, background/path style, labels/spacing presets.
- Replace manual button controls with structured navigation/rotation controls if native `VirtualTreeDiagramPane_Navigation` keys are reintroduced.
- Ensure virtual tree participates in share/read-only/edit lifecycle and realign commands.
