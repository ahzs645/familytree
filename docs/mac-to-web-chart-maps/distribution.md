# Distribution chart map

## Mac evidence
- Not observed in extracted Mac chart-pane labels or string selectors.

## Web implementation today
- Switch entry: `id: 'distribution'`.
- Data source: full persons list from `listAllPersons` currently in `ChartsApp` state.
- Render path: `DistributionChart` in `src/components/charts/SpecializedCharts.jsx`.

## Mac ⇄ web mapping
- No native evidence -> likely not in Mac parity scope by current extraction.
- If it exists under different naming (`distribution`/`demographic`), we need a second extraction pass against nib names.

## Parity focus
- Keep this chart as web-only unless native equivalent is confirmed.
- If kept, ensure import/export/document save includes `chartType: 'distribution'` and any generated chart options.
