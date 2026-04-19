# Relationship Path chart map

## Mac evidence
- Relationship path/build symbols are present (`Relationship`, relationship pane strings, relationship path controller hints).
- `findRelationshipPathsController` / `createRelationshipChart:` style symbols imply a dedicated relationship builder path.
- UI strings include flow labels for relationship workflows.

## Web implementation today
- Switch entry: `id: 'relationship'` with `needsSecond: true`.
- Data source: `findRelationshipPath(rootId, secondId)` in `src/lib/relationshipPath.js`.
- Render path: `RelationshipPathChart.jsx`.
- No direct native-equivalent options UI for relationship search toggles in current web UI.

## Mac ⇄ web mapping
- `showRelationship`-style behavior maps to `chartType === 'relationship'` and two-person requirement.
- Mac extraction mentions configurable relationship/pick constraints (`Only Traverse Bloodlines` found in saved UI context for relationship pane), not yet present.

## Parity focus
- Add relationship finder controls: bloodlines-only, path constraints, source/target helper presets if payload includes them.
- Add friendly error/state copy matching Mac messages (`Please select ...`, multiple types, no connection, save prompt) from extraction strings.
- Keep imported relationship result metadata on document load/save instead of recomputing only from current DB state.
