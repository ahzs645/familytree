/**
 * Renders a report AST to the DOM for live preview.
 * Mirrors the HTML exporter but inline-styled for the app shell.
 */
import React from 'react';
import { BdiText } from '../BdiText.jsx';

export function ReportPreview({ report }) {
  if (!report) return <div style={empty}>Configure a report to see the preview.</div>;
  const pageStyle = styleFor(report.pageStyle);
  return (
    <div style={{ ...page, ...pageStyle }}>
      {report.blocks.map((b, i) => <Block key={i} block={b} />)}
    </div>
  );
}

function Block({ block: b }) {
  switch (b.kind) {
    case 'title': {
      if (b.level === 1) return <h1 style={h1}><BdiText>{b.text}</BdiText></h1>;
      if (b.level === 2) return <h2 style={h2}><BdiText>{b.text}</BdiText></h2>;
      return <h3 style={h3}><BdiText>{b.text}</BdiText></h3>;
    }
    case 'paragraph':
      return <p style={p}><BdiText>{b.text}</BdiText></p>;
    case 'list':
      return (
        <ul style={ul}>
          {b.items.map((it, i) => <li key={i}><BdiText>{it}</BdiText></li>)}
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
              <tr key={i}>{r.map((c, j) => <td key={j} style={td}><BdiText>{c}</BdiText></td>)}</tr>
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
  textAlign: 'start',
};
const h1 = { fontSize: 28, margin: '0 0 10px', fontWeight: 700 };
const h2 = { fontSize: 20, margin: '24px 0 10px', fontWeight: 600, borderBottom: '1px solid #d4d7e0', paddingBottom: 4 };
const h3 = { fontSize: 16, margin: '18px 0 8px', fontWeight: 600 };
const p = { margin: '8px 0', fontSize: 14 };
const ul = { margin: '8px 0', paddingInlineStart: 22, fontSize: 14 };
const table = { width: '100%', borderCollapse: 'collapse', margin: '14px 0', fontSize: 13 };
const th = { textAlign: 'start', padding: '6px 8px', borderBottom: '1px solid #1a1d27', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3, color: '#5b6072', fontWeight: 600 };
const td = { padding: '6px 8px', borderBottom: '1px solid #e5e7ed' };
const pageBreak = { textAlign: 'center', color: '#aab', fontSize: 11, padding: '10px 0', borderTop: '1px dashed #aab', borderBottom: '1px dashed #aab', margin: '18px 0' };

function styleFor(pageStyle = {}) {
  const size = pageStyle.pageSize === 'a4'
    ? { width: 794, maxWidth: 'calc(100vw - 48px)' }
    : pageStyle.pageSize === 'legal'
      ? { width: pageStyle.orientation === 'landscape' ? 1344 : 816, maxWidth: 'calc(100vw - 48px)' }
      : { width: pageStyle.orientation === 'landscape' ? 1056 : 816, maxWidth: 'calc(100vw - 48px)' };
  const background = pageStyle.background === 'sepia'
    ? '#fbf6e8'
    : pageStyle.background === 'soft'
      ? '#f7f8fb'
      : '#fff';
  return {
    ...size,
    background,
    padding: Math.max(24, Math.min(96, pageStyle.margin || 48)),
  };
}

export default ReportPreview;
