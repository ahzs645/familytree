## Native spec

### Fonts and scale mapping

All font methods are in `InteractiveTreeView3DViewerPersonObject(PersonInformationTextImage)` ([asm-textimage.txt:408](/private/tmp/claude-501/-Users-ahmadjalil-github-familytree/02ad8618-f10b-49e2-aa84-8200f418d3d2/scratchpad/asm-textimage.txt:408)).

| Content | Native call | Size | Constant |
|---|---|---:|---|
| Full name | `defaultPlattformFontOfSize:` | 14 pt, regular/default | `fontForFullName`, `0x4601a8` |
| Birth/death | `defaultPlattformFontOfSize:` | 12 pt, regular/default | `fontForDates`, `0x4601b8` |
| Kinship | `defaultPlattformFontOfSize:` | 10 pt, regular/default | `fontForKinships`, `0x4601c8` |
| Numbering | `defaultPlattformFontOfSize:` | 10 pt, regular/default | `fontForNumberingSystem`, `0x4601d8` |
| Associate relation | `defaultBoldPlattformFontOfSize:` | 10 pt, bold | `fontForAssociateRelationType`, `0x4601e8` |

The exact macOS family and numeric weight are not decidable from this category: it calls platform helper methods rather than `NSFont systemFontOfSize:` directly. “Default platform font” is established; claiming SF Pro or a specific weight such as 400/700 would require that helper’s implementation.

Scale constants:

- `sceneToPixelRatio = 250.0f`, encoded as `0x437a0000` at `sceneToPixelRatio`, `0x4601f0`.
- `baseScaleRatio = 100.0f`, encoded as `0x42c80000` at `baseScaleRatio`, `0x4601fc`.

For additional texture scaling factor \(A\), `createPersonInformationImage…` uses:

\[
P = 250A\quad\text{bitmap pixels per scene unit}
\]

\[
1\text{ logical text point}=1/100=0.01\text{ scene units}
\]

\[
1\text{ bitmap pixel}=1/(250A)\text{ scene units}
\]

The CGContext transform is \(P/100=2.5A\), and bitmap dimensions are approximately:

\[
(\lceil w_{\rm scene}P\rceil,\ \lceil h_{\rm scene}P\rceil)
\]

See `createPersonInformationImageWithSpaceInContentRect:withAdditionalScalingFactor:andReturnBytes:` at `0x460404–0x460554`.

### Text colors

At `0x4603b8–0x4603f8`, the base text color depends on `userInterfaceAppearance`:

- Light appearance: black, `#000000`, RGB `(0.0, 0.0, 0.0)`, alpha `1.0`.
- Dark appearance: white, `#FFFFFF`, RGB `(1.0, 1.0, 1.0)`, alpha `1.0`.

The full name uses this color unchanged. Every other text row—dates, kinship, numbering, and associate relation—uses the same RGB with alpha `0.4`:

- Light: `#00000066`, RGBA `(0.0, 0.0, 0.0, 0.400000006)`.
- Dark: `#FFFFFF66`, RGBA `(1.0, 1.0, 1.0, 0.400000006)`.

The alpha is loaded from `0xb2cfc0`; `decode_const.py b2cfc0 f` gives `0.4000000059604645`. Loads occur at `0x460728`, `0x4608d4`, `0x460a0c`, `0x460abc`, and `0x460b6c`.

### Row order and layout

`createPersonInformationImageWithSpaceInContentRect:…` draws in this order ([asm-textimage.txt:462](/private/tmp/claude-501/-Users-ahmadjalil-github-familytree/02ad8618-f10b-49e2-aa84-8200f418d3d2/scratchpad/asm-textimage.txt:462)):

1. Full name.
2. Birth date, if enabled and nonempty.
3. Death date, if enabled and nonempty.
4. Localized kinship, if both builder and configuration permit it.
5. Localized numbering-system string.
6. Localized associate-relation type, only when permitted and the person is not part of the centered root.
7. One image/icon row.

Alignment depends on `generalLayoutFromBuilder`:

- Modes `2` and `3`: left-aligned.
- Other modes: centered.

This is established both by the text alignment argument at `0x460380–0x4603b4` and by the icon-row coordinate calculation at `0x460f1c–0x460f44`.

