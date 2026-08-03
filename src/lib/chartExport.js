/**
 * Chart export helpers. PDF and print output share one page plan, including
 * paper dimensions, margins, overlap, empty-page omission, crop marks, and
 * page numbering. PDF pages are rasterized one at a time to cap peak memory.
 */

import {
  applyOmitEmptyPages,
  computePageTiles,
  normalizeMargins,
  normalizePageDimensions,
} from './pageLayout.js';
import { rectsIntersect } from './chartObjectLayout.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_FILENAME_TEMPLATE = '{title}-{date}';

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }
  return node;
}

function toPageSetup(page = {}) {
  if (page && (page.paperSize || page.width || page.height || page.margins)) return page;
  return {
    paperSize: page?.size,
    orientation: page?.orientation,
    width: page?.width,
    height: page?.height,
    backgroundColor: page?.backgroundColor,
    title: page?.title,
    note: page?.note,
  };
}

/**
 * Pure page planning seam used by both exporters and tests.
 */
export function buildChartPagePlan(contentBounds, pageSetup = {}, drawableBounds = []) {
  const setup = toPageSetup(pageSetup);
  const dimensions = normalizePageDimensions(setup);
  const margins = normalizeMargins(setup);
  const rawTiles = computePageTiles(contentBounds, setup);
  const bounds = Array.isArray(drawableBounds) ? drawableBounds : [];
  const tiles = applyOmitEmptyPages(rawTiles, setup, (tile) => (
    bounds.length > 0 && !bounds.some((rect) => rectsIntersect(rect, {
      x: tile.chart.x,
      y: tile.chart.y,
      width: Math.max(0, dimensions.width - margins.left - margins.right),
      height: Math.max(0, dimensions.height - margins.top - margins.bottom),
    }))
  ));
  return { dimensions, margins, tiles };
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

function resolveFileNameFromTemplate(template, context = {}) {
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
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

function exportModel(svgNode, pageSetup = {}) {
  if (!svgNode?.nodeType) throw new Error('No SVG node available for chart export.');
  const content = svgNode.querySelector('[data-chart-export-content="true"]');
  if (!content) throw new Error('The chart has no exportable SVG content.');
  const bbox = content.getBBox();
  const contentBounds = { x: bbox.x, y: bbox.y, width: Math.max(1, bbox.width), height: Math.max(1, bbox.height) };
  const drawableBounds = collectDrawableBounds(content);
  const plan = buildChartPagePlan(contentBounds, pageSetup, drawableBounds);
  if (!plan.tiles.length) throw new Error('The printable page area is empty. Reduce the page margins.');
  return { content, contentBounds, drawableBounds, plan };
}

function collectDrawableBounds(content) {
  const selectors = 'path,line,polyline,polygon,rect,circle,ellipse,text,image,foreignObject';
  const bounds = [];
  for (const element of content.querySelectorAll(selectors)) {
    if (element.closest('defs') || element.closest('[data-export-exclude="true"]')) continue;
    const rect = boundsRelativeTo(element, content);
    if (rect && rect.width >= 0 && rect.height >= 0) bounds.push(rect);
  }
  return bounds;
}

function boundsRelativeTo(element, ancestor) {
  try {
    const bbox = element.getBBox();
    const elementMatrix = element.getCTM();
    const ancestorMatrix = ancestor.getCTM();
    if (!elementMatrix || !ancestorMatrix) return null;
    const matrix = ancestorMatrix.inverse().multiply(elementMatrix);
    const points = [
      new DOMPoint(bbox.x, bbox.y),
      new DOMPoint(bbox.x + bbox.width, bbox.y),
      new DOMPoint(bbox.x, bbox.y + bbox.height),
      new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height),
    ].map((point) => point.matrixTransform(matrix));
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  } catch {
    return null;
  }
}

function clonePageSvg(svgNode, tile, pageSetup, pageCount, options = {}) {
  const { dimensions, margins } = buildChartPagePlan(tile.chart, pageSetup);
  const clone = svgNode.cloneNode(true);
  clone.setAttribute('xmlns', SVG_NS);
  clone.setAttribute('width', dimensions.width);
  clone.setAttribute('height', dimensions.height);
  clone.setAttribute('viewBox', `0 0 ${dimensions.width} ${dimensions.height}`);

  const content = clone.querySelector('[data-chart-export-content="true"]');
  if (!content) throw new Error('The chart has no exportable SVG content.');
  const sourceContent = content.cloneNode(true);
  clone.replaceChildren();

  const background = options.includeBackground !== false
    ? (options.background || pageSetup.backgroundColor || '#ffffff')
    : 'none';
  clone.appendChild(svgEl('rect', { x: 0, y: 0, width: dimensions.width, height: dimensions.height, fill: background }));
  sourceContent.setAttribute('transform', `translate(${margins.left - tile.chart.x},${margins.top - tile.chart.y})`);
  prepareExportContent(sourceContent);
  appendClippedContent(clone, sourceContent, dimensions, margins, `chart-page-clip-${tile.pageNumber}`);
  decoratePage(clone, tile.pageNumber, pageCount, pageSetup, dimensions, margins);
  return clone;
}

function prepareExportContent(content) {
  content.querySelectorAll('[data-export-exclude="true"]').forEach((element) => element.remove());
  content.querySelectorAll('[data-export-stroke]').forEach((element) => {
    element.setAttribute('stroke', element.getAttribute('data-export-stroke') || '#000000');
    element.setAttribute('stroke-width', element.getAttribute('data-export-stroke-width') || '1');
  });
}

function appendClippedContent(svg, content, dimensions, margins, clipId) {
  const width = Math.max(0, dimensions.width - margins.left - margins.right);
  const height = Math.max(0, dimensions.height - margins.top - margins.bottom);
  const defs = svgEl('defs');
  const clipPath = svgEl('clipPath', { id: clipId });
  clipPath.appendChild(svgEl('rect', { x: margins.left, y: margins.top, width, height }));
  defs.appendChild(clipPath);
  svg.appendChild(defs);
  const clipped = svgEl('g', { 'clip-path': `url(#${clipId})` });
  clipped.appendChild(content);
  svg.appendChild(clipped);
}

function decoratePage(svg, pageNumber, pageCount, pageSetup, dimensions, margins) {
  const layer = svgEl('g', { 'data-export-decorations': 'true', 'pointer-events': 'none' });
  const contentWidth = Math.max(0, dimensions.width - margins.left - margins.right);
  const contentHeight = Math.max(0, dimensions.height - margins.top - margins.bottom);
  const watermark = String(pageSetup.watermark || '').trim();
  if (watermark) {
    const cx = margins.left + contentWidth / 2;
    const cy = margins.top + contentHeight / 2;
    const mark = svgEl('text', {
      x: cx,
      y: cy,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-size': Math.max(28, Math.min(contentWidth, contentHeight) / 8),
      'font-family': 'system-ui, -apple-system, sans-serif',
      'font-weight': 700,
      fill: '#000000',
      'fill-opacity': 0.07,
      transform: `rotate(-30 ${cx} ${cy})`,
    });
    mark.textContent = watermark;
    layer.appendChild(mark);
  }
  if (pageSetup.cutMarks) appendCropMarks(layer, dimensions, margins);
  if (pageSetup.printPageNumbers) {
    const pageNo = svgEl('text', {
      x: dimensions.width - Math.max(8, margins.right / 2),
      y: dimensions.height - Math.max(8, margins.bottom / 2),
      'text-anchor': 'end',
      'dominant-baseline': 'middle',
      'font-size': 11,
      'font-family': 'system-ui, -apple-system, sans-serif',
      fill: '#666666',
    });
    pageNo.textContent = `${pageNumber} / ${pageCount}`;
    layer.appendChild(pageNo);
  }
  svg.appendChild(layer);
}

function appendCropMarks(layer, dimensions, margins) {
  const tick = Math.max(4, Math.min(14, margins.left, margins.right, margins.top, margins.bottom));
  const left = margins.left;
  const right = dimensions.width - margins.right;
  const top = margins.top;
  const bottom = dimensions.height - margins.bottom;
  const lines = [
    [left - tick, top, left, top], [left, top - tick, left, top],
    [right, top, right + tick, top], [right, top - tick, right, top],
    [left - tick, bottom, left, bottom], [left, bottom, left, bottom + tick],
    [right, bottom, right + tick, bottom], [right, bottom, right, bottom + tick],
  ];
  for (const [x1, y1, x2, y2] of lines) {
    layer.appendChild(svgEl('line', { x1, y1, x2, y2, stroke: '#000000', 'stroke-width': 1 }));
  }
}

function serializeSvg(svg) {
  return new XMLSerializer().serializeToString(svg);
}

function svgToCanvas(svg, scale = 1) {
  return new Promise((resolve, reject) => {
    const width = Number(svg.getAttribute('width')) || 1;
    const height = Number(svg.getAttribute('height')) || 1;
    const blob = new Blob([serializeSvg(svg)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas rendering is unavailable.');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas);
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to render chart SVG.'));
    };
    image.src = url;
  });
}

export function exportChartAsSvg(svgNode, options = {}) {
  const pageSetup = toPageSetup(options.page || {});
  const model = exportModel(svgNode, pageSetup);
  const pageSvg = clonePageSvg(svgNode, model.plan.tiles[0], pageSetup, model.plan.tiles.length, {
    background: pageSetup.backgroundColor,
    includeBackground: resolveExportSettings(options).includeBackground,
  });
  downloadBlob(new Blob([serializeSvg(pageSvg)], { type: 'image/svg+xml' }), safeFilename(options.filename || 'chart', 'svg'));
}

export async function exportChartAsPng(svgNode, options = {}, background = '#ffffff') {
  const pageSetup = toPageSetup(options.page || {});
  const settings = resolveExportSettings(options);
  const model = exportModel(svgNode, pageSetup);
  const pageSvg = clonePageSvg(svgNode, model.plan.tiles[0], pageSetup, model.plan.tiles.length, {
    background,
    includeBackground: settings.includeBackground,
  });
  const scale = Math.max(0.25, Math.min(4, settings.scale || 1));
  const canvas = await svgToCanvas(pageSvg, scale);
  const jpeg = settings.format === 'jpeg' || settings.format === 'jpg';
  const mime = jpeg ? 'image/jpeg' : 'image/png';
  const extension = jpeg ? 'jpg' : 'png';
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, jpeg ? settings.jpegQuality : undefined));
  canvas.width = 1;
  canvas.height = 1;
  if (!blob) throw new Error('Failed to create chart image.');
  const name = resolveFileNameFromTemplate(options.fileNameTemplate || settings.fileNameTemplate, { title: options.filename, name: options.filename });
  downloadBlob(blob, safeFilename(name, extension));
}

