# Can someone else review and edit this tree? — 2026-07-30

Scenario tested: the owner shares
`https://projects.ahmadjalil.com/familytree/?url=…/family_tree_arabic.mftpkg.zip`
with relatives who read Arabic and are on a phone. They open the link, look
around, correct a name, add a family member, and send the result back.

Method: the app was driven end to end with Playwright at 390 px with
`navigator.language = ar`, against the real Arabic dataset (836 persons, 282
families, 6,598 records) served locally. Every number below was measured, not
estimated. Both halves of the round trip were run: reviewer edits → export
`.mftpkg` → owner merges it back → confirm the reviewer's change is present in
the owner's copy.

---

## 1. The answer

**Yes, with one structural caveat: there is no shared tree.** The app is
browser-local by design (`lib/LocalDatabase.js` behind `AppDataClient`, no
backend — `ConvexDataClient` is a stub that throws). A `?url=` link gives each
person their **own private copy** in their own browser. Two reviewers editing
at the same time never see each other, and nothing flows back to the owner
automatically.

The working loop is therefore explicitly file-based:

```
owner publishes .mftpkg  →  reviewer opens ?url= link (own local copy)
                         →  reviewer edits / adds people
                         →  reviewer: Export → Download .mftpkg
                         →  sends the file back (mail, WhatsApp, …)
                         →  owner: Export → "Merge another tree" → resolve → Apply
```

That loop **works** — verified end to end: a reviewer's rename of
`person-452` (ابراهيم → ابراهيم المعدل) plus a newly added person merged into
the owner's copy without duplicating the other 836 people. It is not
simultaneous collaboration, and it should not be described as such to the
people being invited.

---

## 2. What was broken, and what changed

### 2.1 First contact was English, always

`DEFAULT_LOCALIZATION.locale` was hardcoded `'en'` and nothing consulted
`navigator.languages`. An Arabic reader opening the shared link got an English
left-to-right import dialog over an English welcome page, *before* they had any
way to reach the language picker (bottom of the nav drawer, two taps in).

Fixed: `detectPreferredLocale()` in `lib/i18n.js` seeds the first-run locale
from the browser's languages; `appPreferences`, `LocalizationProvider`, and the
pre-React paint script in `index.html` all use it. A stored preference still
wins. Measured after: `html lang/dir` is `ar / rtl` on first paint and the
import sheet reads "استيراد شجرة العائلة؟".

### 2.2 The person editor — the screen for adding and editing — was 100% English

Everything around it was Arabic; the editor itself rendered ~230 unique English
words: `First Name`, `Gender`, `Male`, `Add Event`, `Save changes`,
`Unsaved changes`, every section heading and every empty-state sentence.

Fixed: `useTranslation` threaded through `routes/PersonEditor.jsx`,
`components/editors/*`, and `components/personEditor/*`, with Arabic strings
added to `locales/ar.json`.

| | before | after |
|---|---|---|
| unique English words in the editor (Arabic UI) | ~230 | **12** |
| form fields with no accessible name | 4 of 22 | **0 of 22** |

The 12 remaining are file/media format names (`PDF`, `URL`, `Audio`), the
GEDCOM tag `DEAT` inside one hint, and source titles from the dataset itself.

Catalog labels moved with it: `ARABIC_CATALOG_LABELS` covered 33 of 128 type
ids and only applied when a separate Arabic/Islamic preference was ticked, so
the Add Event menu offered "Birth" and the saved value displayed "ميلاد". Now
121 of 128 ids have Arabic labels, they apply whenever the interface locale is
Arabic, and `localizeTypeOptions()` applies them to the dropdowns too — the
remaining 7 are label/reference-number ids translated through the message
catalog instead.

### 2.3 `/export` — the page for sending work back — was 100% English

170 unique English words on the one page a reviewer must use to return their
changes. Now 21, all of them format names (`GEDCOM`, `.ged`, `.gdz`, `CSV`,
`vCard`, `.mftpkg`) or the dataset's own tree name.

### 2.4 The merge preview lied about scale

`analyzeBackupMergeJSON()` counted **any** ID match as a "collision", including
byte-identical records. Returning a lightly-edited copy of the same tree
therefore reported:

> `6,617 records · 6,585 record collisions`

