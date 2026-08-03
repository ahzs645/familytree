/**
 * Books — composable multi-section documents.
 *
 * A book is a list of sections. Each section produces report blocks that get
 * concatenated into a single AST for preview/export.
 *
 * Section kinds:
 *   - { kind: 'cover', text, subtitle, author }    — publishable cover page
 *   - { kind: 'title', text, subtitle }            — custom title page
 *   - { kind: 'person-summary', targetRecordName }
 *   - { kind: 'ancestor-narrative', targetRecordName, generations }
 *   - { kind: 'descendant-narrative', targetRecordName, generations }
 *   - { kind: 'family-group-sheet', targetRecordName }
 *   - { kind: 'toc', tocStyle }                    — placeholder; materialized on compile
 */
import JSZip from 'jszip';
import { getAppDataClient } from './data/AppDataClient.js';
import { readField, readRef } from './schema.js';
import { block, emptyReport } from './reports/ast.js';
import {
  buildAhnentafelReport,
  buildPersonSummary,
  buildAncestorNarrative,
  buildDescendantNarrative,
  buildFamilyGroupSheet,
  buildMediaGalleryReport,
  buildNarrativeReport,
  buildPersonsList,
  buildPlacesList,
  buildRegisterReport,
  buildDescendancyReport,
  buildSourcesList,
} from './reports/builders.js';
import { renderHTML } from './reports/renderers/html.js';
import { renderText } from './reports/renderers/text.js';
import { localizeReportAst } from './reports/localizeReport.js';
import { normalizePresentationSettings } from './presentationSettings.js';
import { buildSite } from './websiteExport.js';
import { getAuthorInfo } from './authorInfo.js';
import { listSavedReports } from './reports/savedReports.js';
import { generateId } from './ids.js';
import { listChartDocuments } from './chartDocuments.js';
import { compareStrings, formatInteger, getCurrentLocalization, resolveLocalization } from './i18n.js';
import { translate } from './translate.js';
import { personSummary, sourceSummary } from '../models/index.js';
import {
  formatBibliography,
  formatCitation,
  buildCitationConfigFromTemplate,
  CITATION_MODE,
  DEFAULT_LONG_CITATION,
  DEFAULT_NORMAL_CITATION,
} from './citationFormat.js';
import { refToRecordName } from './recordRef.js';

/**
 * Resolve one source's citation text, honoring its SourceTemplate's per-key
 * citation order / title-component when a template is assigned; otherwise fall
 * back to the record-field default formatter. `caches.relsByTemplate` memoizes
 * the template key relations across sources in one render pass.
 */
async function resolveTemplatedCitation(db, source, mode, baseConfig, caches) {
  const templateId = refToRecordName(source.fields?.template?.value) || refToRecordName(source.fields?.sourceTemplate?.value);
  if (!templateId) return formatCitation(source, mode, baseConfig);
  let keyRelations = caches.relsByTemplate.get(templateId);
  if (!keyRelations) {
    const { records } = await db.query('SourceTemplateKeyRelation', { referenceField: 'template', referenceValue: templateId, limit: 1000 });
    keyRelations = records.map((rel) => ({
      templateKey: refToRecordName(rel.fields?.templateKey?.value),
      longCitationOrder: rel.fields?.longCitationOrder?.value,
      shortCitationOrder: rel.fields?.shortCitationOrder?.value,
      isTitleComponent: !!rel.fields?.isTitleComponent?.value,
    }));
    caches.relsByTemplate.set(templateId, keyRelations);
  }
  const { records: keyValues } = await db.query('SourceKeyValue', { referenceField: 'source', referenceValue: source.recordName, limit: 1000 });
  const values = {};
  for (const kv of keyValues) {
    const key = refToRecordName(kv.fields?.templateKey?.value);
    if (key) values[key] = kv.fields?.value?.value || '';
  }
  const templateConfig = buildCitationConfigFromTemplate(keyRelations, mode, values);
  if (!templateConfig) return formatCitation(source, mode, baseConfig);
  return formatCitation(source, mode, { ...baseConfig, order: templateConfig.order, titleKey: templateConfig.titleKey, values: templateConfig.values, enabled: true });
}

const META_KEY = 'savedBooks';

export const TITLE_PAGE_PRESETS = [
  { id: 'title-subtitle-author-date', labelKey: 'books.titlePresets.titleSubtitleAuthorDate' },
  { id: 'title-subtitle-image-author-date', labelKey: 'books.titlePresets.titleSubtitleImageAuthorDate' },
  { id: 'title-subtitle-crest-author-date', labelKey: 'books.titlePresets.titleSubtitleCrestAuthorDate' },
  { id: 'image-title-subtitle-crest-author-date', labelKey: 'books.titlePresets.imageTitleSubtitleCrestAuthorDate' },
  { id: 'crest-title-subtitle-author-date', labelKey: 'books.titlePresets.crestTitleSubtitleAuthorDate' },
];

const DEFAULT_TITLE_PAGE_PRESET = TITLE_PAGE_PRESETS[0].id;

