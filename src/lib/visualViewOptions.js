export const MAP_VISUAL_OPTION_PRESETS = Object.freeze({
  mapStory: {
    markerMode: 'pins',
    markerSize: 14,
    colorBy: 'event',
    connectionLines: false,
    heatRadius: 34,
    heatOpacity: 0.45,
    heatGradient: 'red-yellow-white',
    heatAmplification: 3,
    heatAutoRadius: true,
    fixedHeatRadius: 42,
    darkHeatMap: false,
    slideshowDelayMs: 1200,
    slideshowYearStep: 30,
    slideshowFit: false,
    slideshowSkipEmptyYears: true,
    slideshowExpandRange: false,
    slideshowStartCurrentYear: false,
    mapType: 'standard',
    displayCurrentLocation: false,
    personGroupMode: 'all',
    smartFilterMode: 'none',
    connectionPattern: 'line',
    connectionWidth: 'medium',
    connectionColor: 'white',
    animateConnections: false,
    dateColorsMode: 'blue-red',
    sunMode: 'noon',
    globeBackground: 'space',
    tileNames: 'auto',
  },
  globe: {
    markerMode: 'pins',
    markerSize: 12,
    colorBy: 'event',
    connectionLines: false,
    heatRadius: 28,
    heatOpacity: 0.35,
    heatGradient: 'red-yellow-white',
    heatAmplification: 3,
    heatAutoRadius: true,
    fixedHeatRadius: 36,
    darkHeatMap: false,
    slideshowDelayMs: 1200,
    slideshowYearStep: 30,
    slideshowFit: false,
    slideshowSkipEmptyYears: true,
    slideshowExpandRange: false,
    slideshowStartCurrentYear: false,
    mapType: 'standard',
    displayCurrentLocation: false,
    personGroupMode: 'all',
    smartFilterMode: 'none',
    connectionPattern: 'line',
    connectionWidth: 'medium',
    connectionColor: 'white',
    animateConnections: false,
    dateColorsMode: 'blue-red',
    sunMode: 'noon',
    globeBackground: 'space',
    tileNames: 'auto',
  },
});

