# Sociogram chart map

## Mac evidence
- Native chart name is exposed as `SociogramChartPane`, `_FunctionTitle_SociogramChartPaneName`, `SociogramChartMaskIcon`, and `SociogramChart`.
- Core builder symbols include `SociogramChartBuilder`, `SociogramChartBuilderConfiguration`, `SociogramPersonChartBuilderItem`, and `SociogramAssociatedPersonChartBuilderItem`.
- Core config keys include `_SociogramChartBuilderConfiguration_ShowParents`, `_ShowGrandparents`, `_ShowPartners`, `_ShowChildren`, `_ShowAssociateRelationsOfStartPerson`, `_ShowAssociateRelationsOfPartners`, `_ShowAssociateRelationsOfChildren`, and `_AssociatedPersonsSpacing`.

## Web implementation today
- Switch entry: `id: 'sociogram'`.
- Render path: `GenogramChart` with `sociogram` flag enabled in `ChartsApp.jsx`.
- Uses the same descendant source as genogram and applies dashed/colored connector styling.

## Mac ⇄ web mapping
- Mac `SociogramChartBuilder` -> web `chartType === 'sociogram'`.
- Mac `SociogramAssociatedPersonChartBuilderItem` -> web currently has no associated/influential person item model.
- Mac neighborhood toggles -> web currently hard-codes a descendant-source view.

## Parity focus
- Build a true social-neighborhood source: parents, grandparents, partners, children, and associate relations behind separate toggles.
- Add associated/influential person spacing and item styling to chart document state.
- Import/preserve sociogram builder/class hints from Mac saved-chart payloads when available.
