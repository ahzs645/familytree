# GitHub repo swarm research

Date: 2026-04-27

Purpose: identify open-source genealogy projects whose ideas, patterns, or license-compatible code could improve this web app.

## License posture

Treat copyleft repositories as design references unless this project deliberately adopts compatible licensing. Direct code adaptation is safest from permissive projects such as MIT, ISC, Apache-2.0, or project-authored code.

Copyleft reference-only candidates found in this pass:

- `gramps-project/gramps` — GPL-2.0
- `fisharebest/webtrees` — GPL-3.0
- `gramps-project/gramps-web` — AGPL-3.0
- `Serg-Norseman/GEDKeeper` — GPL-3.0
- `geneweb/geneweb` — GPL-2.0
- `CCGE-BOADICEA/pedigreejs` — GPL-3.0-or-later

## Highest-value candidates

| Priority | Repo | License | What to bring over |
| --- | --- | --- | --- |
| 1 | `arbre-app/read-gedcom` | MIT | GEDCOM decoding/parsing architecture: tokenizer, structurer, ANSEL/MacRoman/UTF-16 handling, conformance tests. |
| 2 | `FamilySearch/GEDCOM` | Apache-2.0 | Authoritative GEDCOM 7 grammar, version detection, GedZip rules, validation expectations. |
| 3 | `FamilySearch/gedcom5-java` | Apache-2.0 | Round-trip import/export test strategy, reference integrity checks, extension preservation. |
| 4 | `FamilySearch/gedcomx` | Apache-2.0 | Clean source/evidence/conclusion model with confidence, attribution, agents, and contributor metadata. |
| 5 | `donatso/family-chart` | MIT | Interactive chart UX: zoom-to-person, branch trim/expand, editable card rendering, sort hooks. |
| 6 | `PeWu/topola` / `PeWu/topola-viewer` | Apache-2.0 | Relatives chart mode, GEDCOM viewer patterns, multilingual search index, upload/URL/GedZip loading. |
| 7 | `oh-kay-blanket/family-plot` | ISC | 3D graph interactions: birth-year timeline axis, surname filters, relationship tracing, selected-person camera focus. |
| 8 | `mattprusak/autoresearch-genealogy` | MIT | Research workspace templates: open questions, source audit, confidence tiers, timeline gaps, session log. |
| 9 | `tmcw/gedcom` | ISC | Small AST/UNIST-style GEDCOM parser shape, DOT/D3 export tests. |
| 10 | `elliotchance/gedcom` | MIT | Validation warning catalog ideas: age/date inconsistencies, child-before-parent, unresolved links, diff/merge CLI patterns. |

## Bring-over backlog

### 1. GEDCOM import/export hardening

Source references:

- `arbre-app/read-gedcom`
- `FamilySearch/GEDCOM`
- `FamilySearch/gedcom5-java`
- `tmcw/gedcom`
- `elliotchance/gedcom`
- `fisharebest/webtrees` as reference only
- `gramps-project/gramps` as reference only

Actions:

- Split GEDCOM import into explicit phases: byte decode, line tokenize, level structure, cross-reference index, local-record mapping.
- Replace partial encoding fallbacks with tested ANSEL, MacRoman, CP1252, UTF-8, UTF-16LE, and UTF-16BE coverage.
- Add a normalized round-trip harness: import fixture, export GEDCOM, parse exported GEDCOM, compare facts, references, source links, media, and custom tags.
- Preserve unknown/custom GEDCOM payloads on records and re-emit them during export to avoid data loss.
- Add import review warnings before commit: unresolved refs, mismatched family links, invalid dates, unknown tags, media path misses, and duplicate XREFs.

Likely local targets:

- `src/lib/genealogyFileFormats.js`
- `src/lib/gedcomImport.js`
- `src/lib/gedcomExport.js`
- `src/components/GedcomImportReviewSheet.jsx`
- `src/lib/parityValidation.js`

### 2. Plausibility and repairable validation

Source references:

- `gramps-project/gramps` as reference only
- `geneweb/geneweb` as reference only
- `Serg-Norseman/GEDKeeper` as reference only
- `elliotchance/gedcom`

Actions:

- Upgrade plausibility checks from simple year checks to rule objects with severity, affected record refs, explanation, and optional repair metadata.
- Add event-order checks for birth/christening/marriage/divorce/death/burial and family event order.
- Add ancestor-loop, duplicate-family, child-before-parent, spouse inverse mismatch, witness-before-birth, and witness-after-death checks.
- Surface repairable issues in Maintenance and Plausibility, not just read-only reports.

Likely local targets:

- `src/lib/plausibility.js`
- `src/routes/Plausibility.jsx`
- `src/routes/PlausibilityList.jsx`
- `src/routes/Maintenance.jsx`
- `src/lib/maintenance.js`

### 3. Duplicates and merge workflow depth

Source references:

- `fisharebest/webtrees` as reference only
- `gramps-project/gramps` as reference only
- `geneweb/geneweb` as reference only
- `Serg-Norseman/GEDKeeper` as reference only

