# Interactive Tree (`/tree`) — MFT option parity plan

Goal: bring the web 3D Interactive Tree options/actions up to parity with
MacFamilyTree 11's `InteractiveTreeView3DViewer` (source of truth:
`Frameworks/MacFamilyTreeCore.framework/.../en.lproj/CoreInteractiveTreeView.strings`).

Implemented in waves so each lands verifiable. Status legend: ✅ done · 🚧 in
progress · ⬜ todo · 🔶 needs external dependency / product decision.

## Wave 1 — render & options wiring (low risk, no layout restructure)
- ✅ Person Width (`WidthFactorForPersons`)
- ✅ Person Background Saturation (`PersonObjectColorizingFactor`)
- ✅ Person coloring: By Label, By Person Group, Custom Color
- ✅ Generation bands: Show Range of Birth Dates, Show Generations, Custom band color
- ✅ Shadow Radius / Distance / Angle, Font Size
- ✅ Ground Color (`BottomPlaneColorMode`)
- ✅ Display indicators for further available persons (toggle)
- ✅ Parents/Children, Partner, Branch spacing sliders

## Wave 2 — layout engine (higher risk)
- ✅ Generation direction (Top→Bottom / Bottom→Top / Left→Right / Right→Left)
      — coordinate transform on the finished layout (nodes, link points, bands,
      bounds). Known gap: band labels (year/generation text) are skipped in the
      horizontal L→R / R→L modes (label placement is still width/X-based).
- ✅ Brother/Sister Generations depth control (collateral siblings dropped past depth)
- ✅ Scale Ancestors / Scale Descendants at Generation (per-node figure minification)
- ⬜ Box Alignment (`BuilderGenerationsAlignmentHint`) — low visible effect in our
      uniform-row model; deferred
- ⬜ Minification of siblings (focused + other) — needs reliable collateral tagging
- ⬜ Adjust Parent Positions for better space usage

## Wave 3 — bands & display detail
- ✅ Segment Generation Bands by Pedigree (toggle gates per-holder band split)
- ✅ Desaturate Colors for Ancestors of Partner (partner-role nodes desaturated)
- ✅ Display Numbering System (Ahnentafel/d'Aboville/Henry/Generation via
      lib/referenceNumbering.js, lazy-loaded + merged onto nodes, rendered on label)
- ✅ Display Influential Relations Icon (treeQuery flags status.influential from
      AssociateRelation; "I" badge, toggle-gated)
- ✅ Display FamilySearch Icons (toggle now gates the existing FS badge)
- ⬜ Keep birth dates / generation visible while scrolling (per-frame; deferred)
- ⬜ Display Event Description (needs events loaded for every node; deferred)
- ⬜ Ordinances Display Mode (needs LDS ordinance data wired per node; deferred)

## Wave 4 — context menu / actions
- ✅ Delete Family (new `deleteFamily` in lib/subtree.js; context item + confirm)
- ✅ Add Relatives full submenu (added Add Further Father/Mother/Partner;
      existing-person pickers already present)
- ✅ Add / Edit Influential Persons (context item → Person editor influential section)
- ✅ FamilySearch: Display / Matches (context items → /familysearch, gated by
      status.familySearch). Download/Upload/Match left to the FamilySearch route.
- ⬜ Extend tree with FamilySearch (network traversal; deferred — needs FS API calls)

## Wave 5 — separate surfaces
- ⬜ Flat viewer: Place Names mode + Background style (the 9 spotlight/gradients)
- 🔶 Virtual Tree (Metal-style 3D: sky, depth-of-field/bokeh, AR, symbol/family
      symbol modes) — a separate WebGL renderer, large standalone effort.
