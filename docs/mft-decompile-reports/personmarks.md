## Native spec

### Person body sizing and scaling

Let the cached `.dae` bounding-box size be \(N=(n_x,n_y,n_z)\), and the allotted `bodyContentRect` size be \(C=(c_w,c_h)\).

- `+[InteractiveTreeView3DViewer(LoadModels) cachedFlattenedGeometryFromSceneName:andReturnSize:]` obtains the root node bounding box and returns `max-min` unchanged. `-[InteractiveTreeView3DViewerPersonObject(Body) buildNewBodyNodeAndReturnBodyNodeSize:forBodyNodeContentSize:]` copies that 24-byte size directly to the output at `0x10003c–0x100048`. There is no scaling, normalization, or fixed target size in this method. Therefore the return is the natural flattened-model bounding size; its concrete numbers are asset-dependent, not constants in the executable.

- `-[InteractiveTreeView3DViewerPersonObject updateAsNewlyCreatedObject:andIsFirstUpdate:]` computes a uniform fit:

  \[
  s=\min\left(\frac{c_w}{n_x},\frac{c_h}{n_z},\frac{1}{n_y}\right)
  \]

  Terms whose denominator is non-positive are skipped. The height cap `1.0` is immediate at `0xb6124`. Native \(x,z\) are the footprint dimensions; \(y\) is world-up.

- `bodyPositionNode` gets scale `(s,s,s)` and position:

  \[
  (\operatorname{midX}(C),\ y_\text{lift},\ \operatorname{midY}(C))
  \]

  at `0xb64c0–0xb64d0`. The `.dae` geometry itself is not bbox-recentered or grounded here.

- The occupied body rectangle is centered in `bodyContentRect` with size:

  \[
  (n_xs,\ n_zs)
  \]

  at `0xb64fc–0xb6544`.

- Normal non-flat `.dae` lift is `0`. Style `3` with a non-`PersonImage` body uses `0.015` (`0xb2d3d0`). Hover/co-hover adds `0.35` (`0xb2d250`).

- Hover scale for an actual `.dae` body is `1.4` uniformly (`0xb2d058`) in `updateAsNewlyCreatedObject...`. Non-hover is `1.0` immediate at `0xb6200`.

- `-[InteractiveTreeView3DViewerPersonObject personImageScalingWhenHovering]` is for `PersonImage` planes, not `.dae` bodies:

  \[
  h_\text{image}=\min\left(4,\frac{2.3}{m}\right)
  \]

  and, if camera zoom \(z<1\), divides the result by \(z\). `2.3` is at `0xb2d3a8`; `4.0` is immediate at `0xb5a4c`.

- The complete person object is finally scaled by `personInfo.minification = m` on all axes at `0xb73ac–0xb7438`. Thus an ordinary `.dae` vertex ultimately receives uniform scale:

  \[
  m \cdot s \cdot
  \begin{cases}
  1.4 & \text{hover/co-hover}\\
  1.0 & \text{otherwise}
  \end{cases}
  \]

- `widthFactorForPersons` does not stretch the model. In `-[InteractiveTreeView3DViewer(Sizes) sizeOfObjectForInfo:withMinificationScaling:]`, when person-information space is required, it makes the allocated width `widthFactorForPersons × minificationScaling` at `0x282a64–0x282a94`. Layouts 2/3 initially use `2 × widthFactorForPersons` at `0x282b18–0x282b28`. Without information space, width and height are simply the supplied minification scaling at `0x282aec–0x282af4`. Its effect on the body is indirect through \(c_w\) in the uniform-fit formula.

- `largestPersonScaling` is not a featured-person multiplier. `-[InteractiveTreeView3DViewerGenerationBandObject updateMinAndMaxYearAndScalingFromPersonInfos]` initializes it to zero and stores the maximum `minification` encountered at `0x3f8478–0x3f8494`. No root-special body scale is applied. For equal rect and minification, root versus non-root body scale is exactly `1:1`, not `88:58`.

### Body shadow

