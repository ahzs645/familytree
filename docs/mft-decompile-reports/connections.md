## Native spec

### Geometry and scale

The family object does **not** render its connectors as `SCNCylinder`. It creates `InteractiveTreeView3DViewerBaseConnectionObjectConnectionNode` objects; their visible geometry is `SCNCapsule`.

In `-[InteractiveTreeView3DViewerFamilyConnectionObject updateAsNewlyCreatedObject:andIsFirstUpdate:]`:

\[
t=\min(m_{\text{avg}}\times c_{\text{thickness}}\times k,\ 0.08)
\]

where:

- \(m_{\text{avg}}\) = `calculateAverageMinificationUsedInAllPersonInfos`.
- \(c_{\text{thickness}}\) = configuration `connectionThickness`; supplied native default is `0.022`.
- \(k=1\) normally, \(1.5\) when selected, \(2\) when hovered. Selection takes precedence.
- Clamp \(0.08\), decoded from `0xb2e178`.
- Evidence: `0x52949c–0x5294f8`; selected immediate `1.5` at `0x5294c8`, hovered doubling at `0x5294dc`.

Therefore, at minification 1:

| State | Native radius |
|---|---:|
| Normal | 0.022 |
| Selected | 0.033 |
| Hovered | 0.044 |

The value is used as the **capsule radius**, not diameter. The native method contains no additional world-unit multiplier.

For a web scale \(S\) web-units/native-unit:

\[
r_{\text{web}}=S\min(m_{\text{avg}}\times0.022\times k,\ 0.08)
\]

The current web radius `1.6` implicitly corresponds to \(S=1.6/0.022=72.7273\), but that scale is an inference from the web code, not recoverable from the native family method.

In `-[InteractiveTreeView3DViewerBaseConnectionObjectConnectionNode update]`:

- Geometry: `SCNCapsule` at `0x1f05fc`.
- `radialSegmentCount = 8` at `0x1f060c`.
- `capSegmentCount = 3` at `0x1f0618`.
- `capRadius = t` at `0x1f0a30–0x1f0a38`.
- The hidden/picking geometry is an `SCNBox` with width and length \(8t\), immediate `8` at `0x1f0a40`.
- No separate visible cap mesh is added.

For endpoints \(P_s,P_e\), endpoint-extension values enlarge only the native XZ components:

\[
P'_s.xz=P_s.xz+\tfrac12 e_s\,\hat d.xz
\]
\[
P'_e.xz=P_e.xz-\tfrac12 e_e\,\hat d.xz
\]

where \(\hat d=\operatorname{normalize}(P_s-P_e)\). The `0.5` values are immediates at `0x1f08dc` and `0x1f090c`.

The segment difference is rounded to 0.001 before orientation/distance calculations: multiply and divide by `1000.0`, decoded from `0xb2d128`, at `0x1f085c–0x1f08b0`.

For a straight segment of rounded length \(L\) and bend delta \(b\), SceneKit receives:

\[
h=
\begin{cases}
t,&L-|b|<2t\\
L-|b|,&L-|b|\ge 2t
\end{cases}
\]

Evidence: `0x1f0a00–0x1f0a2c`.

The capsule’s local Y axis is aligned to the connection:

\[
\theta_x=\operatorname{atan2}\left(\sqrt{dx^2+dz^2},dy\right)
\]
\[
\theta_y=\operatorname{atan2}(dx,dz)\pmod{2\pi}
\]
\[
\text{euler}=(\theta_x,\theta_y,0)
\]

`2π` is decoded from `0xb2d2b8`; evidence `0x1f0988–0x1f09f4`.

For the stated web coordinate system, the natural scene conversion is:

\[
(x,y,z)_{\text{native}}\rightarrow(Sx,-Sz,Sy)_{\text{web}}
\]

so native elevation Y becomes web Z.

### Father and mother couple bar

For the normal/default generation layout, the family node is rooted at the horizontal midpoint of the parent positions in native XZ, with local Y zero (`0x52985c–0x5298f0`, final `setPosition:` at `0x52bb94`).

Each parent segment starts at that person’s returned `connectionPointForObject:`. Define:

