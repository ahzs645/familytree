import * as THREE from 'three';
import { ROOT_CARD } from './constants.js';
import { MAC_FAMILY_GRAPH_LAYOUT } from './macTreeStyle.js';

export function makeConnector(link, nodes, palette) {
  const group = new THREE.Group();
  const type = link.type;
  const color = link.emphasis
    ? palette.descendantLine
    : type === 'partner'
    ? palette.partnerLine
    : type === 'ancestor'
      ? palette.ancestorLine
      : palette.descendantLine;
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

  const tubeRadius = link.emphasis ? 3 : type === 'partner' ? 1.8 : 2.15;
  group.add(makeConnectorTube(points, palette.shadow, tubeRadius + 4.8, 0.075, { x: 4, y: -5, z: -8 }, 3));
  group.add(makeConnectorTube(points, color, tubeRadius, link.emphasis ? 0.98 : 0.92, { x: 0, y: 0, z: 0 }, 4));
  if (type === 'family' || link.emphasis) {
    for (const point of uniqueConnectorPoints(points)) {
      group.add(makeConnectionCap(point, color, link.emphasis ? 5.8 : 4.4));
    }
  }
  return group;
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
  const radius = a.featured ? ROOT_CARD.w * 0.38 : MAC_FAMILY_GRAPH_LAYOUT.regularConnectorRadius;
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
  const curve = new THREE.CatmullRomCurve3(shifted, false, 'centripetal', 0.08);
  const geometry = new THREE.TubeGeometry(curve, Math.max(8, Math.ceil(distance / 32)), radius, 10, false);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.34,
    metalness: 0.02,
    emissive: color,
    emissiveIntensity: opacity > 0.4 ? 0.04 : 0,
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
