import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const OUT = resolve('scripts/screenshots/editor-review');
await mkdir(OUT, { recursive: true });
const BASE = 'http://localhost:3000';

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.addInitScript(() => localStorage.setItem('cloudtreeweb-has-imported', '1'));
const datasetJson = await readFile('public/family-data.json', 'utf8');
await page.goto(BASE + '/');
await page.evaluate(async (j) => {
  const { getAppDataClient } = await import('/src/lib/data/index.js');
  await getAppDataClient().records.importDataset(JSON.parse(j));
}, datasetJson);
await page.waitForFunction(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  return (await getLocalDatabase().query('Place', { limit: 1 })).records.length > 0;
}, { timeout: 15000 });

for (const [path, file] of [['/places', 'r1-places.png'], ['/sources', 'r2-sources.png'], ['/labels', 'r3-labels.png']]) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${file}` });
  console.log('✓', file);
}

// Dirty check on Places: edit a field, confirm "Unsaved changes" + Save enabled
await page.goto(BASE + '/places', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const input = page.locator('main input[type="text"], main input:not([type])').first();
await input.click();
await input.type('x');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/r4-places-dirty.png`, clip: { x: 300, y: 0, width: 1140, height: 110 } });
console.log('✓ r4-places-dirty.png');
await browser.close();
console.log('done');