- \(F\), \(M\): father/mother connection points in family-local coordinates.
- \(R_f=P_f.x+\frac12\,size_f.x\): father’s inside edge.
- \(L_m=P_m.x-\frac12\,size_m.x\): mother’s inside edge.
- \(G_x=\frac12(R_f+L_m)\).
- \(G_y=\frac12(F_y+M_y)\).
- \(G_z=\frac12(F_z+M_z)\).

Evidence: `0x529ae8–0x529bc8` and `0x529c5c–0x529ca8`.

When the father is left of the mother:

- Father: \(F\rightarrow(G_x+t,G_y,G_z)\).
- Mother: \(M\rightarrow(G_x-t,G_y,G_z)\).

The reversed ordering reverses the signs. Thus the two rounded capsules overlap by \(2t\) at the center instead of leaving a seam (`0x529c94–0x529d6c`).

Both receive `setHasRoundEdges:YES` at `0x529d18` and `0x529d90`. However, the shared renderer does not read that property in `update`; all line bodies are already capsules. The flag adds no separate corner geometry in this binary.

Start overlap/extension:

- Father normally uses \(e_f=t\).
- If its earlier parent-family scan produces a nonzero maximum minification, \(e_f=0.05m_{\text{prior}}\).
- `0.05` is decoded from `0xb2d180`; `0x5294fc–0x529654`, applied at `0x529d20`.
- The mother scan is asymmetric in the machine code: it retains a scanned mother-family minification only when it exceeds the father-side maximum; its resulting extension is likewise \(0.05m\), otherwise \(t\). Applied at `0x529d98`.

For `parentsRelationOrder <= 5`, the bar’s native Z lane is offset by:

\[
\Delta z=-0.1\,m_{\min(parent)}\,parentsRelationOrder
\]

`-0.1` is decoded from `0xb2d078`; evidence `0x529bd0–0x529c58`.

### Children routing

The native topology consists of:

1. `childrenCylinderAttachmentNodeX`: trunk from the couple attachment toward the child-bus midpoint.
2. `childrenCylinderAttachmentNodeY`: crossbar spanning the outer children.
3. One `childrenCylinderNodes` drop per visible child.

The names are confirmed by the ivars at `0xd56960`, `0xd56964`, and `0xd56950`.

When `attachPointForChildrenConnection == 0` and both parent capsules exist, the attachment is the component-wise midpoint of their couple-bar endpoints (`0x52a0e8–0x52a140`). Other enum values choose one parent side; the enum names are not present in the supplied symbols.

The child lane offset is:

\[
\Delta_{\text{child lane}}=(childRelationOrder\bmod 7)\times0.1\times m
\]

`0.1` comes from `0xb2d118`; modulo-seven arithmetic and multiplication are at `0x52a53c–0x52a574`.

The bus elevation is:

\[
Y_{\text{bus}}=
\max(E_f,E_m,E_{c_1},\ldots,E_{c_n})
+0.1m_{\text{avg}}
\]

where each \(E\) comes from `elevationOfContentAboveBottomFloorForLocalGroupIdentifier:...`. Evidence: maximum collection at `0x529668–0x5297c0`, formula at `0x529db4`; `0.1` is `0xb2d118`.

A separate collision/layer adjustment is added by the shared renderer to both endpoint Y values:

\[
Y_{\text{adjust}}=0.0025\max(parentsRelationOrder,childRelationOrder)
\]

`0.0025` is decoded from `0xb33d90`; computed at `0x529430–0x529490`, assigned to all connection nodes at `0x52b6f4–0x52b75c`, and applied at `0x1f092c–0x1f0930`.

Consequently:

- Father/mother capsules run from their actual connection-point Y to the average parent connection-point Y, plus `Yadjust`.
- The children crossbar lies at `Ybus + Yadjust`.
- Each child drop runs from `Ybus + Yadjust` to that child’s connection-point Y plus `Yadjust`.

The crossbar is omitted if the outer-child span is at most `0.01`, decoded from `0xb2d040` (`0x52acd0–0x52ad38`). Otherwise it spans the outer child positions and receives thickness \(t\) (`0x52aea8–0x52aee4`).

Each child drop receives:

