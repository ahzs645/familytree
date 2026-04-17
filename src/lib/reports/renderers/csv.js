/**
 * Render a report AST to CSV — only table blocks emit rows; titles become
 * section headers in the first column.
 */
function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function renderCSV(report) {
  const lines = [];
  let section = '';
  for (const b of report.blocks) {
    if (b.kind === 'title') {
      section = b.text;
      lines.push(csvEscape(`# ${section}`));
    } else if (b.kind === 'paragraph') {
      lines.push(csvEscape(b.text));
    } else if (b.kind === 'list') {
      for (const it of b.items) lines.push(csvEscape(it));
    } else if (b.kind === 'table') {
      lines.push(b.columns.map(csvEscape).join(','));
      for (const r of b.rows) lines.push(r.map(csvEscape).join(','));
    }
  }
  return lines.join('\n');
}
