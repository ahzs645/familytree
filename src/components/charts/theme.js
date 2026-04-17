/**
 * Chart theme — colors, sizes, and node-rendering knobs shared by every chart type.
 *
 * Themes are plain objects so they can be saved per chart-template (see saved chart
 * templates feature). Pass a partial override to `mergeTheme(base, override)`.
 */

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
    0: { fill: '#1f2330', stroke: '#3a4054' }, // unknown
    1: { fill: '#1c2a44', stroke: '#3b6db8' }, // male
    2: { fill: '#3a1c33', stroke: '#b8417a' }, // female
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
    0: { fill: '#eef0f6', stroke: '#bfc4d4' },
    1: { fill: '#dfeaff', stroke: '#5b8be0' },
    2: { fill: '#fbe1ee', stroke: '#cc6499' },
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
    0: { fill: '#ece1c4', stroke: '#a89172' },
    1: { fill: '#e0d2ad', stroke: '#7a6038' },
    2: { fill: '#e9cfb4', stroke: '#a26938' },
  },
};

export const THEMES = [DEFAULT_THEME, LIGHT_THEME, SEPIA_THEME];

export function getTheme(id) {
  return THEMES.find((t) => t.id === id) || DEFAULT_THEME;
}

export function mergeTheme(base, override) {
  if (!override) return base;
  return { ...base, ...override, gender: { ...base.gender, ...(override.gender || {}) } };
}