Actions:

- Add same-type enforcement and merge compatibility scoring.
- Add skip/exclusion persistence for known non-duplicates.
- Add side-by-side field conflict preview with merge-left, merge-right, and field-level choices.
- Run pre-merge loop and relationship-safety checks before committing.
- Reuse the same conflict UI for import/merge-another-tree workflows.

Likely local targets:

- `src/components/duplicates/DuplicatesApp.jsx`
- `src/components/duplicates/MergePair.jsx`
- `src/lib/duplicates.js`
- `src/lib/mergeImport.js`
- `src/components/MergeConflictSheet.jsx`

### 4. Citation, source, and evidence model

Source references:

- `FamilySearch/gedcomx`
- `gramps-project/gramps` as reference only
- `gramps-project/gramps-web` as reference only
- `fisharebest/webtrees` as reference only

Actions:

- Keep current formatted citation output, but enrich citation instances with source, page/where-within-source, transcription/excerpt, confidence, privacy, media, notes, attribution, and contributor.
- Add bibliography de-dupe modes for reports/books.
- Add source-evidence-conclusion concepts where useful without forcing a full GEDCOM X rewrite.

Likely local targets:

- `src/lib/citationFormat.js`
- `src/lib/sourceCertainty.js`
- `src/routes/Sources.jsx`
- `src/routes/SourceRepositories.jsx`
- `src/components/editors/RelatedRecordEditors.jsx`
- `src/lib/reports/*`
- `src/lib/books.js`

### 5. Chart UX and visualization

Source references:

- `donatso/family-chart`
- `PeWu/topola`
- `PeWu/topola-viewer`
- `nliautaud/gedcom-svg-fanchart`
- `oh-kay-blanket/family-plot`
- `CCGE-BOADICEA/pedigreejs` as reference only

Actions:

- Add a Topola-style relatives chart: descendants plus ancestors and descendants of ancestors.
- Add branch trim/expand and zoom-to-person actions to chart nodes.
- Add data-driven fan chart color modes with a legend: surname, birth place, death place, occupation, century, source quality, or custom field.
- Add optional pedigree-symbol style: square/circle/diamond nodes, deceased marker, twin/adoption/foster line styles.
- Add 3D virtual-tree filters and controls: surname highlighting, birth-year axis, selected-person camera focus, trace ancestors/descendants/spouses.

Likely local targets:

- `src/components/charts/ChartsApp.jsx`
- `src/components/charts/ChartCanvas.jsx`
- `src/components/charts/PersonNode.jsx`
- `src/components/charts/FanChart.jsx`
- `src/components/charts/layouts/fanLayout.js`
- `src/components/charts/VirtualTree3D.jsx`
- `src/lib/chartData/*`

### 6. Search and multilingual indexing

Source references:

- `PeWu/topola-viewer`
- `fisharebest/webtrees` as reference only

Actions:

- Add an optional lightweight search index for large trees, with boosted fields for person name, normalized name, alternate names, spouse surname, place, and record id.
- Extend current Arabic normalization with accent-folding and language-aware collation/search behavior for more scripts.
- Keep trimmer/tokenization safe for non-Latin names.

Likely local targets:

- `src/lib/search.js`
- `src/lib/i18n.js`
- `src/components/search/SearchApp.jsx`
- `src/routes/Search.jsx`

### 7. Research workspace

Source references:

- `mattprusak/autoresearch-genealogy`
- `Serg-Norseman/GEDKeeper` as reference only
- `gramps-project/gramps-web` as reference only

Actions:

- Expand research items into open questions, hypotheses, source-audit checklist, confidence tier, timeline-gap view, linked ToDos, and session log.
- Add source hierarchy and confidence tier metadata.
- Let generated suggestions become durable research questions with status and linked evidence.

Likely local targets:

- `src/routes/Research.jsx`
- `src/lib/researchSuggestions.js`
- `src/routes/ToDos.jsx`
- `src/components/ToDoWizardSheet.jsx`

### 8. Privacy policy engine

Source references:

- `fisharebest/webtrees` as reference only
- `gramps-project/gramps` as reference only

Actions:

- Centralize privacy decisions across GEDCOM export, website publish, reports, books, charts, and UI views.
- Combine explicit private flags, living-person inference, tag/fact-level restrictions, source/media privacy, and export profile options.

Likely local targets:

- `src/lib/privacy.js`
- `src/lib/gedcomExport.js`
- `src/lib/websiteExport.js`
- `src/lib/reports/*`
- `src/lib/books.js`

## Suggested implementation order

1. GEDCOM parser/encoding test harness, because it protects interchange and import quality.
2. Validation issue model, because plausibility, import review, maintenance, and merge safety can share it.
3. Duplicate/merge conflict UI, because it is already a known local parity gap.
4. Citation model enrichment, because reports/books/export quality depends on it.
5. Chart UX improvements, starting with low-risk node interactions and fan color modes.
6. Research workspace, because it builds on source/citation confidence and ToDos.
7. Privacy policy engine, once export/report surfaces are stable enough to enforce consistently.

