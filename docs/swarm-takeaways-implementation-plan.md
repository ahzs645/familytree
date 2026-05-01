# Swarm takeaways implementation plan

Date: 2026-04-28

This plan turns the GitHub swarm research into implementation slices for this repo. The order favors shared infrastructure before UI polish.

## Phase 1: GEDCOM diagnostics and round-trip fidelity

Status: implemented initial slice.

Goals:

- Add a tokenization/diagnostic layer with line numbers before record mapping.
- Report malformed lines, level jumps, orphan `CONT`/`CONC`, duplicate XREFs, unresolved pointers, custom tags, continuation counts, and media reference counts.
- Preserve multiline text during import and export using GEDCOM `CONT`/`CONC` rather than flattening notes.
- Add round-trip tests for text, structural diagnostics, xrefs, and export formatting.

Initial local targets:

- `src/lib/gedcomImport.js`
- `src/lib/gedcomExport.js`
- `src/components/GedcomImportReviewSheet.jsx`
- `src/lib/gedcomImport.test.js`
- `src/lib/gedcomExport.test.js`

Next slices:

- Add fixture-based import/export round-trip comparisons.
- Extend preserved extension export to more record types if needed.
- Add deeper warning categories for GEDCOM version, `CHAR`, and vendor-specific tag families.

## Phase 2: Citation and evidence model

Status: implemented initial SourceRelation evidence fields.

Goals:

- Make event-level citations first-class instead of treating source links as secondary metadata.
- Track page/where-within-source, transcription/excerpt, confidence, repository chain, media, attribution, and contributor.
- Reuse citation data in reports, books, GEDCOM export, and website publish.

Likely local targets:

- `src/components/editors/RelatedRecordEditors.jsx`
- `src/routes/Sources.jsx`
- `src/routes/SourceRepositories.jsx`
- `src/lib/citationFormat.js`
- `src/lib/sourceCertainty.js`
- `src/lib/reports/*`
- `src/lib/books.js`

## Phase 3: Offline search index

Status: implemented in-memory token-index foundation used by `runSearch`.

Goals:

- Move large-tree search away from broad `limit: 100000` queries plus in-memory filtering.
- Build a materialized client-side index for names, alternate names, events, notes, source text, citations, places, media captions, stories, and todos.
- Share the index with Search, Smart Filters, duplicate detection, reports, validation, and chart person pickers.

Likely local targets:

- `src/lib/search.js`
- `src/lib/LocalDatabase.js`
- `src/components/search/SearchApp.jsx`
- `src/routes/Search.jsx`
- `src/components/charts/PersonPicker.jsx`

## Phase 4: Chart interaction depth

Status: implemented URL-stable chart focus params and configurable click action.

Goals:

- Improve exploration rather than adding more chart types.
- Add URL-stable focused person/chart state, focus-on-click, animated re-rooting, hide/show branch controls, relatives/neighborhood mode, and a minimap or page-map for huge trees.

Likely local targets:

- `src/components/charts/ChartsApp.jsx`
- `src/components/charts/*`
- `src/routes/ChartPreview.jsx`
- `src/lib/chartData/*`

## Phase 5: Smaller high-value UX wins

Status: implemented QR chart share, Home anniversary cards, privacy profile helper, and link-existing-relative UI.

Goals:

- Person life timeline combining facts, events, notes, media, sources, stories, and research state.
- In-context add/link-relative modal from a person or tree node.
- Privacy profiles shared by export, publish, share, reports, books, charts, and search.
- QR code panel for chart preview links.
- Upcoming birthdays/anniversaries widget on Home.

Likely local targets:

- `src/routes/PersonEditor.jsx`
- `src/lib/personContext.js`
- `src/routes/Tree.jsx`
- `src/routes/Home.jsx`
- `src/routes/AnniversaryList.jsx`
- `src/lib/privacy.js`
- `src/lib/chartShareLink.js`
- `src/routes/ChartPreview.jsx`
