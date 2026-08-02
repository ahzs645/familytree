## Native spec

### Camera

`-[InteractiveTreeView3DViewer(Camera) updateForChangedCameraPropertiesAnimated:]`

All user-facing camera modes use orthographic projection. Only internal mode `100` disables orthographic projection and sets a fixed 15° field of view (`0x1f3aac–0x1f3ac8`).

| Mode | Native ID | Native SCN Euler `(x,y,z)` | Three.js elevation/yaw |
|---|---:|---|---|
| Top Down | 0 | `(-89.82°, 0°, 0°)` | `89.82°, 0°` |
| Top Down Slightly Tilted | 1 | `(-63°, 0°, 0°)` | `63°, 0°` |
| Top Down Tilted | 2 | `(-49.5°, 0°, 0°)` | `49.5°, 0°` |
| Front | 3 | `(-31.5°, 0°, 0°)` | `31.5°, 0°` |
| Front Left | 4 | `(-31.5°, -13.5°, 0°)` | `31.5°, -13.5°` |
| Front Right | 5 | `(-31.5°, +13.5°, 0°)` | `31.5°, +13.5°` |
| Top Left | 10 | `(-45°, -13.5°, 0°)` | `45°, -13.5°` |
| Top Right | 11 | `(-45°, +13.5°, 0°)` | `45°, +13.5°` |
| Isometric Left | 20 | `(-36°, -45°, 0°)` | `36°, -45°` |
| Isometric Right | 21 | `(-36°, +45°, 0°)` | `36°, +45°` |
| Internal perspective | 100 | `(-18°, 0°, 0°)` | `18°, 0°`, FOV 15° |

Sources:

- Modes 0–3 are embedded doubles at `0x1f39f8`, `0x1f39d4`, `0x1f3a30`, `0x1f3a68`.
- Modes 4, 5, 10, 11, 20, 21 come from `0xb2e070`, `0xb2e060`, `0xb2e050`, `0xb2e040`, `0xb2e030`, `0xb2e020`.
- Mode 100 is embedded at `0x1f3d7c`.
- Default mode 1 is therefore exactly the verified 63° preset.

Zoom:

- Minimum: `0.25`, immediate at `+[... minimumZoom]`, `0x1f33ec`.
- Maximum: `4.0`, immediate at `+[... maximumZoom]`, `0x1f33f4`.
- Default: `1.600000023841858`, `0xb2e000`, returned by `+[... defaultZoom]`.
- Setters clamp all requested zooms into `[0.25, 4]`.

`-[... updateCameraZoomDistanceFromZoom]` computes, using single-precision arithmetic:

```text
M = integer-truncated minimum viewport dimension in pixels
D = (50 / zoom) × (M / 600)
```

Constants: `50` at instruction `0x1f38e4`; `600` at `0x1f38c8`.

Ignoring edge insets, the native-to-web mapped camera offset is:

```text
x = D × sin(yaw)
y = -D × cos(elevation) × cos(yaw)
z = D × sin(elevation) × cos(yaw)

cameraPosition = focus + offset
```

This agrees with the existing port’s rotation order. Native distance is not a fixed 1,700 units.

`-[... updateCameraPositionAndRotationAndReturnPosition:andEulerAngles:]` computes:

```text
aspect = viewportWidth / viewportHeight
verticalOffset = D × sin(elevation) × cos(yaw)

orthographicScale =
    verticalOffset / 7 / min(aspect, 1)
```

The divisor `7` is the immediate at `0x1f3608`. For internal perspective mode the same distance computation is retained, but the orthographic scale becomes inactive and FOV remains 15°.

Safe-area/view edge insets additionally displace the camera in camera-local screen axes:

```text
worldUnitsPerPixel = orthographicScale / viewportHeight
horizontalDelta = (rightInset - leftInset) × worldUnitsPerPixel
verticalDelta   = (topInset - bottomInset) × worldUnitsPerPixel
```

Those deltas are rotated into scene space before being added to the camera position (`0x1f3640–0x1f374c`).

Clipping planes are:

- `zNear = 5`, immediate at `0x2f0d9c`.
- `zFar = 900`, decoded from `0xb2cf98`.

Focus clamping, from `-[... setCameraFocusPositionInScene:]`:

```text
focus.x = clamp(requested.x, rect.minX, rect.maxX)
focus.y = requested.y
focus.z = clamp(requested.z, rect.minZ, rect.maxZ)
```

