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

// 1 native scene unit = 58 web units (the builder allocates a 1×1 slot per
// unminified person = regularModelSize). All native band constants below are
// decompiled from GenerationBandObject / elevationOfContentAboveBottomFloor.
const NATIVE_UNIT = 58;
// Common band floor. Native bands rise from the shared ground plane (Y=0);
// the web board keeps figures around z≈0, so the floor sits below them and
// each style's elevation decides how close the top face comes to the figures.
const BAND_FLOOR_Z = -26;

// Native style heights (native units → web): style mode → [bloodTop, otherTop].
function bandElevations(style, generation, band) {
  const u = NATIVE_UNIT;
  switch (style) {
    case 'flat': return [0.02 * u, 0.02 * u];
    case 'raised': return [0.1 * u, 0.1 * u];
    case 'raisedProminent': return [0.25 * u, 0.1 * u];
    case 'pedestal': return [0.15 * u, 0.15 * u];
    case 'pedestalProminent': return [0.30 * u, 0.15 * u];
    case 'smallStairs':
    case 'smallStairsProminent':
    case 'largeStairs':
    case 'largeStairsProminent': {
      const small = style.startsWith('small');
      const base = (small ? 0.15 : 0.30) * u;
      const step = base;
      const level = Math.abs(Number(generation) || 0);
      const bloodStep = step;
      const otherStep = /Prominent$/.test(style) ? step * 0.4 : step;
      return [base + level * bloodStep, base + level * otherStep];
    }
    default: return [0.30 * u, 0.15 * u];
  }
}

export function makeGenerationBand(band, palette, style = 'pedestalProminent', options = {}) {
  if (style === 'none') return new THREE.Group();
  const opacity = Number.isFinite(options.generationBandOpacity) ? options.generationBandOpacity : 0.62;
  const colorMode = options.generationBandColorMode || 'byGeneration';
  const baseColor = rgbaToColor(bandFillForMode(band, colorMode, options));
  const [bloodTop, otherTop] = bandElevations(style, band.generation, band);
  const u = NATIVE_UNIT;
  const capThickness = 0.06 * u;      // native pedestal cap
  const capChamfer = 0.0175 * u;
  const bodyChamfer = 0.01 * u;
  const desaturate = options.desaturateColorsForPartnerAncestors !== false;
  const group = new THREE.Group();
  const segments = band.segments?.length ? band.segments : [band];
  // Tiny per-generation lift so overlapping band rectangles (root card over
  // the parents' row) depth-sort cleanly instead of z-fighting. Invisible at
  // 0.5 units; native rows never overlap because layout contour-packs them.
  const floorZ = BAND_FLOOR_Z + (Number(band.generation) || 0) * 0.5;
  for (const segment of segments) {
    const segW = Number.isFinite(segment.width) ? segment.width : band.width;
    const segH = Number.isFinite(segment.height) ? segment.height : band.height;
    const segX = segment.x;
    const segY = Number.isFinite(segment.y) ? segment.y : band.y;
    const blood = segment.blood !== false;
    const height = blood ? bloodTop : otherTop;
    // Native corner radius: min(width/6, length/6, 0.25 native units).
    const radius = Math.min(segW / 6, segH / 6, 0.25 * u);
    // Partner (non-blood) groups desaturate: S×0.4, V×0.9 in the light theme.
    let color = baseColor;
    if (!blood && desaturate) {
      const hsl = { h: 0, s: 0, l: 0 };
      baseColor.getHSL(hsl);
      color = new THREE.Color().setHSL(hsl.h, hsl.s * 0.4, Math.min(1, hsl.l * 0.96));
    }
    // Lower body blends toward the scene background (native fraction ~0.45).
    const bodyColor = color.clone().lerp(new THREE.Color(palette.background || '#f4f2ee'), 0.45);
    const material = (fill) => new THREE.MeshStandardMaterial({
      color: fill,
      roughness: 0.82,
      metalness: 0,
      transparent: opacity < 0.99,
      opacity: Math.max(0.5, Math.min(1, opacity / 0.62)),
    });
    const shape = roundedRectShape(segW, segH, radius);
    // Two stacked rounded shapes (native pedestal): a thin cap over a body.
    const bodyDepth = Math.max(2, height - capThickness);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
      depth: bodyDepth,
      bevelEnabled: true,
      bevelThickness: bodyChamfer,
      bevelSize: bodyChamfer,
      bevelSegments: 1,
      curveSegments: 8,
    }), material(bodyColor));
    body.position.set(segX, segY, floorZ);
    body.receiveShadow = true;
    body.renderOrder = 1;
    group.add(body);
    const cap = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
      depth: capThickness,
      bevelEnabled: true,
      bevelThickness: capChamfer,
      bevelSize: capChamfer,
      bevelSegments: 2,
      curveSegments: 8,
    }), material(color));
    cap.position.set(segX, segY, floorZ + bodyDepth);
    cap.receiveShadow = true;
    cap.renderOrder = 1.2;
    group.add(cap);

    // Native fake band shadow: +0.23 native units in both dimensions, centered
    // (no lateral offset), transparency 0.25, just above the floor.
    const shadowTexture = makeBandShadowTexture();
    const shadow = makePlaneFromTexture(shadowTexture, segW + 0.23 * u, segH + 0.23 * u);
    shadow.material.opacity = 0.25;
    shadow.position.set(segX, segY, floorZ - 1);
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

