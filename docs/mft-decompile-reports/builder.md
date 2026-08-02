## Native spec

### Units and person allocation

Use `1.0 native scene unit = 58 web units`, because an ordinary unminified person without an information image occupies `(1, 1)` at `m = 1`. Source: `-[InteractiveTreeView3DViewer(Sizes) sizeOfObjectForInfo:withMinificationScaling:]`, `0x282aec–0x282af4`.

For minification `m`:

| Person layout | Native allocated width | Native allocated height |
|---|---:|---:|
| No information image | `m` | `m` |
| Information image, layouts 0/1/100 | `widthFactorForPersons × m` | `(hInfo(widthFactorForPersons) + 0.7) × m` |

The `0.7` is float `0.699999988079071` at `0xb2cfb8`, loaded at `0x282a84–0x282a98`. `hInfo` is returned by `heightOfPersonInformation...`; it is content-dependent, so the builder does not establish one fixed slot height.

Defaults:

- `widthFactorForPersons = 1.0`: `-[InteractiveTreeView3DViewerConfiguration defaultValueForPropertyName:]`, property CFString `0xc6b2b0`, inline `1.0` at `0x53d480`.
- `partnersSpacingFactor = 1.0`: property `0xc35a10`, same inline value.
- `parentsChildsSpacingFactor = 1.1`: property `0xc35a30`, double `1.1` at `0xb2e168`, loaded at `0x53d4b0–0x53d4b8`.

### Directional spacing and concrete gaps

For the normal top-down layout, `spacingForObjectForInfo:` returns `(top, left, bottom, right)`:

```text
T = 0.25
L = auxiliarySibling ? 0.5 : 1.0
B = m × (0.1 + 0.4 × parentsChildsSpacingFactor)
R = 0.025 × m
    + L × 0.15 × m^1.5 × partnersSpacingFactor
```

Sources: `-[InteractiveTreeView3DViewer(Sizes) spacingForObjectForInfo:]`, `0x282bf8–0x282cdc`.

- `0.25`, `1.0`, `0.5`, and exponent `1.5` are inline at `0x282bf8`, `0x282c1c`, `0x282c20`, and `0x282ca8`.
- `0.1`: double at `0xb2d118`.
- `0.4`: float `0.4000000059604645` at `0xb2cfc0`.
- `0.15`: float `0.15000000596046448` at `0xb2cfac`.
- `0.025`: double at `0xb2e4f8`.

At the defaults, for an ordinary unminified person:

```text
T = 0.25       = 14.50 web
L = 1.00       = 58.00 web
B = 0.54       = 31.32 web
R = 0.175      = 10.15 web
```

There are no distinct native `partnerGap`, `siblingGap`, or `childGap` constants. The aligners collide occupied rectangles:

```text
horizontal center separation =
  Wleft/2 + Rleft + Lright + Wright/2

vertical center separation =
  Hrow1/2 + Brow1 + Trow2 + Hrow2/2
```

Consequences for isolated `1 × 1` ordinary persons:

| Measurement | Native | Web |
|---|---:|---:|
| Ordinary horizontal centre pitch | `2.175` | `126.15` |
| Clear body-to-body horizontal gap | `1.175` | `68.15` |
| Ordinary vertical row pitch | `1.79` | `103.82` |
| Clear parent/child body gap | `0.79` | `45.82` |

The `103.82` row pitch is only the body-only baseline. If a generation contains person-information content, substitute its actual allocated `H`; there is no universal generation step.

For an auxiliary sibling at native default sibling minification `m = 0.5`:

```text
W = H = 0.5
T = 0.25
L = 0.5
B = 0.27
R = 0.0390165
```

Thus:

- Auxiliary-to-auxiliary centre pitch: `1.0390165 native = 60.26 web`.
- Ordinary left, auxiliary right: `1.425 native = 82.65 web`.
- Auxiliary left, ordinary right: `1.7890165 native = 103.76 web`.

The asymmetry is native behavior; a single symmetric sibling-gap constant cannot reproduce it exactly.

`minimumSpacingBetweenPartners:` contributes nothing in this viewer: inherited `-[InteractiveTreeViewBaseViewer minimumSpacingBetweenPartners:]` returns `0.0` inline at `0x594998`. Partner separation is therefore the same contour calculation, with `partnersSpacingFactor` affecting `R`.

