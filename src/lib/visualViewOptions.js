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
          { value: 'uniform', label: 'Uniform' },
        ],
      },
      { key: 'markerSize', label: 'Pin size', type: 'range', min: 8, max: 24, step: 1, unit: 'px' },
      { key: 'connectionLines', label: 'Connection lines', type: 'checkbox' },
      {
        key: 'mapType',
        label: 'Map Type',
        type: 'select',
        options: [
          { value: 'standard', label: 'Standard' },
          { value: 'muted', label: 'Muted' },
          { value: 'satellite', label: 'Satellite-style' },
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
const COLOR_MODES = new Set(['event', 'time', 'uniform']);
const HEAT_GRADIENTS = new Set(['red-yellow-white', 'blue-green-red', 'purple-gold']);
const MAP_TYPES = new Set(['standard', 'muted', 'satellite', 'dark']);
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
  if (options.colorBy === 'time') return colorForYear(event?.year, yearBounds);
  return colorForEventType(event?.overlayType || event?.conclusionType);
}

export function buildChronologicalConnections(events = [], enabled = false) {
  if (!enabled) return [];
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
      return {
        id: `${previous.recordName || previous.id || index}-${event.recordName || event.id || index + 1}`,
        from: { lng: previous.lng, lat: previous.lat },
        to: { lng: event.lng, lat: event.lat },
      };
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

function colorForYear(year, bounds) {
  if (!Number.isFinite(year) || !bounds) return '#64748b';
  const min = Array.isArray(bounds) ? bounds[0] : bounds.min;
  const max = Array.isArray(bounds) ? bounds[1] : bounds.max;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return '#2563eb';
  const t = Math.min(1, Math.max(0, (year - min) / (max - min)));
  if (t < 0.33) return '#2563eb';
  if (t < 0.66) return '#0f766e';
  return '#d97706';
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
