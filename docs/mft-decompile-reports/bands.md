## Native spec

Coordinate conversion for the port is:

```text
native (X, Y-up, Z) → web (X, Y, Z-up)
native X → web X
native Z → web Y
native Y → web Z
```

All measurements below are native scene units.

### Band geometry and segmentation

The bands are not `SCNBox` objects.

- Mode `1` uses an `SCNPlane`.
- Modes `2–3` use a rounded `SCNShape`.
- Modes `4–9` use two stacked rounded `SCNShape` objects: a cap plus a lower pedestal.
- Mode `0` produces no bands.

This dispatch is in `-[InteractiveTreeView3DViewerGenerationBandObject blockNodeClassForGenerationBandStyleMode:]` at `0x3f833c`.

For normal generation layouts `0/1`, each segment has:

```text
width  = round((endX - startX) * 1000) / 1000
length = round((maxZWithMargins - minZWithMargins) * 1000) / 1000
height = style/group elevation
radius = min(width / 6, length / 6, 0.25)
```

`1000` is `0xb2d128`; the radius cap `0.25` and divisor `6` are inline at `0x3f9130–0x3f916c`. Layouts `2/3` exchange the X/Z roles.  
Method: `-[InteractiveTreeView3DViewerGenerationBandObject updateGeometrySkippingAnimations:]`.

The common container is rotated `eulerX = -π/2` (`0xb2d030`). A shape is centered at local extrusion coordinate `height/2`; therefore:

```text
native floor Y = 0
native top Y   = height
web floor Z    = 0
web top Z      = height
```

The absolute X/Z footprint still depends on the computed person positions, so no fixed absolute band position exists in the assembly.

Rounded paths are created from `(-width/2, -length/2, width, length)` with path flatness `0.005` (`0xb2d0a0`).  
Methods:

- `-[...RaisedShapeNode assignNewPath]`
- `-[...PedestalShapeNode assignNewPath]`

Mode-specific construction:

- Flat mode `1`: `SCNPlane`, `cornerSegmentCount = 5`; reads/writes depth are disabled.
- Raised modes `2/3`: one `SCNShape`, chamfer `0.02` (`0xb2d3f8`), depth read/write enabled.
- Pedestal/stair modes `4–9`:
  - cap thickness `0.06`, encoded inline at `0xe9680–0xe9690`;
  - cap chamfer `0.0175` (`0xb2d038`);
  - lower-body chamfer `0.01` (`0xb2d040`);
  - lower extrusion `height - 0.06 + bottomExtension`, where `bottomExtension` initializes to zero;
  - cap center is `height/2 - 0.03`; lower center is `-0.03`.

Method: `-[InteractiveTreeView3DViewerGenerationBandObjectPedestalShapeNode setSize:andCornerRadius:andHeight:andShadowTintColor:animated:]`.

Raised and pedestal nodes also contain a fake-shadow node:

```text
shadow width  = width  + 0.23
shadow length = length + 0.23
shadow local extrusion position = -height/2 + 0.01
transparency = 0.25
renderOrder = -100
```

`0.23` is `0xb2d090`; `0.01` is `0xb2d040`; transparency is inline at `0xe9778`. Band blocks themselves use `renderOrder = -900`.

### Person margins and label gutter

Let `S` be `largestPersonScaling`. For layouts `0/1`:

```text
spaceOnRight  = 0.2 S
spaceOnBottom = 0.1 S
```

Constants: `0xb2d068 = 0.2`, `0xb2d118 = 0.1`.

If either label line is visible, define:

```text
L  = max(1, maxZ - minZ)
Wt = 1.6 L
Ht = L × (0.25 × showBirthDates + 0.15 × showGeneration)
M  = 0.1 × (maxZ - minZ)
```

Constants:

- `1.6`: `0xb2d300`
- `0.15`: `0xb2d2d8`
- `0.1`: `0xb2d118`
- `0.25`: inline at `0x3f86e4`

Then:

```text
minXWithMargins =
    minX - 1.7                    if generationBandsShouldBeFullWidth
    minX - (2M + Wt)              if text exists
    minX - 0.2S                   otherwise

maxXWithMargins = maxX + 0.2S
minZWithMargins = minZ
maxZWithMargins = maxZ + 0.1S
```

