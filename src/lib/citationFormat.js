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

function applyFont(value, isTitle, fontMode) {
  if (!value) return '';
  if (!isTitle) return value;
  switch (fontMode) {
    case FONT_MODE.ITALIC: return `*${value}*`;
    case FONT_MODE.SMALL_CAPS: return value.toUpperCase();
    default: return value;
  }
}

/**
 * Build a citation config from a source's resolved SourceTemplateKeyRelation
 * set so `formatCitation` honors the user's per-key order, enable, and
 * title-component choices (MFT longCitationOrder / shortCitationOrder /
 * isTitleComponent).
 *
 * keyRelations: [{ templateKey, longCitationOrder, shortCitationOrder, isTitleComponent }]
 * values:       map of templateKey -> resolved string value (from SourceKeyValue).
 * Returns null when the template carries no usable ordering, so callers fall
 * back to the hardcoded record-field defaults.
 */
export function buildCitationConfigFromTemplate(keyRelations, mode = CITATION_MODE.NORMAL, values = {}) {
  const orderField = mode === CITATION_MODE.LONG ? 'longCitationOrder' : 'shortCitationOrder';
  const base = mode === CITATION_MODE.LONG ? DEFAULT_LONG_CITATION : DEFAULT_NORMAL_CITATION;
  const usable = (keyRelations || []).filter((rel) => rel?.templateKey && Number.isFinite(Number(rel[orderField])) && Number(rel[orderField]) >= 0);
  if (usable.length === 0) return null;
  usable.sort((a, b) => Number(a[orderField]) - Number(b[orderField]));
  const titleRel = usable.find((rel) => rel.isTitleComponent);
  return {
    enabled: true,
    order: usable.map((rel) => rel.templateKey),
    titleKey: titleRel?.templateKey || null,
    values,
    bracketMode: base.bracketMode,
    fontMode: base.fontMode,
    trailingMode: base.trailingMode,
  };
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
  // Template-driven config supplies a `values` map keyed by templateKey and a
  // `titleKey`; otherwise fall back to resolving from the source record's fields.
  const fromTemplate = cfg.values && typeof cfg.values === 'object';
  const parts = [];
  for (const key of cfg.order || []) {
    const raw = fromTemplate ? cfg.values[key] : fieldValue(source, key);
    if (!raw) continue;
    const isTitle = fromTemplate ? key === cfg.titleKey : key === 'title';
    parts.push(applyFont(String(raw), isTitle, cfg.fontMode));
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
