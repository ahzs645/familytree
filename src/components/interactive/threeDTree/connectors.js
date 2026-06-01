import * as THREE from 'three';
import { ROOT_CARD } from './constants.js';
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

// Distance between the bus bar and the children's top edges. Matches the Mac
// source which keeps the bus visually close to the row it's serving.
const BUS_OFFSET_FROM_CHILDREN = 30;

function makeFamilyBus(anchor, others, color, palette, thicknessScale, isDescendant) {
  const group = new THREE.Group();
  const z = 2;
  const anchorEdgeRadius = nodeVerticalRadius(anchor);
  const otherEdgeRadius = nodeVerticalRadius(others[0]);
  const otherY = others[0].y;
  const anchorEdgeY = isDescendant ? anchor.y - anchorEdgeRadius : anchor.y + anchorEdgeRadius;
  const otherEdgeY = isDescendant ? otherY + otherEdgeRadius : otherY - otherEdgeRadius;
  // Bus sits just above the children (or below the parents) — short drops to
  // each child, long drop from the anchor. Mirrors the Mac source.
  const busY = isDescendant
    ? otherEdgeY + BUS_OFFSET_FROM_CHILDREN
    : otherEdgeY - BUS_OFFSET_FROM_CHILDREN;

  const xs = others.map((node) => node.x);
  const minX = Math.min(...xs, anchor.x);
  const maxX = Math.max(...xs, anchor.x);
  // Tube radius in scene units. The native flat viewer draws hairline
  // connectors, so keep these slim — ~1.5 units renders near 1px at the
  // default top-down framing. The faint shadow tube sits just behind.
  const radius = 1.5 * thicknessScale;
  const shadowRadius = radius + 1.6;

  const addSegment = (a, b) => {
    const points = [new THREE.Vector3(a.x, a.y, z), new THREE.Vector3(b.x, b.y, z)];
    group.add(makeConnectorTube(points, palette.shadow, shadowRadius, 0.06, { x: 3, y: -3, z: -6 }, 3));
    group.add(makeConnectorTube(points, color, radius, 0.95, { x: 0, y: 0, z: 0 }, 4));
  };

  addSegment({ x: anchor.x, y: anchorEdgeY }, { x: anchor.x, y: busY });
  if (Math.abs(maxX - minX) > 1) addSegment({ x: minX, y: busY }, { x: maxX, y: busY });
  for (const other of others) addSegment({ x: other.x, y: busY }, { x: other.x, y: otherEdgeY });

  // Subtle caps at junctions — small enough not to look like beads.
  const junctionXs = new Set([anchor.x, ...xs]);
  for (const x of junctionXs) {
    group.add(makeConnectionCap(new THREE.Vector3(x, busY, z + 0.5), color, 1.7 * thicknessScale));
  }
  return group;
}

export function makeConnector(link, nodes, palette, options = {}) {
  const group = new THREE.Group();
  const type = link.type;
  const thicknessScale = Number.isFinite(options.connectionThickness) ? options.connectionThickness : 1;
  const colorMode = options.connectionColorMode || 'byGenerationLight';
  const color = colorForConnector(link, type, palette, colorMode, options.connectionCustomColor);
  const z = link.emphasis ? 5 : 2;
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

  const baseRadius = link.emphasis ? 2.0 : type === 'partner' ? 1.3 : 1.5;
  const tubeRadius = baseRadius * thicknessScale;
  group.add(makeConnectorTube(points, palette.shadow, tubeRadius + 1.6, 0.06, { x: 3, y: -3, z: -6 }, 3));
  group.add(makeConnectorTube(points, color, tubeRadius, link.emphasis ? 0.98 : 0.96, { x: 0, y: 0, z: 0 }, 4));
  if (type === 'family' || link.emphasis) {
    for (const point of uniqueConnectorPoints(points)) {
      group.add(makeConnectionCap(point, color, link.emphasis ? 2.6 : 1.9));
    }
  }
  return group;
}

// "By Generation, Light" connector hues. The native viewer walks a soft
// rainbow as generations climb away from the root: rose at the root, through
// amber / gold / green / teal, up to blue and violet for distant ancestors.
// Tuned a touch deeper than the band fills so hairlines stay legible on pink.
const CONNECTOR_GENERATION_COLORS = [
  '#d98fb4', // 0 — root / descendants (muted rose, not hot magenta)
  '#e0a25a', // 1 — parents / children (amber)
  '#d8b24c', // 2 — grandparents (gold)
  '#8fb061', // 3 — (green)
  '#5ea69a', // 4 — (teal)
  '#6f93c8', // 5 — (blue)
  '#9080c2', // 6 — (violet)
];

function connectorGenerationColor(generation) {
  const index = Math.min(CONNECTOR_GENERATION_COLORS.length - 1, Math.abs(Number(generation) || 0));
  return CONNECTOR_GENERATION_COLORS[index];
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
  // byGenerationLight (default) — colour each connector by the generation it
  // feeds into so siblings/branches read as a soft per-row gradient.
  if (type === 'partner') return palette.partnerLine;
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

function makeConnectorTube(points, color, radius, opacity, offset, renderOrder) {
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
  const segments = Math.max(6, Math.ceil(distance / 24));
  const geometry = new THREE.TubeGeometry(curve, segments, radius, 12, false);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.52,
    metalness: 0,
    transparent: true,
    opacity,
    depthWrite: false,
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
    const cornerRadius = Math.min(34, beforeLength * 0.44, afterLength * 0.44);
    const entry = current.clone().add(before.multiplyScalar(cornerRadius));
    const exit = current.clone().add(after.multiplyScalar(cornerRadius));
    routed.push(entry);
    for (let step = 1; step <= 5; step += 1) {
      const t = step / 6;
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
