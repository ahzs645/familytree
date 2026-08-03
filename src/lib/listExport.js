import { getActiveExportDefaults } from './appPreferences.js';
import { renderCSV } from './reports/renderers/csv.js';

const SEPARATORS = { comma: ',', semicolon: ';', tab: '\t' };

function resolveSeparator(separator) {
  const raw = separator || getActiveExportDefaults().csvSeparator || ',';
  return SEPARATORS[raw] || raw;
}

function valueFor(row, column) {
  if (column.exportValue) return column.exportValue(row);
  if (column.sortValue) return column.sortValue(row);
  if (column.key) return row[column.key];
  return '';
}

function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

export function downloadRowsAsCsv(filenameBase, rows, columns, { separator } = {}) {
  const sep = resolveSeparator(separator);
  const isTab = sep === '\t';
  downloadText(`${filenameBase}.${isTab ? 'tsv' : 'csv'}`, rowsToCsv(rows, columns, { separator: sep }), isTab ? 'text/tab-separated-values' : 'text/csv');
}

/** Build entity-list CSV through the same AST renderer used by reports. */
export function rowsToCsv(rows, columns, { separator } = {}) {
  const exportable = columns.filter((column) => column.export !== false);
  return renderCSV({
    blocks: [{
      kind: 'table',
      columns: exportable.map((column) => column.label || column.key),
      rows: rows.map((row) => exportable.map((column) => valueFor(row, column))),
    }],
  }, { delimiter: resolveSeparator(separator), includeHeader: true });
}

export function downloadRowsAsJson(filenameBase, rows, columns) {
  const exportable = columns.filter((column) => column.export !== false);
  const data = rows.map((row) => Object.fromEntries(
    exportable.map((column) => [column.label || column.key, valueFor(row, column)])
  ));
  downloadText(`${filenameBase}.json`, JSON.stringify(data, null, 2), 'application/json');
}