export const VISUAL_OPTION_SECTIONS = Object.freeze([
  {
    id: 'display',
    label: 'Display',
    controls: [
      {
        key: 'markerMode',
        label: 'Markers',
        type: 'select',
        options: [
          { value: 'pins', label: 'Pins' },
          { value: 'heat', label: 'Heat map' },
          { value: 'pins-heat', label: 'Pins + heat' },
        ],
      },
      {
        key: 'colorBy',
        label: 'Color',
        type: 'select',
        options: [
          { value: 'event', label: 'Event type' },
          { value: 'time', label: 'Date range' },
          { value: 'events-count', label: 'Events count at place' },
          { value: 'person-group', label: 'Person group' },
          { value: 'uniform', label: 'Uniform' },
        ],
      },
      { key: 'markerSize', label: 'Pin size', type: 'range', min: 8, max: 24, step: 1, unit: 'px' },
      { key: 'connectionLines', label: 'Connection lines', type: 'checkbox' },
      { key: 'animateConnections', label: 'Animate connections', type: 'checkbox' },
      {
        key: 'connectionPattern',
        label: 'Connection Pattern',
        type: 'select',
        options: [
          { value: 'line', label: 'Line' },
          { value: 'arrows', label: 'Arrows' },
          { value: 'arrows2', label: 'Arrows 2' },
          { value: 'blobs', label: 'Blobs' },
        ],
      },
      {
        key: 'connectionWidth',
        label: 'Connection Width',
        type: 'select',
        options: [
          { value: 'small', label: 'Small' },
          { value: 'medium', label: 'Medium' },
          { value: 'large', label: 'Large' },
        ],
      },
      {
        key: 'connectionColor',
        label: 'Connection Color',
        type: 'select',
        options: [
          { value: 'white', label: 'White' },
          { value: 'orange', label: 'Orange' },
          { value: 'green', label: 'Green' },
          { value: 'turquoise', label: 'Turquoise' },
          { value: 'pink', label: 'Pink' },
          { value: 'event-date', label: 'Event Date' },
        ],
      },
      {
        key: 'dateColorsMode',
        label: 'Event Date Colors',
        type: 'select',
        options: [
          { value: 'blue-red', label: 'Blue to Red' },
          { value: 'rainbow', label: 'Rainbow' },
          { value: 'turquoise-red', label: 'Turquoise to Red' },
        ],
      },
      {
        key: 'sunMode',
        label: 'Sun Simulation',
        type: 'select',
        kinds: ['globe'],
        options: [
          { value: 'noon', label: 'Always noon' },
          { value: 'current', label: 'Current time' },
          { value: 'currentBright', label: 'Current time, brighter backside' },
        ],
      },
      {
        key: 'globeBackground',
        label: 'Background',
        type: 'select',
        kinds: ['globe'],
        options: [
          { value: 'space', label: 'Starry sky' },
          { value: 'light', label: 'Light box' },
        ],
      },
      {
        key: 'tileNames',
        label: 'Map Names',
        type: 'select',
        options: [
          { value: 'auto', label: 'Map default' },
          { value: 'international', label: 'International' },
          { value: 'national', label: 'National (local names)' },
        ],
      },
      {
        key: 'mapType',
        label: 'Map Type',
        type: 'select',
        options: [
          { value: 'standard', label: 'Standard' },
          { value: 'muted', label: 'Muted' },
          { value: 'satellite', label: 'Satellite' },
          { value: 'hybrid', label: 'Hybrid' },
          { value: 'dark', label: 'Dark' },
        ],
      },
      { key: 'displayCurrentLocation', label: 'Display current location', type: 'checkbox' },
    ],
  },
  {
    id: 'heat',
    label: 'Heat Map',
    controls: [
      {
        key: 'heatGradient',
        label: 'Gradient Colors',
        type: 'select',
        options: [
          { value: 'red-yellow-white', label: 'Red, Yellow and White' },
          { value: 'blue-green-red', label: 'Blue, Green and Red' },
          { value: 'purple-gold', label: 'Purple and Gold' },
        ],
      },
      { key: 'heatRadius', label: 'Radius', type: 'range', min: 12, max: 72, step: 2, unit: 'px' },
      { key: 'heatOpacity', label: 'Opacity', type: 'range', min: 0.1, max: 0.9, step: 0.05, format: 'percent' },
      { key: 'heatAmplification', label: 'Heat amplification', type: 'range', min: 1, max: 8, step: 1 },
      { key: 'heatAutoRadius', label: 'Auto heat radius by zoom', type: 'checkbox' },
      { key: 'fixedHeatRadius', label: 'Fixed heat radius', type: 'range', min: 12, max: 96, step: 2, unit: 'px' },
      { key: 'darkHeatMap', label: 'Always show map in dark colors', type: 'checkbox' },
    ],
  },
  {
    id: 'slideshow',
    label: 'Slideshow',
    controls: [
      { key: 'slideshowDelayMs', label: 'Delay', type: 'range', min: 600, max: 4000, step: 100, unit: 'ms' },
      { key: 'slideshowYearStep', label: 'Year step', type: 'range', min: 1, max: 100, step: 1, unit: 'y' },
      { key: 'slideshowFit', label: 'Fit current step', type: 'checkbox' },
      { key: 'slideshowSkipEmptyYears', label: 'Skip empty year spans', type: 'checkbox' },
      { key: 'slideshowExpandRange', label: 'Expand year range each step', type: 'checkbox' },
      { key: 'slideshowStartCurrentYear', label: 'Always start with current year', type: 'checkbox' },
    ],
  },
  {
    id: 'personGroups',
    label: 'Person Groups',
    controls: [
      {
        key: 'personGroupMode',
        label: 'Group',
        type: 'select',
        options: [
          { value: 'all', label: 'All Persons' },
          { value: 'bookmarked', label: 'Bookmarked' },
          { value: 'start-family', label: 'Start-person family' },
        ],
      },
    ],
  },
  {
    id: 'smartFilter',
    label: 'Smart Filter',
    controls: [
      {
        key: 'smartFilterMode',
        label: 'Smart Filter',
        type: 'select',
        options: [
          { value: 'none', label: 'No Smart Filter' },
          { value: 'with-places', label: 'Events with Places' },
          { value: 'missing-date', label: 'Missing Date' },
          { value: 'living', label: 'Living Persons' },
        ],
      },
    ],
  },
]);

const MARKER_MODES = new Set(['pins', 'heat', 'pins-heat']);
const COLOR_MODES = new Set(['event', 'time', 'events-count', 'person-group', 'uniform']);
const GLOBE_BACKGROUNDS = new Set(['space', 'light']);
const CONNECTION_PATTERNS = new Set(['line', 'arrows', 'arrows2', 'blobs']);
const CONNECTION_WIDTHS = new Set(['small', 'medium', 'large']);
const DATE_COLORS_MODES = new Set(['blue-red', 'rainbow', 'turquoise-red']);
const SUN_MODES = new Set(['noon', 'current', 'currentBright']);
const TILE_NAME_MODES = new Set(['auto', 'international', 'national']);
const HEAT_GRADIENTS = new Set(['red-yellow-white', 'blue-green-red', 'purple-gold']);
const MAP_TYPES = new Set(['standard', 'muted', 'satellite', 'hybrid', 'dark']);
const CONNECTION_COLORS = new Set(['white', 'orange', 'green', 'turquoise', 'pink', 'event-date']);

