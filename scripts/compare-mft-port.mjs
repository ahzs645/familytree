/**
 * Stitch the MFT11 reference and the captured 3D viewer screenshots into a
 * single side-by-side comparison image for visual review.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENS_DIR = resolve(__dirname, 'screenshots/mft-port');
const REFERENCE = '/Users/ahmadjalil/Desktop/Screenshot 2026-05-08 at 10.29.06 AM.png';
const OUT = resolve(SCREENS_DIR, 'side-by-side.png');

const PRESETS = ['topDown', 'topDownSlight', 'topDownTilted', 'front', 'frontLeft', 'isoLeft'];

async function dataUrl(path) {
  const buf = await readFile(path);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

async function main() {
  await mkdir(SCREENS_DIR, { recursive: true });
  const ref = await dataUrl(REFERENCE).catch(() => null);
  const tiles = await Promise.all(PRESETS.map(async (id) => ({
    id, src: await dataUrl(resolve(SCREENS_DIR, `current-${id}.png`)),
  })));
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; background: #1f2024; font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #fff; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; padding: 24px; }
    .cell { background: #2a2c33; border-radius: 12px; padding: 16px; }
    .cell h2 { margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #f0c9ff; }
    .cell p { margin: 0 0 12px 0; font-size: 13px; color: #aab; }
    .cell img { display: block; width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
    .ref { grid-column: 1 / 3; }
  </style></head><body>
    <div class="grid">
      ${ref ? `<div class="cell ref"><h2>Reference — MacFamilyTree 11 Interactive Tree</h2><img src="${ref}"></div>` : ''}
      ${tiles.map((t) => `<div class="cell"><h2>${t.id}</h2><img src="${t.src}"></div>`).join('')}
    </div>
  </body></html>`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 2400 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({ path: OUT, fullPage: true });
  await browser.close();
  console.log('saved', OUT);
}
main().catch((e) => { console.error(e); process.exit(1); });