- Radius \(t\).
- Start and end extension \(t\), at `0x52b0d8–0x52b0fc`, so T-junctions overlap.
- `fillMode = (numeric infoConnectionType == 1)` at `0x52b13c–0x52b148`. Fill mode 1 uses the texture `"InteractiveTreeViewLineStripePattern"` in the shared renderer (`0x1f0730–0x1f0828`).

Only the two outer child drops receive a nonzero start bend delta when at least two children exist (`0x52b14c–0x52b1a8`). The initial bend bound is:

\[
b_0=\min\left(\tfrac12|\text{outer span}|,\ 0.3\right)
\]

where `0.3` is decoded from `0xb2d0c8`; subsequent clearance calculations can reduce it.

A nonzero bend is approximated by additional capsules:

\[
N=\left\lfloor2+25|b|\right\rfloor
\]

with immediate `2` and `25` at `0x1f0a9c–0x1f0aa8`. Every bend capsule also uses radial segments 8, cap segments 3, and radius \(t\). The angular construction uses `π` from `0xb2d2b0` and `2π` from `0xb2d2b8` (`0x1f0ae0–0x1f0c20`). Interior child drops have no curved corner.

### Marriage/divorce icon

The “marriage rings” are not procedural ring geometry.

`iconForParentMarriage` maps:

| Enum | Runtime icon identifier |
|---:|---|
| 1 | `_FamilyEvent_Marriage`, CFString `0xc00f50` |
| 2 | `_FamilyEvent_Divorced`, CFString `0xc121b0` |

The image is obtained through `platformIconForConclusionTypeIdentifier:` at `0x52b978–0x52b9ac`.

It is placed on an `SCNPlane`:

\[
s=0.25m_{\text{icon}}
\]

- `0.25` is returned directly by `+[InteractiveTreeView3DViewerFamilyConnectionObject defaultUnscaledSizeOfFurtherInformationIcons]` at `0x52c504`.
- With two parents, \(m_{\text{icon}}\) is their smaller minification; with one parent, that parent’s minification.
- Plane width and height are both \(s\), `0x52b9ec–0x52ba4c`.
- Euler X \(=-\pi/2\), decoded from `0xb2d030`, so it lies flat on native XZ (`0x52ba60–0x52ba70`).
- `renderingOrder = 100`, immediate at `0x52ba78`.
- `castsShadow = NO` at `0x52ba80–0x52ba88`.
- Diffuse contents are the image; mip filter enum 2 (`0x52bb54–0x52bb74`).
- Diffuse intensity is `1.0` for appearance 0 and `0.40000000596` otherwise; the latter is decoded from `0xb2d0b8`.

Let:

- \(A\) be the default couple/children attachment point.
- \(n\) be marriage-icon count plus enabled associated-indicator count.
- \(a\in\{0,1\}\) indicate whether the associated indicator occupies its slot.

Then the marriage plane’s default-layout origin is:

\[
P_m=(A_x-\tfrac12(n-1)s+a\,s,\ A_y,\ A_z)
\]

Evidence: `0x52bab8–0x52baf0`. Required parent spacing is exactly \(ns\), `0x52c4d8–0x52c4dc`.

Under the native-to-web mapping, the equivalent Three.js plane is already in the board XY plane and needs no Euler rotation.

The precise bitmap artwork and its intrinsic colors are runtime icon assets; they are not encoded by these geometry calls and cannot be recovered from this asm alone.

### Connection colors

Mode order is:

| Mode | Value |
|---|---:|
| By Generation, Light | 0 — default |
| By Generation, Dark | 1 |
| By Blood Relationship | 2 |
| Gray | 3 |
| Black or White | 4 |
| Custom | 5 |

`-[InteractiveTreeViewBaseViewer(FamilyConnectionColors) generalPlatformColorForFamilyConnectionInfo:]`, `0x18e878`.

#### Modes 0 and 1: generation

Define:

\[
L_p=parentsGeneration+parentsRelationOrder+childRelationOrder
\]
\[
L_c=childrenGeneration+parentsRelationOrder+childRelationOrder
\]

Each available level is passed as `colorForHierarchicalLevel:(L - 8)` at `0x18e924–0x18ea6c`. If both exist, they are blended 50/50, immediate `0.5` at `0x18e9e0`. If only one exists, that one is used. If neither exists, fallback is grayscale `0.699999988`, decoded from float `0xb2cfb8`: approximately `#B3B3B3`.

