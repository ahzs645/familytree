/**
 * Generation bands for the Virtual Tree 3D scene.
 *
 * These mirror the Mac renderer's generation-band concept with lightweight
 * planes and labels, kept separate from Scene so the renderer can toggle or
 * restyle bands without touching person/family objects.
 */

import * as THREE from 'three';

const BAND_COLORS = [0x1d4ed8, 0x047857, 0xb45309, 0xbe123c, 0x6d28d9, 0x0f766e];

function makeLabelSprite(text, count) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(10, 14, 24, 0.78)';
  ctx.roundRect(12, 22, 488, 84, 18);
  ctx.fill();
  ctx.font = '700 28px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 52);
  ctx.font = '500 18px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(`${count} ${count === 1 ? 'person' : 'persons'}`, 256, 82);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(180, 45, 1);
  return sprite;
}

export class GenerationBandObject {
  constructor(band, { index = 0, orientation = 'vertical' } = {}) {
    this.group = new THREE.Group();
    const color = BAND_COLORS[Math.abs(band.generation + index) % BAND_COLORS.length];
    const geometry = new THREE.PlaneGeometry(band.width, band.height);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: band.generation === 0 ? 0.13 : 0.085,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.plane = new THREE.Mesh(geometry, material);
    this.plane.position.set(band.x, band.y, -18);
    this.group.add(this.plane);

    this.label = makeLabelSprite(band.title, band.count);
    const labelX = orientation === 'horizontal' ? band.x : band.x - band.width / 2 + 115;
    const labelY = orientation === 'horizontal' ? band.y + band.height / 2 - 56 : band.y;
    this.label.position.set(labelX, labelY, 34);
    this.group.add(this.label);
  }

  dispose() {
    this.plane.geometry?.dispose?.();
    this.plane.material?.dispose?.();
    this.label.material?.map?.dispose?.();
    this.label.material?.dispose?.();
  }
}
