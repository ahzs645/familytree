import * as THREE from 'three';
import { GROUND_COLOR_VALUES } from './constants.js';
import { makeCanvasTexture, makePlaneFromTexture } from './threeUtils.js';

const GRID_LIKE_MODES = new Set(['grid', 'smallGrid', 'largeGrid']);

const GRID_SPACING = {
  grid: 28,
  smallGrid: 18,
  largeGrid: 48,
};

// Resolve the ground base colour from the colour mode/custom colour, falling
// back to the palette background ("auto") for the native paper look.
function resolveGroundColor(palette, options = {}) {
  const mode = options.groundColorMode || 'auto';
  if (mode === 'auto') return palette.background;
  if (mode === 'customColor') {
    const custom = options.groundCustomColor;
    return /^#[0-9a-fA-F]{6}$/.test(String(custom || '')) ? custom : palette.background;
  }
  return GROUND_COLOR_VALUES[mode] || palette.background;
}

export function makeBottomPlane(palette, bounds, mode = 'grid', options = {}) {
  const groundColor = resolveGroundColor(palette, options);
  const group = new THREE.Group();
  const sizeX = Math.max(5200, bounds.maxX - bounds.minX + 1800);
  const sizeY = Math.max(3400, bounds.maxY - bounds.minY + 1800);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const left = centerX - sizeX / 2;
  const right = centerX + sizeX / 2;
  const bottom = centerY - sizeY / 2;
  const top = centerY + sizeY / 2;

  const baseTexture = makeBottomPlaneTexture(mode, palette, groundColor);
  const base = makePlaneFromTexture(baseTexture, sizeX, sizeY);
  base.position.set(centerX, centerY, -86);
  base.renderOrder = 0;
  group.add(base);

  if (!GRID_LIKE_MODES.has(mode)) return group;

  const step = GRID_SPACING[mode] || 28;
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
  group.add(makeLines(regular, palette.grid, mode === 'largeGrid' ? 0.36 : 0.42));
  group.add(makeLines(strong, palette.gridStrong, mode === 'smallGrid' ? 0.22 : 0.3));
  return group;
}

function makeBottomPlaneTexture(mode, palette, groundColor = palette.background) {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = groundColor;
    ctx.fillRect(0, 0, w, h);
    const paper = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, w * 0.78);
    paper.addColorStop(0, 'rgba(255,255,255,0.58)');
    paper.addColorStop(0.58, 'rgba(248,247,242,0.24)');
    paper.addColorStop(1, 'rgba(224,220,208,0.08)');
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(130, 122, 105, 0.01)';
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1);
    }

    if (mode === 'checker' || mode === 'smallChecker' || mode === 'largeChecker') {
      drawChecker(ctx, w, h, mode === 'smallChecker' ? 32 : mode === 'largeChecker' ? 96 : 64);
    } else if (mode === 'dots' || mode === 'smallDots' || mode === 'largeDots') {
      drawDots(ctx, w, h, mode === 'smallDots' ? 24 : mode === 'largeDots' ? 72 : 48);
    } else if (mode === 'smallPlaid' || mode === 'largePlaid') {
      drawPlaid(ctx, w, h, mode === 'smallPlaid' ? 22 : 44);
    } else if (mode === 'smallRectangles' || mode === 'largeRectangles') {
      drawRectangles(ctx, w, h, mode === 'smallRectangles' ? 28 : 60);
    } else if (mode === 'wood') {
      drawWood(ctx, w, h);
    } else if (mode === 'concrete') {
      drawConcrete(ctx, w, h);
    } else if (mode === 'marble') {
      drawMarble(ctx, w, h);
    }
  });
}

function drawChecker(ctx, w, h, size) {
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      if ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) {
        ctx.fillStyle = 'rgba(120, 132, 145, 0.06)';
        ctx.fillRect(x, y, size, size);
      }
    }
  }
}