It applies when person/object nodes exist. The valid rectangle is built by unioning converted scene-space bounding boxes in `-[... calculateValidPersonsObjectsRectForScroll]`; it may be extended for content below the bottom floor. The exact implementation of the unnamed rectangle-union helper at `0x8c5c30` is not recoverable from this dump, but there is no evidence of an additional numeric clamp margin.

### Lighting rig

`-[InteractiveTreeView3DViewer(SceneEssentials) setupSceneEssentials]`

The native rig consists of exactly:

1. One spotlight attached to `spotlightNode`.
2. `spotlightNode` attached below `spotlightOrbitNode`.
3. One ambient light.
4. No second directional/fill light.

Spotlight setup:

- Type: SceneKit spot light (`setType:` followed by spot-specific setters).
- Child-node Euler: `(-π/2, 0, 0)`, `-π/2` from `0xb2d030`.
- Outer angle: `50°`, embedded at `0x47d4d8`.
- Inner angle: `0°`, `0x47d4ec`.
- `castsShadow = shadowStrength > 0`.
- `zFar = 2 × local light height`.
- Orbit position is always the current camera focus.

Let:

```text
r = min(viewportWidth / viewportHeight,
        viewportHeight / viewportWidth)

Cy = native camera Y position
```

`-[InteractiveTreeView3DViewer(Lighting) updateLightingPosition]` sets local spotlight position `(0,L,0)`:

```text
modes 3,4,5:
    L = 2 × Cy / (2.65 × r)

modes 20,21:
    L = min(20, 2 × Cy / (3.5 × r))

all other modes:
    L = 2 × Cy / (3.5 × r)
```

Constants: `2.65` at `0xb33ba0`; `3.5` at `0x47d548/0x47d57c`; `20` at `0x47d558`.

Orbit Euler:

- Modes 3, 4, 5: `(36°, 0°, 0°)`.
- Other modes: `(27°, 36°, 0°)`.

Constants: `36° = 0.6283185307179586` at `0xb33ba8`; `27° = 0.47123889803846897` at `0xb33bc0`.

Shadow configuration:

| Property | Normal hardware | Intel GMA / Nvidia compatibility branch |
|---|---:|---:|
| Shadow mode | `0` / SceneKit forward | Same |
| Sample count | 16 | 8 |
| Radius | 4 | 2 |
| Map size | 2048×2048 | 1024×1024 |

The immediate values occur at `0x2f0ee0–0x2f0f34`. With default `shadowStrength=1`:

- Shadow casting is enabled.
- Shadow color is black with alpha `1`: `(0,0,0,1)` / `#000000`.
- More generally, shadow color is `(0,0,0,shadowStrength)`.
- No custom shadow bias is set in these methods.

Light intensities use two platform/view factors not implemented in this dump:

```text
A = sceneKitView.ambientLightingFactor
S = sceneKitView.spotlightLightingFactor
I = configuration.spotlightIlluminationFactor

normal spotlight intensity = S × (850 + 300I)
normal ambient intensity   = A × (550 + 300I)
```

Constants: `850` at `0xb33bb0`; `550` at `0xb33bb8`; `300` at `0xb2cf90`. At the established default `I=0`, this reduces to `850S` and `550A`. The concrete runtime values of `A` and `S` are genuinely undecidable from this asm because their getter implementations are external.

Lighting modes, from `-[... updateLightingPropertiesAnimated:]`:

| Mode | Ambient color `(R,G,B)` | Spotlight color `(R,G,B)` | Intensity change |
|---|---|---|---|
| Normal, 0 | `(A,A,A)` — unit tint `#FFFFFF` | `(S,S,S)` — `#FFFFFF` | Normal formula |
| Flat, 1 | `(A,A,A)` — `#FFFFFF` | `(S,S,S)` — `#FFFFFF` | Ambient `A×(1000+300I)`; spot `S×(300+300I)` |
| Sunset, 2 | `(A,0.9A,0.8A)` — `#FFE6CC` | `(S,S,S)` — `#FFFFFF` | Normal |
| Blue, 3 | `(0.8A,0.8A,A)` — `#CCCCFF` | `(S,S,S)` — `#FFFFFF` | Normal |
| Green, 4 | `(0.8A,A,0.8A)` — `#CCFFCC` | `(S,S,S)` — `#FFFFFF` | Normal |
| Violet, 5 | `(0.9A,0.8A,A)` — `#E6CCFF` | `(0.95S,0.9S,S)` — `#F2E6FF` | Normal |

Component constants: `0.8` at `0xb2d050`; `0.9` at `0xb2d1c8`; `0.95` at `0xb2d260`; Flat’s `1000` at `0xb2d128`.

