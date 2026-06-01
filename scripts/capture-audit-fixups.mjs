/** Fixups: mobile nav drawer open, and editor scrolled states (mobile+desktop). */
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE = 'http://localhost:3000';
const OUT_D = resolve('scripts/screenshots/audit/desktop');
const OUT_M = resolve('scripts/screenshots/audit/mobile');
const datasetJson = await readFile('public/family-data.json', 'utf8');

async function seed(page) {
  await page.addInitScript(() => localStorage.setItem('cloudtreeweb-has-imported', '1'));
  await page.goto(BASE + '/');
  await page.evaluate(async (jsonText) => {
    const { getAppDataClient } = await import('/src/lib/data/index.js');
    await getAppDataClient().records.importDataset(JSON.parse(jsonText));
  }, datasetJson);
  await page.waitForFunction(async () => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    return (await getLocalDatabase().query('Person', { limit: 1 })).records.length > 0;
  }, { timeout: 20000 });
}
async function personId(page) {
  return page.evaluate(async () => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    const p = (await getLocalDatabase().query('Person', { limit: 400 })).records;
    return p.find((x) => x.recordName === 'person-1381')?.recordName || p[0]?.recordName;
  });
}
async function deepScroll(page, y) {
  await page.evaluate((dy) => {
    const els = Array.from(document.querySelectorAll('main *'));
    let best = null, bestH = 0;
    for (const el of els) {
      const sc = el.scrollHeight - el.clientHeight;
      if (sc > bestH && getComputedStyle(el).overflowY !== 'visible') { bestH = sc; best = el; }
    }
    if (best) best.scrollTop = dy; else window.scrollTo(0, dy);
  }, y);
}

const browser = await chromium.launch();

// --- Mobile ---
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mp = await mctx.newPage();
await seed(mp);
const pid = await personId(mp);

await mp.goto(BASE + '/persons', { waitUntil: 'networkidle' });
await mp.waitForTimeout(900);
await mp.getByRole('button', { name: /menu/i }).first().click().catch(async () => {
  await mp.locator('header button').last().click();
});
await mp.waitForSelector('[role="menu"]', { timeout: 4000 }).catch(() => {});
await mp.waitForTimeout(500);
await mp.screenshot({ path: `${OUT_M}/50-mobile-nav-open.png` });
console.log('mobile nav open done');

await mp.goto(BASE + `/person/${pid}`, { waitUntil: 'networkidle' });
await mp.waitForTimeout(1500);
await deepScroll(mp, 1400);
await mp.waitForTimeout(600);
await mp.screenshot({ path: `${OUT_M}/41-person-editor-scrolled.png` });
console.log('mobile editor scrolled done');
await mctx.close();

// --- Desktop ---
const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dp = await dctx.newPage();
await seed(dp);
await dp.goto(BASE + `/person/${pid}`, { waitUntil: 'networkidle' });
await dp.waitForTimeout(1500);
await deepScroll(dp, 1400);
await dp.waitForTimeout(600);
await dp.screenshot({ path: `${OUT_D}/41-person-editor-scrolled.png` });
console.log('desktop editor scrolled done');
await dctx.close();

await browser.close();
console.log('fixups complete');
