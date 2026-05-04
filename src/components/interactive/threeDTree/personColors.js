import { Gender } from '../../../models/index.js';

export function colorsForGender(gender, palette) {
  if (gender === Gender.Male) return { base: palette.male, deep: palette.maleDeep };
  if (gender === Gender.Female) return { base: palette.female, deep: palette.femaleDeep };
  return { base: palette.unknown, deep: palette.unknownDeep };
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
