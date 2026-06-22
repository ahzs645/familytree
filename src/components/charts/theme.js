/**
 * Chart theme — colors, sizes, and node-rendering knobs shared by every chart type.
 *
 * Themes are plain objects so they can be saved per chart-template (see saved chart
 * templates feature). Pass a partial override to `mergeTheme(base, override)`.
 */

// Gender values follow src/models/constants.js: Male=0, Female=1, UnknownGender=2, Intersex=3
export const DEFAULT_THEME = {
  id: 'default-dark',
  name: 'Default (Dark)',
  background: '#0f1117',
  connector: '#3a4054',
  connectorWidth: 1.5,
  text: '#e2e4eb',
  textMuted: '#8b90a0',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  nodeWidth: 180,
  nodeHeight: 54,
  nodeRadius: 8,
  placeholderFill: '#161922',
  placeholderStroke: '#2e3345',
  gender: {
    0: { fill: '#1c2a44', stroke: '#3b6db8' }, // Male
    1: { fill: '#3a1c33', stroke: '#b8417a' }, // Female
    2: { fill: '#1f2330', stroke: '#3a4054' }, // UnknownGender
    3: { fill: '#2a1f3a', stroke: '#7c5cb8' }, // Intersex
  },
};

export const LIGHT_THEME = {
  ...DEFAULT_THEME,
  id: 'default-light',
  name: 'Default (Light)',
  background: '#f6f7fb',
  connector: '#bfc4d4',
  text: '#1a1d27',
  textMuted: '#5b6072',
  placeholderFill: '#ffffff',
  placeholderStroke: '#dfe2eb',
  gender: {
    0: { fill: '#dfeaff', stroke: '#5b8be0' }, // Male
    1: { fill: '#fbe1ee', stroke: '#cc6499' }, // Female
    2: { fill: '#eef0f6', stroke: '#bfc4d4' }, // Unknown
    3: { fill: '#ece4f6', stroke: '#9374c7' }, // Intersex
  },
};

export const SEPIA_THEME = {
  ...DEFAULT_THEME,
  id: 'sepia',
  name: 'Sepia',
  background: '#f4eedd',
  connector: '#9b815a',
  text: '#3a2a14',
  textMuted: '#7a6646',
  placeholderFill: '#fbf6e8',
  placeholderStroke: '#cdb898',
  gender: {
    0: { fill: '#e0d2ad', stroke: '#7a6038' }, // Male
    1: { fill: '#e9cfb4', stroke: '#a26938' }, // Female
    2: { fill: '#ece1c4', stroke: '#a89172' }, // Unknown
    3: { fill: '#ddcdb3', stroke: '#85683f' }, // Intersex
  },
};

// Synthetic "auto" theme that tracks the app's light/dark toggle at resolution time.
// Callers should resolve via getTheme(id) at render time so a toggle re-applies.
export const AUTO_THEME = {
  id: 'auto',
  name: 'Auto (follow app)',
};

// Additional named styles (MFT exposes a large compositor-style library; these
// give the picker a meaningful spread of palettes rather than 4 options).
function namedStyle(id, name, palette) {
  return {
    ...DEFAULT_THEME,
    id,
    name,
    background: palette.background,
    connector: palette.connector,
    text: palette.text,
    textMuted: palette.textMuted,
    placeholderFill: palette.placeholderFill,
    placeholderStroke: palette.placeholderStroke,
    gender: {
      0: { fill: palette.male[0], stroke: palette.male[1] },
      1: { fill: palette.female[0], stroke: palette.female[1] },
      2: { fill: palette.neutral[0], stroke: palette.neutral[1] },
      3: { fill: palette.neutral[0], stroke: palette.neutral[1] },
    },
  };
}