Modes 6, 7, and 8 force both light colors to unit white; their semantic names are not established by this method.

### Floor and bottom-floor container

`-[InteractiveTreeView3DViewer(SceneEssentials) setupSceneEssentials]`

The visible floor is `SCNFloor`, not a finite plane:

- No width or length is assigned; it is SceneKit’s unbounded floor geometry.
- Reflectivity: `0`, at `0x2f0e58`.
- Node position/rotation: defaults, so native floor height is world `Y=0`.
- Rendering order: `-1000`, at `0x2f0e80`.
- The separate `bottomFloor` object created at `0x2f101c` is an empty `SCNNode` container. This setup method assigns it no geometry or material.

Bottom-plane modes:

| ID | Pattern | Resource | Texture transform scale |
|---:|---|---|---:|
| 0 | Plain | None | — |
| 1 | Small checkerboard | `InteractiveTreeViewCheckerboardPattern` | 80 |
| 2 | Large checkerboard | Same | 30 |
| 3 | Small grid | `InteractiveTreeViewGridPattern` | 250 |
| 4 | Large grid | Same | 100 |
| 5 | Small dots — **default** | `InteractiveTreeViewDotPattern` | 160 |
| 6 | Large dots | Same | 100 |
| 7 | Small rectangles | `InteractiveTreeViewRectPattern` | 750 |
| 8 | Large rectangles | Same | 400 |
| 9 | Small plaid | `InteractiveTreeViewPlaidPattern` | 500 |
| 10 | Large plaid | Same | 250 |
| 11 | Wood | `InteractiveTreeViewWoodPattern` | 20 |
| 12 | Concrete | `InteractiveTreeViewConcretePattern` | 20 |
| 13 | Marble | `InteractiveTreeViewMarblePattern` | 20 |

The CFStrings are at `0xc6cf50`, `0xc6cfb0`, `0xc6d010`, `0xc6d070`, `0xc6d0d0`, `0xc6d130`, `0xc6d170`, and `0xc6d1b0`. Transform immediates occur in `0x51fb50–0x5200d0`.

All pattern textures use repeat wrapping on S and T. Default mode 5 therefore is not “grid” or generic paper; it is the small-dot bitmap repeated with a `160` contents transform.

For normal lighting and default color mode 0, mode 5’s base diffuse color is:

- Light-valued appearance branch: `(1,1,1)` / `#FFFFFF`.
- Dark-valued appearance branch: `(0.075,0.075,0.075)` / `#131313`, constant `0.075` at `0xb33d38`.

Its dot-pattern multiply intensity is:

- Light branch: `0.075`, `0xb2df20`.
- Dark branch: `0.5`, immediate at `0x51feb8`.

For grid modes 3/4, the bitmap’s multiply intensity is `0.15` in the light branch (`0xb2d2d8`) and `0.75` in the dark branch (`0x51fc6c`).

The exact grid-line pixel RGB and physical line spacing cannot be recovered from this asm: they are baked into `InteractiveTreeViewGridPattern`, whose image bytes are not present in the supplied Mach-O. The asm establishes the resource, repeat/filter behavior, transform scales, base color, and multiply intensity—but not the bitmap’s internal pixels. There is also no native “every fourth line is strong” geometry in this code.

Floor material behavior from `-[InteractiveTreeView3DViewer(Materials) configureMaterialForNodesNearBottomPlane:...]`:

- Ambient is not locked to diffuse.
- Lighting model is Blinn.
- Emission, specular, self-illumination, and reflection intensities are all zero.
- Ambient color is the diffuse hue/saturation with brightness multiplied by `1.4`, capped at `1`; `1.4` is at `0xb2d058`.

No fonts are involved in these camera, lighting, or floor methods.

## Web divergences

### Camera

- The orthographic camera choice is correct, but its clipping planes are `1–6000`, versus native `5–900`: [useThreeTreeScene.js:147](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/useThreeTreeScene.js:147).
- All ten public angle presets match the native table exactly: [camera.js:10](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/camera.js:10).
- Camera distance is incorrectly fixed at `1700`; native distance is viewport- and zoom-dependent: [camera.js:26](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/camera.js:26).
- Manual zoom range is `0.1–4.5`, not `0.25–4`: [useThreeTreeScene.js:167](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/useThreeTreeScene.js:167).
- Fit zoom adds an invented `0.9` margin and clamps to `0.1–1.45`; native size-to-fit caps its computed zoom at `2`, while ordinary zoom remains allowed through `4`: [camera.js:48](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/camera.js:48).
- The camera-position rotation formula is correct: [camera.js:144](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/camera.js:144).
- OrbitControls permits an arbitrary rotated polar angle and does not clamp the focus target to the native object rectangle: [useThreeTreeScene.js:162](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/useThreeTreeScene.js:162).

