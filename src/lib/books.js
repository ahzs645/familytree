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
import { getLocalDatabase } from './LocalDatabase.js';
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
import { buildSite } from './websiteExport.js';
import { compareStrings, formatInteger } from './i18n.js';
import { personSummary, sourceSummary } from '../models/index.js';

const META_KEY = 'savedBooks';

export const SECTION_KINDS = [
  { id: 'cover', label: 'Cover Page' },
  { id: 'title', label: 'Title Page' },
  { id: 'toc', label: 'Table of Contents' },
  { id: 'person-summary', label: 'Person Summary', needsPerson: true },
  { id: 'ancestor-narrative', label: 'Ancestor Narrative', needsPerson: true, needsGenerations: true },
  { id: 'descendant-narrative', label: 'Descendant Narrative', needsPerson: true, needsGenerations: true },
  { id: 'narrative-report', label: 'Narrative Report', needsPerson: true, needsGenerations: true },
  { id: 'ahnentafel-report', label: 'Ahnentafel Report', needsPerson: true, needsGenerations: true },
  { id: 'register-report', label: 'Register Report', needsPerson: true, needsGenerations: true },
  { id: 'descendancy-report', label: 'Descendancy Report', needsPerson: true, needsGenerations: true },
  { id: 'family-group-sheet', label: 'Family Group Sheet', needsPerson: true },
  { id: 'person-group', label: 'Person Group Insert', needsGroup: true },
  { id: 'source-insert', label: 'Source Insert', needsSource: true },
  { id: 'persons-list', label: 'Persons List' },
  { id: 'places-list', label: 'Places List' },
  { id: 'sources-list', label: 'Sources List' },
  { id: 'media-gallery', label: 'Media Gallery' },
];