export const SECTION_KINDS = [
  { id: 'cover', labelKey: 'books.sections.cover', configKind: 'text' },
  { id: 'chapter', labelKey: 'books.sections.chapter', configKind: 'text' },
  { id: 'title', labelKey: 'books.sections.title', configKind: 'text' },
  { id: 'toc', labelKey: 'books.sections.toc', configKind: 'text' },
  { id: 'custom-page', labelKey: 'books.sections.customPage', configKind: 'text' },
  { id: 'person-summary', labelKey: 'books.sections.personSummary', configKind: 'person', needsPerson: true },
  { id: 'ancestor-narrative', labelKey: 'books.sections.ancestorNarrative', configKind: 'person', needsPerson: true, needsGenerations: true },
  { id: 'descendant-narrative', labelKey: 'books.sections.descendantNarrative', configKind: 'person', needsPerson: true, needsGenerations: true },
  { id: 'narrative-report', labelKey: 'books.sections.narrativeReport', configKind: 'person', needsPerson: true, needsGenerations: true },
  { id: 'ahnentafel-report', labelKey: 'books.sections.ahnentafelReport', configKind: 'person', needsPerson: true, needsGenerations: true },
  { id: 'register-report', labelKey: 'books.sections.registerReport', configKind: 'person', needsPerson: true, needsGenerations: true },
  { id: 'descendancy-report', labelKey: 'books.sections.descendancyReport', configKind: 'person', needsPerson: true, needsGenerations: true },
  { id: 'family-group-sheet', labelKey: 'books.sections.familyGroupSheet', configKind: 'family', needsPerson: true },
  { id: 'person-group', labelKey: 'books.sections.personGroup', configKind: 'report', needsGroup: true },
  { id: 'source-insert', labelKey: 'books.sections.sourceInsert', configKind: 'report', needsSource: true },
  { id: 'persons-list', labelKey: 'books.sections.personsList', configKind: 'report' },
  { id: 'places-list', labelKey: 'books.sections.placesList', configKind: 'report' },
  { id: 'sources-list', labelKey: 'books.sections.sourcesList', configKind: 'report' },
  { id: 'bibliography', labelKey: 'books.sections.bibliography', configKind: 'report' },
  { id: 'footnotes', labelKey: 'books.sections.footnotes', configKind: 'report' },
  { id: 'media-gallery', labelKey: 'books.sections.mediaGallery', configKind: 'report' },
  { id: 'media-page', labelKey: 'books.sections.mediaPage', configKind: 'report', needsMedia: true },
  { id: 'saved-report', labelKey: 'books.sections.savedReport', configKind: 'report', needsSavedReport: true },
  { id: 'saved-chart', labelKey: 'books.sections.savedChart', configKind: 'chart', needsSavedChart: true },
];

// The six themes are the identifiers shipped by MacFamilyTree 11's
// CoreBooks.strings. CSS lives here so live preview, HTML, and bundle exports
// all share one book renderer mapping.
export const BOOK_THEME_PRESETS = [
  {
    id: 'BlackAndWhite', labelKey: 'books.themes.blackAndWhite', preview: { background: '#ffffff', foreground: '#111111', accent: '#111111' },
    css: 'body{background:#fff;color:#111} h1,h2,h3{font-family:-apple-system,system-ui,"Noto Naskh Arabic",Tahoma,sans-serif;font-weight:800} h2{border-bottom:3px double #111} .book-title-page{letter-spacing:.02em}',
  },
  {
    id: 'Forest', labelKey: 'books.themes.forest', preview: { background: '#f3f0df', foreground: '#203b2c', accent: '#52734d' },
    css: 'body{background:#f3f0df;color:#203b2c} h1,h2,h3{color:#294d37} h2{border-color:#78946f} .book-title-page{background:linear-gradient(135deg,#183828,#52734d);color:#fff;padding:20px;border-radius:8px}',
  },
  {
    id: 'PictureWithWhiteText', labelKey: 'books.themes.largePicture', preview: { background: '#24364b', foreground: '#ffffff', accent: '#b9d4ef' },
    css: 'body{background:#f6f7f9;color:#172033} h2{border-color:#9eb2ca} .book-title-page{background:linear-gradient(135deg,#111827,#496987 58%,#8aa6bd);color:#fff;padding:42px 28px;border-radius:8px;text-shadow:0 1px 4px #000}',
  },
  {
    id: 'Modern', labelKey: 'books.themes.modern', preview: { background: '#f7f9fc', foreground: '#172033', accent: '#356aa0' },
    css: 'body{background:#f7f9fc;color:#172033} h1{font-weight:750;letter-spacing:-.03em} h2{color:#285d91;border-bottom:4px solid #7ca4ca} th{color:#285d91} .book-title-page{border-inline-start:10px solid #356aa0;padding-inline-start:22px}',
  },
  {
    id: 'Magenta', labelKey: 'books.themes.magenta', preview: { background: '#fff4fb', foreground: '#481037', accent: '#b11978' },
    css: 'body{background:#fff4fb;color:#481037} h1,h2,h3{color:#8f145f} h2{border-color:#d46aa8} .book-title-page{background:linear-gradient(140deg,#6d0f49,#bd2b82);color:#fff;padding:28px;border-radius:8px}',
  },
  {
    id: 'Pure', labelKey: 'books.themes.pure', preview: { background: '#ffffff', foreground: '#252525', accent: '#a6a6a6' },
    css: 'body{background:#fff;color:#252525} h1{font-weight:500;letter-spacing:.04em} h2{font-weight:500;border-bottom:1px solid #bbb} h3{font-weight:600} .book-title-page{text-align:center;padding-block:48px}',
  },
];

export const DEFAULT_BOOK_THEME_ID = 'Pure';

export function bookThemeFor(themeId) {
  return BOOK_THEME_PRESETS.find((theme) => theme.id === themeId) || BOOK_THEME_PRESETS.find((theme) => theme.id === DEFAULT_BOOK_THEME_ID);
}

