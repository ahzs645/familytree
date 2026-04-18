# Implementation Task List — Publish

## Objective
Align publish workflows with desktop behavior (websites, book publishing, and import/export depth).

## Implement now

### 1) Add missing publish surfaces (high priority)
- [x] Add `/websites` route (`src/routes/Websites.jsx`) for static site configuration and generation.
- [x] Add `/publish` or `/books/publish` action group for explicit publish orchestration.
- [x] Keep current `/export` for data transfer (GEDCOM/backup) and add explicit cross-linking to new publish pages.

Acceptance:
- “Publish” and “websites” are discoverable without hunting in Home cards.

### 2) Extend static site export
- [x] In `src/lib/websiteExport.js`:
  - add output templates for custom theme/branding,
  - include source links and relationships from stories/places/media,
  - optionally include private/public split + filtering,
  - include progress and failure messaging in UI.
- [x] Add optional asset bundle for media thumbnails in zip output.

Acceptance:
- Exported zip contains valid index + entity pages and no unresolved links for included records.

### 3) Family Tree Book as publishable artifact
- [x] Expand `src/lib/books.js` section kinds:
  - allow cover page metadata, TOC style, narrative/report section presets,
  - support family/group/sources inserts.
- [x] Add web-safe preview export options (plain HTML + PDF) in `/books`.
- [x] Add “Publish as website/book bundle” action in `src/routes/Books.jsx`.

Acceptance:
- Book content can be compiled and exported as a distributable artifact.

### 4) Publish workflow reliability
- [x] Add validation before `downloadSite`:
  - missing records,
  - zero-person trees,
  - privacy conflicts.
- [x] Add progress state, cancellation where heavy work exists, and completed status summary.

Acceptance:
- User can see concrete success/failure and count of exported entities.

### 5) Merge/import edge cases
- [x] In `src/routes/Export.jsx`, preserve current import behavior but add:
  - conflict summary preview for GEDCOM/backup merges,
  - optional rollback notes saved in changelog metadata.

Acceptance:
- Import/merge actions show impact before commit and can be repeated safely.
