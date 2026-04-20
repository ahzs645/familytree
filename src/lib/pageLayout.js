/**
 * Page layout helpers for chart print/export parity with MacFamilyTree.
 *
 * Consumes the `pageSetup` block of a schema V2 chart document and produces
 * concrete pixel dimensions, margin insets, and multi-page tile information
 * (with overlap) that the chart canvas and exporters can use.
 *
 * Dimension units: pixels at 96 DPI (keeps parity with chartExport.js).
 * Mac evidence: paper sizes + overlap + cut marks + page-number options appear
 * in `CoreCharts.strings` and `PrintSettingsPane`.
 */

const DPI = 96;

const PAPER_SIZES_INCHES = {
  letter: [8.5, 11],
  legal: [8.5, 14],
  tabloid: [11, 17],
  a3: [11.693, 16.535],
  a4: [8.268, 11.693],
  a5: [5.827, 8.268],
};

function inchesToPixels(inches) {
  return Math.round(inches * DPI);
}

/**
 * Normalize a pageSetup block to concrete pixel dimensions.
 * If the pageSetup includes non-zero width/height, those override the named
 * paper size. Otherwise the paper size + orientation are used.
 */
export function normalizePageDimensions(pageSetup = {}) {
  const { paperSize = 'letter', orientation = 'landscape', width, height } = pageSetup;

  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return {
      width: Math.round(width),
      height: Math.round(height),
      paperSize: 'custom',
      orientation: width >= height ? 'landscape' : 'portrait',
      isCustom: true,
    };
  }

  const size = PAPER_SIZES_INCHES[paperSize] || PAPER_SIZES_INCHES.letter;
  const portraitWidth = inchesToPixels(size[0]);
  const portraitHeight = inchesToPixels(size[1]);

  if (orientation === 'landscape') {
    return {
      width: portraitHeight,
      height: portraitWidth,
      paperSize,
      orientation: 'landscape',
      isCustom: false,
    };
  }

  return {
    width: portraitWidth,
    height: portraitHeight,
    paperSize,
    orientation: 'portrait',
    isCustom: false,
  };
}

/**
 * Clamp and normalize page margins. Returns margins in pixels.
 */
export function normalizeMargins(pageSetup = {}) {
  const margins = pageSetup.margins || {};
  const clamp = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return 36;
    return Math.max(0, Math.min(400, number));
  };
  return {
    top: clamp(margins.top),
    right: clamp(margins.right),
    bottom: clamp(margins.bottom),
    left: clamp(margins.left),
  };
}

/**
 * Clamp and normalize page overlap in pixels. Overlap is the bleed region
 * reused across adjacent pages when tiling a large chart for print.
 */
export function normalizeOverlap(pageSetup = {}) {
  const number = Number(pageSetup.overlap);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(200, Math.round(number));
}

/**
 * Returns the drawable content rect inside the page (page - margins).
 */
export function getContentRect(pageSetup = {}) {
  const { width, height } = normalizePageDimensions(pageSetup);
  const margins = normalizeMargins(pageSetup);
  return {
    x: margins.left,
    y: margins.top,
    width: Math.max(0, width - margins.left - margins.right),
    height: Math.max(0, height - margins.top - margins.bottom),
  };
}

/**
 * Tile a chart content bounding box into pages with overlap support.
 * Returns an array of page rects (in chart-content coordinates) plus page
 * metadata for print rendering.
 */
export function computePageTiles(contentBounds, pageSetup = {}) {
  const content = getContentRect(pageSetup);
  if (content.width <= 0 || content.height <= 0) return [];

  const overlap = normalizeOverlap(pageSetup);
  const stepX = Math.max(1, content.width - overlap);
  const stepY = Math.max(1, content.height - overlap);

  const hasExplicitWidth = Number.isFinite(contentBounds?.width);
  const hasExplicitHeight = Number.isFinite(contentBounds?.height);
  if ((hasExplicitWidth && contentBounds.width <= 0) || (hasExplicitHeight && contentBounds.height <= 0)) {
    return [];
  }
  const bounds = {
    x: Number.isFinite(contentBounds?.x) ? contentBounds.x : 0,
    y: Number.isFinite(contentBounds?.y) ? contentBounds.y : 0,
    width: hasExplicitWidth ? contentBounds.width : content.width,
    height: hasExplicitHeight ? contentBounds.height : content.height,
  };

  const tiles = [];
  let pageNumber = 1;
  for (let y = bounds.y; y < bounds.y + bounds.height; y += stepY) {
    const rowStart = pageNumber;
    for (let x = bounds.x; x < bounds.x + bounds.width; x += stepX) {
      tiles.push({
        pageNumber,
        col: Math.round((x - bounds.x) / stepX),
        row: Math.round((y - bounds.y) / stepY),
        chart: {
          x,
          y,
          width: Math.min(content.width, bounds.x + bounds.width - x),
          height: Math.min(content.height, bounds.y + bounds.height - y),
        },
        overlap,
      });
      pageNumber++;
    }
    // rowStart retained for readability; no-op if only one column.
    void rowStart;
  }
  return tiles;
}

/**
 * Filter out empty pages when the pageSetup opts into omitEmptyPages.
 * `isPageEmpty` is a caller-supplied predicate: (tile) => boolean.
 */
export function applyOmitEmptyPages(tiles, pageSetup, isPageEmpty) {
  if (!pageSetup?.omitEmptyPages) return tiles;
  if (typeof isPageEmpty !== 'function') return tiles;
  const filtered = tiles.filter((tile) => !isPageEmpty(tile));
  return filtered.map((tile, index) => ({ ...tile, pageNumber: index + 1 }));
}

/**
 * Produce a single consolidated summary for a page layout — useful for
 * debug overlays or exporters that want a quick snapshot.
 */
export function summarizePageLayout(pageSetup = {}) {
  const dimensions = normalizePageDimensions(pageSetup);
  const margins = normalizeMargins(pageSetup);
  const overlap = normalizeOverlap(pageSetup);
  return {
    dimensions,
    margins,
    overlap,
    printPageNumbers: Boolean(pageSetup.printPageNumbers),
    cutMarks: Boolean(pageSetup.cutMarks),
    omitEmptyPages: pageSetup.omitEmptyPages !== false,
    backgroundColor: pageSetup.backgroundColor || '',
  };
}
