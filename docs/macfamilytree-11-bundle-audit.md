# MacFamilyTree 11 Bundle Audit

Source bundle: `/Users/ahmadjalil/Downloads/family tree/app/MacFamilyTree 11.app`

Audit date: 2026-04-18

## Boundary

This audit uses local bundle metadata, `Info.plist`, code-signing entitlements, linked framework names, resource file names, localized string table counts, nib names, and the bundled sample `.mftpkg` package structure. It does not decompile the app binary and does not copy proprietary assets.

CloudTree, iCloud Drive, CloudKit sharing, share invitations, and iCloud conflict handling remain out of scope for the current parity work.

## Bundle Summary

- App version: `11.2.3`, build `112300`.
- Bundle identifier: `com.syniumsoftware.macfamilytree11`.
- Minimum macOS version: `12`.
- App size: about `267M`.
- Frameworks size: about `196M`.
- Resources size: about `62M`.
- Base UI inventory: `228` compiled nibs.
- English localization inventory: `22` string tables with about `859` parsed entries.
- Localized language folders: `cs`, `da`, `de`, `en`, `es`, `fi`, `fr`, `hu`, `it`, `nb`, `nl`, `pl`, `pt`, `ru`, `sv`, plus `Base`.

## Document And File Types

The app declares native ownership/viewer support for:

- `.mftpkg`: MacFamilyTree SQLite package.
- `.mftsql`: MacFamilyTree SQLite file.
- `.mft`: older MacFamilyTree binary file.
- `.ged`: GEDCOM.
- `.uged`: UTF-8 GEDCOM.
- `.uged16`: UTF-16 GEDCOM.
- `.zip`: GedZip.

The current web app already imports `.mftpkg` package drops, inner `database` files, JSON exports, and a GEDCOM subset. The deeper parity gap is format breadth and lifecycle behavior: package round-trip, old binary compatibility where practical, explicit UTF encodings, GedZip, media-folder association, tree create/open/rename/delete flows, and preflight issue handling.

## Native Capabilities

Ignoring CloudKit/iCloud, the bundle requests or links to native capabilities for:

- Contacts and Contacts UI.
- Photos and macOS media library access.
- Camera, microphone, audio/video capture, and AV playback.
- Core Location, MapKit, SceneKit, and a Metal library.
- Image Capture, which matches scanner import UI.
- PDFKit and print entitlement.
- WebKit for embedded web/search panes.
- Disc recording and disc recording UI.
- StoreKit, AuthenticationServices, Synium ID, Synium newsletter, and Synium help.
- User-selected read/write files, app-scoped bookmarks, network client access, and Pictures-folder read-only access.

Browser equivalents are feasible for some of these: file pickers, drag/drop, camera capture, audio recording, media previews, Web Share, print/PDF export, geocoding APIs, and optional Contact Picker where supported. macOS Photos library, scanner integration, disc burning, StoreKit, and app-scoped bookmark behavior need either explicit non-web substitutes or documented limitations.

## Frameworks

Bundled frameworks:

- `MacFamilyTreeCore.framework`
- `SyniumHelp.framework`
- `SyniumID.framework`
- `SyniumNewsletter.framework`

System framework links reinforce these feature areas: CoreData, AVKit/AVFoundation/AVFAudio, Contacts/ContactsUI, Photos/MediaLibrary, CoreLocation/MapKit/SceneKit, WebKit, PDFKit, ImageCaptureCore, DiscRecording/DiscRecordingUI, StoreKit, AuthenticationServices, Security, AppKit, and UniformTypeIdentifiers.

## Resource Model

The root resources include `AppIcon.icns`, `Assets.car`, `Credits.rtf`, `default.metallib`, localizations, Base nibs, and a bundled `Sample Tree.mftpkg`.

The sample package is a useful shape reference:

- Package size: about `35M`.
- `database`: SQLite 3 database, about `4.8M`.
- `resources`: about `30M`, with `184` media files (`103` JPG, `81` PNG).
- `mediathumbs`: one thumbnail payload.
- `metadata`: XML property list.

Sample metadata includes database-level settings such as backup dates, date formats, name format choices, standard template/label/scope setup flags, database version `29`, plus summary counts: `123` persons, `41` families, `3` sources, and `0` ToDos.

The sample database is a CoreData-style SQLite store with `49` tables and `94` entity definitions. Non-iCloud entities visible in the model include people, families, events, facts, notes, media, source relations, labels, scopes, source/place templates, source repositories, place details, research assistant question info, saved books/charts/reports/websites, DNA test result subrecords, FamilySearch match rejection records, and change log entries.

## UI Inventory Signals

The Base nib inventory is the strongest feature map. Approximate name-based clusters:

- FamilySearch: `42`.
- Search-related screens: `49`.
- Preferences: `14`.
- Merge workflow: `13`.
- Books: `12`.
- Places: `14`.
- Sources: `13`.
- Media and capture: `9`.
- Record audio/picture/video/scan sheets: `5`.
- History/change log: `7`.
- Map/MapKit/statistic map workflows: `6`.
- Tree and interactive tree workflows: `15`.
- Charts: `5`.
- Reports: `6`.
- Contacts import/selection: `2`.
- Backups: `2`.
- Subtree export/remove slice workflow: `4`.
- ToDo workflow: `3`.
- Research assistant: `4`.
- Web publishing, FTP, disc burn, and MacFamilyTree.com publishing are also represented.

