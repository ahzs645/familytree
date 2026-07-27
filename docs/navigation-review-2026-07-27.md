# Navigation & menu review (mobile + desktop) — 2026-07-27

Driven with Playwright at **1440×900** and **390×844** against the Arabic
dataset (836 persons), probing the drawer, the mobile menu, overflow menus,
tab strips, and the multi-pane screens. Everything below was measured.

## Verdict

Navigation is coherent at both sizes. The drawer/mobile-menu model works, every
screen has a way back, and the app never overflows the page horizontally. The
defects were all **content pushed outside a container that cannot scroll** —
controls that are on the page but unreachable — plus two alphabetical-ordering
bugs specific to Arabic data.

## Fixed

### 1. Arabic names split across four sections
The person list grouped by first letter, and أ / إ / آ / ا each got their own
header — the same letter in four places. `normalizeSearchText` folds hamza
forms to `ا`, then strips Arabic honorific tokens; a bare `ا` *is* one of those
tokens (as is `د`, for دكتور), so the result was `""` and the code fell back to
the raw character.

Same root cause broke search: typing `د` or `ا` normalized to `""`, which
matched every record — a one-letter filter returned all 836 rows. Now 692 and
809. Section headers are now `["M","ا","ب","ت","ج",…]` with one alef group.

### 2. Reports was unusable on a phone
The workspace is a fixed three-column grid: 220px library + 260px inspector
before the preview gets any width. At 390px the rendered report — the reason
the page exists — was pushed off the right edge, along with the **Options**
toggle at x=391, inside a container with no horizontal scroll. 37 controls
crammed into 390px, 2 unreachable.

Below 768px it is now one column with the library closed, so the preview is
what you land on. Toolbar rows wrap instead of overlapping the title. **6
controls, 0 unreachable.** Desktop unchanged (`280px 330px 590px` at 1440).

### 3. Heritage Tree hid four of its seven controls on mobile
`.heritage-tree-view` is `position: fixed; overflow: hidden` because it pans a
canvas, so anything the header pushes past the viewport is unreachable. At
390px the header measured 567px, putting **Export to PDF, View analytics,
Reset to default person and Reload current tree** off-screen with no way to
get to them. The header and its controls now wrap below 640px.

### 4. Half the settings panels were invisible on desktop
17 panels in one horizontally-scrolling strip (1828px). At 1440px only 984px
showed, so Edit Controllers, Categories, Export, Privacy, Plausibility,
Integrations and Functions sat behind a scroll with no scrollbar, no fade and
no arrows — the strip ended mid-word at "Content Downl". At 390px, 14 of 17
were hidden. It now wraps from `sm` up (all 17 visible, two rows) and keeps a
scroller with an edge fade below that; the gradient follows writing direction.

### 5. ColumnChooser ignored Escape
Closed on outside click only, unlike every other dropdown in the app. Now
closes on Escape and returns focus to its trigger.

### 6. The mobile tree hid its controls behind a four-screen swipe
The bottom dock was a `nowrap` strip **1625px wide** at 390px — over four phone
screens — so reaching Options meant a long blind swipe with no affordance. Three
of its buttons could not do anything there in the first place: InteractiveTreeApp
short-circuits `showPeople` / `showHeader` / `showInspector` on `isMobile`, so
the **People, Inspector and Header toggles changed nothing** at that width.
Camera duplicates "Camera Perspective" inside the Options panel.

Those four are now desktop-only, and both the dock and the top bar wrap instead
of scrolling. The dock's scroller is gone entirely; the top bar's 555px-in-240px
strip — cut mid-word at "Optio" — wraps to three rows. **All 18 controls laid
out without a scroller, 0 unreachable.** Desktop is untouched.

### 7. The command palette was not a listbox, and did not follow its own cursor
It is arrow-key navigable with Enter to jump, but the list was a plain `<ul>` of
`<li><button>`: no `listbox` role, no `option` roles, no `aria-activedescendant`.
It also never scrolled to track the cursor — with 49 entries (1772px) in a 540px
box, arrowing past the fold moved a selection the user could no longer see, and
Enter then jumped somewhere unexpected. Now a proper combobox + listbox, and the
highlighted row scrolls into view.

## Checked and working — not changed

- **Drawer**: 6 groups / 54 links, auto-opens the group containing the current
  route, collapses to a 56px icon rail.
- **Mobile menu**: hamburger → grouped list, expands in place, auto-closes on
  navigate. Footer keeps record count, theme and language.
- **Back paths**: Persons master→detail gives "Back to list"; the editor has
  "← Back"; the tree keeps the app header plus "Return to Family Tree".
- **Command palette**: opens on ⌘/Ctrl+K, filters, closes on Escape (its
  listbox semantics and cursor scrolling were added — see 7).
- **Editor section nav** (22 chips, 1204px wider than a 1440px viewport): a
  deliberate scrolling strip — it has an edge mask and auto-scrolls the active
  chip into view as you move through the form.
- **Zero unreachable controls** on every route tested at both 1440 and 390.
- **No page-level horizontal overflow** anywhere.

## Correction

The first version of this review claimed the palette **listed duplicate rows**
(`/marriages` vs `/marriage-list`). That was wrong — an artifact of a probe
selector, `[role=option],[role=dialog] button,[role=dialog] li`, which matched
both the `<li>` and its nested `<button>` and so counted every row twice. The
palette renders one row per result. `APP_FUNCTIONS` has 49 entries with no
duplicate target and no two rows that render identically.

(The manifest *does* register `/marriages` and `/marriage-list` as two live
routes rather than one plus a redirect, contrary to the comment at the top of
`manifest.js`. Both render the same view, and only one is ever linked, so
nothing surfaces twice — it is untidy, not a defect.)

## Still open

- **16 routes have no drawer entry.** Most are aliases; the genuinely
  nav-less ones (`lists`, `chart-split`, `reference-numbering`,
  `custom-validation`) are reachable only through the Actions page or the
  command palette.
