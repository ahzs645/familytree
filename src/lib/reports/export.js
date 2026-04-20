/**
 * Unified export: given a report AST and a format, produce a Blob the caller
 * can download. PDF export opens the rendered HTML in a new window and calls
 * `print()` — browsers let the user "Save as PDF" from the print dialog.
 */
import { renderHTML } from './renderers/html.js';
import { renderText } from './renderers/text.js';
import { renderCSV } from './renderers/csv.js';
import { renderRTF } from './renderers/rtf.js';

export const EXPORT_FORMATS = [
  { id: 'html', label: 'HTML', ext: 'html', mime: 'text/html' },
  { id: 'text', label: 'Plain Text', ext: 'txt', mime: 'text/plain' },
  { id: 'csv', label: 'CSV', ext: 'csv', mime: 'text/csv' },
  { id: 'rtf', label: 'RTF', ext: 'rtf', mime: 'application/rtf' },
  { id: 'pdf', label: 'PDF (via print)', ext: 'pdf', mime: 'application/pdf' },
];

export function renderTo(format, report, { theme } = {}) {
  switch (format) {
    case 'html':
    case 'pdf':
      return renderHTML(report, { theme });
    case 'text':
      return renderText(report);
    case 'csv':
      return renderCSV(report);
    case 'rtf':
      return renderRTF(report);
    default:
      throw new Error('Unknown export format: ' + format);
  }
}

export function downloadReport(format, report, { theme, filenameBase, author } = {}) {
  const fmt = EXPORT_FORMATS.find((f) => f.id === format);
  if (!fmt) throw new Error('Unknown format ' + format);

  // Author metadata flows through the AST so all renderers see the same credit
  // line without fetching asynchronously. Callers can override via options or
  // leave the AST's own `author` field in place.
  const decoratedReport = author ? { ...report, author } : report;

  if (format === 'pdf') {
    const html = renderHTML(decoratedReport, { theme });
    const w = window.open('', '_blank');
    if (!w) throw new Error('Popup blocked. Allow popups to export as PDF.');
    w.document.write(html);
    w.document.close();
    w.onload = () => {
      w.focus();
      w.print();
    };
    return;
  }

  const content = renderTo(format, decoratedReport, { theme });
  const blob = new Blob([content], { type: fmt.mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeBase = (filenameBase || report.title || 'report').replace(/[^\w\-]+/g, '_');
  a.href = url;
  a.download = `${safeBase}.${fmt.ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}