export function makeGenerationLabel(band, options = {}) {
  if (band.showLabel === false) return new THREE.Group();
  const showGen = options.generationBandsShowGenerations !== false;
  const showYears = options.generationBandsShowBirthDates !== false && Boolean(band.subtitle);
  if (!showGen && !showYears) return new THREE.Group();
  const label = generationLabel(band.generation);
  const primary = showYears ? band.subtitle : label;
  const secondary = showYears && showGen ? label : '';
  const vertical = band.axis === 'vertical';
  const texture = makeGenerationLabelTexture(band, primary, secondary, false);
  const compactTexture = makeGenerationLabelTexture(band, primary, secondary, true);
  const group = new THREE.Group();
  const segments = band.segments?.length ? band.segments : [band];
  let primaryLabelX = null;
  let maxRight = -Infinity;
  if (!vertical) {
    // Native (decompiled GenerationBandObject): ONE text plane per band, sized
    // from the generation depth L — width 1.6·L, line heights 0.25·L (years) +
    // 0.15·L (generation) — anchored at the band's min-X with margin 0.1·L,
    // toward the band's child-side edge, target opacity 0.8. This is what makes
    // the big knockout year numbers of the reference.
    const depth = Math.max(60, band.height || 0);
    const planeW = 1.6 * depth;
    const planeH = ((showYears ? 0.25 : 0) + (secondary || !showYears ? 0.15 : 0)) * depth * 1.15;
    const margin = 0.1 * depth;
    const bandLeft = (Number.isFinite(band.minX) ? band.minX : band.x - band.width / 2);
    const plane = makePlaneFromTexture(texture, planeW, planeH);
    const x = bandLeft + margin + planeW / 2;
    const y = band.y - depth / 2 + planeH / 2 + margin;
    plane.position.set(x, y, -18);
    plane.material.depthTest = false;
    plane.material.opacity = 0.8;
    plane.renderOrder = 18;
    group.add(plane);
    primaryLabelX = x;
    for (const segment of segments) {
      maxRight = Math.max(maxRight, segment.x + segment.width / 2);
    }
  } else {
    for (const segment of segments) {
      const width = 176;
      const height = 58;
      const along = segment.height ?? band.height;
      if (along < height + 60) continue;
      const segmentTop = (Number.isFinite(segment.y) ? segment.y : band.y) + along / 2;
      const plane = makePlaneFromTexture(compactTexture, width, height);
      plane.position.set(segment.x, segmentTop - height / 2 - 14, -18);
      plane.material.depthTest = false;
      plane.renderOrder = 18;
      group.add(plane);
      if (primaryLabelX === null) primaryLabelX = segment.x;
    }
  }
  // Metadata for the "keep labels visible while scrolling" per-frame slide
  // (X-based, so vertical-column labels opt out).
  group.userData = {
    isGenerationLabel: group.children.length > 0 && !vertical,
    naturalX: primaryLabelX ?? 0,
    bandMaxX: Number.isFinite(maxRight) ? maxRight : 0,
  };
  return group;
}