// New-book templates (#41) — preset section lists for common book types.
export const BOOK_TEMPLATES = [
  { id: 'blank', labelKey: 'books.templates.blank', sections: [{ kind: 'cover', text: 'My Family Book' }] },
  { id: 'ancestor', labelKey: 'books.templates.ancestor', sections: [
    { kind: 'cover', text: 'Ancestors' },
    { kind: 'toc' },
    { kind: 'ahnentafel-report', generations: 6 },
    { kind: 'ancestor-narrative', generations: 5 },
    { kind: 'bibliography' },
  ] },
  { id: 'descendant', labelKey: 'books.templates.descendant', sections: [
    { kind: 'cover', text: 'Descendants' },
    { kind: 'toc' },
    { kind: 'register-report', generations: 4 },
    { kind: 'descendant-narrative', generations: 4 },
    { kind: 'bibliography' },
  ] },
  { id: 'family', labelKey: 'books.templates.family', sections: [
    { kind: 'cover', text: 'Our Family' },
    { kind: 'toc' },
    { kind: 'family-group-sheet' },
    { kind: 'persons-list' },
    { kind: 'media-gallery' },
    { kind: 'bibliography' },
  ] },
];

export function bookFromTemplate(templateId, title, outputLanguage = 'en') {
  const template = BOOK_TEMPLATES.find((t) => t.id === templateId) || BOOK_TEMPLATES[0];
  const resolvedTitle = title || 'My Family Book';
  return {
    id: newBookId(),
    title: resolvedTitle,
    themeId: DEFAULT_BOOK_THEME_ID,
    outputLanguage,
    sections: template.sections.map((section) => section.kind === 'cover'
      ? { ...section, text: resolvedTitle }
      : { ...section }),
    presentationSettings: normalizeBookPresentationSettings({}),
  };
}

export const ASSISTANT_BOOK_TYPES = [
  { id: 'person', labelKey: 'books.assistant.types.person' },
  { id: 'family', labelKey: 'books.assistant.types.family' },
  { id: 'ancestor', labelKey: 'books.assistant.types.ancestor' },
  { id: 'descendant', labelKey: 'books.assistant.types.descendant' },
  { id: 'empty', labelKey: 'books.assistant.types.empty' },
];

/** Build the initial section plan used by the New Book Assistant. */
export function buildAssistantSectionPlan(options = {}) {
  const type = ASSISTANT_BOOK_TYPES.some((entry) => entry.id === options.bookType) ? options.bookType : 'person';
  const targetRecordName = options.targetPersonId || '';
  const common = {
    targetRecordName,
    targetFamilyRecordName: options.targetFamilyId || '',
    scope: options.scope || (type === 'ancestor' ? 'ancestors' : type === 'descendant' ? 'descendants' : 'relatives'),
    sort: options.sort || 'name',
    personFilter: 'all',
    includeSources: options.includeSources !== false,
    includeMedia: options.includeMedia !== false,
    includeNotes: options.includeNotes !== false,
    includePrivate: false,
  };
  const cover = { kind: 'cover', text: options.title || 'My Family Book', subtitle: options.subtitle || '', author: options.author || '', date: options.date || '' };
  if (type === 'empty') return [cover, { kind: 'toc', tocStyle: 'numbered' }];
  const sections = [cover, { kind: 'toc', tocStyle: 'numbered' }];
  if (type === 'person') sections.push({ kind: 'person-summary', ...common }, { kind: 'family-group-sheet', ...common });
  if (type === 'family') sections.push({ kind: 'family-group-sheet', ...common }, { kind: 'persons-list', ...common, scope: 'family' });
  if (type === 'ancestor') sections.push(
    { kind: 'ahnentafel-report', ...common, generations: clampGenerations(options.generationsUp, 6) },
    { kind: 'ancestor-narrative', ...common, generations: clampGenerations(options.generationsUp, 5) },
  );
  if (type === 'descendant') sections.push(
    { kind: 'register-report', ...common, generations: clampGenerations(options.generationsDown, 4) },
    { kind: 'descendant-narrative', ...common, generations: clampGenerations(options.generationsDown, 4) },
  );
  if (options.includeMedia !== false) sections.push({ kind: 'media-gallery', ...common });
  if (options.includeSources !== false) sections.push({ kind: 'bibliography', ...common });
  return sections;
}

export function bookFromAssistant(options = {}) {
  return {
    id: newBookId(),
    title: options.title || 'My Family Book',
    bookType: options.bookType || 'person',
    outputLanguage: options.outputLanguage || 'en',
    themeId: bookThemeFor(options.themeId)?.id || DEFAULT_BOOK_THEME_ID,
    assistantScope: {
      generationsUp: clampGenerations(options.generationsUp, 5),
      generationsDown: clampGenerations(options.generationsDown, 4),
      includeSources: options.includeSources !== false,
      includeMedia: options.includeMedia !== false,
    },
    sections: buildAssistantSectionPlan(options),
    presentationSettings: normalizeBookPresentationSettings({}),
  };
}

export function bookEditSignature(book) {
  const { savedAt: _savedAt, ...editable } = book || {};
  return JSON.stringify(normalizeSignatureValue(editable));
}

function normalizeSignatureValue(value) {
  if (Array.isArray(value)) return value.map(normalizeSignatureValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = normalizeSignatureValue(value[key]);
    return result;
  }, {});
}

function clampGenerations(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.min(12, Math.round(number))) : fallback;
}

export function normalizeBookPresentationSettings(settings = {}) {
  return normalizePresentationSettings({
    ...(settings || {}),
    pageStyle: {
      paginate: true,
      ...(settings?.pageStyle || {}),
    },
  });
}

/**
 * Walk a book document and collect structural issues without compiling it.
 * Returns `{ errors, warnings }` where errors block export.
 */