// Connection line color presets (parity with VirtualGlobe's connection color
// menu). 'event-date' is a sentinel — the renderer falls back to the per-event
// date gradient already carried on each connection feature.
const CONNECTION_COLOR_HEX = Object.freeze({
  white: '#f8fafc',
  orange: '#f97316',
  green: '#22c55e',
  turquoise: '#06b6d4',
  pink: '#ec4899',
});

export function connectionColorHex(mode) {
  return CONNECTION_COLOR_HEX[mode] || null;
}
const PERSON_GROUP_MODES = new Set(['all', 'bookmarked', 'start-family']);
const SMART_FILTER_MODES = new Set(['none', 'with-places', 'missing-date', 'living']);

export function normalizeVisualViewOptions(kind = 'mapStory', options = {}) {
  const defaults = MAP_VISUAL_OPTION_PRESETS[kind] || MAP_VISUAL_OPTION_PRESETS.mapStory;
  const next = { ...defaults, ...options };
  next.markerMode = MARKER_MODES.has(next.markerMode) ? next.markerMode : defaults.markerMode;
  next.colorBy = COLOR_MODES.has(next.colorBy) ? next.colorBy : defaults.colorBy;
  next.markerSize = clampNumber(next.markerSize, 8, 24, defaults.markerSize);
  next.connectionLines = Boolean(next.connectionLines);
  next.heatRadius = clampNumber(next.heatRadius, 12, 72, defaults.heatRadius);
  next.heatOpacity = clampNumber(next.heatOpacity, 0.1, 0.9, defaults.heatOpacity);
  next.heatGradient = HEAT_GRADIENTS.has(next.heatGradient) ? next.heatGradient : defaults.heatGradient;
  next.heatAmplification = clampNumber(next.heatAmplification, 1, 8, defaults.heatAmplification);
  next.heatAutoRadius = next.heatAutoRadius !== false;
  next.fixedHeatRadius = clampNumber(next.fixedHeatRadius, 12, 96, defaults.fixedHeatRadius);
  next.darkHeatMap = Boolean(next.darkHeatMap);
  next.slideshowDelayMs = clampNumber(next.slideshowDelayMs, 600, 4000, defaults.slideshowDelayMs);
  next.slideshowYearStep = clampNumber(next.slideshowYearStep, 1, 100, defaults.slideshowYearStep);
  next.slideshowFit = Boolean(next.slideshowFit);
  next.slideshowSkipEmptyYears = next.slideshowSkipEmptyYears !== false;
  next.slideshowExpandRange = Boolean(next.slideshowExpandRange);
  next.slideshowStartCurrentYear = Boolean(next.slideshowStartCurrentYear);
  next.mapType = MAP_TYPES.has(next.mapType) ? next.mapType : defaults.mapType;
  next.displayCurrentLocation = Boolean(next.displayCurrentLocation);
  next.personGroupMode = PERSON_GROUP_MODES.has(next.personGroupMode) ? next.personGroupMode : defaults.personGroupMode;
  next.smartFilterMode = SMART_FILTER_MODES.has(next.smartFilterMode) ? next.smartFilterMode : defaults.smartFilterMode;
  next.connectionPattern = CONNECTION_PATTERNS.has(next.connectionPattern) ? next.connectionPattern : defaults.connectionPattern;
  next.connectionWidth = CONNECTION_WIDTHS.has(next.connectionWidth) ? next.connectionWidth : defaults.connectionWidth;
  next.connectionColor = CONNECTION_COLORS.has(next.connectionColor) ? next.connectionColor : (defaults.connectionColor || 'white');
  next.animateConnections = Boolean(next.animateConnections);
  next.dateColorsMode = DATE_COLORS_MODES.has(next.dateColorsMode) ? next.dateColorsMode : defaults.dateColorsMode;
  next.sunMode = SUN_MODES.has(next.sunMode) ? next.sunMode : defaults.sunMode;
  next.globeBackground = GLOBE_BACKGROUNDS.has(next.globeBackground) ? next.globeBackground : (defaults.globeBackground || 'space');
  next.tileNames = TILE_NAME_MODES.has(next.tileNames) ? next.tileNames : defaults.tileNames;
  return next;
}

export function updateVisualViewOption(kind, options, key, value) {
  return normalizeVisualViewOptions(kind, { ...options, [key]: value });
}

export function usesMarkerPins(options = {}) {
  return options.markerMode === 'pins' || options.markerMode === 'pins-heat';
}