export function newBookId() {
  return 'book-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

export async function listBooks() {
  const db = getLocalDatabase();
  const list = await db.getMeta(META_KEY);
  return Array.isArray(list) ? list : [];
}

export async function saveBook(book) {
  const db = getLocalDatabase();
  const list = await listBooks();
  const idx = list.findIndex((b) => b.id === book.id);
  const stamped = { ...book, savedAt: Date.now() };
  if (idx >= 0) list[idx] = stamped;
  else list.push(stamped);
  await db.setMeta(META_KEY, list);
  return stamped;
}

export async function deleteBook(id) {
  const db = getLocalDatabase();
  const list = await listBooks();
  await db.setMeta(META_KEY, list.filter((b) => b.id !== id));
}

/**
 * Compile a book into a single report AST, inserting page breaks between sections.
 */
export async function compileBook(book) {
  const compiled = emptyReport(book.title || 'Untitled Book');
  const tocEntries = []; // collected as we compile so TOC placeholder can materialize

  for (let i = 0; i < (book.sections || []).length; i++) {
    const s = book.sections[i];
    const sectionBlocks = await sectionToBlocks(s);
    // Record TOC entry for the first title in the section
    const firstTitle = sectionBlocks.find((b) => b.kind === 'title');
    if (firstTitle && s.kind !== 'toc') {
      tocEntries.push({ text: firstTitle.text, index: i + 1 });
    }
    if (i > 0) compiled.blocks.push(block.pageBreak());
    compiled.blocks.push(...sectionBlocks);
  }

  // Materialize any TOC placeholders
  compiled.blocks = compiled.blocks.map((b) =>
    b.kind === '__toc_placeholder__' ? materializeToc(tocEntries, b.tocStyle) : b
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

function materializeToc(entries, style = 'numbered') {
  const items = entries.map((e) => (style === 'plain' ? e.text : `${e.index}. ${e.text}`));
  return [
    block.title('Table of Contents', 2),
    style === 'compact' ? block.paragraph(items.join(' · ')) : block.list(items),
  ];
}

async function sectionToBlocks(section) {
  switch (section.kind) {
    case 'cover':
    case 'title': {
      const out = [];
      out.push(block.title(section.text || 'Untitled', 1));
      if (section.subtitle) out.push(block.paragraph(section.subtitle));
      const metadata = [
        section.author && `Author: ${section.author}`,
        section.date && `Date: ${section.date}`,
        section.publisher && `Publisher: ${section.publisher}`,
        section.place && `Place: ${section.place}`,
      ].filter(Boolean);
      if (metadata.length > 0) out.push(block.list(metadata));
      if (section.note) out.push(block.paragraph(section.note));
      return out;
    }
    case 'toc':
      // Placeholder — materialized after all sections compile so page numbers are consistent.
      return [{ kind: '__toc_placeholder__', tocStyle: section.tocStyle || 'numbered' }];
    case 'person-summary': {
      const r = await buildPersonSummary(section.targetRecordName);
      return r.blocks;
    }
    case 'ancestor-narrative': {
      const r = await buildAncestorNarrative(section.targetRecordName, section.generations || 5);
      return r.blocks;
    }
    case 'descendant-narrative': {
      const r = await buildDescendantNarrative(section.targetRecordName, section.generations || 4);
      return r.blocks;
    }
    case 'narrative-report': {
      const r = await buildNarrativeReport(section.targetRecordName, section.generations || 4);
      return r.blocks;
    }
    case 'ahnentafel-report': {
      const r = await buildAhnentafelReport(section.targetRecordName, section.generations || 6);
      return r.blocks;
    }
    case 'register-report': {
      const r = await buildRegisterReport(section.targetRecordName, section.generations || 4);
      return r.blocks;
    }
    case 'descendancy-report': {
      const r = await buildDescendancyReport(section.targetRecordName, section.generations || 5);
      return r.blocks;
    }
    case 'family-group-sheet': {
      const r = await buildFamilyGroupSheet(section.targetRecordName);
      return r.blocks;
    }
    case 'person-group':
      return buildPersonGroupInsert(section.groupRecordName);
    case 'source-insert':
      return buildSourceInsert(section.sourceRecordName);
    case 'persons-list': {
      const r = await buildPersonsList();
      return r.blocks;
    }
    case 'places-list': {
      const r = await buildPlacesList();
      return r.blocks;
    }
    case 'sources-list': {
      const r = await buildSourcesList();
      return r.blocks;
    }
    case 'media-gallery': {
      const r = await buildMediaGalleryReport();
      return r.blocks;
    }
    default:
      return [block.paragraph(`Unsupported section: ${section.kind}`)];
  }
}

async function buildPersonGroupInsert(groupRecordName) {
  const db = getLocalDatabase();
  const group = groupRecordName ? await db.getRecord(groupRecordName) : null;
  if (!group) return [block.title('Person Group', 2), block.paragraph('No group selected.')];
  const rels = await db.query('PersonGroupRelation', { referenceField: 'personGroup', referenceValue: group.recordName, limit: 100000 });
  const people = [];
  for (const rel of rels.records) {
    const person = await db.getRecord(readRef(rel.fields?.person));
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

async function buildSourceInsert(sourceRecordName) {
  const db = getLocalDatabase();
  const source = sourceRecordName ? await db.getRecord(sourceRecordName) : null;
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
  const blob = new Blob([renderHTML(compiled)], { type: 'text/html' });
  downloadBlob(blob, `${safeFilename(filenameBase || book.title || compiled.title)}.html`);
}

export async function openBookPDF(book) {
  const compiled = await compileBook(book);
  const html = renderHTML(compiled);
  const w = window.open('', '_blank');
  if (!w) throw new Error('Popup blocked. Allow popups to export as PDF.');
  w.document.write(html);
  w.document.close();
  w.onload = () => {
    w.focus();
    w.print();
  };
}

export async function downloadBookBundle(book, { includeWebsite = true, siteOptions = {}, onProgress, signal } = {}) {
  if (signal?.aborted) throw new DOMException('Book bundle export canceled.', 'AbortError');
  const compiled = await compileBook(book);
  const zip = new JSZip();
  zip.file('book/index.html', renderHTML(compiled));
  zip.file('book/book.txt', renderText(compiled));
  zip.file('manifest.json', JSON.stringify({
    format: 'cloudtreeweb-book-bundle',
    title: book.title || compiled.title,
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