`-[InteractiveTreeView3DViewerFakeRoundShadowNode initWithViewer:]`, called from `PersonObject updateAsNewlyCreatedObject...`, creates:

- `SCNPlane(width:1,height:1)`, immediates at `0x494f8c–0x494f94`.
- Diffuse texture `InteractiveTreeViewFakeRoundShadow`, CFString `0xc71a90`.
- `castsShadow = NO`, category `2`, `writesToDepthBuffer = NO`.
- The caller rotates it by Euler X `-π/2` (`0xb2d030`) and overrides rendering order to `10`.

Its final dimensions are:

\[
W_s=1.8\,n_xs,\qquad H_s=1.65\,n_zs
\]

from `-[InteractiveTreeView3DViewerPersonObject updateAsNewlyCreatedObject:andIsFirstUpdate:]`, constants `1.8` at `0xb2d3c0` and `1.65` at `0xb2d3c8`.

It is centered at the same native \(x,z\) as the body. The plane has only a vertical anti-z-fighting offset of `+0.01` (`0xb2d040`); there is no directional ground-plane offset.

For `.dae` bodies, material transparency becomes `0.4` (`0xb2d0b8`) in `updateForChangedCameraMode:andZoom:andIsFirstUpdate:`. Bodies whose node name ends in `Flat` use `0.2` (`0xb2d430`).

No material tint is set. Exact shadow RGB/hex and per-pixel alpha are encoded in the unavailable texture asset, so they are not decidable from the binary. Only the `0.4`/`0.2` opacity multiplier is concrete.

### Root mark

`+[InteractiveTreeView3DViewerPersonObjectRootMarkNode height]` returns `0.05` (`0xb2d180`).

For default layouts 0/1, `PersonObject updateAsNewlyCreatedObject...` sets the mark’s stored `radius` property to:

\[
R_r=1.25\max(c_w,c_h)
\]

where \(c_w,c_h\) are `bodyContentRect` dimensions; `1.25` is immediate at `0xb6980`.

`-[...RootMarkNode createShape]` then builds:

- `SCNCylinder(radius:R_r/2,height:0.05)`. Therefore actual disc radius is \(0.625\max(c_w,c_h)\), and diameter is \(1.25\max(c_w,c_h)\).
- The mark is positioned `0.01` above the person base (`0xb2d040`).
- A `FakeRoundShadowNode` of square size `1.25 × R_r`, i.e. \(1.5625\max(c_w,c_h)\), with node opacity `1.0`; factor `1.25` is immediate at `0x3e8d4`.

Layouts 2/3 use stored radius:

\[
R_r=1.04\max(c_w,c_h)
\]

with `1.04` at `0xb2d3d8`.

Color is derived from person platform color \(C\):

- Light UI: diffuse and ambient \(=0.7C+0.3(1,1,1)\). Endpoint is `#FFFFFF` / `(1,1,1)`; fraction `0.3` is `0xb2cfb0`.
- Dark UI: diffuse \(=0.5C\), ambient \(=0.3C\), blending toward `#000000` / `(0,0,0)`. Diffuse fraction `0.5` is immediate at `0x3e778`; ambient fraction `0.7` is `0xb2cfb8`.

`RootMarkNode` creates no dots, text geometry, images, or `NSFont`. It is a solid cylinder plus shadow. Any normal person name/date plane is separate PersonObject content; there is no dedicated name/date rendered “inside” this node.

### Selection mark

`-[InteractiveTreeView3DViewerPersonObjectSelectionMarkNode createShape]` uses separate spheres, not a torus:

- Base sphere radius `0.5`, immediate at `0x45ef38`.
- Uniform node scale `0.07` (`0xb33a88`), giving actual dot radius `0.035`.
- Sphere segment count `12`, immediate at `0x45ef44`.
- Dot-center ring radius is `R_s/2`.
- Dot count after `setRadius:` is:

  \[
  N=\operatorname{trunc}(8\pi R_s)
  \]

  from `2R_s × π` followed by `fcvtzs ..., #2` at `0x45e90c–0x45e91c`; π is `0xb2d2b0`. The initial count `34` at `0x45e828` is normally replaced when radius is set.
