/**
 * Render a report AST to a standalone HTML document.
 */

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderBlock(b) {
  switch (b.kind) {
    case 'title': {
      const tag = b.level === 3 ? 'h3' : b.level === 2 ? 'h2' : 'h1';
      return `<${tag}>${esc(b.text)}</${tag}>`;
    }
    case 'paragraph':
      return `<p>${esc(b.text)}</p>`;
    case 'list':
      return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
    case 'table': {
      const head = `<thead><tr>${b.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>`;
      const body = `<tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      return `<table>${head}${body}</table>`;
    }
    case 'pageBreak':
      return `<div style="page-break-after:always"></div>`;
    case 'spacer':
      return `<div style="height:${Math.max(0, b.size || 12)}px"></div>`;
    default:
      return '';
  }
}

export function renderHTML(report, { theme } = {}) {
  const pageStyle = report.pageStyle || {};
  const pageBackground = pageStyle.background === 'sepia' ? '#fbf6e8' : pageStyle.background === 'soft' ? '#f7f8fb' : '#fff';
  const css = theme?.id === 'sepia'
    ? `body{background:${pageBackground};color:#3a2a14}`
    : `body{background:${pageBackground};color:#1a1d27}`;
  const pageSize = pageStyle.pageSize === 'a4' ? 'A4' : pageStyle.pageSize === 'legal' ? 'legal' : 'letter';
  const orientation = pageStyle.orientation === 'landscape' ? 'landscape' : 'portrait';
  const margin = Number.isFinite(pageStyle.margin) ? Math.max(24, Math.min(96, pageStyle.margin)) : 48;
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(report.title)}</title>
<style>
  ${css}
  @page{size:${pageSize} ${orientation};margin:${margin}px}
  body{font-family:-apple-system,system-ui,sans-serif;padding:${margin}px;max-width:${orientation === 'landscape' ? 1080 : 820}px;margin:0 auto;line-height:1.6}
  h1{font-size:28px;margin:0 0 10px}
  h2{font-size:20px;margin:24px 0 10px;border-bottom:1px solid currentColor;padding-bottom:4px;opacity:.85}
  h3{font-size:16px;margin:20px 0 8px}
  p{margin:8px 0}
  ul{margin:8px 0;padding-left:24px}
  table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid currentColor;opacity:.95}
  th{font-weight:600;opacity:.7;font-size:11px;text-transform:uppercase;letter-spacing:.3px}
  @media print{body{padding:0;background:#fff;color:#000}}
</style></head><body>
${report.blocks.map(renderBlock).join('\n')}
</body></html>`;
}