export async function exportChartAsPdf(svgNode, options = {}, background = '#ffffff') {
  const pageSetup = toPageSetup(options.page || {});
  const settings = resolveExportSettings(options);
  const model = exportModel(svgNode, pageSetup);
  const { jsPDF } = await import('jspdf');
  const { width, height } = model.plan.dimensions;
  const widthPt = width * 0.75;
  const heightPt = height * 0.75;
  const orientation = width >= height ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ orientation, unit: 'pt', format: [widthPt, heightPt], compress: true });
  const scale = Math.max(0.75, Math.min(2.5, settings.scale || 1));

  for (let index = 0; index < model.plan.tiles.length; index += 1) {
    if (index > 0) pdf.addPage([widthPt, heightPt], orientation);
    const pageSvg = clonePageSvg(svgNode, model.plan.tiles[index], pageSetup, model.plan.tiles.length, {
      background: settings.includeBackground ? background : '#ffffff',
      includeBackground: true,
    });
    const canvas = await svgToCanvas(pageSvg, scale);
    const dataUrl = canvas.toDataURL('image/jpeg', Math.max(0.75, settings.jpegQuality));
    pdf.addImage(dataUrl, 'JPEG', 0, 0, widthPt, heightPt, undefined, 'FAST');
    canvas.width = 1;
    canvas.height = 1;
  }

  const name = resolveFileNameFromTemplate(options.fileNameTemplate || settings.fileNameTemplate, { title: options.filename, name: options.filename });
  pdf.save(safeFilename(name, 'pdf'));
}

