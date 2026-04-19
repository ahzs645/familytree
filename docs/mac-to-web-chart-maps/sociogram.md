# Sociogram chart map

## Mac evidence
- No explicit `sociogram` key appears in extracted chart panes.

## Web implementation today
- Switch entry: `id: 'sociogram'`.
- Render path: `GenogramChart` with `sociogram` flag enabled in `ChartsApp.jsx`.
- Uses same source (`descendantTree`) as genogram.

## Mac ⇄ web mapping
- No native anchor currently in extraction; currently implemented as a web variant of genogram style.
- Style is currently a hard-coded overlay of color/dash, not payload-driven.

## Parity focus
- If native equivalent is added in future extract, map to new style fields (`sociogram` colors/edge style/dash rules).
- In web-only mode, keep consistent exporter/session behavior with other chart types.
