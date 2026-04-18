function valueFor(row, column) {
  if (column.exportValue) return column.exportValue(row);
  if (column.sortValue) return column.sortValue(row);
  if (column.key) return row[column.key];
  return '';
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (!/[",\n\r]/.test(text)) return text;
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

export function downloadRowsAsCsv(filenameBase, rows, columns) {
  const exportable = columns.filter((column) => column.export !== false);
  const lines = [
    exportable.map((column) => escapeCsv(column.label || column.key)).join(','),
    ...rows.map((row) => exportable.map((column) => escapeCsv(valueFor(row, column))).join(',')),
  ];
  downloadText(`${filenameBase}.csv`, lines.join('\n'), 'text/csv');
}

export function downloadRowsAsJson(filenameBase, rows, columns) {
  const exportable = columns.filter((column) => column.export !== false);
  const data = rows.map((row) => Object.fromEntries(
    exportable.map((column) => [column.label || column.key, valueFor(row, column)])
  ));
  downloadText(`${filenameBase}.json`, JSON.stringify(data, null, 2), 'application/json');
}
