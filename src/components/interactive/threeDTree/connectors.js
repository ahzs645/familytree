import * as THREE from 'three';
import { ROOT_CARD } from './constants.js';
import { makeCanvasTexture, makePlaneFromTexture, roundedRect } from './threeUtils.js';

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

  const tubeRadius = link.emphasis ? 3.2 : type === 'partner' ? 2 : 2.45;
  for (let i = 1; i < points.length; i += 1) {
    group.add(makeRibbonSegment(points[i - 1], points[i], palette.shadow, tubeRadius + 5.6, 0.08, -8, 3));
  }
  for (let i = 1; i < points.length; i += 1) {
    group.add(makeRibbonSegment(points[i - 1], points[i], color, tubeRadius, link.emphasis ? 0.96 : 0.9, 0, 4));
  }
  if (type === 'family' || link.emphasis) {
    for (const point of uniqueConnectorPoints(points)) {
      group.add(makeConnectionCap(point, color, link.emphasis ? 5.8 : 4.6));
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
  const radius = a.featured ? ROOT_CARD.w * 0.44 : 58;
  return a.x + Math.sign(b.x - a.x || 1) * radius;
}

function nodeVerticalRadius(node) {
  return node.featured ? ROOT_CARD.h * 0.44 : 72;
}

function makeRibbonSegment(a, b, color, radius, opacity, zOffset, renderOrder) {
  const length = a.distanceTo(b);
  if (length <= 0.1) return new THREE.Group();
  const texture = makeConnectorTexture(color, opacity);
  const mesh = makePlaneFromTexture(texture, length + radius * 2, radius * 2.35);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.position.x += zOffset ? 4 : 0;
  mesh.position.y += zOffset ? -5 : 0;
  mesh.position.z += zOffset;
  const direction = new THREE.Vector3().subVectors(b, a);
  mesh.rotation.z = Math.atan2(direction.y, direction.x);
  mesh.material.depthWrite = false;
  mesh.renderOrder = renderOrder;
  return mesh;
}

function makeConnectorTexture(color, opacity) {
  return makeCanvasTexture(256, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const pad = 5;
    const radius = 24;
    roundedRect(ctx, pad, pad, w - pad * 2, h - pad * 2, radius);
    ctx.fillStyle = colorWithAlpha(color, opacity);
    ctx.fill();
    if (opacity > 0.2) {
      const highlight = ctx.createLinearGradient(0, pad, 0, h - pad);
      highlight.addColorStop(0, 'rgba(255,255,255,0.42)');
      highlight.addColorStop(0.52, 'rgba(255,255,255,0.06)');
      highlight.addColorStop(1, 'rgba(96,0,62,0.1)');
      roundedRect(ctx, pad, pad, w - pad * 2, h - pad * 2, radius);
      ctx.fillStyle = highlight;
      ctx.fill();
    }
  });
}

function colorWithAlpha(color, alpha) {
  const parsed = new THREE.Color(color);
  return `rgba(${Math.round(parsed.r * 255)},${Math.round(parsed.g * 255)},${Math.round(parsed.b * 255)},${alpha})`;
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
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.34,
    metalness: 0.03,
    transparent: true,
    opacity: 0.9,
  });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 12), material);
  cap.scale.set(1.2, 1.2, 0.45);
  cap.position.copy(point);
  cap.position.z += 1;
  cap.renderOrder = 5;
  return cap;
}
