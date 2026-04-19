# Circular chart map

## Mac evidence
- Not explicitly listed in the extracted chart button strings or selector list in the decompile notes.

## Web implementation today
- Switch entry: `id: 'circular'`.
- Render path: `CircularAncestorChart` in `src/components/charts/SpecializedCharts.jsx`.
- Layout function: circular fan-like layout in the same file (uses `layoutAncestors` source + circle math).

## Mac ⇄ web mapping
- No direct native chart-name evidence in `mac_chart_decompile_extraction.md`, so parity is currently speculative.
- Web should treat this as a specialized presentation variant; align with any generic chart compositor payload if available.

## Parity focus
- Validate whether native has a direct circular equivalent before implementing deep payload mapping.
- If not present, keep it as a web-only variant and gate optional migration from imported `arcDegrees`/layout metadata.
- Still include generic chart parity: edit lifecycle, share/export, and realign commands.
