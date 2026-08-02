/**
 * Render a report AST to CSV — only table blocks emit rows; titles become
 * section headers in the first column.
 */
function csvEscape(v, delimiter) {
  const s = String(v ?? '');
  if (s.includes(delimiter) || /["\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function normalizeCSVOptions(options = {}) {
  return {
    delimiter: [',', ';', '\t'].includes(options.delimiter) ? options.delimiter : ',',
    newline: options.newline === '\r\n' ? '\r\n' : '\n',
    includeHeader: options.includeHeader !== false,
  };
}

export function renderCSV(report, options = {}) {
  const { delimiter, newline, includeHeader } = normalizeCSVOptions(options);
  const lines = [];
  let section = '';
  for (const b of report.blocks) {
    if (b.kind === 'title') {
      section = b.text;
      if (includeHeader) lines.push(csvEscape(`# ${section}`, delimiter));
    } else if (b.kind === 'paragraph') {
      lines.push(csvEscape(b.text, delimiter));
    } else if (b.kind === 'list') {
      for (const it of b.items) lines.push(csvEscape(it, delimiter));
    } else if (b.kind === 'table') {
      if (includeHeader) lines.push(b.columns.map((value) => csvEscape(value, delimiter)).join(delimiter));
      for (const r of b.rows) lines.push(r.map((value) => csvEscape(value, delimiter)).join(delimiter));
    }
  }
  return lines.join(newline);
}
