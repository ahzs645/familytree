/**
 * Color modes for virtual-tree 3D objects.
 *
 * Each mode is a pure function taking a builder node + context and returning
 * a hex color number suitable for Three.js materials. Matches the Mac
 * VirtualTreeConfiguration color modes (gender, generation, lastName, uniform).
 */

import { Gender } from '../../../models/index.js';

const GENDER_COLORS = {
  [Gender.Male]: 0x4d80e6,
  [Gender.Female]: 0xff6fa4,
  [Gender.Intersex]: 0xb47bff,
};

const GENERATION_PALETTE = [
  0x60a5fa, 0x34d399, 0xfbbf24, 0xf87171, 0xa78bfa,
  0xfb923c, 0x2dd4bf, 0xf472b6, 0x818cf8, 0xc084fc,
];

const UNIFORM_COLOR = 0x9ca3af;

function hashStringToColor(value) {
  const text = String(value || '');
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  const r = (hash & 0xff0000) >> 16;
  const g = (hash & 0xff00) >> 8;
  const b = hash & 0xff;
  // Push toward mid-bright so colors stay visible on dark background.
  const lift = (channel) => Math.min(255, Math.max(80, channel));
  return (lift(r) << 16) | (lift(g) << 8) | lift(b);
}

export const COLOR_MODES = ['gender', 'generation', 'lastName', 'uniform'];

export function resolveNodeColor(node, mode = 'gender') {
  if (!node) return UNIFORM_COLOR;
  if (mode === 'uniform') return UNIFORM_COLOR;
  if (mode === 'generation') {
    const depth = Number.isFinite(node.depth) ? Math.max(0, node.depth) : 0;
    return GENERATION_PALETTE[depth % GENERATION_PALETTE.length];
  }
  if (mode === 'lastName') {
    const surname = (node.name || '').trim().split(/\s+/).pop() || '';
    return hashStringToColor(surname);
  }
  if (mode === 'gender') {
    return GENDER_COLORS[node.gender] ?? UNIFORM_COLOR;
  }
  return UNIFORM_COLOR;
}
