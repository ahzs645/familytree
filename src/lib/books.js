/**
 * Books — composable multi-section documents.
 *
 * A book is a list of sections. Each section produces report blocks that get
 * concatenated into a single AST for preview/export.
 *
 * Section kinds:
 *   - { kind: 'title', text, subtitle }            — custom title page
 *   - { kind: 'person-summary', targetRecordName }
 *   - { kind: 'ancestor-narrative', targetRecordName, generations }
 *   - { kind: 'descendant-narrative', targetRecordName, generations }
 *   - { kind: 'family-group-sheet', targetRecordName }
 *   - { kind: 'toc' }                              — placeholder; materialized on compile
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { block, emptyReport } from './reports/ast.js';
import {
  buildPersonSummary,
  buildAncestorNarrative,
  buildDescendantNarrative,
  buildFamilyGroupSheet,
} from './reports/builders.js';

const META_KEY = 'savedBooks';

export const SECTION_KINDS = [
  { id: 'title', label: 'Title Page' },
  { id: 'toc', label: 'Table of Contents' },
  { id: 'person-summary', label: 'Person Summary', needsPerson: true },
  { id: 'ancestor-narrative', label: 'Ancestor Narrative', needsPerson: true, needsGenerations: true },
  { id: 'descendant-narrative', label: 'Descendant Narrative', needsPerson: true, needsGenerations: true },
  { id: 'family-group-sheet', label: 'Family Group Sheet', needsPerson: true },
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
    b.kind === '__toc_placeholder__' ? materializeToc(tocEntries) : b
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

function materializeToc(entries) {
  return [
    block.title('Table of Contents', 2),
    block.list(entries.map((e) => `${e.index}. ${e.text}`)),
  ];
}

async function sectionToBlocks(section) {
  switch (section.kind) {
    case 'title': {
      const out = [];
      out.push(block.title(section.text || 'Untitled', 1));
      if (section.subtitle) out.push(block.paragraph(section.subtitle));
      return out;
    }
    case 'toc':
      // Placeholder — materialized after all sections compile so page numbers are consistent.
      return [{ kind: '__toc_placeholder__' }];
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
    case 'family-group-sheet': {
      const r = await buildFamilyGroupSheet(section.targetRecordName);
      return r.blocks;
    }
    default:
      return [block.paragraph(`Unsupported section: ${section.kind}`)];
  }
}
