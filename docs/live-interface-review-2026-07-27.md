# Live interface review — 2026-07-27

> **Status:** §1, §2 (partly), §3.1–§3.4, §4, and §5 were fixed on this branch;
> see [§8 What was fixed](#8-what-was-fixed) for the after-numbers and what is
> deliberately still open. The findings below describe the state *before* those
> changes.

Target: the deployed build at
`https://projects.ahmadjalil.com/familytree/?url=…/family_tree_arabic.mftpkg.zip`
(836 persons, 282 families, 6,598 records, Arabic-language tree).

Method: the live site was driven with Playwright against the real dataset —
all 91 routes crawled with data loaded, plus targeted interaction tests for
import, search, editing, export, localization, accessibility, and mobile.
Every claim below was measured, not inferred. Findings that turned out to be
**correct behaviour** are listed in §6 so they don't get re-reported.

---

## 1. The `?url=` deep link — the thing that most needs fixing

The link works. The experience around it does not. All of the following is in
`src/main.jsx` (`autoLoadIfEmpty`, `loadFromUrl`).

**1.1 — Every failure mode is silent and indistinguishable.**
`loadFromUrl` errors are caught and sent to `console.error` only
(`main.jsx:150-152`). Measured, on three separate first-visit profiles:

| Scenario | What the user sees |
|---|---|
| Dataset URL 404s | `/welcome` · "No tree yet" |
| URL isn't a package (pointed at `favicon.ico`) | `/welcome` · "No tree yet" |
| User dismisses the confirm dialog | `/welcome` · "No tree yet" |
| *(success)* | the tree |

Three different outcomes, one identical screen, and nothing anywhere in the UI
mentions that a dataset was ever requested. No error, no retry, no "load it
now" button. A shared link that fails is indistinguishable from a first-time
visitor arriving at an empty app.

**1.2 — The gate is a native `window.confirm()` on a blank white page.**
Measured: DOM ready at 738 ms, `confirm()` fires at 753 ms — before React
mounts. The user sees a bare browser dialog reading
"projects.ahmadjalil.com says: Import family tree data from https://…?" over
an empty white page. On mobile that reads as a phishing prompt. It is also why
the link silently no-ops in any context that auto-dismisses dialogs.

**1.3 — The app renders nothing until the import finishes.**
`ReactDOM.createRoot(...).render()` sits in `autoLoadIfEmpty().finally(...)`,
so download + parse + IndexedDB write all happen before first paint. Measured
on a fast connection: 3,849 ms to first paint, of which 3,096 ms is blank
white *after* the user clicks OK. There is no shell, no spinner, no progress.
This scales with package size — and `MAX_REMOTE_IMPORT_BYTES` allows up to
50 MB, so a large tree on mobile data is a long blank screen with no
indication the page is alive.

**1.4 — The size guard can be bypassed.** The pre-flight check reads
`content-length` (`main.jsx:94`); if the server responds chunked the header is
absent, `size` is `0`, and the guard passes. The real check only happens after
the entire body is already buffered in memory.

**Suggested fix:** mount the app first, and move the whole `?url=` flow into
the React tree — an in-app confirm sheet, a determinate progress bar driven by
a streaming reader, and an error state on `/welcome` that names the failed URL
with a Retry button.

---

## 2. Accessibility and document semantics

DOM audit across 19 representative routes, computing accessible names the way
a screen reader would (`aria-label`, `aria-labelledby`, `label[for]`, wrapping
`<label>`, `title`):

- **128 form fields have no accessible name at all.** The visible label text is
  rendered as an adjacent element and never associated with the control.
  Worst offenders: Sources 36/53, Places 31/42, Books 15/22, Person editor
  14/26, Reports 7/15. `getByLabel('First Name')` matches **zero** elements on
  the person editor even though the words "First Name" are on screen. Every
  one of these is a text box a screen-reader user cannot identify.
- **Nested `<main>` landmarks on 12 of 19 routes** — the shell renders a
  `<main>` and the route renders another inside it.
- **No `<h1>`** on `/search`, `/places`, `/charts`, `/duplicates`, `/media`;
  **two `<h1>`** on `/reports`.

Buttons are in good shape — 0 of 1,355 lacked an accessible name.

---

## 3. Localization — the biggest gap for *this* dataset

The tree is Arabic. RTL itself is well done: `dir=rtl` applies, the sidebar
mirrors, Arabic names render correctly, and there is no horizontal overflow.
But the translation layer only covers part of the app.

**3.1 — Vietnamese is offered but does not exist.** `SUPPORTED_LOCALES`
(`src/lib/i18n.js:12`) lists `vi / Tiếng Việt`, and it appears as the second
option in the language picker. `src/lib/translate.js` imports only `en.json`
and `ar.json`; there is no `vi.json`. Selecting it silently renders English.
(Vietnamese *is* partly built out elsewhere — `vietnameseReports.js`,
`vietnameseRelationshipLabel` — so this looks like an unfinished locale rather
than a stray entry. Either finish `vi.json` or hide the option until it lands.)

**3.2 — 47 of 67 route components never call `useTranslation`.** Including
Reports, Statistics, Export, Charts, Places, Media, Search, PersonEditor,
FamilyEditor and Tree. Measured latin-word counts with Arabic selected:

| Route | Untranslated terms remaining |
|---|---|
| `/settings/general` | 0 |
| `/tree` | 9 |
| `/statistics` | 45 |
| `/reports` | 96 |
| `/export` | 157 |

So the chrome translates and the actual working surfaces don't. Even on the
mostly-translated Persons page the "New person" button and the Male/Female
labels stay English.

**3.3 — Generated report bodies are English-only.** A Person Summary for an
Arabic person still emits `Born:`, `Gender:`, `Father:`, `Mother:`, and
`TYPE / DATE / DESCRIPTION` column headers. Exported reports for an Arabic
family come out half English.

**3.4 — RTL layout bug in the report preview.** Measured header positions on
`/reports` with Arabic active:

```
Type        left=319px
Date        left= 86px
Description left=-178px   ← off-screen, clipped, unreachable
```

The table lays out LTR-width-first inside an RTL container, pushing the third
column past the left edge.

---

## 4. Mislabelled controls

Chart **PDF** and report **"Save as PDF Document…"** do not produce a PDF —
both open a popup and call `window.print()`, leaving the user to pick
"Save as PDF" in the browser print dialog (`chartExport.js:208`,
`reports/export.js:44`). Verified working end to end (popup renders content,
`print()` is called), so this is a naming problem, not a broken feature —
but "Save as PDF Document…" sitting next to "Save as HTML File…", which
downloads a file immediately, sets the wrong expectation. The internal
constant already calls it `'PDF (via print)'`; the UI should too.

Neither call site wraps the `throw new Error('Popup blocked…')` in a handler,
so with popups blocked the click does nothing and reports nothing.

---

## 5. Smaller issues

- **`/person/new` writes a record on navigation.** `NewPerson.jsx` saves a
  blank Person in a mount effect before any input. Confirmed: the crawler
  merely *visiting* the route pushed the tree from 836 to 837 persons. Any
  stray navigation or back-button leaves an orphan unnamed person behind.
- **Unnamed persons sort into the middle of the list.** 99 persons genuinely
  have no name in the source; they render as "No name recorded" and then sort
  under **N**, wedged between real names, because the placeholder string is
  used as the sort key. They should group at the end or in their own section.
- **`beforeunload` fires on leaving `/charts`** with nothing unsaved.
- **10 of 18 places have no coordinates**, so the map plots 8. A "look up
  missing coordinates" prompt on `/places` would close this in one click —
  `BatchPlaceLookupSheet` already exists.

---

## 6. Verified working — do not re-report

- **Import fidelity is correct.** 738 of 837 persons have a first name in the
  source SQLite; the "No name recorded" rows are accurate data, not an import
  bug. Record counts match the package exactly.
- **All 91 routes render** with zero page errors and zero unhandled console
  errors.
- **Exports work**: `.ged` (114 KB), `.gdz`, `.dot` (153 KB), backup `.json`
  (7.5 MB), `.mftpkg` (7.5 MB), chart SVG/PNG, report HTML/CSV/TXT/RTF.
- **Editing persists.** Changed a first name, saved, reloaded — value survived,
  and the change log recorded it.
- **Search works** — free-text "احمد" returned 113 matches across Arabic fields.
- **No horizontal overflow at 390 px** on any route tested.
- **The blanket HTTP 404 on every deep route is expected** — it's the GitHub
  Pages SPA fallback in `public/404.html`, and the client-side rewrite works.
- **Media gallery being empty is correct** — the package contains no media.

---

## 7. Priority

1. §1 — deep-link loading UX and silent failures. This is the entry point for
   every shared link, and right now a broken link and a fresh visit look identical.
2. §3.2 / §3.3 — push `useTranslation` through the report/statistics/export
   surfaces. An Arabic tree that reports in English is the core "not yet
   useful" gap.
3. §2 — associate labels with inputs. Large but mechanical.
4. §3.1 — finish or hide the Vietnamese locale.
5. §3.4, §4, §5 — targeted fixes.

---

## 8. What was fixed

Measured the same way as the findings above, against a production build of this
branch serving the same Arabic dataset.

| # | Finding | Before | After |
|---|---|---|---|
| 1.1 | Deep-link failures indistinguishable from a fresh visit | 404, wrong file type, and dismissed dialog all → "No tree yet" | each shows the message and the failing URL with **Try again**; cancelling leaves an **Import** banner |
| 1.2 | Native `confirm()` over a blank page | fired at 753 ms, before React mounted | in-app sheet inside the app shell |
| 1.3 | Nothing rendered until the import finished | 3,849 ms to first paint, 3,096 ms blank after clicking OK | ~150 ms to first paint, determinate progress bar throughout |
| 1.4 | Size cap bypassable on a chunked response | header-only check | enforced as bytes arrive |
| 2 | Unlabelled form fields | 128 of 1,608 | **79** |
| 2 | Routes with nested `<main>` | 12 of 19 | **0 of 19** |
| 3.1 | Vietnamese offered with no `vi.json` | silently English | marked "— English interface" in the picker |
| 3.2 | Untranslated terms with Arabic selected | `/reports` 96, `/statistics` 45 | **19** and **13** |
| 3.3 | Report bodies English-only | `Born:`, `Gender:`, `Father:`, `TYPE/DATE/DESCRIPTION` | translated; table headers had *never* been localized (the pass read `headers`, the AST emits `columns`) |
| 3.4 | RTL report column clipped off-screen | `Description` at x=-178 | all columns at positive offsets |
| 4 | PDF buttons promised a file | "Save as PDF Document…" / "PDF" | "Print / Save as PDF…" / "Print", and a blocked popup now reports itself |
| 5 | `/person/new` wrote a record on navigation | crawling the route moved 836 → 837 | asks first unless the visit carries intent; count unchanged |
| 5 | Unnamed persons sorted under **N** | wedged between real surnames | own group, sorted last |
| 5 | `beforeunload` on leaving `/charts` | fired with nothing edited | fires only after a real edit |

Regression check: all 91 routes crawled against the rebuilt app — no page
errors, no empty routes, exactly one `<main>` each. 429 unit tests pass.
Import → edit → save → reload verified end to end on the Arabic dataset.

### Still open

- **~79 unlabelled fields remain**, concentrated in Sources (24), Books (12),
  Places (12), and the person editor (8). The shared `Field` components and
  `MasterDetailList` are fixed, so what is left is per-screen bespoke markup.
  (Some are `<input type="file" class="hidden">` behind styled buttons, which
  `display: none` keeps out of the accessibility tree anyway.)
- **Per-builder report `helpText` is still English in every locale.** The
  lookup is wired (`reports.helpText.<builderId>`) and falls back to the
  English literal; the ~30 sentences were left for a translator rather than
  machine-translated.
- **`/export` remains largely untranslated** (157 terms) — the largest single
  remaining route.
- **Event type and gender *values* inside reports** ("Birth", "Nationality",
  "Male") are record data rendered verbatim; localizing them needs a
  value-level catalog keyed off `ConclusionPersonEventType`.
- **10 of 18 places still have no coordinates.** `BatchPlaceLookupSheet`
  exists; `/places` just never prompts.