export const NAMED_STYLES = [
  namedStyle('ocean', 'Ocean', { background: '#eef6fb', connector: '#4b86a8', text: '#0e2a3a', textMuted: '#4d6b7a', placeholderFill: '#f4fafe', placeholderStroke: '#bcd6e6', male: ['#d4e8f6', '#3f78a0'], female: ['#d2f0ec', '#319287'], neutral: ['#e3eef4', '#7a98a8'] }),
  namedStyle('forest', 'Forest', { background: '#eef6ee', connector: '#5a8a52', text: '#16301a', textMuted: '#4d6b48', placeholderFill: '#f4fbf3', placeholderStroke: '#c4ddbf', male: ['#d8ecd2', '#4f8a52'], female: ['#e6e7c5', '#8a8a32'], neutral: ['#e3efe0', '#7a987a'] }),
  namedStyle('slate', 'Slate', { background: '#f1f3f5', connector: '#64748b', text: '#1f2733', textMuted: '#5b6675', placeholderFill: '#f8fafc', placeholderStroke: '#cbd5e1', male: ['#dbe2ea', '#566173'], female: ['#e6dde8', '#7a6688'], neutral: ['#e3e7ec', '#7e8794'] }),
  namedStyle('rose', 'Rose', { background: '#fbeef3', connector: '#b06a86', text: '#3a1422', textMuted: '#7a4d5e', placeholderFill: '#fef4f8', placeholderStroke: '#e6bccd', male: ['#dfe0f6', '#5a5aa0'], female: ['#f6d2e1', '#a23f6c'], neutral: ['#f0e0e8', '#98778a'] }),
  namedStyle('mono', 'Monochrome', { background: '#f4f4f5', connector: '#71717a', text: '#18181b', textMuted: '#52525b', placeholderFill: '#fafafa', placeholderStroke: '#d4d4d8', male: ['#e4e4e7', '#52525b'], female: ['#d4d4d8', '#3f3f46'], neutral: ['#dcdce0', '#71717a'] }),
  namedStyle('midnight', 'Midnight', { background: '#0f172a', connector: '#475569', text: '#e2e8f0', textMuted: '#94a3b8', placeholderFill: '#1e293b', placeholderStroke: '#334155', male: ['#1e3a5f', '#3b82f6'], female: ['#3b1f4f', '#a855f7'], neutral: ['#293548', '#64748b'] }),
  namedStyle('pastel', 'Pastel', { background: '#fdf6ff', connector: '#b59ad0', text: '#322041', textMuted: '#6d5a82', placeholderFill: '#fefaff', placeholderStroke: '#e3d2f0', male: ['#d6e6ff', '#7aa0d8'], female: ['#ffe0ef', '#d885ab'], neutral: ['#eee2f6', '#9a85b0'] }),
  namedStyle('vibrant', 'Vibrant', { background: '#fff8f0', connector: '#e07a3f', text: '#2a1605', textMuted: '#7a5230', placeholderFill: '#fffcf7', placeholderStroke: '#f0d4b8', male: ['#bfe3ff', '#1f7ad8'], female: ['#ffd6c2', '#e0552a'], neutral: ['#fff0cc', '#d99a1f'] }),
];

export const THEMES = [AUTO_THEME, DEFAULT_THEME, LIGHT_THEME, SEPIA_THEME, ...NAMED_STYLES];

function currentAppIsDark() {
  if (typeof document === 'undefined') return true;
  return document.documentElement.classList.contains('dark');
}

/**
 * Resolve a chart theme. Pass `appIsDark` explicitly when the caller knows
 * the React-controlled theme state (avoids reading the html class before the
 * theme-applying useEffect has run).
 */
export function getTheme(id, appIsDark) {
  if (id === 'auto' || !id) {
    const dark = appIsDark === undefined ? currentAppIsDark() : appIsDark;
    return dark ? DEFAULT_THEME : LIGHT_THEME;
  }
  return THEMES.find((t) => t.id === id) || DEFAULT_THEME;
}

export function mergeTheme(base, override) {
  if (!override) return base;
  return { ...base, ...override, gender: { ...base.gender, ...(override.gender || {}) } };
}
