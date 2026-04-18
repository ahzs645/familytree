# Implementation Task List — Reports

## Objective
Close report parity gaps and improve report workflow reliability.

## Implement now

### 1) Add missing report builders (high priority)
- [x] In `src/lib/reports/builders.js`, add:
  - `buildPersonEventsReport(recordName)`
    - subject = selected person
    - rows from `PersonEvent` + `FamilyEvent` linked to person where needed
    - include type/date/place/description and relation context.
  - `buildStoryReport(recordName)`
    - subject = selected story
    - include metadata, story sections, relations to persons/families/events/media.
  - `buildKinshipReport(recordA, recordB)`
    - use `src/lib/relationshipPath.js` to produce path + labels.
- [x] Export the new builders from `builders.js`.

### 2) Wire new builders into report UI
- [x] Register new report IDs/labels in `src/components/reports/ReportsApp.jsx`.
- [x] Extend builder config to support:
  - two-person selection for Kinship.
  - custom subject label for person-events and story reports.
- [x] Ensure saved report schema includes second subject + report-specific options.

Acceptance:
- New reports appear in drop-down and can be generated without errors.

### 3) Add report quality and layout improvements
- [x] Add `needsSecondSubject`, `includeHeader`, and `defaultOptions` handling in report config object.
- [x] Preserve full generation state during long builds via loading state and cancel-safe fetch path.
- [x] Normalize column order/empty placeholders across all list/report tables.

Acceptance:
- Report output is stable for both empty and populated datasets.
- Saving/loading a report restores all selected options.

### 4) Cover behavior with tests
- [x] Add builder-level tests in `src/lib/reports/`:
  - person events includes at least one row and expected columns,
  - story report returns section text and relations,
  - kinship report handles same-person and no-path cases.
- [x] Add/update `npm` test baseline for `src/components/reports/ReportsApp` interactions.

Acceptance:
- New tests green in CI/local `npm test`.

### 5) Documentation
- [x] Update `docs/web-ui-interface-notes.md` section with implemented status after completion.
- [x] Add per-report usage notes in reports route header/help text.
