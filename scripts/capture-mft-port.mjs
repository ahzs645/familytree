/**
 * MFT11 Interactive Tree port — Playwright capture harness.
 *
 * Loads /tree, then captures the 3D viewer canvas at several camera modes
 * matching MacFamilyTree 11. Output goes to scripts/screenshots/mft-port/.
 */
import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'screenshots/mft-port');
const BASE = process.env.BASE || 'http://localhost:3000';
const VIEWPORT = { width: 1440, height: 760 };
// Match the reference screenshot aspect (≈1442x740 visible canvas).

const CAMERA_PRESETS = [
  { id: 'topDown', label: 'Top Down' },
  { id: 'topDownSlight', label: 'Top Down, slightly tilted' },
  { id: 'topDownTilted', label: 'Top Down, tilted' },
  { id: 'front', label: 'Front' },
  { id: 'frontLeft', label: 'Front Left' },
  { id: 'isoLeft', label: 'Isometric Left' },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

  page.on('console', (msg) => {
    const text = msg.text();
    if (/CloudTreeWeb|autoLoad|family-data|import|warn|error|empty/i.test(text)) {
      console.log('  page>', text.slice(0, 240));
    }
  });

  // Pre-set the import flag BEFORE the first navigation so autoLoadIfEmpty
  // doesn't race with our explicit import.
  await page.addInitScript(() => {
    localStorage.setItem('cloudtreeweb-has-imported', '1');
  });

  // Read the dataset locally and import explicitly via the data client.
  const datasetJson = await readFile(resolve(__dirname, '../public/family-data.json'), 'utf8');
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const importResult = await page.evaluate(async (jsonText) => {
    try {
      const mod = await import('/src/lib/data/index.js');
      const client = mod.getAppDataClient?.();
      if (!client?.records?.importDataset) return { err: 'no client' };
      const dataset = JSON.parse(jsonText);
      const count = await client.records.importDataset(dataset);
      const persons = await client.records.query('Person', { limit: 1 });
      return { count, hasPersons: (persons?.records?.length || 0) > 0 };
    } catch (e) { return { err: String(e?.message || e) }; }
  }, datasetJson);
  console.log('explicit import:', importResult);

  await page.goto(BASE + '/tree', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('canvas').length > 0, { timeout: 30000 }).catch(() => null);
  const stage = await page.evaluate(async () => {
    const text = document.body.innerText.slice(0, 200);
    const canvases = document.querySelectorAll('canvas').length;
    let personsViaClient = -1;
    try {
      const dataMod = await import('/src/lib/data/index.js');
      const c = dataMod.getAppDataClient?.();
      const r = await c?.records?.query?.('Person', { limit: 100000 });
      personsViaClient = r?.records?.length ?? -1;
    } catch {}
    return { text, canvases, personsViaClient };
  });
  console.log('tree stage:', stage);
  await page.waitForTimeout(2000);

  for (const preset of CAMERA_PRESETS) {
    await page.evaluate((mode) => {
      try {
        const KEY = 'cloudtreeweb:interactive-tree-viewer-options';
        const raw = localStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        parsed.version = 4;
        parsed.appearanceMode = 'macLight';
        parsed.cameraMode = mode;
        parsed.personStyle = 'simplified';
        parsed.personImageStyle = 'round';
        parsed.generationBandColorMode = 'macPink';
        parsed.generationBandsFullWidth = true;
        parsed.generationBandStyle = 'raised';
        parsed.generationBandOpacity = 0.78;
        parsed.connectionColorMode = 'byGenerationLight';
        parsed.bottomPlaneMode = 'grid';
        parsed.lightingMode = 'normal';
        parsed.displayLabels = true;
        parsed.displayBirthDate = true;
        parsed.displayDeathDate = true;
        localStorage.setItem(KEY, JSON.stringify(parsed));
      } catch { /* noop */ }
    }, preset.id);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelectorAll('canvas').length > 0, { timeout: 30000 }).catch(() => null);
    await page.waitForFunction(() => !/Loading tree/.test(document.body.innerText || ''), { timeout: 30000 }).catch(() => null);
    await page.waitForTimeout(2500);
    // Click "Size to Fit" so we start from a known framing.
    await page.evaluate(() => {
      const fit = [...document.querySelectorAll('button')].find((b) => /Size to Fit/.test(b.textContent || ''));
      if (fit) fit.click();
    });
    await page.waitForTimeout(800);
    // Walk up from the canvas and hide every absolutely-positioned sibling overlay.
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const canvasShell = canvas.parentElement; // the div ref'd by containerRef
      const viewerShell = canvasShell?.parentElement; // ThreeDTreeView's styles.shell div
      if (!viewerShell) return;
      for (const child of viewerShell.children) {
        if (child === canvasShell) continue;
        child.style.display = 'none';
      }
      // Hide InteractiveTreeApp's top toolbar (segmented control row).
      const appToolbar = viewerShell.closest('[style]')?.parentElement?.previousElementSibling;
      if (appToolbar && appToolbar.tagName === 'DIV' && /Interactive Tree/.test(appToolbar.textContent || '')) {
        appToolbar.style.display = 'none';
      }
    });
    await page.waitForTimeout(300);
    // Re-fit the camera now that overlays are gone.
    await page.evaluate(() => {
      window.dispatchEvent(new Event('resize'));
    });
    await page.waitForTimeout(800);
    const outPath = resolve(OUT_DIR, `current-${preset.id}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log('saved', outPath);
  }

  if (errors.length) {
    console.error('Page errors:', errors.slice(0, 8));
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