The full-width extension `-1.7` is `0xb33908`.  
Method: `-[InteractiveTreeView3DViewerGenerationBandObject updateGeometrySkippingAnimations:]`, `0x3f85dc–0x3f8980`.

Layouts `2/3` use the analogous side on Z, with text width `0.8 × X-span` (`0xb2d050`), text-height factors `0.2/0.1` (`0xb2d068`, `0xb2d118`), and full-width extension `-0.4` (`0xb2d338`).

### Gap splitting

Segmentation happens at every adjacent-person transition where both local-group identifiers exist and differ, provided `generationBandsShouldSegmentAccordingToLocalGroupIdentifier` is enabled. A large distance is not the trigger.

Let:

```text
m = min(previous.minification, current.minification)
p = 0.2m
g = max(0.01, 0.1m)
```

Constants: `0xb2d068 = 0.2`, `0xb2d118 = 0.1`, `0xb2d040 = 0.01`.

For layouts `0/1`, the tentative boundaries include person half-width, that side’s person spacing, and `p`:

```text
previousEnd = previous.x + previous.width/2 + previous.rightSpacing + p
currentStart = current.x - current.width/2 - current.leftSpacing - p
```

If `currentStart - previousEnd < g`, both boundaries are recentered around their midpoint so the final gap is exactly `g`. Otherwise the natural gap is retained. Layouts `2/3` do this on Z.

Dictionary keys are `startX/endX` at `0xc2a250/0xc2a270`, or `startZ/endZ` at `0xc2a290/0xc2a2b0`.  
Method: `-[InteractiveTreeView3DViewer(GenerationBands) rebuildGenerationBands]`, `0x15abb8–0x15ae04`.

### Style modes

Heights come from:

`-[InteractiveTreeView3DViewer elevationOfContentAboveBottomFloorForLocalGroupIdentifier:inGeneration:andReturnIfBloodRelationshipGroup:andIsPartOfCenteredRoot:]` at `0x415ea0`.

“Blood group” is true when at least one member’s `relationshipToRootPersonType` is `0`, `1`, or `2`. The exact enum names are not recoverable from these methods.

| Mode | Geometry | Elevation/height |
|---:|---|---|
| 0 | None | — |
| 1 | Flat `SCNPlane` | `0` |
| 2 | Raised `SCNShape` | `0.1` (`0xb2d118`) |
| 3 | Raised, prominent blood | blood `0.25` inline; other `0.1` (`0xb33950`) |
| 4 | Pedestal | `0.15` (`0xb2d2d8`) |
| 5 | Pedestal, prominent blood | blood `0.30` (`0xb2d0c8`); other `0.15` (`0xb33958`) |
| 6 | Small stairs | base `0.15`, step `0.15` (`0xb33958`) |
| 7 | Small stairs, prominent blood | base `0.15`; blood step `0.15`, other step `0.06 = 0.15×0.4` (`0xb2d070`) |
| 8 | Large stairs | base `0.30`, step `0.30` (`0xb33960`) |
| 9 | Large stairs, prominent blood | base `0.30`; blood step `0.30`, other step `0.12 = 0.30×0.4` |

For stair modes:

```text
level = generation - minimumGeneration
```

Layouts `1/2` reverse it:

```text
level = maximumGeneration - minimumGeneration - level
height = base + level × step
```

Thus default mode `5` is a rounded, two-level pedestal: a `0.06` cap over a lower body, reaching `0.30` beneath blood groups and `0.15` beneath partner-ancestor groups.

### Default color mode 0

The native color input is:

```text
paletteIndex = mod20(generationNumber - 8)
```

It is not directly the stored relative-generation value.  
Methods:

- `-[InteractiveTreeView3DViewerGenerationBandObject updateGeometrySkippingAnimations:]`, `0x3f8b30–0x3f8bb8`
- `+[CommonColorsHelper colorForHierarchicalLevel:]` at `0x248940`
- palette initializer block at `0x2489dc`

The 20-color palette is HSV:

```text
indices 0…9:
  H = fract(0.05 + 0.1i + 0.5)
  S = 0.7
  V = 0.95

indices 10…19:
  H = fract(0.1i + 0.5)
  S = 0.5
  V = 1.0
```

Constants: `0.05` at `0xb2d180`, `0.7` at `0xb2d0f8`, `0.95` at `0xb2e0d0`; `0.1/0.5/1.0` are inline in `0x2489dc–0x248ad8`.

Mode `0` then applies one of these exact appearance-code paths:

```text
appearance == 0:
  result = mix(base, white, 0.65)

appearance != 0:
  result = mix(base, RGB(0.05, 0.05, 0.05), 0.85)
```

`0.65` is `0xb2d514`; `0.05` is `0xb2d0e8`; `0.85` is `0xb2d028`. Blend direction is confirmed by `+[SYDrawing_ColorsHelper plattformColor:blendedWithColor:withFraction:]` at `0x8ad914`. The mapping of the integer appearance values to a named OS theme is not established by these methods, so it should not be guessed.

If the root’s native `generationNumber` is `8`, requested relative generations map directly as follows:

| Relative | Base HSV | Base RGB / hex | Appearance `0` | Appearance `!=0` |
|---:|---|---|---|---|
| -4 | `0.10, .50, 1` | `(1,.8,.5)` `#FFCC80` | `(1,.93,.825)` `#FFEDD2` | `(.1925,.1625,.1175)` `#31291E` |
| -3 | `0.20, .50, 1` | `(.9,1,.5)` `#E6FF80` | `(.965,1,.825)` `#F6FFD2` | `(.1775,.1925,.1175)` `#2D311E` |
| -2 | `0.30, .50, 1` | `(.6,1,.5)` `#99FF80` | `(.86,1,.825)` `#DBFFD2` | `(.1325,.1925,.1175)` `#22311E` |
| -1 | `0.40, .50, 1` | `(.5,1,.7)` `#80FFB3` | `(.825,1,.895)` `#D2FFE4` | `(.1175,.1925,.1475)` `#1E3126` |
| 0 | `0.55, .70, .95` | `(.285,.7505,.95)` `#49BFF2` | `(.74975,.912675,.9825)` `#BFE9FB` | `(.08525,.155075,.185)` `#16282F` |
| +1 | `0.65, .70, .95` | `(.285,.3515,.95)` `#495AF2` | `(.74975,.773025,.9825)` `#BFC5FB` | `(.08525,.095225,.185)` `#16182F` |

If the root number is not `8`, a relative-only sequence is not unique; use:

```text
mod20(rootGenerationNumber + relativeGeneration - 8)
```

The hex values above are ordinary RGB rounding of the native component math; AppKit color-profile conversion could alter displayed pixels.

When `desaturateColorsForPartnerAncestors` is enabled, a non-blood segment with a non-null local-group identifier is transformed in HSV:

```text
appearance == 0:
  saturation *= 0.4
  brightness *= 0.9
  material diffuse/ambient factors = 0.5 / 0.85

appearance != 0:
  saturation *= 0.3
  brightness *= 0.8
  material diffuse/ambient factors = 0.55 / 0.9
```

Constants are `0xb2d070`, `0xb2d1c8`, `0xb2d0c8`, `0xb2d050`, `0xb2de88`, and `0xb2d408`; method ranges `0x3f9094–0x3f9124` and `0x3f974c–0x3f97e0`.

For pedestal modes the cap uses that segment color. The lower body blends toward `predominentBackgroundColor`: fraction `0.45` when appearance equals `1` (`0xb2d278`), otherwise `0.7` (`0xb2cfb8`). Consequently its exact hex cannot be specified without the runtime background color.

### Text plane

Content:

- Birth-date line: one decimal year when `minYear == maxYear`, otherwise exact format `%ld - %ld` (`CFString 0xc69b50`).
- Generation line:
  - relative zero: localized key `_InteractiveTreeView_RootGeneration` (`0xc69b90`);
  - nonzero: localized key `_InteractiveTreeView_GenerationNumber` (`0xc69b70`), formatted with the signed relative generation.
- Generation text is suppressed when the builder has only one generation.
- There is no person-count line.

The exact localized English expansion of those keys is not present in the supplied binary material, so literal wording such as “Generation N” cannot be proven.