export async function validateBook(book) {
  const errors = [];
  const warnings = [];
  const t = (key, params = {}) => translate(key, params, { localization: getCurrentLocalization() });
  let savedReports = null;
  let savedCharts = null;
  if (!book || !Array.isArray(book.sections) || book.sections.length === 0) {
    errors.push({ sectionIndex: -1, message: t('books.validation.noSections') });
    return { errors, warnings };
  }

  const db = getAppDataClient().records;
  const existsCache = new Map();
  const exists = async (recordName) => {
    if (!recordName) return false;
    if (existsCache.has(recordName)) return existsCache.get(recordName);
    const record = await db.get(recordName);
    const value = !!record;
    existsCache.set(recordName, value);
    return value;
  };

  for (let i = 0; i < book.sections.length; i++) {
    const section = book.sections[i];
    const kind = section?.kind;
    const def = SECTION_KINDS.find((s) => s.id === kind);
    if (!def) {
      errors.push({ sectionIndex: i, message: t('books.validation.unknownKind', { kind }) });
      continue;
    }
    const sectionLabel = t(def.labelKey);
    if (def.needsPerson) {
      if (!section.targetRecordName) {
        errors.push({ sectionIndex: i, message: t('books.validation.noPerson', { section: sectionLabel }) });
      } else if (!(await exists(section.targetRecordName))) {
        errors.push({ sectionIndex: i, message: t('books.validation.personMissing', { section: sectionLabel, person: section.targetRecordName }) });
      }
    }
    if (def.needsGenerations) {
      const g = Number(section.generations);
      if (!Number.isFinite(g) || g <= 0) warnings.push({ sectionIndex: i, message: t('books.validation.defaultGenerations', { section: sectionLabel }) });
      else if (g > 12) warnings.push({ sectionIndex: i, message: t('books.validation.longReport', { section: sectionLabel, count: g }) });
    }
    if (def.needsGroup) {
      if (!section.groupRecordName) errors.push({ sectionIndex: i, message: t('books.validation.noGroup', { section: sectionLabel }) });
      else if (!(await exists(section.groupRecordName))) errors.push({ sectionIndex: i, message: t('books.validation.groupMissing', { section: sectionLabel }) });
    }
    if (def.needsSource) {
      if (!section.sourceRecordName) errors.push({ sectionIndex: i, message: t('books.validation.noSource', { section: sectionLabel }) });
      else if (!(await exists(section.sourceRecordName))) errors.push({ sectionIndex: i, message: t('books.validation.sourceMissing', { section: sectionLabel }) });
    }
    if (def.needsMedia) {
      if (!section.targetRecordName) errors.push({ sectionIndex: i, message: t('books.validation.noMedia', { section: sectionLabel }) });
      else if (!(await exists(section.targetRecordName))) errors.push({ sectionIndex: i, message: t('books.validation.mediaMissing', { section: sectionLabel }) });
    }
    if (kind === 'saved-report' && !section.savedReportId) {
      errors.push({ sectionIndex: i, message: t('books.validation.noSavedReport') });
    } else if (kind === 'saved-report') {
      savedReports ??= await listSavedReports();
      if (!savedReports.some((report) => report.id === section.savedReportId)) {
        errors.push({ sectionIndex: i, message: t('books.validation.savedReportMissing') });
      }
    }
    if (kind === 'saved-chart' && !section.savedChartId) {
      errors.push({ sectionIndex: i, message: t('books.validation.noSavedChart') });
    } else if (kind === 'saved-chart') {
      savedCharts ??= await listChartDocuments();
      if (!savedCharts.some((chart) => chart.id === section.savedChartId)) {
        errors.push({ sectionIndex: i, message: t('books.validation.savedChartMissing') });
      }
    }
    if (kind === 'cover' || kind === 'title' || kind === 'chapter' || kind === 'custom-page') {
      if (!(section.text || '').trim()) warnings.push({ sectionIndex: i, message: t('books.validation.emptyTitle', { section: sectionLabel }) });
    }
  }

  const tocCount = book.sections.filter((s) => s?.kind === 'toc').length;
  if (tocCount > 1) warnings.push({ sectionIndex: -1, message: t('books.validation.multipleToc', { count: tocCount }) });
  return { errors, warnings };
}

export function newBookId() {
  return generateId('book');
}

export async function listBooks() {
  const db = getAppDataClient().meta;
  const list = await db.get(META_KEY);
  return Array.isArray(list) ? list : [];
}

export async function saveBook(book) {
  const db = getAppDataClient().meta;
  const list = await listBooks();
  const idx = list.findIndex((b) => b.id === book.id);
  const stamped = { ...book, savedAt: Date.now() };
  if (idx >= 0) list[idx] = stamped;
  else list.push(stamped);
  await db.set(META_KEY, list);
  return stamped;
}

export async function deleteBook(id) {
  const db = getAppDataClient().meta;
  const list = await listBooks();
  await db.set(META_KEY, list.filter((b) => b.id !== id));
}

/**
 * Compile a book into a single report AST, inserting page breaks between sections.
 */
export async function compileBook(book) {
  const compiled = emptyReport(book.title || 'Untitled Book');
  const presentationSettings = normalizeBookPresentationSettings(book.presentationSettings);
  compiled.pageStyle = presentationSettings.pageStyle;
  compiled.bookTheme = bookThemeFor(book.themeId);
  compiled.outputLanguage = book.outputLanguage || 'en';
  compiled.localization = resolveLocalization({ locale: compiled.outputLanguage });
  const t = (key, params = {}) => translate(key, params, { localization: compiled.localization });
  const paginateSections = presentationSettings.pageStyle.paginate;
  const tocEntries = []; // collected as we compile so TOC placeholder can materialize
  const author = await safeGetAuthorInfo();
  // Attach author info on the compiled AST so renderers (HTML/PDF) can stamp a
  // single credit line on the document footer.
  if (author) compiled.author = author;

  for (let i = 0; i < (book.sections || []).length; i++) {
    const s = book.sections[i];
    const sectionBlocks = await sectionToBlocks(s, author, t);
    // Renderer-only metadata stays non-enumerable so the public report AST
    // remains backward compatible for text/CSV/RTF exporters and consumers.
    sectionBlocks.forEach((entry) => Object.defineProperty(entry, 'bookSectionKind', {
      value: s.kind,
      enumerable: false,
      configurable: true,
    }));
    // Record TOC entry for the first title in the section
    const firstTitle = sectionBlocks.find((b) => b.kind === 'title');
    if (firstTitle && s.kind !== 'toc') {
      tocEntries.push({ text: firstTitle.text, index: i + 1 });
    }
    if (i > 0 && paginateSections) compiled.blocks.push(block.pageBreak());
    compiled.blocks.push(...sectionBlocks);
  }

  // Materialize any TOC placeholders
  compiled.blocks = compiled.blocks.map((b) =>
    b.kind === '__toc_placeholder__' ? materializeToc(tocEntries, b.tocStyle, t) : b
  );
  // Flatten the materialized TOC blocks
  const flat = [];
  for (const b of compiled.blocks) {
    if (Array.isArray(b)) flat.push(...b);
    else flat.push(b);
  }
  compiled.blocks = flat;
  return compiled;
}

