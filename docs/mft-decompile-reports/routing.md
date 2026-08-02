## Native routing spec

Coordinates below are native SceneKit coordinates. For Three.js, map

\[
(X,Z;Y_{\rm elev})_{\rm native}\rightarrow
(x,y,z)_{\rm web}=(X,-Z,Y_{\rm elev})
\]

before applying the native-to-web scale.

Definitions:

- \(A_f,A_m\): parent connection points.
- \(G_x=(A_{f,x}+A_{m,x})/2\): inside-edge gap center.
- \(m_p=\min(m_f,m_m)\).
- \(r_p=\texttt{parentsRelationOrder}\), \(r_c=\texttt{childRelationOrder}\).
- \(q_p=r_p\le5 ? -0.1m_pr_p : 0\).
- \(\delta_c=(r_c\bmod 7)\,0.1m_p\).
- \(h=0.0025\max(r_p,r_c)\): common elevation adjustment.
- \(P_{\rm far}=\max(\text{parent occupied-rect maxZ})\).
- \(C_{\rm near}=\min(\text{visible child occupied-rect minZ})\).
- \(Z_g=(P_{\rm far}+C_{\rm near})/2\): midpoint of the actual gutter.

Decoded constants used here:

| Value | vmaddr | Use |
|---:|---:|---|
| `0.1` | `0xb2d118` | content elevation, child relation lane |
| `-0.1` | `0xb2d078` | parent-union lane |
| `0.0025` | `0xb33d90` | common height adjustment |
| `0.3` | `0xb2d0c8` | maximum outer bend |
| `0.01` | `0xb2d040` | effectively-zero span test |
| `0.05` | `0xb2d180` | upstream parent-edge extension |
| `0.08` | `0xb2e178` | maximum capsule radius |

### 1. Board-plane path

In `-[InteractiveTreeView3DViewerFamilyConnectionObject updateAsNewlyCreatedObject:andIsFirstUpdate:]`:

#### a. `childrenCylinderAttachmentNodeX` — trunk

For two parents, the trunk starts at the average of the two parent-capsule end points, not at the rendered marriage-icon plane:

\[
T_0=(G_x,\ Z_{\rm couple})
\]

where

\[
Z_{\rm couple}=\frac{A_{f,z}+A_{m,z}}2+q_p.
\]

The parent capsules overlap around \(G_x\): when the father is left, their ends are \(G_x+t\) and \(G_x-t\), giving the established \(2t\) overlap. Averaging those endpoints recovers \(G_x\).

The ordinary multi-child trunk ends at

\[
T_1=(G_x,\ Z_g+\delta_c).
\]

This is exactly the sibling-crossbar lane. It is set at `0x52a9bc–0x52aa74`.

For the single aligned-child degeneracy—one child and total X span \(\le0.01\)—the crossbar is removed and layout 0 advances the trunk endpoint to \(Z_g+\delta_c+t\), producing overlap with the child drop.

The trunk does not dogleg in X. Instead, the crossbar extent is enlarged to include \(G_x\).

#### b. `childrenCylinderAttachmentNodeY` — sibling crossbar

The crossbar is placed at

\[
Z_{\rm bus}=Z_g+\delta_c
           =\frac{P_{\rm far}+C_{\rm near}}2+\delta_c.
\]

It is therefore midway between:

- the parents’ child-facing occupied-rect edge, and
- the nearest children’s `minZ` edge.

There is no fixed `0.1×m` child clearance. The `0.1×m` term is solely the relation-order lane \(\delta_c\). With \(r_c=0\), child clearance is exactly half of the free gutter:

\[
C_{\rm near}-Z_{\rm bus}
=\frac{C_{\rm near}-P_{\rm far}}2.
\]

The bend does not change the crossbar’s Z coordinate.

Let each child’s edge point be \(D_i=(x_i,z_i)\), normally with \(z_i=\text{child minZ}\). Its bus-side X is

\[
x_i^{bus}=x_i+\delta_c.
\]

Before bend shortening:

\[
X_L=\min(G_x,\min_i x_i^{bus}),\qquad
X_R=\max(G_x,\max_i x_i^{bus}).
\]

The logical crossbar is then

\[
(X_L+b_L,Z_{\rm bus})\rightarrow(X_R-b_R,Z_{\rm bus}).
\]

For two or more children, the code subsequently moves its first endpoint by \(-t\) and its last by \(+t\) for capsule overlap. Construction is at `0x52aea8–0x52aee4`; endpoint overlap is at `0x52b1b4–0x52b278`.

If \(|X_R-X_L|\le0.01\), the crossbar node is torn down (`0xb2d040 = 0.01`).

#### Actual capsule placement

`FamilyConnectionObject` sets logical start/end points; actual SceneKit placement happens in `-[InteractiveTreeView3DViewerBaseConnectionObjectConnectionNode update]`:

\[
P_{\rm node}=(S'+E')/2
\]

at `0x1f09d0–0x1f09e0`, with the capsule rotated onto \(E'-S'\).

Endpoint extension \(e_s,e_e\) is applied as

