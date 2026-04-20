/**
 * Name format presets mirroring MacFamilyTree 11's
 * `Person_NameFormat_*` enum (preferences pane `PreferencePaneNameFormat.nib`).
 *
 * Mac splits this into two independent preferences:
 *   - display format: how the name renders in editors, chart nodes, reports.
 *   - sort format:    how the name sorts (separate from display).
 *
 * Nine presets are supported. Each preset is a list of name-part tokens
 * separated by spaces or explicit commas. Missing parts are skipped so
 * `Last, First` collapses to just `Last` when no given name is present.
 */

export const NAME_FORMAT = Object.freeze({
  TITLE_FIRST_MIDDLE_LAST_SUFFIX: 'title-first-middle-last-suffix',
  FIRST_MIDDLE_LAST: 'first-middle-last',
  LAST_SUFFIX_FIRST_MIDDLE: 'last-suffix-first-middle',
  LAST_COMMA_FIRST_MIDDLE: 'last-comma-first-middle',
  TITLE_LAST_MIDDLE_FIRST_SUFFIX: 'title-last-middle-first-suffix',
  TITLE_LAST_FIRST_SUFFIX: 'title-last-first-suffix',
  TITLE_COMMA_FIRST_MIDDLE_SUFFIX: 'title-comma-first-middle-suffix',
  FIRST_LAST: 'first-last',
  LAST_FIRST: 'last-first',
});

export const NAME_FORMAT_LABELS = Object.freeze({
  [NAME_FORMAT.TITLE_FIRST_MIDDLE_LAST_SUFFIX]: 'Title First Middle Last Suffix',
  [NAME_FORMAT.FIRST_MIDDLE_LAST]: 'First Middle Last',
  [NAME_FORMAT.LAST_SUFFIX_FIRST_MIDDLE]: 'Last Suffix First Middle',
  [NAME_FORMAT.LAST_COMMA_FIRST_MIDDLE]: 'Last, First Middle',
  [NAME_FORMAT.TITLE_LAST_MIDDLE_FIRST_SUFFIX]: 'Title Last Middle First Suffix',
  [NAME_FORMAT.TITLE_LAST_FIRST_SUFFIX]: 'Title Last First Suffix',
  [NAME_FORMAT.TITLE_COMMA_FIRST_MIDDLE_SUFFIX]: 'Title, First Middle Suffix',
  [NAME_FORMAT.FIRST_LAST]: 'First Last',
  [NAME_FORMAT.LAST_FIRST]: 'Last First',
});

export const NAME_FORMAT_OPTIONS = Object.freeze(
  Object.values(NAME_FORMAT).map((value) => ({ value, label: NAME_FORMAT_LABELS[value] })),
);

export const DEFAULT_DISPLAY_FORMAT = NAME_FORMAT.FIRST_LAST;
export const DEFAULT_SORT_FORMAT = NAME_FORMAT.LAST_COMMA_FIRST_MIDDLE;

function joinTokens(tokens) {
  const out = [];
  for (const token of tokens) {
    if (!token) continue;
    if (token === ',') {
      if (out.length === 0) continue;
      out[out.length - 1] = `${out[out.length - 1]},`;
      continue;
    }
    out.push(token);
  }
  return out.join(' ').replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim().replace(/,$/, '');
}

/**
 * Compose a full name from a parts object using the given preset.
 * parts = { title?, first?, middle?, last?, suffix? }
 */
export function formatName(parts = {}, preset = DEFAULT_DISPLAY_FORMAT) {
  const { title = '', first = '', middle = '', last = '', suffix = '' } = parts;
  switch (preset) {
    case NAME_FORMAT.TITLE_FIRST_MIDDLE_LAST_SUFFIX:
      return joinTokens([title, first, middle, last, suffix]);
    case NAME_FORMAT.LAST_SUFFIX_FIRST_MIDDLE:
      return joinTokens([last, suffix, first, middle]);
    case NAME_FORMAT.LAST_COMMA_FIRST_MIDDLE:
      return joinTokens([last, ',', first, middle]);
    case NAME_FORMAT.TITLE_LAST_MIDDLE_FIRST_SUFFIX:
      return joinTokens([title, last, middle, first, suffix]);
    case NAME_FORMAT.TITLE_LAST_FIRST_SUFFIX:
      return joinTokens([title, last, first, suffix]);
    case NAME_FORMAT.TITLE_COMMA_FIRST_MIDDLE_SUFFIX:
      return joinTokens([title, ',', first, middle, suffix]);
    case NAME_FORMAT.FIRST_LAST:
      return joinTokens([first, last]);
    case NAME_FORMAT.LAST_FIRST:
      return joinTokens([last, first]);
    case NAME_FORMAT.FIRST_MIDDLE_LAST:
    default:
      return joinTokens([first, middle, last]);
  }
}

/** Pull the five name parts off a raw record. */
export function namePartsFromRecord(record) {
  const f = record?.fields || {};
  return {
    title: f.namePrefix?.value || f.title?.value || '',
    first: f.firstName?.value || '',
    middle: f.nameMiddle?.value || f.middleName?.value || '',
    last: f.lastName?.value || '',
    suffix: f.nameSuffix?.value || '',
  };
}

/**
 * Module-level cache of the active preferences so sync code paths
 * (personSummary, list comparators) can consult them without an await.
 * Seeded from Settings on load via `setActiveNameFormats`.
 */
let activeDisplay = DEFAULT_DISPLAY_FORMAT;
let activeSort = DEFAULT_SORT_FORMAT;

export function setActiveNameFormats({ display, sort } = {}) {
  if (display) activeDisplay = display;
  if (sort) activeSort = sort;
}

export function getActiveDisplayFormat() { return activeDisplay; }
export function getActiveSortFormat() { return activeSort; }

export function formatDisplayName(record) {
  return formatName(namePartsFromRecord(record), activeDisplay);
}

export function formatSortName(record) {
  return formatName(namePartsFromRecord(record), activeSort);
}
