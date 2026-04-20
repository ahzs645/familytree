/**
 * ConnectionObject — a single edge between two persons or a person and a
 * family. Mirrors Mac VirtualTreeConnectionObject.
 *
 * Kind `partner` renders dashed; `parent-of` solid. Callers can swap the
 * material to highlight a relationship path.
 */

import * as THREE from 'three';

const DEFAULT_COLOR = 0xaab4c8;
const HIGHLIGHT_COLOR = 0xffd166;

function buildMaterial(kind, highlight = false) {
  const color = highlight ? HIGHLIGHT_COLOR : DEFAULT_COLOR;
  if (kind === 'partner') {
    return new THREE.LineDashedMaterial({
      color,
      linewidth: 2,
      dashSize: 14,
      gapSize: 8,
      transparent: true,
      opacity: highlight ? 0.95 : 0.65,
    });
  }
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: highlight ? 0.95 : 0.55,
  });
}

export class ConnectionObject {
  constructor(connection, from, to) {
    this.connection = connection;
    this.kind = connection.kind || 'parent-of';
    this.fromId = connection.fromId;
    this.toId = connection.toId;
    const material = buildMaterial(this.kind);
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    this.line = new THREE.Line(geometry, material);
    if (this.kind === 'partner') this.line.computeLineDistances();
    this.line.userData = { kind: 'connection', connection };
  }

  setHighlight(highlight) {
    const next = buildMaterial(this.kind, highlight);
    this.line.material?.dispose?.();
    this.line.material = next;
    if (this.kind === 'partner') this.line.computeLineDistances();
  }

  dispose() {
    this.line.geometry?.dispose?.();
    this.line.material?.dispose?.();
  }
}
