import * as THREE from 'three';
import { BAND_LABEL_GUTTER } from './constants.js';
import { makeCanvasTexture, makePlaneFromTexture, roundedRect } from './threeUtils.js';

const STAIR_STYLES = {
  smallStairs: 12,
  smallStairsProminent: 12,
  largeStairs: 28,
  largeStairsProminent: 28,
};

function bandHeightOffset(style, generation) {
  // "Stairs" styles offset each generation upward in z creating a stepped feel.
  const step = STAIR_STYLES[style];
  if (!step) return 0;
  return Math.abs(generation) * step;
}

function isProminentBlood(style) {
  return /Prominent$/.test(style);
}

function normalizeRenderStyle(style) {
  if (style === 'raisedProminent') return 'raised';
  if (style === 'pedestalProminent') return 'pedestal';
  if (style === 'smallStairs' || style === 'smallStairsProminent') return 'raised';
  if (style === 'largeStairs' || style === 'largeStairsProminent') return 'pedestal';
  return style;
}

function roundedRectShape(width, height, radius) {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, w, h);
  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  return shape;
}

function rgbaToColor(rgba) {
  const match = String(rgba).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return new THREE.Color('#f3c6e0');
  return new THREE.Color(`rgb(${match[1]}, ${match[2]}, ${match[3]})`);
}

export function makeGenerationBand(band, palette, style = 'raised', options = {}) {
  if (style === 'none') return new THREE.Group();
  const opacity = Number.isFinite(options.generationBandOpacity) ? options.generationBandOpacity : 0.62;
  const colorMode = options.generationBandColorMode || 'byGeneration';
  const renderStyle = normalizeRenderStyle(style);
  const prominent = isProminentBlood(style);
  const zOffset = bandHeightOffset(style, band.generation);
  const effectiveColorMode = prominent && colorMode === 'byGeneration' ? 'highSaturation' : colorMode;
  const color = rgbaToColor(bandFillForMode(band, effectiveColorMode));
  // Real extruded slab so the band reads as a 3D pedestal (visible depth/side
  // when the camera tilts) like the native viewer, not a flat sticker.
  const depth = renderStyle === 'pedestal' ? 70 : renderStyle === 'flat' ? 10 : 44;
  const group = new THREE.Group();
  const segments = band.segments?.length ? band.segments : [band];
  for (const segment of segments) {
    const shape = roundedRectShape(segment.width, band.height, 34);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 7,
      bevelSize: 6,
      bevelSegments: 2,
      curveSegments: 8,
    });
    geometry.translate(0, 0, -depth);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.82,
      metalness: 0,
      transparent: opacity < 0.99,
      opacity: Math.max(0.5, Math.min(1, opacity / 0.62)),
    });
    const mesh = new THREE.Mesh(geometry, material);
    // Top face sits just behind the figures; the slab extrudes away from camera.
    mesh.position.set(segment.x, band.y, -8 + zOffset);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    group.add(mesh);

    const shadowTexture = makeBandShadowTexture();
    const shadow = makePlaneFromTexture(shadowTexture, segment.width * 1.04, band.height * 1.12);
    shadow.position.set(segment.x + 12, band.y - 18, -8 - depth - 10 + zOffset);
    shadow.renderOrder = 0.5;
    group.add(shadow);
  }
  return group;
}

