/**
 * Renders a report AST to the DOM for live preview.
 * Mirrors the HTML exporter but inline-styled for the app shell.
 */
import React from 'react';

export function ReportPreview({ report }) {
  if (!report) return <div style={empty}>Configure a report to see the preview.</div>;
  return (
    <div style={page}>
      {report.blocks.map((b, i) => <Block key={i} block={b} />)}
    </div>
  );
}

function Block({ block: b }) {
  switch (b.kind) {
    case 'title': {
      if (b.level === 1) return <h1 style={h1}>{b.text}</h1>;
      if (b.level === 2) return <h2 style={h2}>{b.text}</h2>;
      return <h3 style={h3}>{b.text}</h3>;
    }
    case 'paragraph':
      return <p style={p}>{b.text}</p>;
    case 'list':
      return (
        <ul style={ul}>
          {b.items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      );
    case 'table':
      return (
        <table style={table}>
          <thead>
            <tr>{b.columns.map((c) => <th key={c} style={th}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {b.rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j} style={td}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      );
    case 'pageBreak':
      return <div style={pageBreak}>— page break —</div>;
    case 'spacer':
      return <div style={{ height: b.size || 12 }} />;
    default:
      return null;
  }
}

const empty = { padding: 48, color: 'hsl(var(--muted-foreground))', textAlign: 'center' };
// The report preview always renders as a paper page — white background and
// dark body text — regardless of the app theme, so it matches what HTML/PDF
// exports produce.
const page = {
  background: '#fff',
  color: '#1a1d27',
  margin: '20px auto',
  padding: 48,
  maxWidth: 820,
  borderRadius: 4,
  boxShadow: '0 2px 24px rgba(0,0,0,0.4)',
  lineHeight: 1.55,
};
const h1 = { fontSize: 28, margin: '0 0 10px', fontWeight: 700 };
const h2 = { fontSize: 20, margin: '24px 0 10px', fontWeight: 600, borderBottom: '1px solid #d4d7e0', paddingBottom: 4 };
const h3 = { fontSize: 16, margin: '18px 0 8px', fontWeight: 600 };
const p = { margin: '8px 0', fontSize: 14 };
const ul = { margin: '8px 0', paddingLeft: 22, fontSize: 14 };
const table = { width: '100%', borderCollapse: 'collapse', margin: '14px 0', fontSize: 13 };
const th = { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #1a1d27', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3, color: '#5b6072', fontWeight: 600 };
const td = { padding: '6px 8px', borderBottom: '1px solid #e5e7ed' };
const pageBreak = { textAlign: 'center', color: '#aab', fontSize: 11, padding: '10px 0', borderTop: '1px dashed #aab', borderBottom: '1px dashed #aab', margin: '18px 0' };

export default ReportPreview;