Name layout:

- Starts at logical `y = 3`.
- Maximum line height: `15`.
- Measurement rectangle: `W × 30`.
- Drawn height: \(\min(\text{measured height},30)\).
- Line-break mode argument is `0`, corresponding to word wrapping.
- Therefore it occupies at most two 15-point lines.
- No explicit ellipsis or truncation string is created. Content beyond the two-line rectangle is clipped by the capped draw rectangle.

Constants/calls: `0x460588–0x4605e0`.

Date rows:

- Font 12, maximum line height 12, row text height capped at 12.
- Line-break mode argument `5`: middle truncation.
- Birth-to-death spacing is 3 logical points when both exist; otherwise the terminal spacing after the birth row is 6.
- Death always advances by its height plus 6.

Kinship:

- Font 10, word-wrapped.
- Measured in `W × 20`, maximum line height 10: at most two lines.
- Advances by measured/capped height plus 6.

Numbering:

- Font 10, word-wrapped.
- Renderer allows `W × 20`, but `heightOfPersonInformation…` budgets only `W × 12`. This is a native internal mismatch and should be retained only if strict bug-for-bug parity is required.
- The native renderer receives `localizedNumberingSystemString` verbatim; it does not add `"# "`.

Associate relation:

- Bold 10.
- Word-wrapped in `W × 30`, maximum line height 10: at most three lines.
- Advances by height plus 6.

### Birth/death “prefixes”

There are no Unicode prefix strings such as `☆ ` or `† ` in this method.

The renderer draws the date string itself unchanged, with a separate conclusion-icon asset in a 12×10 logical rectangle:

- Birth identifier at `0xc00ef0`: decoded CFString `_PersonEvent_Birth`.
- Death identifier at `0xc00f30`: decoded CFString `_PersonEvent_Death`.

They are passed to `platformIconForConclusionTypeIdentifier:` at `0x460668–0x460674` and `0x460810–0x46081c`. The image is fitted into 12×10 and drawn at fraction/alpha `0.4` (`0xb2cfc0`).

Thus the native logical format is:

```text
[birth conclusion icon, 12×10] [birthDate verbatim]
[death conclusion icon, 12×10] [deathDate verbatim]
```

Whether those assets visually resemble a hollow star and dagger cannot be decoded into exact Unicode from this assembly; they are images, not characters.

### Labels, groups, and icon row

“Labels” and “person groups” are not text lines. Their platform images are appended to the final icon array.

Native image order is:

1. FamilySearch pinned.
2. FamilySearch matches found.
3. FamilySearch auto-matched.
4. FamilySearch record matches.
5. FamilySearch further information.
6. FamilySearch updates.
7. Person-label image.
8. Person-groups image.
9. Notes image, decoded name `InteractiveTreeViewHasNoteIcon` at `0xc6f9b0`.
10. Media image, decoded name `InteractiveTreeViewHasMediaIcon` at `0xc6f9d0`.
11. Ready-ordinances image.

Icon sizing for \(N\) images and logical width \(W\):

\[
S=
\begin{cases}
20,&22N\le W\\
\left\lfloor\frac{W-2N}{N}\right\rfloor,&22N>W
\end{cases}
\]

Each image is aspect-fitted into `S × S`, with 2 logical points between slots. The block is centered except in layout modes 2/3, where it begins at `x=0`. The height routine reserves 26 logical points for the row.

Relevant assembly: `0x460bb8–0x460fb0`.

### Height and wrap width

For the content-dependent branch of `heightOfPersonInformationForPersonInformation:forViewer:forWidth:returnMaximumPossibleHeight:` ([asm-textimage.txt:1654](/private/tmp/claude-501/-Users-ahmadjalil-github-familytree/02ad8618-f10b-49e2-aa84-8200f418d3d2/scratchpad/asm-textimage.txt:1654)):

\[
W=\lfloor100\,w_{\rm scene}\rfloor
\]

Define:

\[
m(s,f,L,H)=\min\bigl(
\operatorname{heightOfString}(s,f,\text{maxLineHeight}=L,\text{bounds}=W\times H),
H\bigr)
\]

Then:

\[
R=m(name,14,15,30)+9
\]

