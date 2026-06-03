# Import UX Notes

## GEDCOM fixtures

The focused import tests use copied GeneWeb `ged2gwb` cram fixtures under
`fixtures/geneweb/ged2gwb-cram/`.

Covered cases:

- `SIMPLE.GED`: baseline GEDCOM 5.5 family import shape.
- `ALLGED.GED`: broad GEDCOM tag/continuation conformance review.
- `LTER*.GED`: CR, LF, CRLF, and LFCR line-ending tokenization.
- `ANSEL.GED`: legacy ANSEL decoding through the `CHAR` tag.
- `ULHCL.GED`, `ULHBOMCL.GED`, `UHLBOMCL.GED`: UTF-16LE explicit decode and UTF-16 BOM decode paths.

## Import option TODOs

GEDCOM encoding and import mode are currently supported as saved defaults via
`importPreferences.js` and the settings UI. The drop-zone importer does not yet
accept per-file override options through `importFromFile()` or
`importFromBytes()`, so the drop zone should not add encoding or strict/review
mode controls until that API is threaded through.

Candidate next step:

- Add an options object to `MFTPKGImporter.importFromFile()` and
  `MFTPKGImporter.importFromBytes()` for `{ gedcomEncoding, gedcomMode }`.
- Pass those options to `_importGedcomBytes()`.
- Add drop-zone controls only after the options affect the active import call.
