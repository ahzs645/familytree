import * as THREE from 'three';
import { ROOT_CARD, generationDepthZ } from './constants.js';
import { MAC_FAMILY_GRAPH_LAYOUT } from './macTreeStyle.js';

/**
 * Build all connectors for a layout in one pass: groups descendant links by
 * parent and ancestor links by child so siblings share a single horizontal
 * bus instead of stacking N overlapping L-shapes (which causes z-fighting).
 * Partner links and any link with pre-computed `points` fall through to
 * `makeConnector`.
 */
export function makeFamilyConnectors(links, nodes, palette, options = {}) {
  const group = new THREE.Group();
  if (!links?.length) return group;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const descendantByParent = new Map();
  const ancestorByChild = new Map();
  const passThrough = [];

  for (const link of links) {
    if (link.points?.length) { passThrough.push(link); continue; }
    if (link.type === 'descendant' && link.from && link.to) {
      if (!descendantByParent.has(link.from)) descendantByParent.set(link.from, []);
      descendantByParent.get(link.from).push(link);
    } else if (link.type === 'ancestor' && link.from && link.to) {
      // Layout stores ancestor links as parent→child (from=parent, to=child).
      // Group by the child so two parents share one upward drop + bus.
      if (!ancestorByChild.has(link.to)) ancestorByChild.set(link.to, []);
      ancestorByChild.get(link.to).push(link);
    } else {
      passThrough.push(link);
    }
  }

  const thicknessScale = Number.isFinite(options.connectionThickness) ? options.connectionThickness : 1;
  const colorMode = options.connectionColorMode || 'byGenerationLight';

  for (const [parentId, parentLinks] of descendantByParent) {
    const parent = nodeById.get(parentId);
    const children = parentLinks.map((link) => nodeById.get(link.to)).filter(Boolean);
    if (!parent || children.length === 0) continue;
    if (children.length === 1) {
      group.add(makeConnector(parentLinks[0], nodes, palette, options));
      continue;
    }
    const color = colorForConnector(parentLinks[0], 'descendant', palette, colorMode, options.connectionCustomColor);
    group.add(makeFamilyBus(parent, children, color, palette, thicknessScale, /*descendant*/ true));
  }

  for (const [childId, ancestorLinks] of ancestorByChild) {
    const child = nodeById.get(childId);
    // For ancestor links: from=parent, to=child. Group by child, others=parents.
    const parents = ancestorLinks.map((link) => nodeById.get(link.from)).filter(Boolean);
    if (!child || parents.length === 0) continue;
    if (parents.length === 1) {
      group.add(makeConnector(ancestorLinks[0], nodes, palette, options));
      continue;
    }
    const color = colorForConnector(ancestorLinks[0], 'ancestor', palette, colorMode, options.connectionCustomColor);
    // Anchor is the child (below), others are the parents (above) → not "descendant"
    group.add(makeFamilyBus(child, parents, color, palette, thicknessScale, /*descendant*/ false));
  }

  for (const link of passThrough) {
    group.add(makeConnector(link, nodes, palette, options));
  }

  return group;
}

// Distance between the bus bar and the nearest figure edge — keeps the bus in
// the gutter between bands (like the Mac source) with room for rounded corners.
const BUS_OFFSET_FROM_CHILDREN = 46;