export function printChart(svgNode, options = {}) {
  const rawPageSetup = toPageSetup(options.page || {});
  const pageSetup = {
    ...rawPageSetup,
    margins: rawPageSetup.printMargins || rawPageSetup.margins,
  };
  const model = exportModel(svgNode, pageSetup);
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Popup blocked. Allow popups to print this chart.');

  const source = model.content.cloneNode(true);
  source.removeAttribute('transform');
  source.setAttribute('id', 'chart-print-source');
  prepareExportContent(source);
  const sourceMarkup = serializeSvg(source);
  const { width, height } = model.plan.dimensions;
  const margins = model.plan.margins;
  const pages = model.plan.tiles.map((tile) => {
    const page = svgEl('svg', { xmlns: SVG_NS, width, height, viewBox: `0 0 ${width} ${height}`, class: 'chart-page' });
    page.appendChild(svgEl('rect', { x: 0, y: 0, width, height, fill: pageSetup.backgroundColor || '#ffffff' }));
    const use = svgEl('use', {
      href: '#chart-print-source',
      transform: `translate(${margins.left - tile.chart.x},${margins.top - tile.chart.y})`,
    });
    appendClippedContent(page, use, model.plan.dimensions, margins, `chart-print-clip-${tile.pageNumber}`);
    decoratePage(page, tile.pageNumber, model.plan.tiles.length, pageSetup, model.plan.dimensions, margins);
    return serializeSvg(page);
  }).join('');
  const title = escapeHtml(safeFilename(options.filename || 'chart', 'pdf'));
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>@page{size:${width}px ${height}px;margin:0}html,body{margin:0;padding:0;background:#fff}.chart-source{position:absolute;width:0;height:0;overflow:hidden}.chart-page{display:block;width:${width}px;height:${height}px;break-after:page;page-break-after:always}.chart-page:last-child{break-after:auto;page-break-after:auto}@media screen{.chart-page{margin:16px auto;box-shadow:0 1px 8px #999}}</style></head><body><svg class="chart-source" xmlns="${SVG_NS}">${sourceMarkup}</svg>${pages}<script>window.onload=()=>{window.focus();window.print();}</script></body></html>`);
  popup.document.close();
}

// Backward-compatible name retained for callers outside the chart editor.
export const printChartViaPdf = printChart;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}