- Dots cast shadows, category `2`, render order `75`.

For default layouts 0/1:

\[
R_s=1.15\max(c_w,c_h)
\]

using `1.15` at `0xb2d3e8`; therefore the dot-center radius is \(0.575\max(c_w,c_h)\).

If the person is both root and selected, the mark is raised to `0.01 + 0.05 = 0.06`; otherwise its base height is zero in these layouts.

Selection color:

- With tint \(C\): \(0.6C+0.4B_\text{inv}\), where \(B_\text{inv}\) is the inverted predominant background; `0.4` at `0xb2cfc0`.
- Without tint: `#66B3FF`, float RGB `(0.4, 0.7, 1.0)` from `0xb2cfc0`, `0xb2cfb8`, and immediate `1.0`.
- Ambient intensity `1.4` (`0xb2d058`); diffuse intensity `1.0`.

### Further-person marks

`-[InteractiveTreeView3DViewerPersonObject(FurtherPersonsIndicators) updateFurtherPersonMarkWithNodeRef:...]` creates a short capsule with a ball at the person end:

- Start: `(anchorX, 0.025, anchorZ)`, `0.025` at `0xb2e4f8`.
- End: `start + direction × 0.3900000155`; length at `0xb336a0`.
- Capsule cap radius/thickness: `0.02500000037` (`0xb2d0ec`).
- Capsule radial and cap segments: `8`, immediates at `0x56eb00` and `0x56eb0c`.
- Endpoint sphere starts with radius `1`, then scales to `2×thickness`, producing radius `0.05`; immediates at `0x56ece4` and `0x56ed4c`.
- Color is the resolved person platform color blended 25% toward `#000000` / `(0,0,0)`:

  \[
  C_f=0.75C
  \]

  Fraction `0.25` is immediate at `0x343718`.

For default layout 0, rotating the base vector `(0,-1)` gives:

| Meaning | Usage | Native XZ direction | Web XY direction |
|---|---:|---:|---:|
| Parents | 0 | `(0,-1)` | `(0,-1)` |
| Children | 1 | `(0,+1)` | `(0,+1)` |
| Male partner | 3 | `(-1,0)` | `(-1,0)` |
| Female partner | 2 | `(+1,0)` | `(+1,0)` |

The rotation constants are `180°` at `0xb2d218`, `90°` at `0xb2d228`, and `270°` at `0xb2d560`.

### Connector endpoints

`-[InteractiveTreeView3DViewerPersonObject connectionPointForObject:forUsage:andPreventReturningInsidePoint:]` does not use a fixed radial distance. It anchors against `occupiedBodyContentRect`.

For default layout 0:

- Parents: centerline at the rect’s native `minZ`.
- Children: centerline at `personInfo.size.height/(2m) + 0.1` when preventing an inside endpoint.
- Female partner: rect right-edge midpoint.
- Male partner: rect left-edge midpoint.
- Usage 4: rect center.

The safety extension is `0.1` at `0xb2d118`. Layout 1 swaps the parent/child sides. Layout 2 rotates these to left/right and layout 3 reverses left/right. Flat/photo-specific branches may return the rect center.

World-up endpoint height is:

\[
Y=elevation_\text{band}+0.1m
\]

using `0.1` at `0xb2d118`.

`-[... clampOtherConnectionPoint:toBorderComingFromPoint:withBorderOverlap:]` intersects the incoming line with `completeContentRect`, then returns:

\[
P=I+\operatorname{normalize}(P_\text{incoming}-I)\times overlap
\]

while preserving the incoming Y coordinate. `overlap` is a caller-supplied parameter; this method contains no fixed overlap constant, and no concrete caller value is present in the supplied dumps.

## Web divergences

- The web scales every `.dae` by its largest 3D bbox axis to fixed targets `58` or `88`, making the featured body `1.517×` larger. Native fits \(x,z\) to the allocated rect, caps native Y at `1`, and has no root multiplier. See [referenceModels.js:75](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/referenceModels.js:75) and [macTreeStyle.js:15](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/macTreeStyle.js:15).