// Native family connection (InteractiveTreeView3DViewerFamilyConnectionObject):
// straight risers/trunk + a children bus where ONLY the outer turns are rounded
// L-corners — middle children drop straight off the bus (T-joins), matching the
// SCNCapsule + per-child bend-delta model in the binary. We draw the outer drops
// and the bus as one rounded U polyline so the corners curve like the source,
// then straight drops for the inner children and the trunk.
function makeFamilyBus(anchor, others, color, palette, thicknessScale, isDescendant) {
  const group = new THREE.Group();
  const z = 2;
  const anchorEdgeRadius = nodeVerticalRadius(anchor);
  const anchorEdgeY = isDescendant ? anchor.y - anchorEdgeRadius : anchor.y + anchorEdgeRadius;
  // Each child's near edge (children can differ in size → different edge Y).
  const edgeYOf = (node) => (isDescendant
    ? node.y + nodeVerticalRadius(node)
    : node.y - nodeVerticalRadius(node));
  // Bus sits in the gutter just past the figure CLOSEST to the parent/child
  // side — i.e. above the TALLEST child (descendant) or below the LOWEST parent
  // (ancestor). Using the nearest edge keeps the bus clear of every figure so
  // each one gets a real drop with a roundable corner (the featured root's big
  // head no longer pokes above a too-low bus → no sharp up-turn).
  const nearestEdgeY = isDescendant
    ? Math.max(...others.map(edgeYOf))
    : Math.min(...others.map(edgeYOf));
  const busY = isDescendant
    ? nearestEdgeY + BUS_OFFSET_FROM_CHILDREN
    : nearestEdgeY - BUS_OFFSET_FROM_CHILDREN;

  const sorted = [...others].sort((a, b) => a.x - b.x);
  const left = sorted[0];
  const right = sorted[sorted.length - 1];
  // Thin hairline tubes, matching the source (which draws connectors at a
  // near-constant slim width, not bold focus lines).
  const radius = 1.6 * thicknessScale;
  const shadowRadius = radius + 0.8;

  const addPath = (points) => {
    group.add(makeConnectorTube(points, palette.shadow, shadowRadius, 0.05, { x: 1.5, y: -1.5, z: -6 }, 3));
    group.add(makeConnectorTube(points, color, radius, 0.95, { x: 0, y: 0, z: 0 }, 4));
  };
  const vec = (x, y) => new THREE.Vector3(x, y, z);

  if (right.x - left.x > 1) {
    // Outer frame: leftmost drop → bus → rightmost drop, rounded at both turns.
    addPath([
      vec(left.x, edgeYOf(left)),
      vec(left.x, busY),
      vec(right.x, busY),
      vec(right.x, edgeYOf(right)),
    ]);
    // Inner children: straight drops off the bus.
    for (const other of others) {
      if (other === left || other === right) continue;
      addPath([vec(other.x, busY), vec(other.x, edgeYOf(other))]);
    }
  } else {
    // All children share one x (single stack) — one straight drop.
    addPath([vec(left.x, busY), vec(left.x, edgeYOf(left))]);
  }

  // Trunk: anchor (couple/child) to the bus, straight.
  addPath([vec(anchor.x, anchorEdgeY), vec(anchor.x, busY)]);
  return group;
}