The plane uses the same `Wt/Ht` formulas above, rasterized at `300` pixels per world unit (`0xb2cf90`). It is rotated `-π/2` (`0xb2d030`), does not cast shadows, uses `renderOrder = 1`, constant lighting, and writes no depth.

Fonts from `-[... updateGeometrySkippingAnimations:]`, `0x3f9de8–0x3f9f20`:

- Both lines visible:
  - year line: platform default font, size `0.55 × texturePixelHeight` (`0xb2de88`);
  - generation line: platform default semibold, size `0.35 × texturePixelHeight` (`0xb2d250`).
- Only one line: platform default font at the full texture-pixel height.
- If the longest measured line exceeds the texture width, both fonts are uniformly scaled by `textureWidth/measuredWidth`.

These are macOS platform-default fonts, effectively system-font APIs; the exact PostScript face is not encoded here.

Text color is not a fixed `bandText` constant. For mode `0`, it is derived from the band’s shadow tint in HSV:

```text
shadow tint, appearance == 0:
  S = min(3Sband, 1)
  V = 0.6Vband

shadow tint, appearance != 0:
  black

text, appearance == 0:
  S = min(3Sshadow, 1)
  V = Vshadow × (0.5 if any partner segment was desaturated, else 0.8)

text, appearance != 0:
  S = min(3Sshadow, 0.7)
  V = min(3Vshadow, 1)
```

`0.6` is `0xb2d060`, `0.8` is `0xb2d050`, and `0.7` is `0xb2cfd0`; other factors are inline at `0x3f9338–0x3f93dc` and `0x3f9f24–0x3fa154`.

Vertical placement records:

```text
normalYPositionForTextNode  = first segment’s top height
highestYPositionForTextNode = maximum segment top height
```

For layouts `0/1`, normal placement is:

```text
native X = minXWithMargins + marginsForText + planeWidth/2
native Y = normalYPositionForTextNode + 0.01
native Z = (maxZ - minZ)/2 - planeHeight/2 - marginsForText
```

In web coordinates, native Y becomes label Z. If the label is moved, it uses `highestYPositionForTextNode + 0.01`. The offset `0.01` is `0xb2d040`.  
Method: `-[InteractiveTreeView3DViewerGenerationBandObject updateFromUpdateAtTime:]`, `0x3fbf04–0x3fc06c`.

Normal target transparency is `0.8` (`0xb2d050`); moved transparency is `0.45` (`0xb33688`).

With `moveBirthDateAndGenerationIfNotInViewBounds` enabled, the native code:

1. Builds the band footprint’s four world-space perimeter segments.
2. Projects them into camera space.
3. Insets the SceneKit view bounds, after application edge insets, by `12` points on each relevant dimension; `12` is inline at `0x3fba58`.
4. Intersects projected band-edge rays with the relevant viewport edges.
5. Keeps the closest valid intersection whose ray parameter is in `[0,1]`.
6. Moves the label laterally to that intersection, raises it to the highest segment top, and changes target transparency from `0.8` to `0.45`.

Method range: `0x3fb4d8–0x3fc0f0`.

## Web divergences

- The web uses arbitrary extrusions `70/10/44`, corner radius up to `34`, and bevel `7/6`, instead of native heights `0–0.30`, radius `min(w/6,l/6,.25)`, and chamfers `0.01–0.02`: [generationBands.js:65](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/generationBands.js:65), [generationBands.js:75](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/generationBands.js:75).

- `pedestalProminent` is collapsed to ordinary pedestal geometry, so default native mode `5` loses its `0.30` blood versus `0.15` partner-group height and its separate `0.06` cap: [generationBands.js:23](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/generationBands.js:23).

- “Prominent blood” changes the web color mode to `highSaturation`. Native prominence changes elevation only; color desaturation is independently controlled by `desaturateColorsForPartnerAncestors`: [generationBands.js:59](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/generationBands.js:59).

- Stair height is `abs(relativeGeneration) × 12/28`, independent of minimum/maximum generation, layout direction, and blood group. Native uses `0.15/0.30` bases and steps, reversed for layouts `1/2`, with `0.4×` partner steps only in prominent modes: [generationBands.js:5](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/generationBands.js:5).

