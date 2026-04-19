/**
 * Shared export helpers for chart canvas outputs.
 */

const DEFAULT_PAGE = 'letter';

export function getChartExportPageSize(page = {}) {
  const { size = DEFAULT_PAGE, orientation = 'landscape' } = page;
  const sizes = {
    letter: [1056, 816],
    a4: [1123, 794],
    legal: [1344, 816],
  };
  const [width, height] = sizes[size] || sizes[DEFAULT_PAGE];
  if (orientation === 'portrait') return { width: height, height: width };
  return { width, height };
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
  const size = getChartExportPageSize(page);
  const clone = cloneSvgNode(svgNode);
  if (!clone) throw new Error('No SVG node available for chart export.');
  clone.setAttribute('width', size.width);
  clone.setAttribute('height', size.height);
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(img, 0, 0, size.width, size.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((png) => {
      if (png) {
        downloadBlob(png, safeFilename(filename, 'png'));
      }
    }, 'image/png');
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
