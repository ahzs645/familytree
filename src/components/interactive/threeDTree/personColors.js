import { Gender } from '../../../models/index.js';

export function colorsForGender(gender, palette) {
  if (gender === Gender.Male) return { base: palette.male, deep: palette.maleDeep };
  if (gender === Gender.Female) return { base: palette.female, deep: palette.femaleDeep };
  return { base: palette.unknown, deep: palette.unknownDeep };
}

const GENERATION_COLORS = [
  { base: '#ef9bc9', deep: '#c7679b' },
  { base: '#f7c592', deep: '#cc8b50' },
  { base: '#ffe282', deep: '#c4a635' },
  { base: '#bcd98e', deep: '#7da354' },
  { base: '#92cebd', deep: '#549583' },
  { base: '#9bbfe4', deep: '#5d8ac1' },
  { base: '#b6a4e0', deep: '#7c66c1' },
];

const PEDIGREE_COLORS = {
  paternal: { base: '#9bbfe4', deep: '#5d8ac1' },
  maternal: { base: '#ef9bc9', deep: '#c7679b' },
};

export function colorsForNode(node, palette, mode = 'byGender', options = {}) {
  let saturation = Number.isFinite(options.personSaturation) ? options.personSaturation : 1;
  // "Desaturate Colors for Ancestors of Partner" — soften the partner's line so
  // the focused person's own bloodline reads as the primary lineage.
  if (options.desaturatePartnerAncestors && isPartnerLineNode(node)) saturation *= 0.4;
  return adjustSaturation(resolveNodeColors(node, palette, mode, options), saturation);
}

function isPartnerLineNode(node) {
  const role = String(node?.role || (node?.roles || []).join(' ')).toLowerCase();
  return role.includes('partner');
}

function resolveNodeColors(node, palette, mode, options) {
  if (mode === 'byGeneration') {
    const idx = Math.abs(Number(node?.generation) || 0) % GENERATION_COLORS.length;
    return GENERATION_COLORS[idx];
  }
  if (mode === 'byPedigree') {
    const role = String(node?.role || '').toLowerCase();
    if (role.includes('matern')) return PEDIGREE_COLORS.maternal;
    if (role.includes('patern')) return PEDIGREE_COLORS.paternal;
    return colorsForGender(node?.person?.gender, palette);
  }
  if (mode === 'byLabel') {
    const key = labelKeyForPerson(node?.person);
    return key ? colorFromString(key) : colorsForGender(node?.person?.gender, palette);
  }
  if (mode === 'byPersonGroup') {
    const key = personGroupKeyForPerson(node?.person);
    return key ? colorFromString(key) : colorsForGender(node?.person?.gender, palette);
  }
  if (mode === 'customColor') {
    const base = isHex(options.personCustomColor) ? options.personCustomColor : '#7da9d8';
    return { base, deep: shadeHex(base, 0.32) };
  }
  return colorsForGender(node?.person?.gender, palette);
}

function labelKeyForPerson(person) {
  if (!person) return '';
  const labels = person.labels || person.label || person.tags;
  if (Array.isArray(labels)) return String(labels[0] || '');
  return typeof labels === 'string' ? labels : '';
}

function personGroupKeyForPerson(person) {
  if (!person) return '';
  const group = person.personGroup || person.personGroupName || person.group;
  if (typeof group === 'string') return group;
  return group?.name || '';
}

// Deterministic pleasant pastel from an arbitrary string (label / group name),
// mirroring the native viewer's stable per-category colouring.
function colorFromString(value) {
  let hash = 0;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 360;
  }
  const hue = ((hash % 360) + 360) % 360;
  return { base: hslToHex(hue, 52, 70), deep: hslToHex(hue, 56, 50) };
}

function isHex(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function adjustSaturation(colors, factor) {
  if (!Number.isFinite(factor) || factor === 1) return colors;
  return {
    base: scaleHexSaturation(colors.base, factor),
    deep: scaleHexSaturation(colors.deep, factor),
  };
}

function scaleHexSaturation(hex, factor) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return hslToHex(h, Math.max(0, Math.min(100, s * factor)), l);
}

function shadeHex(hex, amount) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const next = [rgb.r, rgb.g, rgb.b].map((value) => Math.round(value * (1 - amount)));
  return `#${next.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex) {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h, s, l) {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  const toHex = (value) => Math.round((value + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(rp)}${toHex(gp)}${toHex(bp)}`;
}

export function isLivingPerson(person) {
  if (!person) return false;
  return !person.deathDate;
}

export function lightenHex(hex, amount) {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return hex;
  const next = [0, 2, 4].map((index) => {
    const value = parseInt(normalized.slice(index, index + 2), 16);
    return Math.round(value + (255 - value) * amount).toString(16).padStart(2, '0');
  });
  return `#${next.join('')}`;
}
