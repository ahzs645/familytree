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

export function colorsForNode(node, palette, mode = 'byGender') {
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
  return colorsForGender(node?.person?.gender, palette);
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