`+[CommonColorsHelper colorForHierarchicalLevel:]`, `0x248940`, applies positive modulo 20. Its palette generator at `0x2489dc` uses:

For indices 0–9:

\[
H=\operatorname{fract}(i/10+0.5),\quad S=0.5,\quad V=1
\]

For indices 10–19:

\[
H=\operatorname{fract}(0.05+i/10+0.5),\quad
S=0.699999988,\quad V=0.949999988
\]

Constants: `0.05` at `0xb2d180`, `0.699999988` at `0xb2d0f8`, `0.949999988` at `0xb2e0d0`; `0.5`, `1`, and `10` are immediates at `0x248a34–0x248a44`.

| i | Hex | Calibrated RGB input |
|---:|---|---|
| 0 | `#80FFFF` | (0.500, 1.000, 1.000) |
| 1 | `#80B3FF` | (0.500, 0.700, 1.000) |
| 2 | `#9980FF` | (0.600, 0.500, 1.000) |
| 3 | `#E680FF` | (0.900, 0.500, 1.000) |
| 4 | `#FF80CC` | (1.000, 0.500, 0.800) |
| 5 | `#FF8080` | (1.000, 0.500, 0.500) |
| 6 | `#FFCC80` | (1.000, 0.800, 0.500) |
| 7 | `#E6FF80` | (0.900, 1.000, 0.500) |
| 8 | `#99FF80` | (0.600, 1.000, 0.500) |
| 9 | `#80FFB2` | (0.500, 1.000, 0.700) |
| 10 | `#49BFF2` | (0.285, 0.7505, 0.950) |
| 11 | `#495AF2` | (0.285, 0.3515, 0.950) |
| 12 | `#9D49F2` | (0.6175, 0.285, 0.950) |
| 13 | `#F249E1` | (0.950, 0.285, 0.8835) |
| 14 | `#F2497C` | (0.950, 0.285, 0.4845) |
| 15 | `#F27C49` | (0.950, 0.4845, 0.285) |
| 16 | `#F2E149` | (0.950, 0.8835, 0.285) |
| 17 | `#9DF249` | (0.6175, 0.950, 0.285) |
| 18 | `#49F25A` | (0.285, 0.950, 0.3515) |
| 19 | `#49F2BF` | (0.285, 0.950, 0.7505) |

Hex values are rounded representations; the float inputs are authoritative.

Critically, `adjustPlatformColorForConnectionInfoForGenerationColor:withLightOption:andLightUserInterfaceAppearance:` simply returns its input at `0x18ebc0–0x18ebc4`. Therefore **ByGenerationLight and ByGenerationDark are identical in this binary**.

#### Mode 2: blood relationship

`colorForBloodInfoConnectionType:`, `0x18eb2c`:

| Numeric info type | Hex | RGB |
|---:|---|---|
| 3 | `#731A1A` | (0.449999988, 0.100000001, 0.100000001) |
| 4 | `#CC1A1A` | (0.800000012, 0.100000001, 0.100000001) |
| Other, appearance 0 | `#4D4D4D` | (0.300000012, 0.300000012, 0.300000012) |
| Other, nonzero appearance | `#999999` | (0.600000024, 0.600000024, 0.600000024) |

Constants: type-3 red `0xb2d278` and `0xb2d0a8`; type-4 red `0xb2cfc8` and `0xb2d0a8`; grays `0xb2cfb0` and `0xb2cfcc`.

The supplied symbols do not expose semantic enum names for numeric types 3 and 4, so they should be preserved as numeric classifications rather than guessed as “paternal,” “maternal,” etc.

Segment classification:

- With children, father and mother capsules use their respective parent info type.
- With no children, both use `min(fatherType,motherType)`.
- Each child drop uses that child’s own type.
- `childrenCylinderAttachmentNodeX` uses the maximum child type.
- `childrenCylinderAttachmentNodeY` normally uses the maximum child type. It forces type 3 when the set contains at least one type 3, at least one type outside 3/4, and exactly one type 4 (`specificPlatformColorForChildYInterConnectionsInFamilyConnection:`, `0x18e5ac–0x18e6c4`).