export function makeConnector(link, nodes, palette, options = {}) {
  const group = new THREE.Group();
  // Tag the whole connection with its family id so a pointer raycast can identify
  // which relationship is under the cursor (drives hover highlighting).
  if (link.familyId) group.userData.connectionKey = link.familyId;
  const type = link.type;
  const thicknessScale = Number.isFinite(options.connectionThickness) ? options.connectionThickness : 1;
  const colorMode = options.connectionColorMode || 'byGenerationLight';
  // Native rule (decompiled): a line highlights when its OWN connection or the
  // person endpoint it belongs to is hovered/selected — the lines TOUCHING that
  // family, not a traced lineage path. `hoveredKeys` is the set of family ids to
  // light up (all families touching a hovered person, or the single hovered
  // line); `hoveredConnectionKey` kept for the single-line callers.
  const highlighted = Boolean(link.familyId) && (
    (options.hoveredKeys && options.hoveredKeys.has(link.familyId))
    || options.hoveredConnectionKey === link.familyId
  );
  const baseColor = colorForConnector(link, type, palette, colorMode, options.connectionCustomColor);
  // Native highlight = additive emissive GLOW (intensity 0.75) + thickness ×2 on
  // top of the line's normal colour. We lift the hue toward white and add a
  // matching emissive so the touched lines read as glowing, not just brighter.
  const color = highlighted ? lightenHex(baseColor, 0.5) : baseColor;
  // Connectors span two generations (parent → child). Sit them at the midpoint
  // depth between the two staggered slabs so they read as connecting both
  // without floating in front of/behind either by a full generation step.
  const z = (link.emphasis ? 5 : 2) + generationDepthZ((Number(link.generation) || 0) - 0.5);
  let points = (link.points || []).map((point) => new THREE.Vector3(point.x, point.y, point.z ?? z));
  if (points.length === 0 && link.from && link.to) {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const from = nodeById.get(link.from);
    const to = nodeById.get(link.to);
    if (!from || !to) return group;
    points = type === 'partner'
      ? partnerPoints(from, to, z)
      : orthogonalPoints(from, to, z);
  }

  // Slim, near-uniform width — the source does NOT bold the focus/emphasis line.
  const baseRadius = type === 'partner' ? 1.2 : 1.6;
  const tubeRadius = baseRadius * thicknessScale * (highlighted ? 2 : 1);
  const glow = highlighted ? { emissive: color, emissiveIntensity: 0.6 } : {};
  group.add(makeConnectorTube(points, palette.shadow, tubeRadius + 1.4, 0.05, { x: 1.5, y: -1.5, z: -6 }, 3));
  group.add(makeConnectorTube(points, color, tubeRadius, highlighted ? 1 : link.emphasis ? 0.98 : 0.96, { x: 0, y: 0, z: highlighted ? 4 : 0 }, highlighted ? 8 : 4, glow));
  // Transparent fat tube purely for forgiving hit-testing of the thin line.
  // Coarse geometry + a direct tag let pointer raycasts test ONLY these tubes.
  if (link.familyId) {
    const hit = makeConnectorTube(points, '#000000', 11, 0, { x: 0, y: 0, z: 0 }, 1, { radialSegments: 5, step: 72 });
    hit.userData.connectorHit = true;
    hit.userData.connectionKey = link.familyId;
    group.add(hit);
  }
  if (link.coupleMark) group.add(makeUnionMarker(link.coupleMark, link.emphasis));
  return group;
}

function lightenHex(hex, amount) {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return hex;
  const next = [0, 2, 4].map((index) => {
    const value = parseInt(normalized.slice(index, index + 2), 16);
    return Math.round(value + (255 - value) * amount).toString(16).padStart(2, '0');
  });
  return `#${next.join('')}`;
}

// The native viewer marks each couple bar with a MARRIAGE symbol — two
// interlocking wedding rings (MacFamilyTree ships Family_Rings models for this),
// NOT a slashed circle. Two thin neutral-silver ring outlines overlapping
// horizontally, sitting just in front of the bar.
function makeUnionMarker(point, emphasis) {
  const group = new THREE.Group();
  const r = emphasis ? 8.5 : 6.8;
  const tube = emphasis ? 1.5 : 1.25;
  const mat = new THREE.MeshBasicMaterial({ color: '#aeb3bd', transparent: true, opacity: 0.96 });
  const offset = r * 0.6;
  const ringLeft = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 14, 44), mat);
  ringLeft.position.x = -offset;
  const ringRight = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 14, 44), mat);
  ringRight.position.x = offset;
  group.add(ringLeft);
  group.add(ringRight);
  group.position.set(point.x, point.y, (point.z ?? 5) + 4);
  group.renderOrder = 7;
  return group;
}

// Native flat-viewer connector colour: a muted dusty rose-brown, NOT the heavy
// dark maroon we had — the source's hairlines read as a soft terracotta/rose
// that lightens slightly as generations climb away from the root.
const CONNECTOR_GENERATION_COLORS = [
  '#b06257', // 0 — root / descendants (muted rose-brown)
  '#b56a5e', // 1 — parents / children
  '#ba7266', // 2 — grandparents
  '#bf7b6e', // 3
  '#c48476', // 4
  '#c98d7f', // 5
  '#ce9789', // 6 — distant ancestors
];

function connectorGenerationColor(generation) {
  const index = Math.min(CONNECTOR_GENERATION_COLORS.length - 1, Math.abs(Number(generation) || 0));
  return CONNECTOR_GENERATION_COLORS[index];
}

