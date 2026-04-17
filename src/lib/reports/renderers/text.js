/**
 * Render a report AST to plain text.
 */
export function renderText(report) {
  const out = [];
  for (const b of report.blocks) {
    switch (b.kind) {
      case 'title':
        out.push('');
        out.push(b.text);
        out.push('='.repeat(Math.min(b.text.length, 60)).slice(0, b.level === 1 ? 60 : b.level === 2 ? 40 : 20));
        break;
      case 'paragraph':
        out.push(b.text);
        break;
      case 'list':
        for (const item of b.items) out.push('  - ' + item);
        break;
      case 'table': {
        const widths = b.columns.map((c, i) =>
          Math.max(c.length, ...b.rows.map((r) => String(r[i] ?? '').length))
        );
        out.push(b.columns.map((c, i) => c.padEnd(widths[i])).join('  '));
        out.push(widths.map((w) => '-'.repeat(w)).join('  '));
        for (const r of b.rows) {
          out.push(r.map((v, i) => String(v ?? '').padEnd(widths[i])).join('  '));
        }
        break;
      }
      case 'pageBreak':
        out.push('\n---\n');
        break;
      case 'spacer':
        out.push('');
        break;
    }
  }
  return out.join('\n');
}
