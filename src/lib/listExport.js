import { getActiveExportDefaults } from './appPreferences.js';

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

function escapeCsv(value, separator = ',') {
  const text = String(value ?? '');
  if (!text.includes('"') && !text.includes('\n') && !text.includes('\r') && !text.includes(separator)) return text;
  return `"${text.replace(/"/g, '""')}"`;
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
  const exportable = columns.filter((column) => column.export !== false);
  const sep = resolveSeparator(separator);
  const lines = [
    exportable.map((column) => escapeCsv(column.label || column.key, sep)).join(sep),
    ...rows.map((row) => exportable.map((column) => escapeCsv(valueFor(row, column), sep)).join(sep)),
  ];
  const isTab = sep === '\t';
  downloadText(`${filenameBase}.${isTab ? 'tsv' : 'csv'}`, lines.join('\n'), isTab ? 'text/tab-separated-values' : 'text/csv');
}

export function downloadRowsAsJson(filenameBase, rows, columns) {
  const exportable = columns.filter((column) => column.export !== false);
  const data = rows.map((row) => Object.fromEntries(
    exportable.map((column) => [column.label || column.key, valueFor(row, column)])
  ));
  downloadText(`${filenameBase}.json`, JSON.stringify(data, null, 2), 'application/json');
}
