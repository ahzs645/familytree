/**
 * FamilyObject — optional marker representing the family union between
 * partners. Mirrors Mac VirtualTreeFamilyObject.
 *
 * The web graph doesn't carry explicit family-node positions, so this object
 * derives its position from the midpoint of the two partner meshes. When the
 * builder has no partner edge for a subject, no FamilyObject is created.
 */

import * as THREE from 'three';

const MARKER_RADIUS = 8;
const MARKER_COLOR = 0xcbd5e1;

export class FamilyObject {
  constructor({ partnerAId, partnerBId, positionA, positionB }) {
    this.partnerAId = partnerAId;
    this.partnerBId = partnerBId;

    const mid = {
      x: (positionA.x + positionB.x) / 2,
      y: (positionA.y + positionB.y) / 2,
      z: (positionA.z + positionB.z) / 2 - 2,
    };
    this.marker = new THREE.Mesh(
      new THREE.SphereGeometry(MARKER_RADIUS, 12, 10),
      new THREE.MeshStandardMaterial({ color: MARKER_COLOR, roughness: 0.7 })
    );
    this.marker.position.set(mid.x, mid.y, mid.z);
    this.marker.userData = { kind: 'family' };
  }

  dispose() {
    this.marker.geometry?.dispose?.();
    this.marker.material?.dispose?.();
  }
}

/**
 * Walk the builder's connections, find partner edges, and emit one
 * FamilyObject per unique partner pair.
 */
export function buildFamilyObjects(connections, positionById) {
  const seen = new Set();
  const out = [];
  for (const conn of connections) {
    if (conn.kind !== 'partner') continue;
    const key = [conn.fromId, conn.toId].sort().join('::');
    if (seen.has(key)) continue;
    seen.add(key);
    const a = positionById.get(conn.fromId);
    const b = positionById.get(conn.toId);
    if (!a || !b) continue;
    out.push(new FamilyObject({
      partnerAId: conn.fromId,
      partnerBId: conn.toId,
      positionA: a,
      positionB: b,
    }));
  }
  return out;
}