Add for each nonempty/enabled field:

- Birth: \(m(birth,12,12,12)+6\)
- Death: \(m(death,12,12,12)+6\)
- Kinship: \(m(kinship,10,10,20)+6\)
- Numbering: \(m(numbering,10,10,12)+6\)
- Associate relation: \(m(associate,10_{\rm bold},10,30)+6\)
- Any qualifying icon: `26`

The returned scene height is:

\[
h_{\rm scene}=\frac{\lceil R\rceil-5}{100}
\]

Constants and arithmetic: `0x46174c–0x4619e4`.

The width is not a universal fixed constant. It is the method’s `forWidth:` input, converted to \(W=\lfloor100w\rfloor\). The caller uses the person-information content width; in general layout modes 2/3 it supplies half the available width, while modes 0/1/100 use the full width (`updateAsNewlyCreatedObject:andIsFirstUpdate:`, `0xb5be0–0xb5d24` in `asm-personbody.txt`).

The flag-named maximum-possible-height branch uses this fixed estimate:

\[
h_{\max}=\frac{
37
+18B
+18D
+26K
+36A
+18N
+26I
-6
}{100}
\]

where:

- \(B,D\): corresponding display flags.
- \(K\): kinships permitted and displayed.
- \(A\): associate relation permitted and person is not in the centered root.
- \(N\): numbering permitted and active.
- \(I\): any potentially enabled icon category.

Constants are immediate at `0x4614c0` (`37`), `0x4614c8` (`55 = 37+18`), `0x4614e0` (`18`), `0x461514` (`26`), `0x461544` (`36`), `0x46157c` (`18`), `0x4615dc` (`26`), and `0x4615e4` (`−6`).

### Background plane

`createPersonInformationBackgroundImageWithSpaceInContentRect:` creates a separate lower-resolution texture ([asm-textimage.txt:2016](/private/tmp/claude-501/-Users-ahmadjalil-github-familytree/02ad8618-f10b-49e2-aa84-8200f418d3d2/scratchpad/asm-textimage.txt:2016)):

- Resolution: \(250/3=83.\overline3\) bitmap pixels per scene unit.
- Logical drawing scale remains 100 units per scene unit.
- Rounded rectangle is inset by 5 logical points, or `0.05` scene units.
- Corner radius: 6 logical points, or `0.06` scene units.
- Shadow: black with alpha `0.7`, CGContext offset `(1,−1)`, blur `4`.
  - `0xb2cfb8` decodes to `0.699999988079071`.
  - Shadow color approximately `#000000B3`.
- Light fill: `#FFFFFF`, RGB `(1,1,1)`, alpha `1`.
- Dark fill: approximately `#262626`, RGB `(0.150000006, 0.150000006, 0.150000006)`, alpha `1`.
  - `0xb2cfac` decodes to `0.15000000596046448`.
- Pixels outside the rounded rectangle/shadow remain transparent.
- The background plane is rendered behind the text plane: rendering orders 19 and 20 respectively.
- Its width and height are the foreground plane’s dimensions plus `0.25` scene units (`updateAsNewlyCreatedObject…`, `0xb6824–0xb68c4`).

There is no additional node opacity applied here; the central fill is opaque, while only the shadow and transparent exterior carry partial/zero alpha.

### Full dates versus years

This renderer contains no full-date-versus-year-only branch.

When `displayBirthDate` or `displayDeathDate` is true, it retrieves `birthDate`/`deathDate` and draws that `NSString` verbatim (`0x460294–0x4602cc`, then `0x46065c–0x460990`). The flags govern visibility only.

Therefore:

- A full date is shown when the upstream `birthDate`/`deathDate` string is a full date.
- A year is shown when that upstream string contains only a year.
- The exact upstream rule that constructs those strings is genuinely undecidable from `asm-textimage.txt`; inventing a zoom- or configuration-based year switch would be incorrect.

The builder trace corroborates that already-formatted display-property strings are assigned directly via `setBirthDate:` and `setDeathDate:` (`updatePropertiesOfInfo:`, `0x548780–0x5487c4` in `asm-builder.txt`).

Native label visibility is separately controlled by minification:

- Reserve space only when `minification >= 0.25`.
- Render when `minification >= 0.25`, or when hovered below that threshold.