function materializeToc(entries, style = 'numbered', t = (key) => key) {
  const items = entries.map((e) => (style === 'plain' ? e.text : `${e.index}. ${e.text}`));
  return [
    block.title(t('books.sections.toc'), 2),
    style === 'compact' ? block.paragraph(items.join(' · ')) : block.list(items),
  ];
}

export function bookSectionReportOptions(section = {}) {
  const sortBy = section.sort === 'birth-asc' || section.sort === 'birth-desc'
    ? 'birth'
    : section.sort === 'date' ? 'date' : 'name';
  return {
    ...(section.config || {}),
    scope: section.scope || 'all',
    targetRecordName: section.targetRecordName || '',
    targetFamilyRecordName: section.targetFamilyRecordName || '',
    personFilter: section.personFilter || 'all',
    sortBy,
    sortDescending: section.sort === 'birth-desc',
    appendCitations: section.includeSources !== false,
    includeSources: section.includeSources !== false,
    includeMedia: section.includeMedia !== false,
    includeNotes: section.includeNotes !== false,
    includePrivate: !!section.includePrivate,
  };
}

export function bookSectionPersonIds(section = {}, { families = [], childRelations = [] } = {}) {
  const scope = section.scope || 'all';
  if (scope === 'all') return null;
  const targetId = section.targetRecordName || '';
  if (scope === 'family') {
    const family = families.find((record) => record.recordName === section.targetFamilyRecordName);
    if (!family) return targetId ? [targetId] : [];
    const ids = new Set([readRef(family.fields?.man), readRef(family.fields?.woman)].filter(Boolean));
    for (const relation of childRelations) {
      if (readRef(relation.fields?.family) === family.recordName) ids.add(readRef(relation.fields?.child));
    }
    return [...ids].filter(Boolean);
  }
  if (!targetId) return [];
  if (scope === 'selected') return [targetId];

  const familyById = new Map(families.map((family) => [family.recordName, family]));
  const parentFamiliesByChild = new Map();
  const childrenByFamily = new Map();
  for (const relation of childRelations) {
    const familyId = readRef(relation.fields?.family);
    const childId = readRef(relation.fields?.child);
    if (!familyId || !childId) continue;
    if (!parentFamiliesByChild.has(childId)) parentFamiliesByChild.set(childId, []);
    parentFamiliesByChild.get(childId).push(familyId);
    if (!childrenByFamily.has(familyId)) childrenByFamily.set(familyId, []);
    childrenByFamily.get(familyId).push(childId);
  }
  const spouseFamiliesByPerson = new Map();
  for (const family of families) {
    for (const personId of [readRef(family.fields?.man), readRef(family.fields?.woman)].filter(Boolean)) {
      if (!spouseFamiliesByPerson.has(personId)) spouseFamiliesByPerson.set(personId, []);
      spouseFamiliesByPerson.get(personId).push(family.recordName);
    }
  }
  const result = new Set([targetId]);
  const queue = [targetId];
  while (queue.length) {
    const personId = queue.shift();
    const next = [];
    if (scope === 'ancestors' || scope === 'relatives') {
      for (const familyId of parentFamiliesByChild.get(personId) || []) {
        const family = familyById.get(familyId);
        next.push(readRef(family?.fields?.man), readRef(family?.fields?.woman));
        if (scope === 'relatives') next.push(...(childrenByFamily.get(familyId) || []));
      }
    }
    if (scope === 'descendants' || scope === 'relatives') {
      for (const familyId of spouseFamiliesByPerson.get(personId) || []) {
        const family = familyById.get(familyId);
        if (scope === 'relatives') next.push(readRef(family?.fields?.man), readRef(family?.fields?.woman));
        next.push(...(childrenByFamily.get(familyId) || []));
      }
    }
    for (const nextId of next.filter(Boolean)) {
      if (result.has(nextId)) continue;
      result.add(nextId);
      queue.push(nextId);
    }
  }
  return [...result];
}

async function resolveBookSectionPersonIds(section) {
  if (!section.scope || section.scope === 'all') return null;
  const db = getAppDataClient().records;
  const [{ records: families }, { records: childRelations }] = await Promise.all([
    db.query('Family', { limit: 100000 }),
    db.query('ChildRelation', { limit: 100000 }),
  ]);
  return bookSectionPersonIds(section, { families, childRelations });
}

function localizedReportBlocks(report, t) {
  return localizeReportAst(report, t).blocks || [];
}