### Generation depth

The generation-geometry pass records maximum sizes and all four spacing components per generation. `deltaInHeightBetweenGeneration1:andGeneration2:` returns the difference between the resulting stored generation centres; it does not multiply a generation index by a constant. Sources:

- `-[InteractiveTreeViewBaseBuilder(AlignGenerationGeometryInfo) calculateAlignGenerationGeometryInfoInInfoContainer:forRootPersonInfo:]`, `0x1d564c–0x1d6520`.
- `-[InteractiveTreeViewBaseBuilder(AlignGenerationGeometryInfo) deltaInHeightBetweenGeneration1:andGeneration2:]`, `0x1d6520`.
- Used by `-[InteractiveTreeViewTreeBuilder(AlignParents) alignParentsForInfo:...]` at `0x4eb128–0x4eb150`.

For uniform centred rows:

```text
center[g+1] - center[g] =
  max_i(H_i/2 + B_i) in row g
  + max_j(H_j/2 + T_j) in row g+1
```

More complicated rows use the actual relative extents collected by the geometry pass. Therefore `248` or `270` cannot be a literal native parity value.

### Branch and family-block separation

Subtrees are contour-packed. If a collision occurs against a different generation, the required displacement is increased by:

```text
abs(currentGeneration - collidedGeneration)
× branchSpacing
× branchSpacingFactor
```

- `branchSpacing = 0.5`, inline in `-[InteractiveTreeView3DViewer(Sizes) branchSpacing]` at `0x2831f0`.
- Default `branchSpacingFactor = 0.4`, double at `0xb2d070`, returned by `-[InteractiveTreeViewTreeBuilderConfiguration defaultValueForPropertyName:]`.
- Effective increment: `0.2 native = 11.6 web` per generation of difference.
- Usage: `AlignParents` at `0x4eb294–0x4eb2c4`; `AlignPartnerAndChildren` at `0x5060a4–0x5060b8` and analogous collision sites.

For two blocks colliding within the same generation, this additional term is zero. There is no native builder constant corresponding to `familyPadding`, `blockGap`, or a fixed family-block gap.

### Local groups and root placement

`-[InteractiveTreeViewPersonInfo(TreeBuilder_BuildPartnersAndChildren) assignLocalGroupIdentifiersToChildInfos:]`, `0x565eb8–0x5662a8`, assigns identifiers; it does not add geometric padding:

- The opposite parent/partner inherits the current person’s local group at `0x565f4c–0x565f98`.
- A new random identifier is created at `0x5660e4–0x5660f0`.
- If any child branch continues into further children, each child gets a separate random identifier at `0x56614c–0x566168`.
- Otherwise the children share the newly created identifier.
- Those identifiers propagate to the opposite parent in each descendant family at `0x5661c8–0x566218`.

This is what drives native band segmentation. It is not inferred afterward from large coordinate gaps.

In `-[InteractiveTreeViewTreeBuilder(Build) rebuildForViewer:withRootObject:inContainer:]`:

- Root generation is `0`.
- Root minification is exactly `1.0`, inline at `0x5a172c`.
- On viewer exchange, its logical position is `(0, 0)` at `0x5a17a8–0x5a17b4`.
- Its local group is a fresh random identifier at `0x5a175c–0x5a176c`.

The root is not allocated a larger body or slot. Its only layout enlargement is:

```text
Rroot = max(Rroot, max(Wroot, Hroot) / 3)
```

The divisor `3.0` is inline at `0x282d40` in `spacingForObjectForInfo:`. For a `1 × 1` root, `R` rises from `0.175` to `0.333333`.

### Featured sizing and minification

There is no direct-line or featured scale above `1.0`.

Defaults from `-[InteractiveTreeViewTreeBuilderConfiguration defaultValueForPropertyName:]`, `0x165f58–0x166168`:

- `ancestorMinificationStartLevel = 3`, property `0xc2b410`.
- `descendantsMinificationStartLevel = 2`, property `0xc2b430`.
- Both sibling minification controls default to `1`, properties `0xc2b450` and `0xc2b470`.

Ancestor scale at depth `a`:

```text
a = 1, 2: 1
a >= 3: 1 / (a - 3 + 2)
```

So depths 1–4 are `1, 1, 0.5, 0.333333`. Source: `-[InteractiveTreeViewPersonInfo(TreeBuilder_BuildAncestors) buildAncestorsIfNecessary...]`, `0xb450–0xb498`.

