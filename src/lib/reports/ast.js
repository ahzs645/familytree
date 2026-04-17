/**
 * Report AST helpers. A report is an array of blocks, each block is one of:
 *   { kind: 'title', text, level }                // 1=H1 ... 3=H3
 *   { kind: 'paragraph', text }
 *   { kind: 'list', items: string[] }
 *   { kind: 'table', columns: string[], rows: string[][] }
 *   { kind: 'pageBreak' }
 *   { kind: 'spacer', size: number }
 *
 * Reports are plain data so exporters can transform them without touching DOM.
 */

export const block = {
  title: (text, level = 1) => ({ kind: 'title', text, level }),
  paragraph: (text) => ({ kind: 'paragraph', text }),
  list: (items) => ({ kind: 'list', items }),
  table: (columns, rows) => ({ kind: 'table', columns, rows }),
  pageBreak: () => ({ kind: 'pageBreak' }),
  spacer: (size = 12) => ({ kind: 'spacer', size }),
};

export function emptyReport(title) {
  return {
    title: title || 'Report',
    createdAt: Date.now(),
    blocks: [],
  };
}