when 13 records actually differed and 32 were new. Anyone would read that as
"this will wreck my tree" and stop.

Fixed: the analysis now separates new / changed / unchanged and samples
*changed* records. Same file now previews as:

> `6,610 سجل في الملف — 25 جديد، 13 مختلف، 6,572 مطابق`

### 2.5 Applying the merge silently discarded the reviewer's work

Every conflicting record in `MergeConflictSheet` defaults to **Keep current**.
An owner who opens the sheet and clicks *Apply merge* — the obvious path —
keeps their own values and throws away every edit the reviewer made, with no
warning. In the common case (a relative reviewed *your* tree, you want their
corrections) the default is exactly backwards.

The default is left as-is because it is the data-safe one when merging a
stranger's tree, but it now says so: while every row is still on "Keep
current", the sheet shows a warning naming the number of incoming changes that
will be dropped and pointing at "Use incoming all".

### 2.6 "New person" was unreachable on a phone

At 390 px the action lived inside the filter `<details>` popover with a
`hidden sm:inline` label — an unlabelled icon, two taps deep. Now it sits in
the page header next to the filter toggle, with an `aria-label`.

### 2.7 Person rows were not controls

Mobile rows were `<div class="cursor-pointer">` — no `role`, no `tabindex`, not
a link. The only route into a person on a phone was unreachable by keyboard and
announced as anonymous text. Now `role="button"`, `tabIndex={0}`,
Enter/Space activation, a visible focus ring, and `aria-current` on the active
row.

### 2.8 Smaller Arabic gaps on the review path

- `"No name recorded"` was a hardcoded English constant reaching the screen in
  8 places — and this tree has **99 people with no name**. `NO_NAME` stays the
  English sentinel that half the codebase compares against; a new
  `localizeNoName()` / `noNameLabel()` pair localizes it at render time.
- Interactive tree: heading, the six view-mode names, and the
  Father/Mother/Partner/Child navigation labels.
- List headers: `"12 of 40 rows"`.
- Empty-state sentences rendered as `".Use the menu above to add one"` — an
  English sentence inside an RTL container moving its full stop to the front.
  `dir="auto"` on those nodes fixes it for anything still untranslated.

Measured English words with Arabic selected:

| route | before | after |
|---|---|---|
| `/tree` | 10 | **1** (the app name) |
| `/persons` | 6 | **6** — all dataset content¹ |
| `/families` | 14 | **11** — all dataset content¹ |
| `/export` | 170 | **21** — format names |
| person editor | ~230 | **12** |

¹ `Misssing link` is a person record in the tree, and
`Families with one child` / `Label is 'Incomplete'` / `Married before 1950` are
the owner's own saved scope names imported from MacFamilyTree. Both are data,
correctly left alone.

---

## 3. Still open

- **`/charts`, `/reports`, `/statistics`, `/search` are still partly English**
  (14–28 unique words each). They are read-only analysis surfaces, off the
  review-and-edit path, so they were left for a follow-up.
- **No live collaboration.** Two people editing separate copies of the same
  tree will produce two files that both need merging, and a record edited in
  both will surface as a conflict with no indication of who changed what. If
  simultaneous editing is wanted, that is a backend — the `ConvexDataClient`
  seam exists for it, but nothing behind it does.
- **Exports are named `cloudtreeweb-<date>.mftpkg`** regardless of who made
  them. Two relatives returning files on the same day produce identical
  filenames.
- **A returned `.mftpkg` is 7.5 MB** where the published package is 1.5 MB, so
  it round-trips as JSON rather than the compact SQLite form. Fine over mail,
  awkward over a messaging app.
- **Deletions do not travel.** The merge adds and updates; a person the
  reviewer deleted stays in the owner's copy.
- **~79 unlabelled form fields remain** elsewhere in the app (Sources, Books,
  Places), unchanged from the 2026-07-27 review.

---

## 4. What to tell the reviewers

The link gives each of them a private copy that never leaves their phone. They
can change anything without risk to the original. When they are done:
**القائمة ← الإعدادات والبيانات ← الاستيراد والتصدير ← تنزيل ملف ‎.mftpkg**, then send
that file back. On the owner's side, the same page's "دمج شجرة أخرى" takes it,
and **"استخدام الوارد للكل"** is the button that accepts their corrections.
