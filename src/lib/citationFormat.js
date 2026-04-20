/**
 * Multi-axis citation formatter mirroring MacFamilyTree's dual
 * `longCitation*` / `normalCitation*` property family on source templates.
 *
 * Mac exposes four independent axes for each mode:
 *   - order:          which fields appear and in what sequence
 *   - bracketMode:    none | parens | brackets
 *   - fontMode:       plain | italic | smallCaps (title treatment)
 *   - trailingMode:   none | period | semicolon
 *
 * "Normal" citation = footnote-length inline reference.
 * "Long"   citation = bibliography-length entry.
 *
 * Only a conservative subset is wired into rendering: the fields referenced
 * are the common ones on a SourceRecord (title, author, date, publisher,
 * page, repository, reference number, url). Unknown fields are skipped.
 */

export const CITATION_MODE = Object.freeze({
  NORMAL: 'normal',
  LONG: 'long',
});

export const BRACKET_MODE = Object.freeze({
  NONE: 'none',
  PARENS: 'parens',
  BRACKETS: 'brackets',
});

export const FONT_MODE = Object.freeze({
  PLAIN: 'plain',
  ITALIC: 'italic',
  SMALL_CAPS: 'smallCaps',
});

export const TRAILING_MODE = Object.freeze({
  NONE: 'none',
  PERIOD: 'period',
  SEMICOLON: 'semicolon',
});

export const DEFAULT_NORMAL_CITATION = Object.freeze({
  enabled: true,
  order: ['author', 'title', 'date', 'page'],
  bracketMode: BRACKET_MODE.PARENS,
  fontMode: FONT_MODE.ITALIC,
  trailingMode: TRAILING_MODE.PERIOD,
});

export const DEFAULT_LONG_CITATION = Object.freeze({
  enabled: true,
  order: ['author', 'title', 'publisher', 'date', 'repository', 'reference', 'url'],
  bracketMode: BRACKET_MODE.NONE,
  fontMode: FONT_MODE.ITALIC,
  trailingMode: TRAILING_MODE.PERIOD,
});

function readField(record, names, fallback = '') {
  for (const name of names) {
    const value = record?.fields?.[name]?.value;
    if (value) return String(value);
  }
  return fallback;
}

function fieldValue(source, key) {
  switch (key) {
    case 'title': return readField(source, ['title', 'name']);
    case 'author': return readField(source, ['author', 'creator']);
    case 'date': return readField(source, ['date', 'cached_date']);
    case 'publisher': return readField(source, ['publisher']);
    case 'page': return readField(source, ['page']);
    case 'repository': return readField(source, ['repositoryName', 'repository']);
    case 'reference': return readField(source, ['sourceReferenceNumber', 'referenceNumber']);
    case 'url': return readField(source, ['url']);
    case 'text': return readField(source, ['text']);
    default: return readField(source, [key]);
  }
}

function applyFont(value, key, fontMode) {
  if (!value) return '';
  if (key !== 'title') return value;
  switch (fontMode) {
    case FONT_MODE.ITALIC: return `*${value}*`;
    case FONT_MODE.SMALL_CAPS: return value.toUpperCase();
    default: return value;
  }
}

function bracket(value, mode) {
  if (!value) return '';
  switch (mode) {
    case BRACKET_MODE.PARENS: return `(${value})`;
    case BRACKET_MODE.BRACKETS: return `[${value}]`;
    default: return value;
  }
}

function trail(value, mode) {
  if (!value) return '';
  switch (mode) {
    case TRAILING_MODE.PERIOD: return value.endsWith('.') ? value : `${value}.`;
    case TRAILING_MODE.SEMICOLON: return value.endsWith(';') ? value : `${value};`;
    default: return value;
  }
}

/**
 * Format a single source record in the given mode.
 * Returns a plain string suitable for paragraph/list rendering. Markdown
 * `*italic*` is emitted for italicized titles; HTML renderers already honor
 * that convention.
 */
export function formatCitation(source, mode = CITATION_MODE.NORMAL, config) {
  const cfg = config || (mode === CITATION_MODE.LONG ? DEFAULT_LONG_CITATION : DEFAULT_NORMAL_CITATION);
  if (!cfg.enabled) return '';
  const parts = [];
  for (const key of cfg.order || []) {
    const raw = fieldValue(source, key);
    if (!raw) continue;
    parts.push(applyFont(raw, key, cfg.fontMode));
  }
  if (parts.length === 0) return '';
  const joined = parts.join(mode === CITATION_MODE.LONG ? '. ' : ', ');
  return trail(bracket(joined, cfg.bracketMode), cfg.trailingMode);
}

export function formatBibliography(sources, config = DEFAULT_LONG_CITATION) {
  return (sources || [])
    .map((source) => formatCitation(source, CITATION_MODE.LONG, config))
    .filter(Boolean);
}
