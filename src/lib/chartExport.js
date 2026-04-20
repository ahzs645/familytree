/**
 * Shared export helpers for chart canvas outputs.
 *
 * Consumes schema V2 `pageSetup` (paper size, orientation, custom width/height,
 * margins) and `exportSettings` (format, scale, jpegQuality, includeBackground,
 * fileNameTemplate) when provided; falls back to legacy `page` shape for
 * backward compatibility.
 */

import { normalizePageDimensions } from './pageLayout.js';

const DEFAULT_FILENAME_TEMPLATE = '{title}-{date}';

function toPageSetup(page = {}) {
  if (page && (page.paperSize || page.width || page.height || page.margins)) return page;
  if (!page) return {};
  return {
    paperSize: page.size,
    orientation: page.orientation,
    width: page.width,
    height: page.height,
    backgroundColor: page.backgroundColor,
    title: page.title,
    note: page.note,
  };
}

export function getChartExportPageSize(page = {}) {
  const dims = normalizePageDimensions(toPageSetup(page));
  return { width: dims.width, height: dims.height };
}

function resolveExportSettings(options = {}) {
  const raw = options.exportSettings || {};
  return {
    format: raw.format || options.format || 'png',
    scale: Number.isFinite(raw.scale) ? raw.scale : 1,
    includeBackground: raw.includeBackground !== false,
    jpegQuality: Number.isFinite(raw.jpegQuality) ? raw.jpegQuality : 0.92,
    fileNameTemplate: raw.fileNameTemplate || DEFAULT_FILENAME_TEMPLATE,
  };
}

export function resolveFileNameFromTemplate(template, context = {}) {
  const isoDate = new Date().toISOString().slice(0, 10);
  const map = {
    '{title}': context.title || 'chart',
    '{date}': isoDate,
    '{name}': context.name || context.title || 'chart',
  };
  return String(template || DEFAULT_FILENAME_TEMPLATE).replace(/\{(title|date|name)\}/g, (match) => map[match] ?? match);
}

export function safeFilename(base, ext) {
  return `${String(base || 'chart').replace(/[^\w-]+/g, '_')}.${ext}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

function cloneSvgNode(svgRef) {
  if (!svgRef?.nodeType) return null;
  const clone = svgRef.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return clone;
}

export function chartSvgBlob(svgNode, { page = {}, filename = 'chart' } = {}) {
  const size = getChartExportPageSize(page);
  const clone = cloneSvgNode(svgNode);
  if (!clone) throw new Error('No SVG node available for chart export.');
  clone.setAttribute('width', size.width);
  clone.setAttribute('height', size.height);
  return new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
}

export function exportChartAsSvg(svgNode, options = {}) {
  const { page = {}, filename = 'chart' } = options;
  const blob = chartSvgBlob(svgNode, { page, filename });
  downloadBlob(blob, safeFilename(filename, 'svg'));
}

export function exportChartAsPng(svgNode, options = {}, background = '#ffffff') {
  const { page = {}, filename = 'chart' } = options;
  const settings = resolveExportSettings(options);
  const size = getChartExportPageSize(page);
  const scale = Math.max(0.25, Math.min(4, settings.scale || 1));
  const outWidth = Math.round(size.width * scale);
  const outHeight = Math.round(size.height * scale);
  const clone = cloneSvgNode(svgNode);
  if (!clone) throw new Error('No SVG node available for chart export.');
  clone.setAttribute('width', size.width);
  clone.setAttribute('height', size.height);
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext('2d');
    if (settings.includeBackground) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, outWidth, outHeight);
    }
    ctx.drawImage(img, 0, 0, outWidth, outHeight);
    URL.revokeObjectURL(url);
    const mime = settings.format === 'jpeg' || settings.format === 'jpg' ? 'image/jpeg' : 'image/png';
    const ext = mime === 'image/jpeg' ? 'jpg' : 'png';
    const outName = resolveFileNameFromTemplate(options.fileNameTemplate || settings.fileNameTemplate, { title: filename, name: filename });
    canvas.toBlob((image) => {
      if (image) {
        downloadBlob(image, safeFilename(outName, ext));
      }
    }, mime, mime === 'image/jpeg' ? settings.jpegQuality : undefined);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    throw new Error('Failed to build PNG export from chart SVG.');
  };
  img.src = url;
}

export function printChartViaPdf(svgNode, options = {}) {
  const { page = {}, filename = 'chart' } = options;
  const size = getChartExportPageSize(page);
  const clone = cloneSvgNode(svgNode);
  if (!clone) throw new Error('No SVG node available for chart export.');
  clone.setAttribute('width', size.width);
  clone.setAttribute('height', size.height);
  const html = `\n    <html>\n      <head><title>${safeFilename(filename, 'pdf')}</title></head>\n      <body style="margin:0;background:#fff;display:flex;align-items:center;justify-content:center;">\n        ${clone.outerHTML}\n        <script>\n          window.onload = () => {\n            window.focus();\n            window.print();\n          };\n        </script>\n      </body>\n    </html>\n  `;
  const w = window.open('', '_blank');
  if (!w) throw new Error('Popup blocked. Allow popups to export as PDF.');
  w.document.write(html);
  w.document.close();
}