#### Other modes

- Gray: appearance 0 is `#737373`, RGB `(0.449999988, …)` from `0xb2d278`; nonzero appearance is `#999999`, RGB `(0.600000024, …)` from `0xb2cfcc`. Method `0x18e8f4–0x18eb08`.
- Black or White: appearance 0 is pure `#000000`; nonzero appearance is pure `#FFFFFF`, immediates at `0x18eaa4–0x18eb28`.
- Custom: returns `configuration.customFamilyConnectionColor` unchanged at `0x18ead0–0x18eafc`.

Highlighting leaves the base family color in place and adds emission:

- Selected highlight: `#8099FF`, RGB `(0.5, 0.600000024, 1)`, `0x52b3b8–0x52b3d4`, with green from `0xb2cfcc`.
- Hover highlight: `#6680FF`, RGB `(0.400000006, 0.5, 1)`, `0x52b3f4–0x52b410`, with red from `0xb2cfc0`.
- Emission intensity `0.75`, immediate in `updateHighlightColor` at `0x1f10d4`.

### `hasAssociatedPersonsNode`

The marker appears only when:

```text
familyInfo.hasAssociatedPersons
&& configuration.displayAssociateRelationsIcon
```

Evidence: `0x52b820–0x52b970`.

It is an `InteractiveTreeView3DViewerAssociatePersonsIndicatorNode`, not a sprite or connector cap.

Its size is:

\[
xzSize=0.8s=0.2m_{\text{icon}}
\]

`0.8` is decoded from `0xb2d050`; assignment at `0x52b8e4–0x52b8f8`.

The indicator renderer `-[InteractiveTreeView3DViewerAssociatePersonsIndicatorNode update]`, `0x4922a0`, loads and flattens:

```text
InteractiveTreeAssociatePersonsIndicator.dae
```

CFString `0xc714f0`, used at `0x4922cc–0x4922e0`.

It applies a uniform scale:

\[
scale=\min\left(\frac{xzSize}{bodySize.x},\frac{xzSize}{bodySize.z}\right)
\]

at `0x492308–0x492338`. It performs no Euler rotation and no material/color override.

For the default layout, its raw node origin is:

\[
P_a=(A_x-\tfrac12(n-1)s-\tfrac12s,\ A_y,\ A_z)
\]

at `0x52b8a8–0x52b8e0`. The DAE’s internal origin determines the visible centering. Its mesh, intrinsic material and exact colors are not present in the disassembly and are genuinely undecidable without the DAE asset.

No `NSFont` or text geometry is used anywhere in these family-connection or indicator methods.

## Web divergences

- The mode names and ordering are correct in [constants.js:163](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/constants.js:163), including mode 0 as `byGenerationLight`.

- The web treats thickness as an arbitrary normalized scale defaulting to 1 [connectors.js:36](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:36), then uses radius `1.6` for buses [connectors.js:108](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:108) and `1.2` for partner links versus `1.6` elsewhere [connectors.js:177](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:177). Native uses the same \(t\) for father, mother, trunk, crossbar and child drops.

- Web highlighting collapses selection and hover into one state and always doubles thickness [connectors.js:153](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:153). Native selection is ×1.5 and hover ×2. Web also lightens the diffuse color and uses emission intensity 0.6 [connectors.js:158](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:158); native retains the diffuse color, uses fixed blue emission, and intensity 0.75.

- `TubeGeometry` uses 14 radial segments and has open ends [connectors.js:343](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:343). Native uses 8-sided `SCNCapsule` geometry with three cap segments and rounded ends. The unused sphere-cap helper at [connectors.js:429](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:429) is not attached to normal paths.

- Every web polyline corner is rounded with a quadratic curve and a radius as large as 40 [connectors.js:377](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:377). Native leaves father, mother, trunk, crossbar and interior child drops straight; only the two outer child-drop starts receive bends, bounded initially by 0.3 native unit.

- The web bus is separated by a fixed 46 units [connectors.js:72](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:72). Native derives its lane from child connection points, relation-order offset, content elevation, minification, and the `0.1` clearance. At the current inferred \(S=72.727\), native `0.1` would be about `7.27`, not `46`.