function drawDots(ctx, w, h, spacing) {
  const radius = Math.max(1.5, spacing * 0.05);
  ctx.fillStyle = 'rgba(110, 124, 142, 0.18)';
  for (let y = spacing / 2; y < h; y += spacing) {
    for (let x = spacing / 2; x < w; x += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPlaid(ctx, w, h, spacing) {
  ctx.strokeStyle = 'rgba(120, 132, 145, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(170, 80, 80, 0.07)';
  ctx.lineWidth = 2;
  const major = spacing * 3;
  for (let x = 0; x < w; x += major) {
    ctx.beginPath();
    ctx.moveTo(x + spacing, 0);
    ctx.lineTo(x + spacing, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += major) {
    ctx.beginPath();
    ctx.moveTo(0, y + spacing);
    ctx.lineTo(w, y + spacing);
    ctx.stroke();
  }
}

function drawRectangles(ctx, w, h, height) {
  const aspect = 2.1;
  const width = height * aspect;
  for (let y = 0; y < h; y += height) {
    const offset = (Math.floor(y / height) % 2) * (width / 2);
    for (let x = -width; x < w + width; x += width) {
      ctx.strokeStyle = 'rgba(120, 132, 145, 0.14)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + offset + 1, y + 1, width - 2, height - 2);
    }
  }
}

function drawWood(ctx, w, h) {
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, 'rgba(196, 142, 88, 0.6)');
  base.addColorStop(0.5, 'rgba(174, 120, 70, 0.55)');
  base.addColorStop(1, 'rgba(154, 104, 56, 0.6)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(96, 60, 30, 0.18)';
  ctx.lineWidth = 1;
  for (let y = 0; y < h; y += 18 + Math.random() * 6) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < w; x += 12) {
      ctx.lineTo(x, y + Math.sin(x * 0.04 + y * 0.01) * 3);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 12; i += 1) {
    const cx = Math.random() * w;
    const cy = Math.random() * h;
    const r = 8 + Math.random() * 14;
    const knot = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    knot.addColorStop(0, 'rgba(82, 50, 24, 0.4)');
    knot.addColorStop(1, 'rgba(82, 50, 24, 0)');
    ctx.fillStyle = knot;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawConcrete(ctx, w, h) {
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, 'rgba(174, 176, 178, 0.4)');
  base.addColorStop(1, 'rgba(140, 144, 148, 0.45)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2000; i += 1) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const a = Math.random() * 0.08;
    ctx.fillStyle = `rgba(60, 60, 64, ${a})`;
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  for (let i = 0; i < 6; i += 1) {
    ctx.strokeStyle = 'rgba(70, 72, 76, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.random() * w, Math.random() * h);
    for (let j = 0; j < 12; j += 1) ctx.lineTo(Math.random() * w, Math.random() * h);
    ctx.stroke();
  }
}

function drawMarble(ctx, w, h) {
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, 'rgba(242, 240, 234, 0.66)');
  base.addColorStop(0.5, 'rgba(228, 224, 214, 0.6)');
  base.addColorStop(1, 'rgba(214, 208, 196, 0.66)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 30; i += 1) {
    ctx.strokeStyle = `rgba(120, 110, 96, ${0.06 + Math.random() * 0.04})`;
    ctx.lineWidth = 0.8 + Math.random() * 1.5;
    ctx.beginPath();
    const startY = Math.random() * h;
    ctx.moveTo(0, startY);
    let prevY = startY;
    for (let x = 0; x < w; x += 18) {
      prevY += (Math.random() - 0.5) * 18;
      ctx.lineTo(x, prevY);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 8; i += 1) {
    const cx = Math.random() * w;
    const cy = Math.random() * h;
    const r = 20 + Math.random() * 40;
    const vein = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    vein.addColorStop(0, 'rgba(180, 174, 160, 0.18)');
    vein.addColorStop(1, 'rgba(180, 174, 160, 0)');
    ctx.fillStyle = vein;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
