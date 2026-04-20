/**
 * PersonObject — one scene node per person in the virtual tree.
 *
 * Mirrors the Mac VirtualTreePersonObject split: the React/Three layer
 * instantiates a PersonObject per builder node, and the object owns its
 * mesh, label sprite, and click targets. This keeps picking, highlighting,
 * and material swaps scoped to the object rather than the scene.
 */

import * as THREE from 'three';
import { createPersonMesh, SYMBOL_SIZE } from './symbolModes.js';
import { resolveNodeColor } from './colorModes.js';

function makeLabelSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = '600 22px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(20, 20, 28, 0.85)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(text || '').slice(0, 24), 128, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(120, 30, 1);
  return sprite;
}

export class PersonObject {
  constructor(node, { symbolMode, colorMode, photoUrl }) {
    this.node = node;
    this.group = new THREE.Group();
    this.group.position.set(node.x ?? 0, node.y ?? 0, node.z ?? 0);

    this.baseColor = resolveNodeColor(node, colorMode);
    this.mesh = createPersonMesh(symbolMode, this.baseColor, { photoUrl });
    this.mesh.userData = { id: node.id, kind: 'person' };
    this.group.add(this.mesh);

    this.label = makeLabelSprite(node.name);
    this.label.position.set(0, SYMBOL_SIZE * 0.75, 0);
    this.group.add(this.label);
  }

  setColorMode(colorMode) {
    this.baseColor = resolveNodeColor(this.node, colorMode);
    if (this.mesh.material?.color && !this.mesh.userData.__isPhoto) {
      this.mesh.material.color.setHex(this.baseColor);
    }
  }

  setHighlight(highlight) {
    if (!this.mesh?.material?.emissive) return;
    if (highlight) {
      this.mesh.material.emissive.setHex(0xffd166);
      this.mesh.material.emissiveIntensity = 0.55;
    } else {
      this.mesh.material.emissive.setHex(0x000000);
      this.mesh.material.emissiveIntensity = 0;
    }
  }

  getClickTarget() {
    return this.mesh;
  }

  dispose() {
    if (this.mesh?.material?.map) this.mesh.material.map.dispose?.();
    this.mesh?.material?.dispose?.();
    if (this.label?.material?.map) this.label.material.map.dispose?.();
    this.label?.material?.dispose?.();
  }
}