Descendant scale at depth `d`:

```text
d = 1: 1
d >= 2: 1 / (d - 2 + 2)
```

So depths 1–4 are `1, 0.5, 0.333333, 0.25`. Source: `buildPartnersAndChildrenIfNecessaryForViewer:...`, `0x566a74–0x566ac8`.

Partners inherit the current person’s scale at `0x5667f0–0x5667fc`.

Auxiliary sibling scale is:

```text
lineageScale × (1 - 0.5 × configuredSiblingFactor)
```

The inline operands `1.0` and `-0.5` are at `0xaec8–0xaecc`; the multiply-add is at `0xb830`. With the default factor `1`, siblings are `0.5 × lineageScale`.

### Sibling ordering and partner side

Effective unset `childSortingMode` is `0`, because `InteractiveTreeViewTreeBuilderConfiguration` has no explicit default case for it and `-[BaseConfiguration defaultValueForPropertyName:]` returns `nil` at `0x1c6808`; the scalar configuration path consequently reads zero.

`+[InteractiveTreeViewPersonInfo(TreeBuilder_FamilyDictionaries) allChildRelationDictionaries...]`, around `0x18b758–0x18b85c`, implements:

| Mode | Ordering |
|---:|---|
| `0` | Name ascending, then birth date descending |
| `1` | Birth date ascending, then name ascending |
| `2` | Birth date descending, then name ascending |

Keys decoded from CFStrings:

- `nameForSorting` at `0xc2e710`.
- `birthDateForSorting` at `0xc2e6f0`.

Thus the effective fresh/default mode is **By Name**, not birth ascending. A stored user preference can override it.

For top-down layout, parent family arrays are collected father first and mother second; later sets are moved by the positive collision delta. The resulting conventional placement is father/partner-in-father-role on the left, mother/partner-in-mother-role on the right. Source: `-[InteractiveTreeViewTreeBuilder(AlignParents) alignParentsForInfo:...]`, father/mother collection at `0x4eaeac–0x4eb04c`, collision/move at `0x4eb27c–0x4eb414`.

Multiple unions are packed from their family roles and contours. There is no native `index % 2` rule that alternates partners arbitrarily around the root. How an unknown-gender parent is assigned to father/mother role is not decidable from these builder methods.

No color, material, or `NSFont` calls occur in the relevant builder/alignment methods; those are viewer-object responsibilities.

## Web divergences

### Constant mapping

| Web value | Web/native units | Native equivalent | Verdict |
|---|---:|---|---|
| `generationStep: 248` | `4.2759` native | Dynamic; body-only baseline `103.82 web` | Fixed and substantially too large |
| `GEN_STEP = 270` | `4.6552` native | Dynamic; body-only baseline `103.82 web` | Fixed and substantially too large |
| `childGap: 146` | `2.5172` native | Ordinary contour pitch `126.15`; auxiliary pitches `60.26–103.76` | Too large and loses minification/asymmetry |
| `PARTNER_OFFSET = 178` | `3.0690` native | Ordinary isolated contour pitch `126.15` | About 41% high |
| Hardcoded partner gap `150` | `2.5862` native | `126.15` ordinary fallback | About 19% high |
| `NODE_SPACING = 240` | `4.1379` native | `126.15 + 11.6×collisionGenerationDelta` | About 90% high before branch adjustment |
| `MIN_GEN_GAP = 124` | `2.1379` native | `126.15` ordinary pitch | Close: about 1.7% low |
| `branchGap: 96` | `1.6552` native | `11.6` per collided-generation difference | Far too large, but currently unused |
| `regularModelSize: 58` | `1.0` native | `58` | Match |
| `featuredModelSize: 88` | `1.5172` native | `58`; native scale is `1.0` | Incorrect featured enlargement |

Sources: [macTreeStyle.js:4](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/macTreeStyle.js:4), [constants.js:3](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/constants.js:3), [layout.js:319](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:319).

`familyPadding: 120`, `blockGap: 90`, and `rootParentGap: 320` have no native builder equivalent. They are destructured but not used by the family-graph layout. `branchGap: 96` is also unused. See [macTreeStyle.js:7](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/macTreeStyle.js:7) and [layout.js:265](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:265).