function makeBandTexture(band, palette, style = 'raised', colorMode = 'byGeneration') {
  const fill = bandFillForMode(band, colorMode);
  return makeCanvasTexture(1280, 320, (ctx, w, h) => {
    const insetX = 26;
    const insetY = style === 'flat' ? 58 : 36;
    const height = style === 'pedestal' ? h - 96 : h - 74;
    const radius = style === 'flat' ? 20 : 30;
    ctx.shadowColor = style === 'flat' ? 'transparent' : 'rgba(120, 96, 116, 0.10)';
    ctx.shadowBlur = style === 'pedestal' ? 30 : 22;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = style === 'pedestal' ? 12 : 8;
    roundedRect(ctx, insetX, insetY, w - insetX * 2, height, radius);
    // Soft, near-flat pastel fill — the native flat viewer has only a gentle
    // top-to-bottom shade, no glossy plastic sheen.
    const body = ctx.createLinearGradient(0, insetY, 0, insetY + height);
    body.addColorStop(0, tint(fill, 0.22));
    body.addColorStop(0.35, tint(fill, 0.08));
    body.addColorStop(0.75, fill);
    body.addColorStop(1, shade(fill, 0.03));
    ctx.fillStyle = body;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetX = 0;

    // Whisper-thin highlight along the very top edge only (no broad shine band).
    roundedRect(ctx, insetX + 7, insetY + 6, w - (insetX + 7) * 2, Math.max(14, height * 0.16), radius - 8);
    const shine = ctx.createLinearGradient(0, insetY, 0, insetY + height * 0.22);
    shine.addColorStop(0, 'rgba(255,255,255,0.30)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    ctx.fill();

    ctx.lineWidth = 1.6;
    ctx.strokeStyle = band.generation === 0 ? 'rgba(196, 55, 164, 0.16)' : 'rgba(126, 117, 79, 0.12)';
    roundedRect(ctx, insetX, insetY, w - insetX * 2, height, radius);
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
  }, { scale: 3 });
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

function bandFillForMode(band, mode) {
  const baseGenerationFill = band.generation === 0
    ? 'rgba(246, 177, 230, 0.62)'
    : band.generation < 0
      ? ancestorBandColor(Math.abs(band.generation))
      : descendantBandColor(band.generation);
  if (mode === 'macPink') {
    // Pink slabs with a real RGB gradient (slabs are solid, so alpha no longer
    // carries the gradient): saturated magenta-pink at the root/recent rows
    // fading to light pink for distant generations — matching the source.
    if (band.generation === 0) return 'rgb(231, 150, 198)';
    const tiers = [
      'rgb(235, 165, 206)', // gen ±1 — saturated pink near the root
      'rgb(240, 184, 216)',
      'rgb(244, 201, 225)',
      'rgb(248, 217, 234)',
      'rgb(251, 232, 242)', // distant generations — light pink
    ];
    return tiers[Math.min(Math.abs(band.generation) - 1, tiers.length - 1)];
  }
  if (mode === 'byGeneration') return baseGenerationFill;
  if (mode === 'gray') return 'rgba(170, 174, 178, 0.55)';
  if (mode === 'highSaturation') {
    return band.generation === 0
      ? 'rgba(255, 110, 200, 0.78)'
      : band.generation < 0
        ? ancestorBandColorHighSat(Math.abs(band.generation))
        : descendantBandColorHighSat(band.generation);
  }
  if (mode === 'blueGradient') return gradientFill(band.generation, ['rgba(190,224,250,0.6)', 'rgba(120,162,224,0.6)', 'rgba(72,108,196,0.6)']);
  if (mode === 'greenGradient') return gradientFill(band.generation, ['rgba(210,236,210,0.6)', 'rgba(150,206,158,0.6)', 'rgba(78,162,108,0.6)']);
  if (mode === 'blueOrange') return gradientFill(band.generation, ['rgba(180,216,244,0.6)', 'rgba(252,200,150,0.6)', 'rgba(244,138,84,0.6)']);
  if (mode === 'magentaOrange') return gradientFill(band.generation, ['rgba(244,178,228,0.6)', 'rgba(252,194,156,0.6)', 'rgba(240,134,84,0.6)']);
  return baseGenerationFill;
}

function gradientFill(generation, palette) {
  const idx = Math.min(palette.length - 1, Math.abs(generation));
  return palette[idx];
}

function ancestorBandColorHighSat(generation) {
  const colors = [
    'rgba(244, 120, 196, 0.74)',
    'rgba(255, 168, 124, 0.7)',
    'rgba(255, 222, 92, 0.66)',
    'rgba(160, 222, 100, 0.64)',
    'rgba(108, 210, 168, 0.62)',
  ];
  return colors[(generation - 1) % colors.length];
}

function descendantBandColorHighSat(generation) {
  const colors = [
    'rgba(212, 130, 240, 0.72)',
    'rgba(168, 142, 248, 0.66)',
    'rgba(120, 184, 240, 0.66)',
    'rgba(146, 220, 174, 0.64)',
  ];
  return colors[(generation - 1) % colors.length];
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