async function sectionToBlocks(section, author = null, t = null) {
  const options = bookSectionReportOptions(section);
  switch (section.kind) {
    case 'cover':
    case 'title':
      return buildTitlePage(section, author);
    case 'chapter':
      return buildChapterBlocks(section);
    case 'custom-page':
      return [
        section.text ? block.title(section.text, 2) : null,
        section.body ? block.paragraph(section.body) : null,
        section.note ? block.paragraph(section.note) : null,
      ].filter(Boolean);
    case 'toc':
      // Placeholder — materialized after all sections compile so page numbers are consistent.
      return [{ kind: '__toc_placeholder__', tocStyle: section.tocStyle || 'numbered' }];
    case 'person-summary': {
      const r = await buildPersonSummary(section.targetRecordName, options);
      return localizedReportBlocks(r, t);
    }
    case 'ancestor-narrative': {
      const r = await buildAncestorNarrative(section.targetRecordName, section.generations || 5);
      return localizedReportBlocks(r, t);
    }
    case 'descendant-narrative': {
      const r = await buildDescendantNarrative(section.targetRecordName, section.generations || 4);
      return localizedReportBlocks(r, t);
    }
    case 'narrative-report': {
      const r = await buildNarrativeReport(section.targetRecordName, section.generations || 4, options);
      return localizedReportBlocks(r, t);
    }
    case 'ahnentafel-report': {
      const r = await buildAhnentafelReport(section.targetRecordName, section.generations || 6);
      return localizedReportBlocks(r, t);
    }
    case 'register-report': {
      const r = await buildRegisterReport(section.targetRecordName, section.generations || 4);
      return localizedReportBlocks(r, t);
    }
    case 'descendancy-report': {
      const r = await buildDescendancyReport(section.targetRecordName, section.generations || 5, options);
      return localizedReportBlocks(r, t);
    }
    case 'family-group-sheet': {
      const r = await buildFamilyGroupSheet(section.targetRecordName, options);
      return localizedReportBlocks(r, t);
    }
    case 'person-group':
      return localizedReportBlocks({ blocks: await buildPersonGroupInsert(section.groupRecordName, options) }, t);
    case 'source-insert':
      return localizedReportBlocks({ blocks: await buildSourceInsert(section.sourceRecordName) }, t);
    case 'persons-list': {
      const personIds = await resolveBookSectionPersonIds(section);
      const r = await buildPersonsList({ ...options, ...(personIds ? { personIds } : {}) });
      return localizedReportBlocks(r, t);
    }
    case 'places-list': {
      const r = await buildPlacesList(options);
      return localizedReportBlocks(r, t);
    }
    case 'sources-list': {
      const r = await buildSourcesList(options);
      return localizedReportBlocks(r, t);
    }
    case 'bibliography':
      return localizedReportBlocks({ blocks: await buildBibliographyInsert(section.config) }, t);
    case 'footnotes':
      return localizedReportBlocks({ blocks: await buildFootnotesInsert(section.config) }, t);
    case 'media-gallery': {
      const r = await buildMediaGalleryReport(options);
      return localizedReportBlocks(r, t);
    }
    case 'media-page':
      return localizedReportBlocks({ blocks: await buildMediaPageInsert(section.targetRecordName, section.caption) }, t);
    case 'saved-report':
      return localizedReportBlocks({ blocks: await buildSavedReportInsert(section.savedReportId) }, t);
    case 'saved-chart':
      return localizedReportBlocks({ blocks: await buildSavedChartInsert(section.savedChartId) }, t);
    default:
      return [block.paragraph(`Unsupported section: ${section.kind}`)];
  }
}

function buildChapterBlocks(section) {
  const chapterType = section.chapterType || 'content';
  const chapterNumber = section.chapterNumber ? `${section.chapterNumber}. ` : '';
  const label = chapterType === 'preface'
    ? 'Preface'
    : chapterType === 'appendix'
      ? 'Appendix'
      : 'Chapter';
  const title = section.text || label;
  const heading = chapterNumber && chapterType === 'content' ? `${chapterNumber}${title}` : title;
  return [
    block.title(heading, 1),
    section.subtitle ? block.paragraph(section.subtitle) : null,
    section.note ? block.paragraph(section.note) : null,
  ].filter(Boolean);
}

async function buildSavedReportInsert(savedReportId) {
  if (!savedReportId) return [block.paragraph('Saved report embed missing savedReportId.')];
  const saved = (await listSavedReports()).find((r) => r.id === savedReportId);
  if (!saved) return [block.paragraph(`Saved report not found: ${savedReportId}.`)];
  const builderFn = resolveReportBuilder(saved.builderId);
  if (!builderFn) return [block.paragraph(`Unsupported saved-report builder: ${saved.builderId}.`)];
  try {
    const args = argsForSavedReport(saved);
    const report = await builderFn(...args);
    const out = [];
    if (saved.name) out.push(block.title(saved.name, 2));
    if (Array.isArray(report?.blocks)) out.push(...report.blocks);
    return out;
  } catch (error) {
    return [block.paragraph(`Saved report failed to build: ${error?.message || error}.`)];
  }
}

function resolveReportBuilder(builderId) {
  switch (builderId) {
    case 'person-summary': return buildPersonSummary;
    case 'ancestor-narrative': return buildAncestorNarrative;
    case 'descendant-narrative': return buildDescendantNarrative;
    case 'narrative-report': return buildNarrativeReport;
    case 'ahnentafel-report': return buildAhnentafelReport;
    case 'register-report': return buildRegisterReport;
    case 'descendancy-report': return buildDescendancyReport;
    case 'family-group-sheet': return buildFamilyGroupSheet;
    case 'persons-list': return buildPersonsList;
    case 'places-list': return buildPlacesList;
    case 'sources-list': return buildSourcesList;
    case 'media-gallery': return buildMediaGalleryReport;
    default: return null;
  }
}

function argsForSavedReport(saved) {
  const gens = Number(saved.options?.generations);
  if (saved.targetRecordName && Number.isFinite(gens)) return [saved.targetRecordName, gens];
  if (saved.targetRecordName) return [saved.targetRecordName];
  return [];
}

