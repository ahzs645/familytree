# Timeline chart map

## Mac evidence
- No explicit timeline chart label appears in extracted strings/selectors.

## Web implementation today
- Switch entry: `id: 'timeline'`.
- Data source: both `buildAncestorTree` and `buildDescendantTree` merged in `TimelineChart`.
- Render path: `TimelineChart` in `src/components/charts/SpecializedCharts.jsx`.

## Mac ⇄ web mapping
- No direct native proof in the current extraction file.
- Current web implementation should be treated as an advanced chart visualization not yet represented in current Mac chart map.

## Parity focus
- Confirm native timeline equivalence before allocating native-style schema mapping.
- Preserve generic editor/export parity (read-only prompts, shared save flows) so any non-native charts still respect app-wide behavior.