### Lighting

- The native spotlight has been replaced with a fixed directional light: [useThreeTreeScene.js:199](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/useThreeTreeScene.js:199).
- The web adds a second directional fill which does not exist natively: [useThreeTreeScene.js:209](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/useThreeTreeScene.js:209).
- Native lighting follows camera focus through an orbit node and changes height with viewport, zoom, and camera mode. The web light remains fixed at `(60,-240,940)`: [useThreeTreeScene.js:202](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/useThreeTreeScene.js:202).
- Web shadow map size is 1024 instead of the normal native 2048; radius is configurable around 3 instead of native 4; and the web adds a `-0.0005` bias not set by these native methods: [useThreeTreeScene.js:204](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/useThreeTreeScene.js:204).
- `shadowStrength` only toggles shadows. It does not control black shadow alpha/intensity continuously as native does: [useThreeTreeScene.js:190](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/useThreeTreeScene.js:190).
- Normal/Flat/Sunset/Blue/Green/Violet tint formulas and Flat’s reversed ambient/key balance are absent.
- Distance fog is a web-only effect: [useThreeTreeScene.js:145](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/useThreeTreeScene.js:145).

### Floor

- The web uses a finite bounds-sized plane rather than an unbounded/recentered floor: [floor.js:28](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/floor.js:28).
- It places that plane at web `Z=-86`; the direct native coordinate mapping places the floor at `Z=0`: [floor.js:39](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/floor.js:39).
- The fallback mode is `grid`, while native default mode 5 is small dots: [floor.js:25](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/floor.js:25).
- The radial paper glow, scan lines, and all procedural checker/dot/plaid/wood/concrete/marble algorithms are invented rather than native bitmap patterns: [floor.js:69](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/floor.js:69).
- Web grid spacings `18/28/48`, strong lines every fourth cell, palette colors, and opacities have no counterpart in this native method: [floor.js:7](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/floor.js:7), [floor.js:45](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/floor.js:45).
- The floor is rebuilt from layout bounds and viewer options: [useThreeTreeScene.js:569](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/useThreeTreeScene.js:569).

## Recommended fixes

1. **Correct camera zoom semantics.** Set OrbitControls to `minZoom=0.25`, `maxZoom=4`, initialize native zoom to `1.6`, and cap size-to-fit at `2`. Preserve the current angle table and mapped position formula. Replace fixed-distance logic with the native `D=(50/zoom)×floor(min(W,H))/600` formula where camera/light distance affects clipping and illumination.

2. **Replace the key/fill arrangement with one focus-following spotlight.** Remove the fill light. Use a `THREE.SpotLight` with a 25° Three.js half-cone angle, full penumbra corresponding to native inner angle 0, and a target at camera focus. Preserve the native 850:550 key-to-ambient ratio; a practical Three.js normalization is ambient `1.0`, spotlight `850/550 = 1.54545`.

3. **Match modern native shadows.** Use a 2048² shadow map, radius 4, remove the invented `-0.0005` bias unless acne requires a platform workaround, and set `key.shadow.intensity = clamp(shadowStrength,0,1)` while toggling `castShadow` only at zero.

4. **Implement the six lighting tints exactly.** Use normalized unit tints: Normal/Flat `#FFFFFF`, Sunset `#FFE6CC`, Blue `#CCCCFF`, Green `#CCFFCC`, Violet ambient `#E6CCFF`, Violet spot `#F2E6FF`. Flat should use normalized ambient:key intensities `1000:300`, not the normal `550:850`.

5. **Make small dots the floor default.** Remove the radial paper gradient and scan lines for parity. Use a deterministic repeating dot texture with transform/repeat density corresponding to native scale 160; apply dot contrast `0.075` in light appearance and `0.5` in dark appearance.

6. **Treat native grid assets as bitmap patterns.** Replace geometric lines and the “every fourth line” rule with a single repeating grid texture. Use transform scales 250 for small grid and 100 for large grid, with multiply strengths 0.15 light / 0.75 dark. Exact line RGB should remain marked pending until the native `InteractiveTreeViewGridPattern` asset is obtained.

7. **Align floor elevation deliberately.** Native floor maps to web `Z=0`, but the current port has built other content around `Z=-86`. Move it to zero only together with the band/person elevation baseline; otherwise preserve `-86` temporarily and document it as a web coordinate offset rather than native behavior.