- Web connector depth uses a generation-slab offset [connectors.js:162](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:162) based on `GENERATION_DEPTH_STEP = 18` [constants.js:3](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/constants.js:3). Native elevation is based on actual band/content elevation plus `0.1 × averageMinification` and the relation-order adjustment.

- The web adds a second enlarged, displaced shadow tube [connectors.js:109](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:109) and again for ordinary links [connectors.js:181](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:181). Native uses the actual capsule geometry/material and SceneKit shadowing; it does not create this duplicate visible tube.

- The marriage marker is two procedural silver tori with arbitrary radii `6.8/8.5` [connectors.js:205](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:205). Native uses a single square image plane of size `0.25 × minification`, selecting either the marriage or divorce event icon.

- The web’s dusty-rose generation table and lineage classes [connectors.js:226](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:226) do not exist in the native 3D family connector. Native uses the 20-color calibrated-HSV hierarchy algorithm and may blend parent and child levels.

- Web dark-generation mode shades generation colors by 22% [connectors.js:265](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:265). Native light and dark generation modes are identical because the adjustment method is a no-op.

- Web blood mode selects generic partner/ancestor/descendant palette colors [connectors.js:270](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:270). Native uses numeric `infoConnectionType`, with types 3 and 4 receiving the two exact reds and all others receiving appearance-dependent gray.

- Web gray `#9098a0`, near-black/near-white, and the arbitrary custom fallback [connectors.js:261](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:261) differ from native `#737373/#999999`, pure black/white, and the exact configured custom color.

- Numeric type-1 striped child drops are not implemented.

- No associated-person indicator appears in the listed web files; only `coupleMark` is handled [connectors.js:191](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:191).

- [personColors.js:3](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/personColors.js:3) contains person-body coloring only. It provides no native family-connection color resolver.

## Recommended fixes

1. **Replace the connector color resolver.** Implement the native 20-entry HSV formula, effective levels \(L_p/L_c\), and 50/50 family blending. Make `byGenerationLight` and `byGenerationDark` aliases. Use exact gray, black/white, and custom behavior. For exact blood mode, propagate `infoConnectionType` onto links; do not infer it from paternal/maternal lineage labels.

2. **Replace procedural torus rings with an image plane.** Use marriage/divorce PNG or SVG assets on a square board-aligned plane sized `0.25 × minification × S`, no shadow, high render order. If the original assets are unavailable, one static interlocking-rings image is still substantially closer than 3D tori.

3. **Unify thickness and highlight behavior.** Use:

   ```js
   radius = S * Math.min(
     averageMinification * 0.022 * thicknessScale
       * (selected ? 1.5 : hovered ? 2 : 1),
     0.08
   );
   ```

   Apply it to partner, trunk, crossbar and child segments alike. With the current `1.6` baseline, use `S = 72.7273`, giving selected radius `2.4`, hover radius `3.2`, and clamp `5.818`.

4. **Render straight pieces as capped segments.** Use `CapsuleGeometry` or an 8-sided cylinder plus hemispherical caps. For Three.js `CapsuleGeometry`, account for its middle-section length so total height matches SceneKit’s capsule height. Remove the partner `1.2` special case and the displaced duplicate shadow tube.

5. **Restrict corner rounding.** Keep the couple bar, trunk, crossbar and interior child drops straight. Bend only the two outer drops. With the inferred scale, native maximum bend `0.3S` is about `21.82`, not 40. Add endpoint overlap at T-junctions rather than smoothing every polyline through Catmull–Rom interpolation.

6. **Use native elevation inputs.** Map native Y to web Z and compute the child-bus height from maximum content/band elevation plus `0.1 × averageMinification`, followed by `0.0025 × max(relation orders)`. If those data are not yet available, use one small shared board-height offset; do not derive connection height from generation slab depth.

7. **Add the associated-person indicator.** Prefer the original `InteractiveTreeAssociatePersonsIndicator.dae`. Otherwise use a lightweight substitute occupying `0.2 × minification × S` in the adjacent icon slot. Preserve the separate display option rather than folding it into the marriage mark.

8. **Implement numeric type-1 striping last.** It affects only classified child drops and is lower-impact than correcting geometry, colors and the marriage marker.
