import { describe, expect, it } from 'vitest';
import { appearanceThemeTokens } from './appPreferences.js';

const LIGHT_SECONDARY = hslToRgb(220, 14, 96);
const DARK_SECONDARY = hslToRgb(224, 18, 17);

describe('appearanceThemeTokens', () => {
  it.each(['#2563eb', '#ffffff', '#000000', '#facc15', '#dc2626', '#777777'])(
    'derives accessible action and interactive colors from %s',
    (accent) => {
      const tokens = appearanceThemeTokens(accent);
      expect(contrast(parseHsl(tokens.primary), parseHsl(tokens.primaryForeground))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(parseHsl(tokens.interactiveLight), LIGHT_SECONDARY)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(parseHsl(tokens.interactiveDark), DARK_SECONDARY)).toBeGreaterThanOrEqual(4.5);
    }
  );

  it('lets invalid colors fall back to the stylesheet defaults', () => {
    expect(appearanceThemeTokens('not-a-color')).toBeNull();
  });
});

function parseHsl(value) {
  const [h, s, l] = String(value).replaceAll('%', '').split(/\s+/).map(Number);
  return hslToRgb(h, s, l);
}

function hslToRgb(h, sPercent, lPercent) {
  const s = sPercent / 100;
  const l = lPercent / 100;
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = l - c / 2;
  let rgb;
  if (hue < 60) rgb = [c, x, 0];
  else if (hue < 120) rgb = [x, c, 0];
  else if (hue < 180) rgb = [0, c, x];
  else if (hue < 240) rgb = [0, x, c];
  else if (hue < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return rgb.map((channel) => channel + m);
}

function contrast(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((channel) => (
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