\[
S'=S-\hat u\,e_s/2,\qquad E'=E+\hat u\,e_e/2,
\quad \hat u=\frac{E-S}{\lVert E-S\rVert}.
\]

For an unbent segment of adjusted length \(D\), the code supplies `SCNCapsule.height` as \(D\) when \(D\ge2t\), otherwise \(t\), at `0x1f0a18–0x1f0a38`.

### 2. Drops

Every visible child gets its own connection node; the native code does not suppress a leg because a large child happens to intersect the bus.

For child \(i\):

\[
D_{i,0}=(x_i+\delta_c,\ Z_{\rm bus},\ Y_{\rm bus})
\]

\[
D_{i,1}=(x_i,\ z_i,\ Y_i),
\]

where \(z_i\) is the child’s `connectionPointForObject:forUsage:...` result for usage `0`, ordinarily the occupied-rect `minZ` edge.

Consequences:

- With \(r_c=0\), the drop is straight in board X and runs from the bus to `minZ`.
- With \(r_c\ne0\), its start is shifted in both bus X and bus Z by \(\delta_c\), while its child endpoint remains on the figure. It is therefore slightly diagonal in XZ.

The caller passes `andPreventReturningInsidePoint:NO` at `0x52a664–0x52a674` and `0x52b054–0x52b064`.

`FamilyConnectionObject` never calls `clampOtherConnectionPoint:...withBorderOverlap:`. Thus there is no FamilyConnection `borderOverlap` argument to decode. The actual calls elsewhere in the binary—associate-connection objects at `0x226cb8` and `0x41c964`—pass an immediate `0.0`.

Each child drop sets both endpoint extensions to \(t\) at `0x52b0d8–0x52b0fc`. Its logical endpoint is exactly the child edge, but the rendered capsule continues \(t/2\) beyond it along the 3D segment direction. That is the only penetration into the child rect.

### 3. Bends

Only the first and last child in X order receive a nonzero `startPointBendDelta`. “Start” is the bus end of the child drop.

For the default layout:

- leftmost drop: \(+\;b_L\), along native +X;
- rightmost drop: \(-\;b_R\), along native −X;
- all middle drops: zero.

The initial cap is

\[
b_0=\min\left(\frac{|C_{\rm near}-P_{\rm far}|}{2},\,0.3\right),
\]

with `0.3` from `0xb2d0c8`. It is additionally limited by available horizontal distance to \(G_x\), adjacent-child spacing, and the available generation-axis run:

\[
b_L=\min\bigl(
b_0,\ |X_L-G_x|,\ |x_1-x_0|,\ t+|Z_g-z_0|
\bigr),
\]

with \(b_L=0\) when \(|X_L-G_x|\le0.01\). The right side has the symmetric last/penultimate-child formula.

This is one quarter-turn at the bus end, not an S-curve. In board projection it joins:

\[
(X_L+b_L,Z_{\rm bus})
\rightsquigarrow
(X_L,Z_{\rm bus}+b_L)
\]

on the left, with the mirrored turn on the right. The remaining drop continues toward the child.

`ConnectionNode update` approximates the quarter-circle with

\[
N=\left\lfloor 2+25|b|\right\rfloor
\]

capsules, using sine/cosine over \(0\ldots\pi/2\); \(\pi\) is loaded from `0xb2d2b0`. Bend construction is at `0x1f0a98–0x1f0c44`.

The crossbar loses \(b_L\) and \(b_R\) geometrically, then regains a thickness overlap \(t\) at each outer end:

\[
[X_L+b_L-t,\;X_R-b_R+t].
\]

### 4. Parent side

For the ordinary top-down layout, `connectionPointForObject:forUsage:...` maps usages `2` and `3` to the occupied rectangle’s side-edge midpoint:

- left parent: `(maxX, centerZ)`;
- right parent: `(minX, centerZ)`.

Father/mother usage is selected by actual X order, not gender. See `0x5299e0–0x529b14` and the helper branches at `0xb83c4`/`0xb8524`.

The elevation returned by the helper is

\[
Y_i=E_i+0.1m_i,
\]

where \(E_i\) is the viewer’s content elevation and `0.1` is loaded from `0xb2d118`.

Thus the zero-order couple bar runs through the figures’ Z centers, from their facing X edges. It is not attached at `minZ` or at a “lower-body” Z coordinate.

For \(r_p>0\), the parent-edge starts remain at their rect centers, while their shared ends move to \(Z_{\rm couple}\). The two capsules consequently angle toward the shifted union lane.

Their shared endpoint elevation is \((Y_f+Y_m)/2\), so unequal parent elevations produce sloped 3D capsules. Parent starts also receive an upstream extension: normally \(0.05\) times the largest upstream-family minification (`0xb2d180`), or \(t\) when no upstream family supplies one.

### 5. Multi-family routing

For \(r_p=1\ldots5\):

\[
q_p=-0.1m_pr_p.
\]

This shifts:

- the shared couple-bar lane,
- the parent-capsule end points,
- the trunk start.