async function buildSavedChartInsert(savedChartId) {
  if (!savedChartId) return [block.paragraph('Saved chart embed missing savedChartId.')];
  const doc = (await listChartDocuments()).find((d) => d.id === savedChartId);
  if (!doc) return [block.paragraph(`Saved chart not found: ${savedChartId}.`)];
  // Books render to HTML/text/PDF, not SVG — so the embed captures the chart's
  // metadata rather than a rasterized image. Callers that want an inline
  // chart image should export the chart separately and insert it via an image
  // overlay or future media-gallery entry.
  const out = [];
  out.push(block.title(doc.name || 'Saved Chart', 2));
  const details = [
    doc.chartType && `Type: ${doc.chartType}`,
    doc.roots?.primaryPersonId && `Subject: ${doc.roots.primaryPersonId}`,
    doc.roots?.secondaryPersonId && `Partner/pair: ${doc.roots.secondaryPersonId}`,
    doc.builderConfig?.common?.generations && `Generations: ${doc.builderConfig.common.generations}`,
    doc.compositorConfig?.themeId && `Theme: ${doc.compositorConfig.themeId}`,
  ].filter(Boolean);
  if (details.length > 0) out.push(block.list(details));
  if (doc.pageSetup?.note) out.push(block.paragraph(doc.pageSetup.note));
  return out;
}

async function buildPersonGroupInsert(groupRecordName) {
  const db = getAppDataClient().records;
  const group = groupRecordName ? await db.get(groupRecordName) : null;
  if (!group) return [block.title('Person Group', 2), block.paragraph('No group selected.')];
  const rels = await db.query('PersonGroupRelation', { referenceField: 'personGroup', referenceValue: group.recordName, limit: 100000 });
  const people = [];
  for (const rel of rels.records) {
    const person = await db.get(readRef(rel.fields?.person));
    const summary = personSummary(person);
    if (summary) people.push(summary);
  }
  people.sort((a, b) => compareStrings(a.fullName, b.fullName));
  return [
    block.title(readField(group, ['name', 'title'], 'Person Group'), 2),
    readField(group, ['description', 'userDescription'], '') ? block.paragraph(readField(group, ['description', 'userDescription'], '')) : null,
    people.length
      ? block.table(['Name', 'Born', 'Died'], people.map((person) => [person.fullName, person.birthDate || '', person.deathDate || '']))
      : block.paragraph('No members recorded.'),
  ].filter(Boolean);
}

function buildTitlePage(section, author) {
  const preset = section.titlePreset || DEFAULT_TITLE_PAGE_PRESET;
  const out = [];
  const effectiveAuthor = section.author || author?.authorName || '';
  const effectivePublisher = section.publisher || author?.organization || '';
  const title = section.text || 'Untitled';
  const subtitle = section.subtitle || '';
  const date = section.date || '';
  const image = section.imageCaption || section.image || '';
  const crest = section.crestCaption || (author?.crest ? 'Family Crest' : '');

  const metadata = [
    effectiveAuthor && `Author: ${effectiveAuthor}`,
    date && `Date: ${date}`,
    effectivePublisher && `Publisher: ${effectivePublisher}`,
    section.place && `Place: ${section.place}`,
  ].filter(Boolean);

  const emit = (tokens) => {
    for (const token of tokens) {
      if (token === 'Title') out.push(block.title(title, 1));
      else if (token === 'SubTitle' && subtitle) out.push(block.paragraph(subtitle));
      else if (token === 'Image') {
        // Real image when a data URL is supplied (#85), else the caption placeholder.
        if (section.imageDataUrl) out.push(block.image(section.imageDataUrl, image || ''));
        else if (image) out.push(block.paragraph(`[Image: ${image}]`));
      } else if (token === 'FamilyCrest') {
        if (section.crestDataUrl || author?.crestDataUrl) out.push(block.image(section.crestDataUrl || author.crestDataUrl, crest || 'Family Crest'));
        else if (crest) out.push(block.paragraph(`[Family Crest: ${crest}]`));
      } else if (token === 'Metadata' && metadata.length > 0) out.push(block.list(metadata));
    }
  };

  switch (preset) {
    case 'title-subtitle-image-author-date':
      emit(['Title', 'SubTitle', 'Image', 'Metadata']); break;
    case 'title-subtitle-crest-author-date':
      emit(['Title', 'SubTitle', 'FamilyCrest', 'Metadata']); break;
    case 'image-title-subtitle-crest-author-date':
      emit(['Image', 'Title', 'SubTitle', 'FamilyCrest', 'Metadata']); break;
    case 'crest-title-subtitle-author-date':
      emit(['FamilyCrest', 'Title', 'SubTitle', 'Metadata']); break;
    case 'title-subtitle-author-date':
    default:
      emit(['Title', 'SubTitle', 'Metadata']); break;
  }
  if (section.note) out.push(block.paragraph(section.note));
  if (section.kind === 'cover' && author) {
    const colophon = [author.email, author.website, author.copyright].filter(Boolean);
    if (colophon.length > 0) out.push(block.paragraph(colophon.join(' · ')));
  }
  return out;
}

async function buildBibliographyInsert(config) {
  const db = getAppDataClient().records;
  const { records } = await db.query('Source', { limit: 100000 });
  const sorted = [...records].sort((a, b) => compareStrings(
    readField(a, ['author', 'title'], ''),
    readField(b, ['author', 'title'], ''),
  ));
  const baseConfig = { ...DEFAULT_LONG_CITATION, ...(config || {}) };
  const caches = { relsByTemplate: new Map() };
  const entries = [];
  for (const source of sorted) {
    const text = await resolveTemplatedCitation(db, source, CITATION_MODE.LONG, baseConfig, caches);
    if (text) entries.push(text);
  }
  const out = [block.title('Bibliography', 2)];
  if (entries.length === 0) out.push(block.paragraph('No sources recorded.'));
  else out.push(block.list(entries));
  return out;
}

