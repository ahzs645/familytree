import { parseEventDate } from '../utils/formatDate.js';

export const VITAL_MARKER_STYLE_OPTIONS = [
  { value: 'range', label: 'Year range' },
  { value: 'symbols', label: 'Islamic-friendly symbols' },
  { value: 'arabic-labels', label: 'Arabic labels' },
];

export const DEFAULT_VITAL_DISPLAY = {
  markerStyle: 'range',
};

let activeVitalDisplay = { ...DEFAULT_VITAL_DISPLAY };

export function normalizeVitalDisplay(value = {}) {
  const markerStyle = VITAL_MARKER_STYLE_OPTIONS.some((option) => option.value === value.markerStyle)
    ? value.markerStyle
    : DEFAULT_VITAL_DISPLAY.markerStyle;
  return { markerStyle };
}

export function setActiveVitalDisplay(value = {}) {
  activeVitalDisplay = normalizeVitalDisplay(value);
}

export function getActiveVitalDisplay() {
  return activeVitalDisplay;
}

export function yearLabel(raw) {
  const parsed = parseEventDate(raw);
  return parsed?.year == null ? '' : String(parsed.year);
}

export function lifeSpanLabelFor(summary, display = activeVitalDisplay) {
  if (!summary) return '';
  const b = yearLabel(summary.birthDate);
  const d = yearLabel(summary.deathDate);
  if (!b && !d) return '';

  const normalized = normalizeVitalDisplay(display);
  if (normalized.markerStyle === 'symbols') {
    return formatVitalParts([
      b ? `* ${b}` : '',
      d ? `◆ ${d}` : '',
    ]);
  }
  if (normalized.markerStyle === 'arabic-labels') {
    return formatVitalParts([
      b ? `ميلاد ${b}` : '',
      d ? `وفاة ${d}` : '',
    ]);
  }
  return `${b || '?'} – ${d || ''}`.trim();
}

export function formatVitalDateParts({ birthDate, deathDate } = {}, display = activeVitalDisplay) {
  const normalized = normalizeVitalDisplay(display);
  const birth = birthDate ? String(birthDate) : '';
  const death = deathDate ? String(deathDate) : '';
  if (normalized.markerStyle === 'symbols') {
    return [birth ? `* ${birth}` : '', death ? `◆ ${death}` : ''].filter(Boolean);
  }
  if (normalized.markerStyle === 'arabic-labels') {
    return [birth ? `ميلاد ${birth}` : '', death ? `وفاة ${death}` : ''].filter(Boolean);
  }
  return [birth ? `b. ${birth}` : '', death ? `d. ${death}` : ''].filter(Boolean);
}

export function formatVitalPhraseParts(summary = {}, display = activeVitalDisplay) {
  const normalized = normalizeVitalDisplay(display);
  const birth = summary.birthDate ? String(summary.birthDate) : '';
  const death = summary.deathDate ? String(summary.deathDate) : '';
  if (normalized.markerStyle === 'symbols') {
    return [birth ? `* ${birth}` : '', death ? `◆ ${death}` : ''].filter(Boolean);
  }
  if (normalized.markerStyle === 'arabic-labels') {
    return [birth ? `ولد/ولدت ${birth}` : '', death ? `توفي/توفيت ${death}` : ''].filter(Boolean);
  }
  return [birth ? `born ${birth}` : '', death ? `died ${death}` : ''].filter(Boolean);
}

function formatVitalParts(parts) {
  return parts.filter(Boolean).join('  ');
}