function makeGenerationLabelTexture(band, primary, secondary, compact) {
  if (compact) {
    return makeCanvasTexture(380, 130, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = band.generation === 0 ? 'rgba(154, 69, 158, 0.64)' : 'rgba(103, 94, 82, 0.6)';
      ctx.font = '800 30px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText(primary, 18, 58);
      if (secondary) {
        ctx.fillStyle = band.generation === 0 ? 'rgba(139, 78, 156, 0.54)' : 'rgba(89, 96, 108, 0.58)';
        ctx.font = '750 19px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
        ctx.fillText(secondary, 19, 88);
      }
    }, { scale: 3 });
  }
  // Native ratio (decompiled band text plane): the years line is 0.55 of the
  // texture height, the generation line 0.35 semibold, left-aligned, with a
  // uniform downscale when the years line would overflow the plane width.
  return makeCanvasTexture(720, 210, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    let primarySize = h * 0.55;
    let secondarySize = h * 0.35;
    ctx.font = `600 ${primarySize}px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
    const measured = ctx.measureText(primary).width;
    if (measured > w - 24) {
      const fit = (w - 24) / measured;
      primarySize *= fit;
      secondarySize *= fit;
    }
    ctx.fillStyle = band.generation === 0 ? 'rgba(154, 69, 158, 0.66)' : 'rgba(122, 96, 102, 0.62)';
    ctx.font = `600 ${primarySize}px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
    ctx.fillText(primary, 12, primarySize * 1.02);
    if (secondary) {
      ctx.fillStyle = band.generation === 0 ? 'rgba(139, 78, 156, 0.56)' : 'rgba(110, 99, 106, 0.56)';
      ctx.font = `650 ${secondarySize}px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
      ctx.fillText(secondary, 14, primarySize * 1.02 + secondarySize * 1.08);
    }
  }, { scale: 2 });
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

function hexToRgbString(hex, fallback = 'rgb(239, 155, 201)') {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return fallback;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) return fallback;
  return `rgb(${r}, ${g}, ${b})`;
}

function bandFillForMode(band, mode, options = {}) {
  if (mode === 'customColor') return hexToRgbString(options.generationBandCustomColor);
  const baseGenerationFill = band.generation === 0
    ? 'rgba(246, 177, 230, 0.62)'
    : band.generation < 0
      ? ancestorBandColor(Math.abs(band.generation))
      : descendantBandColor(band.generation);
  if (mode === 'macPink') return nativeBandColor(band.generation);
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

// Native band color mode 0, decompiled from CommonColorsHelper
// colorForHierarchicalLevel: — a 20-entry HSV wheel indexed by
// mod20(generationNumber - 8), then mixed 65% toward white for the light
// appearance. The native builder numbers generations root=0 with ancestors
// POSITIVE (our web convention is ancestors negative), so flip the sign.
// Stepping one generation rotates hue by 0.1: violet root → orchid parents →
// pink grandparents → salmon → yellow, exactly the reference ramp.
function nativeBandColor(webGeneration) {
  const nativeGeneration = -Number(webGeneration || 0);
  const idx = ((nativeGeneration - 8) % 20 + 20) % 20;
  const hue = idx < 10 ? (0.55 + 0.1 * idx) % 1 : (0.5 + 0.1 * idx) % 1;
  const sat = idx < 10 ? 0.7 : 0.5;
  const val = idx < 10 ? 0.95 : 1.0;
  const [r, g, b] = hsvToRgb(hue, sat, val);
  const mix = (channel) => Math.round((channel + (1 - channel) * 0.65) * 255);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function hsvToRgb(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
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