async function buildFootnotesInsert(config) {
  const db = getAppDataClient().records;
  const { records } = await db.query('Source', { limit: 100000 });
  const sorted = [...records].sort((a, b) => compareStrings(
    readField(a, ['title'], ''),
    readField(b, ['title'], ''),
  ));
  const cfg = { ...DEFAULT_NORMAL_CITATION, ...(config || {}) };
  const caches = { relsByTemplate: new Map() };
  const entries = [];
  for (let index = 0; index < sorted.length; index++) {
    const text = await resolveTemplatedCitation(db, sorted[index], CITATION_MODE.NORMAL, cfg, caches);
    if (text) entries.push(`${entries.length + 1}. ${text}`);
  }
  const out = [block.title('Footnotes', 2)];
  if (entries.length === 0) out.push(block.paragraph('No sources recorded.'));
  else out.push(block.list(entries));
  return out;
}

async function buildMediaPageInsert(mediaRecordName, caption) {
  const { records: db, assets } = getAppDataClient();
  const media = mediaRecordName ? await db.get(mediaRecordName) : null;
  if (!media) return [block.paragraph('Media not found.')];
  const ids = media.fields?.assetIds?.value || [];
  let asset = ids.length ? await assets.get(ids[0]) : null;
  if (!asset && assets.listForRecord) {
    const list = await assets.listForRecord(media.recordName);
    asset = (list || [])[0] || null;
  }
  const title = caption || media.fields?.caption?.value || media.fields?.filename?.value || media.fields?.fileName?.value || 'Media';
  const blocks = [block.title(title, 2)];
  if (asset?.dataBase64) {
    blocks.push(block.image(`data:${asset.mimeType || 'image/png'};base64,${asset.dataBase64}`, caption || media.fields?.caption?.value || ''));
  } else {
    blocks.push(block.paragraph(media.fields?.url?.value || 'No image data available for this media record.'));
  }
  return blocks;
}

async function buildSourceInsert(sourceRecordName) {
  const db = getAppDataClient().records;
  const source = sourceRecordName ? await db.get(sourceRecordName) : null;
  if (!source) return [block.title('Source', 2), block.paragraph('No source selected.')];
  const summary = sourceSummary(source);
  const rows = [
    ['Title', summary?.title || source.recordName],
    ['Date', summary?.date || ''],
    ['Repository', readField(source, ['repositoryName'], '')],
    ['Reference', readField(source, ['sourceReferenceNumber', 'referenceNumber'], '')],
  ].filter((row) => row[1]);
  const out = [block.title(summary?.title || source.recordName, 2)];
  if (rows.length) out.push(block.table(['Field', 'Value'], rows));
  if (summary?.text) out.push(block.paragraph(summary.text));
  return out;
}

export async function downloadBookHTML(book, { filenameBase } = {}) {
  const compiled = await compileBook(book);
  const blob = new Blob([renderBookHTML(book, compiled)], { type: 'text/html' });
  downloadBlob(blob, `${safeFilename(filenameBase || book.title || compiled.title)}.html`);
}

export function renderBookHTML(book, compiled) {
  return renderHTML(compiled, {
    theme: bookThemeFor(book?.themeId),
    localization: compiled?.localization || resolveLocalization({ locale: book?.outputLanguage || 'en' }),
  });
}

export async function downloadBookBundle(book, { includeWebsite = true, siteOptions = {}, onProgress, signal } = {}) {
  if (signal?.aborted) throw new DOMException('Book bundle export canceled.', 'AbortError');
  const compiled = await compileBook(book);
  const zip = new JSZip();
  zip.file('book/index.html', renderBookHTML(book, compiled));
  zip.file('book/book.txt', renderText(compiled));
  zip.file('manifest.json', JSON.stringify({
    format: 'cloudtreeweb-book-bundle',
    title: book.title || compiled.title,
    theme: bookThemeFor(book.themeId)?.id,
    outputLanguage: book.outputLanguage || 'en',
    exportedAt: new Date().toISOString(),
    sections: (book.sections || []).map((section) => section.kind),
  }, null, 2));

  let websiteStats = null;
  if (includeWebsite) {
    const site = await buildSite({
      ...siteOptions,
      signal,
      onProgress: (update) => onProgress?.({ ...update, message: `Website: ${update.message}` }),
    });
    websiteStats = site.stats;
    const siteZip = await JSZip.loadAsync(site.blob);
    const entries = Object.values(siteZip.files);
    let copied = 0;
    for (const entry of entries) {
      if (signal?.aborted) throw new DOMException('Book bundle export canceled.', 'AbortError');
      if (entry.dir) continue;
      zip.file(`website/${entry.name}`, await entry.async('arraybuffer'));
      copied += 1;
      onProgress?.({ phase: 'bundle', completed: copied, total: entries.length, message: `Bundled website file ${formatInteger(copied)}.` });
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    onProgress?.({
      phase: 'zip',
      completed: Math.round(metadata.percent),
      total: 100,
      message: `Compressing book bundle (${Math.round(metadata.percent)}%).`,
    });
  });
  downloadBlob(blob, `${safeFilename(book.title || compiled.title || 'family-book')}-bundle.zip`);
  return {
    sections: (book.sections || []).length,
    website: websiteStats,
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

function safeFilename(value) {
  return String(value || 'book').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'book';
}

async function safeGetAuthorInfo() {
  try {
    return await getAuthorInfo();
  } catch {
    return null;
  }
}