// Native viewer lineage hues. Values are pixel-sampled from the line cores of
// the MacFamilyTree 11 reference (Screenshot 2026-05-08 10.29.06) — the source
// lines are MUTED mid-tones (not hot/saturated), matching the binary's scheme
// of a 0.5-saturation HSB generation palette darkened ~30% toward black.
// The focus line is violet, descendant flow magenta-rose, ancestor lineages
// split red (husband line) / green (wife line).
const LINEAGE_CONNECTOR_COLORS = {
  root: '#9f4ac6', // violet — couple bar + trunk feeding the focus person
  descend: '#b04489', // magenta-rose — grandparents → parents, descendant flow
  paternal: '#ae5047', // brick/salmon red — link feeding a male (husband) ancestor
  maternal: '#a6ba3b', // lime green — link feeding a female (wife) ancestor
};

function lineageConnectorColor(colorClass) {
  return LINEAGE_CONNECTOR_COLORS[colorClass] || null;
}

function colorForConnector(link, type, palette, mode, customColor) {
  if (mode === 'gray') return '#9098a0';
  if (mode === 'blackOrWhite') return palette.background && isDarkBackground(palette.background) ? '#f4f5f7' : '#1c1f24';
  if (mode === 'customColor') return customColor || '#7b5af6';
  if (mode === 'byGenerationDark') {
    if (type === 'partner') return palette.partnerLine;
    if (Number.isFinite(link.generation)) return shadeHex(connectorGenerationColor(link.generation), 0.22);
    return link.emphasis || type === 'descendant' ? palette.descendantLine : palette.ancestorLine;
  }
  if (mode === 'byBlood') {
    if (type === 'partner') return '#b2b8bf';
    return link.emphasis ? palette.descendantLine : (type === 'ancestor' ? palette.ancestorLine : palette.descendantLine);
  }
  // byGenerationLight (default) — match the native viewer's lineage hues
  // (violet focus line, magenta descendant flow, red/green ancestor lineages).
  if (type === 'partner') return palette.partnerLine;
  const lineage = lineageConnectorColor(link.colorClass);
  if (lineage) return lineage;
  if (Number.isFinite(link.generation)) return connectorGenerationColor(link.generation);
  if (link.emphasis) return palette.descendantLine;
  if (type === 'ancestor') return palette.ancestorLine;
  return palette.descendantLine;
}

function shadeHex(hex, amount) {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return hex;
  const next = [0, 2, 4].map((index) => {
    const value = parseInt(normalized.slice(index, index + 2), 16);
    return Math.round(value * (1 - amount)).toString(16).padStart(2, '0');
  });
  return `#${next.join('')}`;
}

function isDarkBackground(color) {
  const hex = String(color || '').replace('#', '');
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
}

function partnerPoints(from, to, z) {
  const y = Math.max(partnerLineY(from), partnerLineY(to));
  return [
    new THREE.Vector3(edgeX(from, to), y, z),
    new THREE.Vector3(edgeX(to, from), y, z),
  ];
}

function partnerLineY(node) {
  return node.y + (node.featured ? 38 : 14);
}

function orthogonalPoints(from, to, z) {
  const fromEdgeRadius = nodeVerticalRadius(from);
  const toEdgeRadius = nodeVerticalRadius(to);
  const fromEdge = from.y > to.y ? from.y - fromEdgeRadius : from.y + fromEdgeRadius;
  const toEdge = from.y > to.y ? to.y + toEdgeRadius : to.y - toEdgeRadius;
  const midY = (fromEdge + toEdge) / 2;
  return [
    new THREE.Vector3(from.x, fromEdge, z),
    new THREE.Vector3(from.x, midY, z),
    new THREE.Vector3(to.x, midY, z),
    new THREE.Vector3(to.x, toEdge, z),
  ];
}

function edgeX(a, b) {
  const radius = a.featured
    ? MAC_FAMILY_GRAPH_LAYOUT.featuredHorizontalConnectorRadius
    : MAC_FAMILY_GRAPH_LAYOUT.regularHorizontalConnectorRadius;
  return a.x + Math.sign(b.x - a.x || 1) * radius;
}

function nodeVerticalRadius(node) {
  return node.featured
    ? MAC_FAMILY_GRAPH_LAYOUT.featuredConnectorRadius
    : MAC_FAMILY_GRAPH_LAYOUT.regularConnectorRadius;
}

