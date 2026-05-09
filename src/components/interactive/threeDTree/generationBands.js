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

    if (style !== 'flat') {
      const shadowTexture = makeBandShadowTexture();
      const shadow = makePlaneFromTexture(shadowTexture, segment.width * 1.035, band.height * 1.08);
      shadow.position.set(segment.x + 10, band.y - 16, -43);
      shadow.renderOrder = 0.5;
      group.add(shadow);
    }
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
    const insetY = style === 'flat' ? 58 : 36;
    const height = style === 'pedestal' ? h - 96 : h - 74;
    const radius = style === 'flat' ? 20 : 30;
    ctx.shadowColor = style === 'flat' ? 'transparent' : 'rgba(88, 70, 86, 0.18)';
    ctx.shadowBlur = style === 'pedestal' ? 50 : 40;
    ctx.shadowOffsetX = 8;
    ctx.shadowOffsetY = style === 'pedestal' ? 20 : 15;
    roundedRect(ctx, insetX, insetY, w - insetX * 2, height, radius);
    const body = ctx.createLinearGradient(0, insetY, 0, insetY + height);
    body.addColorStop(0, tint(fill, 0.56));
    body.addColorStop(0.2, tint(fill, 0.28));
    body.addColorStop(0.62, fill);
    body.addColorStop(1, shade(fill, 0.05));
    ctx.fillStyle = body;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetX = 0;

    roundedRect(ctx, insetX + 7, insetY + 7, w - (insetX + 7) * 2, Math.max(26, height * 0.32), radius - 8);
    const shine = ctx.createLinearGradient(0, insetY, 0, insetY + height * 0.45);
    shine.addColorStop(0, 'rgba(255,255,255,0.66)');
    shine.addColorStop(0.58, 'rgba(255,255,255,0.13)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    ctx.fill();

    const lowerBevel = ctx.createLinearGradient(0, insetY + height - 44, 0, insetY + height);
    lowerBevel.addColorStop(0, 'rgba(255,255,255,0)');
    lowerBevel.addColorStop(1, 'rgba(104, 62, 96, 0.09)');
    roundedRect(ctx, insetX + 10, insetY + height - 44, w - (insetX + 10) * 2, 34, 18);
    ctx.fillStyle = lowerBevel;
    ctx.fill();

    ctx.lineWidth = 2.1;
    ctx.strokeStyle = band.generation === 0 ? 'rgba(196, 55, 164, 0.24)' : 'rgba(126, 117, 79, 0.18)';
    roundedRect(ctx, insetX, insetY, w - insetX * 2, height, radius);
    ctx.stroke();

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255,255,255,0.62)';
    roundedRect(ctx, insetX + 3, insetY + 3, w - (insetX + 3) * 2, height - 6, radius - 4);
    ctx.stroke();
  });
}

function makeBandShadowTexture() {
  return makeCanvasTexture(768, 220, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const gradient = ctx.createRadialGradient(w * 0.5, h * 0.42, h * 0.08, w * 0.5, h * 0.5, w * 0.54);
    gradient.addColorStop(0, 'rgba(74, 57, 72, 0.13)');
    gradient.addColorStop(0.55, 'rgba(74, 57, 72, 0.065)');
    gradient.addColorStop(1, 'rgba(74, 57, 72, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });
}

export function makeGenerationLabel(band) {
  if (band.showLabel === false) return new THREE.Group();
  const label = generationLabel(band.generation);
  const primary = band.subtitle || label;
  const secondary = band.subtitle ? label : `${band.count} ${band.count === 1 ? 'person' : 'people'}`;
  const texture = makeGenerationLabelTexture(band, primary, secondary, false);
  const compactTexture = makeGenerationLabelTexture(band, primary, secondary, true);
  const labelWidth = Math.min(BAND_LABEL_GUTTER - 22, 276);
  const labelHeight = 92;
  const group = new THREE.Group();
  const segments = band.segments?.length ? band.segments : [band];
  for (const [index, segment] of segments.entries()) {
    const compact = index > 0;
    const width = compact ? 176 : labelWidth;
    const height = compact ? 58 : labelHeight;
    if (compact && segment.width > 430) continue;
    if (segment.width < width + 60) continue;
    const plane = makePlaneFromTexture(compact ? compactTexture : texture, width, height);
    const segmentLeft = segment.x - segment.width / 2;
    const x = compact
      ? segmentLeft + width / 2 + 18
      : Math.min(segmentLeft + BAND_LABEL_GUTTER / 2, segment.x - labelWidth * 0.05);
    plane.position.set(x, band.y + (compact ? band.height * 0.2 : 2), -18);
    plane.material.depthTest = false;
    plane.renderOrder = 18;
    group.add(plane);
  }
  return group;
}

function makeGenerationLabelTexture(band, primary, secondary, compact) {
  return makeCanvasTexture(compact ? 380 : 520, compact ? 130 : 170, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = band.generation === 0 ? 'rgba(154, 69, 158, 0.64)' : 'rgba(103, 94, 82, 0.6)';
    ctx.font = `800 ${compact ? 30 : 38}px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
    ctx.fillText(primary, compact ? 18 : 24, compact ? 58 : 78);
    ctx.fillStyle = band.generation === 0 ? 'rgba(139, 78, 156, 0.54)' : 'rgba(89, 96, 108, 0.58)';
    ctx.font = `750 ${compact ? 19 : 24}px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
    ctx.fillText(secondary, compact ? 19 : 26, compact ? 88 : 116);
  });
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
    'rgba(244, 184, 232, 0.62)',
    'rgba(255, 208, 188, 0.58)',
    'rgba(255, 236, 164, 0.56)',
    'rgba(202, 229, 178, 0.54)',
    'rgba(180, 222, 198, 0.52)',
  ];
  return colors[(generation - 1) % colors.length];
}

function descendantBandColor(generation) {
  const colors = [
    'rgba(236, 194, 244, 0.6)',
    'rgba(213, 202, 255, 0.54)',
    'rgba(190, 225, 248, 0.54)',
    'rgba(204, 232, 214, 0.52)',
  ];
  return colors[(generation - 1) % colors.length];
}