### Behavior

- Both web paths use a fixed generation pitch. The simple path multiplies `270` by a default factor of `1`; the family path multiplies `248` by `1`. Native defaults to `1.1`, and the factor modifies only the bottom spacing term, not the whole pitch. See [layout.js:10](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:10), [layout.js:14](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:14), and [layout.js:244](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:244).

- `NODE_SPACING × branchFactor` globally scales all horizontal placement. Native `branchSpacingFactor` adds a small collision-dependent term after contour collision; it does not scale the base occupied width. See [layout.js:15](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:15).

- The family path’s `MIN_GEN_GAP = 124` is already close to the ordinary native pitch, but `PARTNER_GAP = 150` and `childGap × 0.8 = 116.8` override that with unrelated symmetric values. See [layout.js:324](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:324) and [layout.js:399](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:399).

- The root is shifted to `x = 78`, its companion to `x = -132`, and lineage ancestors are explicitly scaled to `1.5`. Native root position is zero and direct-line persons remain scale `1`. See [layout.js:446](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:446) and [layout.js:458](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:458).

- Web collateral scale is `0.72`; native default is `0.5 × lineageScale`. See [layout.js:450](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:450).

- Web minification is disabled by default and, when enabled, is a linear `0.14` reduction with a `0.42` floor. Native defaults start at ancestor level 3 and descendant level 2 and use reciprocal scaling without that floor. See [layout.js:147](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:147).

- The simple path defaults to birth ascending; the family path always prioritizes the lineage/root role and then birth date ascending. Native’s effective unset mode is by name, and ordering applies before alignment without a root-first sorting rule. See [layout.js:10](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:10), [layout.js:629](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:629), and [constants.js:173](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/constants.js:173).

- The simple path alternates root partners by union index. The family path assumes `parents[0]` is father and `parents[1]` is mother rather than resolving roles. Native placement is father-role left and mother-role right. See [layout.js:99](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:99) and [layout.js:423](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:423).

- Band grouping is reconstructed from `familyBlockId` only for generations `<= -2`. Native uses propagated local-group identifiers wherever they occur. See [layout.js:705](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:705).

- Web regular label width `164` and footprint width `190` are much wider than the native default allocated person width of `58 web`. This contributes to the oversized horizontal layout. See [macTreeStyle.js:17](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/macTreeStyle.js:17) and [layout.js:341](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:341).

## Recommended fixes

1. **Replace fixed row and node pitches with occupied-rectangle contour packing.** In web units use:

   ```js
   T = 14.5;
   L = 58 * (auxiliarySibling ? 0.5 : 1);
   B = 58 * m * (0.1 + 0.4 * parentsChildrenFactor);
   R = 58 * (
     0.025 * m
     + (auxiliarySibling ? 0.5 : 1) * 0.15 * Math.pow(m, 1.5) * partnerFactor
   );
   ```

   Place adjacent generations from their maximum `H/2 + B` and `H/2 + T` extents. Keep `126.15` as the simple ordinary horizontal fallback, rather than `146`, `178`, or `240`.

2. **Remove featured/direct-line enlargement from layout.** Change `featuredModelSize` from `88` to `58`; change lineage scale `1.5` to `1`; change collateral `0.72` to `0.5`. Keep any focus ring as a visual overlay that does not enlarge the layout footprint.

3. **Restore native defaults and minification.** Default `parentsChildrenSpacing` to `1.1`; start ancestors at level `3` and descendants at level `2`; use reciprocal scales `1, 1, .5, .333…` for ancestors and `1, .5, .333…` for descendants.

4. **Remove special root offsets.** Put the root at `x = 0`. Do not derive partner placement from `ROOT_CARD.w` or alternate by union index. Resolve father/mother roles and place father-role left, mother-role right through contour collision.

5. **Use the native branch adjustment.** After base collision, add `11.6 × abs(generation - collidedGeneration)` web units at the default branch factor. Do not multiply every node pitch by `branchFactor`.

6. **Make By Name the default child order.** Implement name ascending with birth-date-descending tie-breaking; ensure the family-graph path honors the selected sorting mode instead of always applying lineage priority plus birth ascending.

7. **Carry local-group IDs into bands.** Assign and propagate groups while walking families, then segment every generation by those IDs. Do not limit segmentation to `generation <= -2` or infer it from coordinate gaps.
