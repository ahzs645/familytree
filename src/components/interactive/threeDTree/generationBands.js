import * as THREE from 'three';
import { BAND_LABEL_GUTTER } from './constants.js';
import { makeCanvasTexture, makePlaneFromTexture, roundedRect } from './threeUtils.js';

export function makeGenerationBand(band, palette, style = 'raised') {
  if (style === 'none') return new THREE.Group();
  const texture = makeBandTexture(band, palette, style);
  const geometry = new THREE.PlaneGeometry(band.width, band.height);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(band.x, band.y, -34);
  mesh.renderOrder = 1;
  return mesh;
}

function makeBandTexture(band, palette, style = 'raised') {
  const fill = band.generation === 0
    ? 'rgba(248, 191, 218, 0.68)'
    : band.generation < 0
      ? ancestorBandColor(Math.abs(band.generation))
      : descendantBandColor(band.generation);
  return makeCanvasTexture(1024, 256, (ctx, w, h) => {
    const insetY = style === 'flat' ? 42 : 32;
    const height = style === 'pedestal' ? h - 82 : h - 64;
    ctx.shadowColor = style === 'flat' ? 'transparent' : 'rgba(0,0,0,0.16)';
    ctx.shadowBlur = style === 'pedestal' ? 36 : 28;
    ctx.shadowOffsetY = style === 'pedestal' ? 16 : 12;
    roundedRect(ctx, 24, insetY, w - 48, height, style === 'flat' ? 18 : 34);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    if (style === 'pedestal') {
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      roundedRect(ctx, 36, insetY + height - 18, w - 72, 22, 16);
      ctx.fill();
    }
    ctx.lineWidth = 2;
    ctx.strokeStyle = band.generation === 0 ? 'rgba(191, 82, 150, 0.28)' : 'rgba(130, 112, 72, 0.22)';
    ctx.stroke();

  });
}

export function makeGenerationLabel(band) {
  if (band.showLabel === false) return new THREE.Group();
  const label = generationLabel(band.generation);
  const sublabel = band.subtitle || `${band.count} ${band.count === 1 ? 'person' : 'people'}`;
  const texture = makeCanvasTexture(520, 170, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = band.generation === 0 ? 'rgba(157, 58, 117, 0.54)' : 'rgba(93, 84, 42, 0.58)';
    ctx.font = '800 42px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.fillText(label, 24, 78);
    ctx.fillStyle = 'rgba(80, 86, 96, 0.62)';
    ctx.font = '750 25px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.fillText(sublabel, 26, 116);
  });
  const labelWidth = Math.min(BAND_LABEL_GUTTER - 34, 250);
  const labelHeight = 82;
  const plane = makePlaneFromTexture(texture, labelWidth, labelHeight);
  plane.position.set(band.x - band.width / 2 + BAND_LABEL_GUTTER / 2, band.y + 2, -18);
  plane.material.depthTest = false;
  plane.renderOrder = 18;
  return plane;
}

function generationLabel(generation) {
  if (generation === 0) return 'Root Generation';
  if (generation < 0) return `Generation ${Math.abs(generation)}`;
  return `Descendant ${generation}`;
}

function ancestorBandColor(generation) {
  const colors = [
    'rgba(255, 220, 191, 0.72)',
    'rgba(255, 238, 170, 0.67)',
    'rgba(225, 237, 168, 0.62)',
    'rgba(189, 228, 200, 0.58)',
  ];
  return colors[(generation - 1) % colors.length];
}

function descendantBandColor(generation) {
  const colors = [
    'rgba(242, 191, 231, 0.65)',
    'rgba(213, 205, 255, 0.58)',
    'rgba(194, 226, 248, 0.58)',
    'rgba(206, 234, 215, 0.56)',
  ];
  return colors[(generation - 1) % colors.length];
}
