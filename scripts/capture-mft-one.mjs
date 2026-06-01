/**
 * Fast single-view capture for iterating on the MFT11 top-down port.
 * Outputs scripts/screenshots/mft-port/current-<mode>.png (default topDown).
 */
import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'screenshots/mft-port');
const BASE = process.env.BASE || 'http://localhost:3000';
const MODE = process.env.MODE || 'topDown';
const VIEWPORT = { width: 1440, height: 760 };

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

  await page.addInitScript(() => localStorage.setItem('cloudtreeweb-has-imported', '1'));
  const datasetJson = await readFile(resolve(__dirname, '../public/family-data.json'), 'utf8');
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(async (jsonText) => {
    const mod = await import('/src/lib/data/index.js');
    const client = mod.getAppDataClient?.();
    await client?.records?.importDataset(JSON.parse(jsonText));
  }, datasetJson);

  await page.evaluate(({ mode, ground }) => {
    const KEY = 'cloudtreeweb:interactive-tree-viewer-options';
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}');
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
    parsed.bottomPlaneMode = ground;
    parsed.lightingMode = 'normal';
    parsed.displayLabels = true;
    parsed.displayBirthDate = true;
    parsed.displayDeathDate = true;
    localStorage.setItem(KEY, JSON.stringify(parsed));
  }, { mode: MODE, ground: process.env.GROUND || 'grid' });

  await page.goto(BASE + '/tree', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('canvas').length > 0, { timeout: 30000 }).catch(() => null);
  await page.waitForFunction(() => !/Loading tree/.test(document.body.innerText || ''), { timeout: 30000 }).catch(() => null);
  await page.waitForTimeout(2600);
  await page.evaluate(() => {
    const fit = [...document.querySelectorAll('button')].find((b) => /Size to Fit/.test(b.textContent || ''));
    if (fit) fit.click();
  });
  await page.waitForTimeout(900);
  // Optional zoom-in (ZOOM = number of wheel ticks) to inspect connectors/text up close.
  const zoomTicks = Number(process.env.ZOOM || 0);
  if (zoomTicks > 0) {
    const focusY = process.env.FOCUSY || '0.62';
    await page.evaluate((fy) => { window.__zoomFocusY = fy; }, focusY);
    const box = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const r = c.getBoundingClientRect();
      const fy = Number(window.__zoomFocusY || 0.62);
      return { x: r.left + r.width / 2, y: r.top + r.height * fy };
    });
    await page.mouse.move(box.x, box.y);
    const delta = zoomTicks < 0 ? 120 : -120; // negative ZOOM => zoom out
    for (let i = 0; i < Math.abs(zoomTicks); i += 1) {
      await page.mouse.wheel(0, delta);
      await page.waitForTimeout(90);
    }
    await page.waitForTimeout(700);
  }
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const canvasShell = canvas.parentElement;
    const viewerShell = canvasShell?.parentElement;
    if (!viewerShell) return;
    for (const child of viewerShell.children) {
      if (child === canvasShell) continue;
      child.style.display = 'none';
    }
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(700);
  const outPath = resolve(OUT_DIR, `current-${MODE}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  console.log('saved', outPath);
  if (errors.length) console.error('Page errors:', errors.slice(0, 6));
  await browser.close();
}
main().catch((err) => { console.error(err); process.exit(1); });