export function usesHeatMap(options = {}) {
  return options.markerMode === 'heat' || options.markerMode === 'pins-heat';
}

export function colorForVisualEvent(event, options = {}, yearBounds = null) {
  if (options.colorBy === 'uniform') return '#2563eb';
  if (options.colorBy === 'time') return colorForYear(event?.year, yearBounds, options.dateColorsMode);
  if (options.colorBy === 'events-count') return colorForEventsCount(event?.eventsAtPlace, options.dateColorsMode);
  if (options.colorBy === 'person-group') return colorForPersonGroup(event?.personGroupId);
  return colorForEventType(event?.overlayType || event?.conclusionType);
}

function colorForPersonGroup(groupId) {
  if (!groupId) return '#94a3b8'; // slate — no group
  let hash = 0;
  const str = String(groupId);
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360} 65% 55%)`;
}

/**
 * Annotate events with `eventsAtPlace` — how many events share the same
 * coordinate — for the "Color pins according to Events count" mode.
 */
export function attachEventCounts(events = []) {
  const counts = new Map();
  for (const event of events) {
    if (!Number.isFinite(event?.lat) || !Number.isFinite(event?.lng)) continue;
    const key = `${event.lat.toFixed(4)},${event.lng.toFixed(4)}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return events.map((event) => {
    if (!Number.isFinite(event?.lat) || !Number.isFinite(event?.lng)) return event;
    const key = `${event.lat.toFixed(4)},${event.lng.toFixed(4)}`;
    return { ...event, eventsAtPlace: counts.get(key) || 1 };
  });
}

function colorForEventsCount(count, mode) {
  if (!Number.isFinite(count) || count <= 0) return '#64748b';
  // Log ramp: 1 event = cool end, ~20+ events = hot end of the gradient.
  const t = Math.min(1, Math.log10(count) / Math.log10(20));
  return dateGradientColor(t, mode);
}

function dateGradientColor(t, mode = 'blue-red') {
  const clamped = Math.min(1, Math.max(0, t));
  if (mode === 'rainbow') return `hsl(${Math.round(250 - clamped * 250)}, 78%, 48%)`;
  if (mode === 'turquoise-red') return mixHex('#06b6d4', '#dc2626', clamped);
  return mixHex('#2563eb', '#dc2626', clamped);
}

function mixHex(a, b, t) {
  const pa = hexChannels(a);
  const pb = hexChannels(b);
  const channel = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${channel(pa.r, pb.r)}${channel(pa.g, pb.g)}${channel(pa.b, pb.b)}`;
}

function hexChannels(hex) {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

export function buildChronologicalConnections(events = [], enabled = false, options = {}) {
  if (!enabled) return [];
  const colorMode = typeof options === 'string' ? options : options?.connectionColor;
  const presetColor = connectionColorHex(colorMode);
  const sorted = events
    .filter((event) => Number.isFinite(event?.lat) && Number.isFinite(event?.lng))
    .sort((a, b) => {
      const ay = Number.isFinite(a.year) ? a.year : Number.POSITIVE_INFINITY;
      const by = Number.isFinite(b.year) ? b.year : Number.POSITIVE_INFINITY;
      return ay - by || String(a.recordName || a.id || '').localeCompare(String(b.recordName || b.id || ''));
    });
  return sorted.slice(1)
    .map((event, index) => {
      const previous = sorted[index];
      const connection = {
        id: `${previous.recordName || previous.id || index}-${event.recordName || event.id || index + 1}`,
        from: { lng: previous.lng, lat: previous.lat },
        to: { lng: event.lng, lat: event.lat },
      };
      // 'event-date' keeps each segment colored by the destination event's
      // marker color (already computed for the pins); presets force one hue.
      if (presetColor) connection.color = presetColor;
      else if (colorMode === 'event-date' && event.color) connection.color = event.color;
      return connection;
    });
}

function colorForEventType(type) {
  const value = String(type || '').toLowerCase();
  if (/birth|christ|bapt/.test(value)) return '#2563eb';
  if (/death|buri|crem/.test(value)) return '#7f1d1d';
  if (/marri|engag|divorc/.test(value)) return '#7c3aed';
  if (/resid|occup|migra|immig|emig|census|arrival|depart/.test(value)) return '#0f766e';
  return '#d97706';
}

function colorForYear(year, bounds, mode = 'blue-red') {
  if (!Number.isFinite(year) || !bounds) return '#64748b';
  const min = Array.isArray(bounds) ? bounds[0] : bounds.min;
  const max = Array.isArray(bounds) ? bounds[1] : bounds.max;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return '#2563eb';
  const t = Math.min(1, Math.max(0, (year - min) / (max - min)));
  return dateGradientColor(t, mode);
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