CloudKit and iCloud nibs are present but intentionally excluded from the current scope.

## Localized Workflow Signals

Top English string tables by parsed entry count:

- `Localizable.strings`: `357`.
- `DatabaseMaintenance.strings`: `83`.
- `FamilySearch.strings`: `79`.
- `WelcomeWindowStrings.strings`: `71`.
- `Edit.strings`: `54`.
- `ChartPanes.strings`: `51`.
- `ReportPanes.strings`: `37`.
- `EditMediaPanes.strings`: `24`.
- `ResearchAssistantPane.strings`: `19`.
- `InteractiveTreePaneStrings.strings`: `14`.

The localized strings confirm these non-iCloud workflows:

- Welcome/document lifecycle: create tree, import GEDCOM, manage backups, open manual/settings, rename/delete/reveal local files, demo/purchase/account surfaces.
- Editing: people, families, events, facts, stories, notes, source citations, labels, ToDos, place details, templates, custom conclusion types, plausibility, timeline, history, and map context.
- FamilySearch: login, overview/statistics, matches, record matches, memories/pictures, sources, discussions, compare, merge, duplicates, ordinances, batch download, change history, and ignored/rejected matches.
- Media: add media, add URL, Apple media library, image editing, scanner import, camera/photo capture, audio/video recording, slideshow, and gallery workflows.
- Places/maps: place lookup, batch lookup, coordinates, GeoName IDs, place-detail conversion, map views, and virtual globe workflows.
- Charts/reports/books: saved charts/reports, chart object editing, page setup, pagination, export/share/print, report style/language/theme, book section builders, and bundle-style outputs.
- Maintenance/import/merge: database cleanup, source/place template management, date/name format repair, duplicate search, empty entry cleanup, GEDCOM issue analysis, GEDCOM media folder selection, tree merge wizard, and subtree export/remove.
- Research: persisted questions, context views, ignore/complete state, object targeting, and assistant options.

## Current App Coverage

Already present or started in this repo:

- `.mftpkg`/SQLite import, including packages and inner `database` files.
- GEDCOM import/export subset.
- Local indexed database and generic record browsing/editing.
- Tree, list, chart, report, book, website, map, globe, media gallery, slideshow, maintenance, templates, labels, ToDo, DNA, repository, plausibility, duplicates, and research routes.
- Static website and book bundle exports.
- Current parity pass added Settings, Author Information, Web Search, Favorites, and a local FamilySearch review surface.

## Remaining Non-iCloud Gaps

Highest-value gaps to track:

- Document lifecycle: package round-trip/export, `.mftsql`, `.mft`, `.uged`, `.uged16`, GedZip, richer GEDCOM issue review, media-folder association, and tree picker/create/rename/delete behavior.
- Media acquisition: file-picker creation of media records, camera capture, audio recording, image crop/rotate/caption/replace, URL capture, and explicit limitations for Photos/scanner/disc burning.
- Contacts import: CSV/vCard importer and optional browser Contact Picker.
- FamilySearch: API-backed login/search/compare/merge/batch download/source/memory/ordinance flows after credentials and terms are confirmed.
- Places/geocoding: lookup, batch coordinate assignment, GeoName ID handling, and convert-to-place-detail.
- Chart editing: saved chart documents, overlay text/images/lines, object selection, alignment/layering, page setup, export/share/print polish, and undo/redo.
- Reports/books: richer report types, report style/theme/page controls, saved report previews, book section builder depth, author metadata in headers, and optional Web Speech narration.
- Website publishing: FTP/SFTP or another deploy target, theme management, publish history, validation logs, and MacFamilyTree.com replacement strategy if desired.
- Database maintenance: custom conclusion type management, date/name format repair, duplicate/empty-entry cleanup, source/place template editors, media optimization, search/replace, and change log integration.
- Research assistant: persisted question generation, completion state, target context, filters, and ToDo creation.
- DNA: detailed DNA test result UI for ATDNA, MTDNA, YDNA, raw data files, SNP differences, and Y-STR markers.
- Preferences: apply preferences across navigation, charts, reports, maps, exports, editing defaults, function visibility, and import/export settings.
- Localization: application-level string catalog architecture if multiple UI languages become a goal.

## Priority Recommendation

1. Finish document lifecycle and media association. This protects the core promise: importing and preserving real MacFamilyTree data.
2. Build browser-safe media acquisition and Contacts import. The bundle makes these first-class desktop workflows, and useful web equivalents are practical.
3. Deepen local FamilySearch workflow while keeping API work gated on credentials and terms.
4. Add place lookup/geocoding and GeoName ID workflows.
5. Upgrade charts, reports, and books from generated outputs to saved, editable document workflows.
6. Expand website publishing and theme management.
7. Flesh out maintenance, research assistant, DNA detail, and preferences wiring.
