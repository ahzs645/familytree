# Fractal Tree chart map

## Mac evidence
- Not present in chart pane key list.

## Web implementation today
- Switch entry: `id: 'fractal-tree'`.
- Render path: `FractalAncestorChart` variant `'fractal'`.

## Mac ⇄ web mapping
- No direct native selector evidence.
- Current implementation can reuse theme/layout defaults and exported metadata.

## Parity focus
- Keep as optional web-only until extraction confirms native equivalent.
- Maintain `chartType` and variant restoration in `chartTemplates`/`chartDocuments`.
