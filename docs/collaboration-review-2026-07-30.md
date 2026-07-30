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

## 3. Round two — adding relatives through the tree

Driving the flow the tree actually offers — open a person, "Add relatives",
pick father/mother/partner/child — turned up a data bug rather than a
translation gap.

**3.1 — "Add father" created the person and connected nothing.**
`assignParent()` fills the first free parent slot; once `man` and `woman` were
both set it fell through every branch and did nothing. `linkParent()` then
saved the unchanged family and returned success, so `/person/new` reported
nothing wrong. Reproduced on the real tree: the anchor (`person-182`, سلطان
حسن) already had both parents, and the new record ended up in **zero**
families with zero children. The reviewer believes they added a grandfather;
they added a floating record.

Fixed: when no slot is free the child gets another parent family — which is
how the schema already models step and adoptive parents — and a link that
genuinely fails now redirects with a banner instead of silently succeeding.
`assignParent()` returns whether it placed anyone.

**3.2 — "Add son with <partner>" ignored the partner.** `NewPerson` never read
the `partner` query parameter, so the child landed in whichever family
`findFamilyWithParent` returned first. Wrong for anyone with more than one
union. Both bugs now have regression tests that fail against the old code.

**3.3 — On a phone the menu could not be opened at all.** It was bound only to
`contextmenu`, and phones have no right-click; measured on a 390 px touch
context, neither tap nor long press produced anything. A 500 ms long press
opens it now (cancelled by a pan), and the menu clamps into the viewport —
anchored at the tap point it used to hang off the edge and clip its own
labels.

**3.4 — Deletions now travel.** `deletePerson`, `deleteFamily` and
`removeSubtree` wrote straight to the transaction and skipped the change log
entirely, so a reviewer's removals were indistinguishable from records their
file simply never contained. They log now, and `planMerge` reads those Delete
entries out of an incoming package — never plain absence, since a subtree
export or GEDCOM subset is missing most of the tree without meaning any of it
should go. Deletions are listed first in the merge sheet, opt-in per record,
defaulting to keep. Verified end to end: reviewer deletes ابراهيم نداء (3
records with the cascade), owner sees "حُذفت 3 سجلات في النسخة الأخرى" and
applies it.

**3.5 — Exports are distinguishable and small.** Every file was
`cloudtreeweb-<date>.mftpkg`; they now carry the tree name, the author, and a
time to the second. The package was also stored uncompressed with
pretty-printed JSON — **7,517,658 → 640,578 bytes**, now smaller than the
1.5 MB package being published.

**3.6 — The four read-only routes are done.** `/search` had been measuring
zero English words for the wrong reason: `SearchApp` threw
`t is not defined` and the page never rendered.

| route | before | after |
|---|---|---|
| `/search` | 28 | **0** |
| `/charts` | 14 | **2** (`SVG`, `PNG`) |
| `/reports` | 16 | **4** (`HTML`, `CSV`, `RTF`, `PDF`) |
| `/statistics` | 14 | **0** — the rest is place-name data |

Gender values (`Male` / `Female`) were the last non-format English inside
report bodies; `genderLabel()` is locale-aware now, like `noNameLabel()`.

---

## 4. Still open

- **No live collaboration.** Two people editing separate copies of the same
  tree will produce two files that both need merging, and a record edited in
  both will surface as a conflict with no indication of who changed what. If
  simultaneous editing is wanted, that is a backend — the `ConvexDataClient`
  seam exists for it, but nothing behind it does.
- **Only the 3D view can add relatives.** Flat, Sun, Family, Canvas and
  Details have no add path at all; someone who switches view loses the
  affordance.
- **A merge cannot say who changed what.** Conflicts show current vs incoming
  with no author, so an owner merging two relatives' files back has to
  remember which is which.
- **~79 unlabelled form fields remain** elsewhere in the app (Sources, Books,
  Places), unchanged from the 2026-07-27 review.

---

## 5. What to tell the reviewers

The link gives each of them a private copy that never leaves their phone. They
can change anything without risk to the original. When they are done:
**القائمة ← الإعدادات والبيانات ← الاستيراد والتصدير ← تنزيل ملف ‎.mftpkg**, then send
that file back. On the owner's side, the same page's "دمج شجرة أخرى" takes it,
and **"استخدام الوارد للكل"** is the button that accepts their corrections.