function makeConnectorTube(points, color, radius, opacity, offset, renderOrder, detail = {}) {
  const routed = roundedPolylinePoints(points);
  if (routed.length < 2) return new THREE.Group();
  const shifted = routed.map((point) => new THREE.Vector3(
    point.x + offset.x,
    point.y + offset.y,
    point.z + offset.z
  ));
  const distance = shifted.reduce((sum, point, index) => (
    index === 0 ? 0 : sum + point.distanceTo(shifted[index - 1])
  ), 0);
  // CatmullRomCurve3 needs ≥3 control points to interpolate cleanly. Use a
  // dedicated LineCurve3 for straight 2-point segments — TubeGeometry on a
  // degenerate spline produces stippled/discontinuous output.
  const curve = shifted.length === 2
    ? new THREE.LineCurve3(shifted[0], shifted[1])
    : new THREE.CatmullRomCurve3(shifted, false, 'centripetal', 0.08);
  const segments = Math.max(8, Math.ceil(distance / (detail.step || 9)));
  const geometry = new THREE.TubeGeometry(curve, segments, radius, detail.radialSegments || 14, false);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.52,
    metalness: 0,
    transparent: true,
    opacity,
    depthWrite: false,
    emissive: detail.emissive ? new THREE.Color(detail.emissive) : new THREE.Color(0, 0, 0),
    emissiveIntensity: detail.emissiveIntensity || 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = renderOrder;
  return mesh;
}

function roundedPolylinePoints(points) {
  if (points.length <= 2) return points;
  const routed = [points[0].clone()];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const before = new THREE.Vector3().subVectors(previous, current);
    const after = new THREE.Vector3().subVectors(next, current);
    const beforeLength = before.length();
    const afterLength = after.length();
    const isCorner = beforeLength > 0.1 && afterLength > 0.1 && Math.abs(before.normalize().dot(after.normalize())) < 0.98;
    if (!isCorner) {
      routed.push(current.clone());
      continue;
    }
    const cornerRadius = Math.min(40, beforeLength * 0.45, afterLength * 0.45);
    const entry = current.clone().add(before.multiplyScalar(cornerRadius));
    const exit = current.clone().add(after.multiplyScalar(cornerRadius));
    routed.push(entry);
    // Resolve the arc finely enough that the bend reads as a smooth curve, not
    // a few flat chords. Scale the step count with the corner radius.
    const arcSteps = Math.max(8, Math.round(cornerRadius / 2.5));
    for (let step = 1; step < arcSteps; step += 1) {
      const t = step / arcSteps;
      routed.push(quadraticPoint(entry, current, exit, t));
    }
    routed.push(exit);
  }
  routed.push(points[points.length - 1].clone());
  return routed;
}

function quadraticPoint(a, control, b, t) {
  const oneMinusT = 1 - t;
  return new THREE.Vector3(
    oneMinusT * oneMinusT * a.x + 2 * oneMinusT * t * control.x + t * t * b.x,
    oneMinusT * oneMinusT * a.y + 2 * oneMinusT * t * control.y + t * t * b.y,
    oneMinusT * oneMinusT * a.z + 2 * oneMinusT * t * control.z + t * t * b.z
  );
}

function uniqueConnectorPoints(points) {
  const seen = new Set();
  return points.filter((point) => {
    const key = `${Math.round(point.x)}:${Math.round(point.y)}:${Math.round(point.z)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function makeConnectionCap(point, color, radius) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.34,
    metalness: 0.03,
    transparent: true,
    opacity: 0.9,
  });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 12), material);
  cap.scale.set(1.24, 1.24, 0.5);
  cap.position.set(0, 0, 0);
  cap.renderOrder = 5;
  group.add(cap);

  const highlight = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.32, 16, 8),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.54, depthWrite: false })
  );
  highlight.scale.set(1.4, 0.9, 0.35);
  highlight.position.set(-radius * 0.22, radius * 0.24, radius * 0.18);
  highlight.renderOrder = 6;
  group.add(highlight);

  group.position.copy(point);
  group.position.z += 1;
  return group;
}
