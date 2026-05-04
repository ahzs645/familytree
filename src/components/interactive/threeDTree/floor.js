import * as THREE from 'three';
import { makeCanvasTexture, makePlaneFromTexture, roundedRect } from './threeUtils.js';

export function makeBottomPlane(palette, bounds, mode = 'grid') {
  const group = new THREE.Group();
  const sizeX = Math.max(2400, bounds.maxX - bounds.minX + 900);
  const sizeY = Math.max(1800, bounds.maxY - bounds.minY + 900);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const step = 95;
  const left = centerX - sizeX / 2;
  const right = centerX + sizeX / 2;
  const bottom = centerY - sizeY / 2;
  const top = centerY + sizeY / 2;

  const baseTexture = makeBottomPlaneTexture(mode, palette);
  const base = makePlaneFromTexture(baseTexture, sizeX, sizeY);
  base.position.set(centerX, centerY, -86);
  base.renderOrder = 0;
  group.add(base);

  if (mode === 'plain') return group;

  const makeLines = (positions, color, opacity) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    return new THREE.LineSegments(geometry, material);
  };

  const regular = [];
  const strong = [];
  let index = 0;
  for (let x = left; x <= right; x += step, index += 1) {
    const target = index % 4 === 0 ? strong : regular;
    target.push(x, bottom, -82, x, top, -82);
  }
  index = 0;
  for (let y = bottom; y <= top; y += step, index += 1) {
    const target = index % 4 === 0 ? strong : regular;
    target.push(left, y, -82, right, y, -82);
  }
  group.add(makeLines(regular, palette.grid, 0.72));
  group.add(makeLines(strong, palette.gridStrong, 0.46));
  return group;
}

function makeBottomPlaneTexture(mode, palette) {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, w, h);
    if (mode === 'checker') {
      const size = 64;
      for (let y = 0; y < h; y += size) {
        for (let x = 0; x < w; x += size) {
          if (((x + y) / size) % 2 === 0) {
            ctx.fillStyle = 'rgba(120, 132, 145, 0.055)';
            ctx.fillRect(x, y, size, size);
          }
        }
      }
    } else if (mode === 'dots') {
      ctx.fillStyle = 'rgba(110, 124, 142, 0.16)';
      for (let y = 28; y < h; y += 48) {
        for (let x = 28; x < w; x += 48) {
          ctx.beginPath();
          ctx.arc(x, y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  });
}