It does not shift the sibling bus. The trunk simply slopes from the shifted union lane back to \(Z_g+\delta_c\).

The child bus is controlled independently by

\[
\delta_c=(r_c\bmod7)\,0.1m_p.
\]

This moves the trunk endpoint/crossbar lane and the children’s bus-side X positions.

For `parentsRelationOrder > 5`, the `0x529bd4` cutoff skips the parent-lane offset entirely: \(q_p=0\). Such unions reuse the base Z lane and can overlap. The raw order still contributes to \(h=0.0025\max(r_p,r_c)\); there is no corresponding cutoff in the height adjustment.

### 6. Upward versus downward ownership

Yes: native routing is one `InteractiveTreeView3DViewerFamilyConnectionObject` per family record.

That object owns:

- father capsule;
- mother capsule;
- the couple/union join;
- one trunk;
- one sibling crossbar when needed;
- every visible child drop.

A child-to-parents “ancestor link” is not a second upward bus. It is the child drop belonging to that parents’ family object. Siblings are other drops in the same object.

The web’s family-graph route is already structurally close: [layout.js](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:533) iterates families and emits one routed assembly. However, the legacy fallback in [connectors.js](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:17) still independently constructs `descendantByParent` and `ancestorByChild` buses. That fallback should not be used for Mac-native family routing.

### 7. Y elevation

The segments are not all flattened to one elevation.

Before common adjustment:

\[
Y_{\rm bus}=
\max(\text{father, mother, and child content elevations})
+0.1m_{\rm avg}.
\]

Then the following logical endpoint elevations are used:

- parent capsules: \(Y_f/Y_m\rightarrow(Y_f+Y_m)/2\);
- trunk: \((Y_f+Y_m)/2\rightarrow Y_{\rm bus}\);
- crossbar: \(Y_{\rm bus}\rightarrow Y_{\rm bus}\);
- child drop \(i\): \(Y_{\rm bus}\rightarrow Y_i\).

Finally, `setHeightAdjustment:` applies

\[
h=0.0025\max(r_p,r_c)
\]

to both endpoints of every family segment (`0x52b68c–0x52b75c`; constant `0xb33d90`). Straight capsules therefore interpolate elevation between their endpoints; only the crossbar is necessarily level.

## Web divergences

- [layout.js:563](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:563) puts the bus a fixed `CHILD_BUS_GAP` beyond the tallest child. Native uses the midpoint between parent `maxZ` and child `minZ`, with no fixed clearance.
- [connectors.js:72](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:72) repeats the same error with `BUS_OFFSET_FROM_CHILDREN = 46`.
- [layout.js:574](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:574) describes and implements a lower-body couple bar. Native attaches at facing X edges at rect-center Z.
- [layout.js:583](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:583) joins parent centers, rather than their facing occupied-rect borders.
- [layout.js:591](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:591) creates an X dogleg and clamps an `anchorX` into the child span. Native keeps the trunk at \(G_x\) and expands the crossbar to include it.
- [layout.js:600](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:600) suppresses child legs conditionally. Native creates one drop per visible child.
- [layout.js:610](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/layout.js:610) represents the outer drops and crossbar as one U polyline. Native uses separate capsules and applies a bend only to each outer drop’s bus end.
- [connectors.js:345](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:345) routes every polyline through Catmull–Rom geometry, while [connectors.js:378](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:378) rounds every detected corner. Native trunks and middle T-junctions are straight; only two `startPointBendDelta` values can be nonzero.
- [connectors.js:165](/Users/ahmadjalil/github/familytree/src/components/interactive/threeDTree/connectors.js:165) assigns one web Z elevation to an entire connector. Native uses different endpoint elevations and straight 3D interpolation.
- Neither current family route implements `parentsRelationOrder`, `childRelationOrder`, the `>5` cutoff, modulo-7 lanes, or the `0.0025×order` elevation separation.

## Recommended fixes

1. Replace the current family routing block with a single `routeNativeFamily(family)` that emits parent capsules, trunk, crossbar, and all child drops from the formulas above. Preserve the existing one-family iteration in `layout.js`.

2. Derive endpoints from explicit occupied rectangles. Couple endpoints must be facing X-edge midpoints; child endpoints must be `minZ`-edge midpoints. Remove `COUPLE_BAR_DROP`, `CHILD_BUS_GAP`, and `BUS_OFFSET_FROM_CHILDREN` from native-style routing.

3. Keep segments separate. Add a renderer for capsule descriptors containing `start`, `end`, `radius`, endpoint extensions, and optional `startBendDelta`. Do not send native-family trunks or middle drops through general-purpose rounded polylines.

4. Implement relation lanes exactly:

   - parent lane only for orders `≤5`;
   - child lane with signed modulo 7;
   - common elevation adjustment from the unbounded maximum order.

5. Always emit one drop per visible child. For a single aligned child, omit the crossbar and use the native thickness overlap at the trunk/drop join.

6. Retire the `ancestorByChild`/`descendantByParent` fallback for Mac-family data, or make it consume already-grouped family descriptors so it cannot create a second bus.