Methods: `shouldShowPersonInformationImageForPersonInformation:forViewer:` at `0x461410` and `needsSpaceForPersonInformationImageForPersonInformation:forViewer:` at `0x461454`.

## Web divergences

- The web hard-codes Unicode `☆` and `†` into the date strings. Native uses separate conclusion-icon images and passes the recorded date unchanged. See [personNodes.js:9](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:9).

- Typography is substantially heavier: name weight `780/850`, dates `700`, kinship `650`, and numbering `750`. Native uses its regular/default font for all except the bold associate relation. See [personNodes.js:547](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:547).

- The web uses fixed light-theme colors (`#17191d`, `#747b86`, `#5c6580`, blue numbering, purple groups). Native is monochrome, appearance-adaptive black/white, with all non-name text at alpha 0.4. See [personNodes.js:547](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:547).

- Web sizing is a fixed `420×230` canvas and fixed plane dimensions. Native measures every row and creates a variable-height plane from the formula above. See [personNodes.js:538](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:538) and [personNodes.js:187](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:187).

- The web background is fully transparent and has no native rounded white/dark backing plane or shadow. See [personNodes.js:539](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:539).

- The web explicitly ellipsizes the second name line. Native word-wraps into a rectangle capped at two lines but does not construct an ellipsis. See [personNodes.js:665](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:665).

- Web always centers text. Native left-aligns modes 2/3.

- Web adds `"# "` before numbering and colors it blue. Native draws the localized numbering string verbatim in the common secondary monochrome color. See [personNodes.js:573](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:573).

- Web renders person groups as purple bullet-delimited text and notes/media as emoji. Native places platform-provided label, group, notes, and media images in one icon row. See [personNodes.js:589](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:589).

- Native has a bold localized associate-relation row. The web has no equivalent; its `eventDescription` row is a different data concept. See [personNodes.js:581](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:581).

- Web interprets `displayLabels` as permission to create the entire name/date plane. Native `displayLabels` controls the person-label image in the icon row; overall information-plane visibility instead depends on minification/hover. See [personNodes.js:187](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:187).

- `yearLabel()` deliberately extracts only a year, and `lifeSpanLabelFor()` creates a combined range. Neither behavior matches the native texts plane, which draws separate verbatim dates. `formatVitalDateParts()` also uses `*`, `◆`, `b.`, or `d.` rather than native image assets. See [vitalFormat.js:26](/Users/ahmadjalil/github/familytree/src/lib/vitalFormat.js:26), [vitalFormat.js:31](/Users/ahmadjalil/github/familytree/src/lib/vitalFormat.js:31), and [vitalFormat.js:53](/Users/ahmadjalil/github/familytree/src/lib/vitalFormat.js:53).

## Recommended fixes

1. Replace the fixed `420×230` label with measured, variable-height content. Use `100` logical units per scene unit, the native row caps/spacings above, and size the Three.js plane from the resulting scene height.

2. Add the rounded background. For a simple shippable implementation, combine it into the same canvas: opaque `#FFFFFF`/`#262626`, inset `5` logical points, radius `6`, black shadow alpha `0.7`, blur `4`, and extend the plane by `0.25` scene units.

3. Match typography and colors: 14 regular name; 12 regular dates; 10 regular kinship/numbering; 10 bold associate relation. Use black/white by theme and alpha `0.4` for every row except the name.

4. Stop embedding `☆`/`†` in date strings. Reserve a separate 12×10 slot and draw birth/death conclusion icons at alpha `0.4`; keep the date value verbatim. The precise native icon artwork must be sampled from the app/assets because the assembly only establishes its identifiers.

5. Implement native row behavior: name maximum two wrapped lines; dates middle-truncated; kinship maximum two lines; associate relation maximum three; 3 points between birth and death, otherwise 6-point row gaps.

6. Treat `displayLabels` as an icon-row option, not as the master switch for name/date rendering. Add the native `minification >= 0.25 || hovered` visibility rule.

7. Keep `vitalFormat.yearLabel()` and lifespan ranges out of the regular texts-plane path. They may remain for other UI surfaces, but native-parity labels should consume the recorded birth/death strings directly.
