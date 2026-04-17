/**
 * Render a report AST to RTF — minimal RTF 1.5 output with heading styles.
 * Targets broad compatibility (Word, TextEdit, LibreOffice).
 */
function escRtf(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, '\\line ')
    .replace(/[\u0080-\uFFFF]/g, (ch) => '\\u' + ch.charCodeAt(0) + '?');
}

export function renderRTF(report) {
  const out = [];
  out.push('{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Helvetica;}}');
  out.push('\\fs24 '); // 12pt default
  for (const b of report.blocks) {
    switch (b.kind) {
      case 'title': {
        const size = b.level === 1 ? 48 : b.level === 2 ? 32 : 28;
        out.push(`\\pard\\b\\fs${size} ${escRtf(b.text)}\\b0\\fs24\\par`);
        break;
      }
      case 'paragraph':
        out.push(`\\pard ${escRtf(b.text)}\\par`);
        break;
      case 'list':
        for (const it of b.items) out.push(`\\pard\\li360 \\bullet\\tab ${escRtf(it)}\\par`);
        break;
      case 'table': {
        // RTF tables are gnarly; fall back to tab-aligned rows for compatibility.
        out.push(`\\pard\\b ${b.columns.map(escRtf).join('\\tab ')}\\b0\\par`);
        for (const r of b.rows) out.push(`\\pard ${r.map(escRtf).join('\\tab ')}\\par`);
        break;
      }
      case 'pageBreak':
        out.push('\\page');
        break;
      case 'spacer':
        out.push('\\par');
        break;
    }
  }
  out.push('}');
  return out.join('\n');
}
