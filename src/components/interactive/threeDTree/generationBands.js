import * as THREE from 'three';
import { BAND_LABEL_GUTTER } from './constants.js';
import { makeCanvasTexture, makePlaneFromTexture, roundedRect } from './threeUtils.js';

export function makeGenerationBand(band, palette, style = 'raised') {
  if (style === 'none') return new THREE.Group();
  const group = new THREE.Group();
  const segments = band.segments?.length ? band.segments : [band];
  for (const segment of segments) {
    const texture = makeBandTexture(band, palette, style);
    const geometry = new THREE.PlaneGeometry(segment.width, band.height);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(segment.x, band.y, -34);
    mesh.renderOrder = 1;
    group.add(mesh);
  }
  return group;
}

function makeBandTexture(band, palette, style = 'raised') {
  const fill = band.generation === 0
    ? 'rgba(246, 177, 230, 0.62)'
    : band.generation < 0
      ? ancestorBandColor(Math.abs(band.generation))
      : descendantBandColor(band.generation);
  return makeCanvasTexture(1280, 320, (ctx, w, h) => {
    const insetX = 26;
    const insetY = style === 'flat' ? 50 : 34;
    const height = style === 'pedestal' ? h - 94 : h - 70;
    const radius = style === 'flat' ? 24 : 42;
    ctx.shadowColor = style === 'flat' ? 'transparent' : 'rgba(76, 60, 78, 0.22)';
    ctx.shadowBlur = style === 'pedestal' ? 48 : 38;
    ctx.shadowOffsetY = style === 'pedestal' ? 20 : 15;
    roundedRect(ctx, insetX, insetY, w - insetX * 2, height, radius);
    const body = ctx.createLinearGradient(0, insetY, 0, insetY + height);
    body.addColorStop(0, tint(fill, 0.32));
    body.addColorStop(0.2, tint(fill, 0.1));
    body.addColorStop(0.58, fill);
    body.addColorStop(1, shade(fill, 0.1));
    ctx.fillStyle = body;
    ctx.fill();
    ctx.shadowColor = 'transparent';

    roundedRect(ctx, insetX + 7, insetY + 7, w - (insetX + 7) * 2, Math.max(22, height * 0.36), radius - 8);
    const shine = ctx.createLinearGradient(0, insetY, 0, insetY + height * 0.45);
    shine.addColorStop(0, 'rgba(255,255,255,0.62)');
    shine.addColorStop(0.7, 'rgba(255,255,255,0.12)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    ctx.fill();

    roundedRect(ctx, insetX + 14, insetY + height - 24, w - (insetX + 14) * 2, 16, 12);
    ctx.fillStyle = 'rgba(96, 55, 100, 0.06)';
    ctx.fill();

    ctx.lineWidth = 2.2;
    ctx.strokeStyle = band.generation === 0 ? 'rgba(192, 57, 158, 0.34)' : 'rgba(126, 117, 79, 0.26)';
    roundedRect(ctx, insetX, insetY, w - insetX * 2, height, radius);
    ctx.stroke();

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255,255,255,0.56)';
    roundedRect(ctx, insetX + 3, insetY + 3, w - (insetX + 3) * 2, height - 6, radius - 4);
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

function tint(color, amount) {
  return mixRgba(color, '#ffffff', amount);
}

function shade(color, amount) {
  return mixRgba(color, '#000000', amount);
}

function mixRgba(color, target, amount) {
  const source = parseRgba(color);
  const mix = parseHex(target);
  const channel = (a, b) => Math.round(a + (b - a) * amount);
  return `rgba(${channel(source.r, mix.r)}, ${channel(source.g, mix.g)}, ${channel(source.b, mix.b)}, ${source.a})`;
}

function parseRgba(color) {
  const match = String(color).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([.\d]+))?\)/);
  if (!match) return { r: 255, g: 255, b: 255, a: 1 };
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: Number(match[4] ?? 1),
  };
}

function parseHex(color) {
  const hex = color.replace('#', '');
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function generationLabel(generation) {
  if (generation === 0) return 'Root Generation';
  if (generation < 0) return `Generation ${Math.abs(generation)}`;
  return `Descendant ${generation}`;
}

function ancestorBandColor(generation) {
  const colors = [
    'rgba(255, 218, 190, 0.62)',
    'rgba(255, 235, 160, 0.58)',
    'rgba(220, 236, 160, 0.56)',
    'rgba(183, 225, 198, 0.54)',
  ];
  return colors[(generation - 1) % colors.length];
}

function descendantBandColor(generation) {
  const colors = [
    'rgba(242, 184, 232, 0.6)',
    'rgba(213, 202, 255, 0.54)',
    'rgba(190, 225, 248, 0.54)',
    'rgba(204, 232, 214, 0.52)',
  ];
  return colors[(generation - 1) % colors.length];
}