- The extra `generationDepthZ = generation × 18` is not native band elevation; native elevation is style-driven and always measured above the common floor: [constants.js:5](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/constants.js:5).

- The `macPink`, ancestor, descendant, and high-saturation arrays do not implement native mode `0`’s 20-entry HSV wheel or appearance blending: [generationBands.js:284](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/generationBands.js:284), [generationBands.js:348](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/generationBands.js:348). The color-mode list also presents `macPink` as a distinct first mode, whereas native numeric mode `0` is the hierarchical palette described above: [constants.js:108](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/constants.js:108).

- Web splitting uses generation-dependent thresholds of `980/760/560/520` and never splits generations `>=0`. Native splits every local-group transition and only uses a scale-dependent minimum gap `max(.01,.1m)`: [macTreeStyle.js:43](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/macTreeStyle.js:43).

- Web labels are created per segment; native has one band-level text plane: [generationBands.js:175](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/generationBands.js:175).

- The web adds a person-count line. Native displays only dates and/or localized generation text: [generationBands.js:165](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/generationBands.js:165).

- Web labels use fixed `276×92` or `176×58` planes and skip narrow/long segments. Native sizes the plane from the generation span and label flags: [generationBands.js:172](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/generationBands.js:172).

- Web text is unusually heavy (`800/750`) and hard-coded by root/non-root. Native uses platform regular plus semibold and derives text color from the band/shadow HSV: [generationBands.js:219](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/generationBands.js:219). The fixed `bandText` values in [palette.js:22](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/palette.js:22) do not represent the native formula and are not used by the current generation-label renderer.

- Web disables label depth testing and fixes label Z at `-18`; native reads depth, writes no depth, and places the label `0.01` above the selected band top: [generationBands.js:202](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/generationBands.js:202).

- Web shadows scale by percentages and use offsets `(+12,-18,-depth-10)`. Native shadow growth is an absolute `+0.23` in both footprint dimensions with no comparable lateral offset: [generationBands.js:100](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/generationBands.js:100).

- The string style list is usable, but its array order is not native numeric order: native is `none, flat, raised, raisedProminent, pedestal, pedestalProminent, …`. Any numeric-index migration based on [constants.js:95](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/constants.js:95) would be shifted.

## Recommended fixes

1. **Replace band color mode `0` with the native HSV algorithm.** Implement the 20-color formula, `generationNumber - 8` indexing, and appearance blends exactly. Remove the prominent-style promotion to `highSaturation`. This will produce the largest immediate parity improvement.

2. **Make `pedestalProminent` the native mode-5 geometry.** Define one native-to-web scale `U`, then use:
   ```text
   blood height = 0.30U
   other height = 0.15U
   cap = 0.06U
   cap chamfer = 0.0175U
   body chamfer = 0.01U
   radius = min(width/6, length/6, 0.25U)
   ```
   Render cap and body as separate meshes so their colors/materials can differ.

3. **Implement all style heights from the native table.** Eliminate `44/70` and `abs(generation)×12/28`. Stair height should be `base + level×step`, with layout reversal and `0.4×` non-blood steps in modes `7/9`.

4. **Replace `macBandSplitGap()` with local-group splitting.** Split at every identifier change; compute `p=0.2m` and `g=max(0.01U,0.1m)` and enforce `g` around the midpoint only when the natural gap is smaller.

5. **Remove the artificial per-generation Z staggering for bands.** In the web coordinate system, set each band floor to common web `Z=0`; its top is the style elevation. Figures and labels should be lifted by that same local-group elevation.

6. **Rebuild labels as one plane per band.** Remove the people count, use the native `Wt/Ht/M` formulas, regular system font for years, semibold only for the second generation line, and uniform fit-to-width scaling. Use `depthTest=true`, `depthWrite=false`, normal opacity `0.8`, moved opacity `0.45`, and web `Z=selectedBandTop+0.01U`.

7. **Simplify shadows to the native proportions.** Size them to `width+0.23U` by `length+0.23U`, center them beneath the block, and use opacity `0.25`; remove the current percentage enlargement and lateral offset.
