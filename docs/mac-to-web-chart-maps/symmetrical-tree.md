# Symmetrical Tree chart map

## Mac evidence
- Symmetrical view is not directly named in extracted chart key list.
- Likely derives from `Tree` plus alternate layout treatment.

## Web implementation today
- Switch entry: `id: 'symmetrical'` in `CHART_TYPES`.
- Render path: `TreeChart` with `variant='symmetrical'` (`src/components/charts/TreeChart.jsx`).
- Layout uses `layoutAncestorsUpward` + `layoutDescendants`.

## Mac ⇄ web mapping
- No explicit native selector in extraction, so this is currently a web-only variant until further decomp confirms native parity.
- Uses existing tree compositor pipeline and overlays.

## Parity focus
- Keep symmetrical behavior stable and map generic native compositor style fields into this layout where possible.
- Add schema-safe `chartType` restore so imports/dumps from web round-trip consistently.
- Add specialized action labels/messages if native style docs are found in a future extraction pass.