- The web bbox-centers and grounds the model after scaling. Native places the authored flattened geometry under a centered `bodyPositionNode` without bbox translation. See [referenceModels.js:86](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/referenceModels.js:86).

- Web `personWidth` anisotropically multiplies model X. Native applies `widthFactorForPersons` to the allotted person width, followed by a uniform body fit. See [personNodes.js:77](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:77), [personNodes.js:161](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:161), and [personNodes.js:234](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:234).

- Regular minification scales the web model and label, but not the shadow, selection mark, further-person mark, or other person children. Native applies minification to the complete PersonObject. See [personNodes.js:144](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:144).

- Web shadows are fixed `194×66`, opacity `0.17`, directionally offset and placed at `-20`; the featured shadow is separately scaled from a `230×230` card. Native body shadows are centered, model-relative `1.8×/1.65×`, and opacity `0.4` for `.dae`. See [personNodes.js:147](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:147), [personNodes.js:203](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:203), [personNodes.js:469](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:469), and [macTreeStyle.js:19](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/macTreeStyle.js:19).

- The featured web node is a textured white card containing 36 dots, name, and birth date. Native `RootMarkNode` is a solid tinted cylinder with no dots or text; dots belong only to `SelectionMarkNode`. See [personNodes.js:606](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:606).

- Web selection is a continuous torus with fixed radii `68` or `0.46×ROOT_CARD.w`. Native uses variable-count spheres of radius `0.035`, with ring size derived from `bodyContentRect`. The featured node also only adds this mark for hover, not selected-root state. See [personNodes.js:230](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:230) and [personNodes.js:495](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:495).

- Web further-person marks are sphere-plus-cone teardrops with featured-specific sizes and gender-deep color. Native uses a constant-width capsule plus a `2t` endpoint ball, resolved person color darkened 25%, and supports separate parent, child, male-partner, and female-partner directions. See [personNodes.js:350](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:350) and [personNodes.js:382](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personNodes.js:382).

- Web connectors use fixed center radii `30`, `60`, `90`, and `96`; native samples the occupied body rectangle and has no root-ring connector radius. See [macTreeStyle.js:22](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/macTreeStyle.js:22).

## Recommended fixes

1. **Remove featured-body enlargement.** As a safe first patch, set `featuredModelSize` to `58`, matching `regularModelSize`. Then replace largest-axis normalization with the native mapped-axis fit: footprint X/Y to the allocated body rect and upright Z to one shared web-unit height cap.

2. **Replace the featured texture card with native marks.** Render a solid root cylinder with radius `0.625 × max(bodyContentWidth, bodyContentHeight)`, height `0.05U`, and base offset `0.01U`, where `U` is the web conversion for one native unit. Keep ordinary person text separate. Add the dotted selection ring only when selected.

3. **Make selection dots literal spheres.** Dot-center radius `0.575M`, dot radius `0.035U`, count `trunc(8π×1.15M/U)`, using the person tint/background blend. This is materially closer than a torus.

4. **Correct scaling ownership.** Put all visual children in an inner content group and uniformly scale that group by `node.scale`. Remove `model.scale.x *= personWidthScale(...)`; apply width factor to layout/content width instead.

5. **Correct body shadows.** Center the shadow under the figure, remove the angle/distance offset for this shadow type, use dimensions `1.8 × fittedFootprintWidth` and `1.65 × fittedFootprintDepth`, height `0.01U`, and opacity `0.4` (`0.2` for Flat).

6. **Replace teardrop indicators.** Use length `0.39U`, capsule radius `0.025U`, start ball radius `0.05U`, height `0.025U`, and `0.75 × resolvedPersonColor`. Preserve four independent directions.

7. **Replace featured connector radii immediately.** As a minimal patch, use the same body-based radii for featured and regular nodes—`featuredConnectorRadius: 30` and `featuredHorizontalConnectorRadius: 60`—instead of attaching to the root card. Longer-term, calculate each endpoint from the occupied body footprint rather than any fixed radius.
