import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const OUT = resolve('scripts/screenshots/editor-review');
await mkdir(OUT, { recursive: true });
const BASE = 'http://localhost:3000';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.addInitScript(() => localStorage.setItem('cloudtreeweb-has-imported', '1'));
const datasetJson = await readFile('public/family-data.json', 'utf8');
await page.goto(BASE + '/');
await page.evaluate(async (jsonText) => {
  const { getAppDataClient } = await import('/src/lib/data/index.js');
  await getAppDataClient().records.importDataset(JSON.parse(jsonText));
}, datasetJson);

await page.waitForFunction(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  return (await getLocalDatabase().query('Person', { limit: 1 })).records.length > 0;
}, { timeout: 15000 });

const target = await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  const persons = (await db.query('Person', { limit: 100000 })).records;
  let best = null, bestScore = -1;
  for (const p of persons.slice(0, 400)) {
    const [ev, fa, no] = await Promise.all([
      db.query('PersonEvent', { referenceField: 'person', referenceValue: p.recordName, limit: 20 }),
      db.query('PersonFact', { referenceField: 'person', referenceValue: p.recordName, limit: 20 }),
      db.query('Note', { referenceField: 'person', referenceValue: p.recordName, limit: 20 }),
    ]);
    const score = ev.records.length * 2 + fa.records.length + no.records.length;
    if (score > bestScore) { bestScore = score; best = p.recordName; }
  }
  const fams = (await db.query('Family', { limit: 50 })).records;
  return { personId: best, familyId: fams[0]?.recordName };
});
console.log('target', target);

// Person editor — clean state (shows nav bar + "All changes saved")
await page.goto(BASE + `/person/${target.personId}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/02-person-editor-top.png` });
console.log('✓ 02-person-editor-top.png');

// Dirty state — type into the first name field, capture the "Unsaved changes" header
const firstInput = page.locator('main input').first();
await firstInput.click();
await firstInput.type('x');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/06-person-dirty.png`, clip: { x: 240, y: 0, width: 1200, height: 60 } });
console.log('✓ 06-person-dirty.png');

// Section nav jump — click a chip near the end and capture
const navButtons = page.locator('nav[aria-label="Editor sections"] button');
const count = await navButtons.count();
console.log('section nav chips:', count);
if (count > 4) {
  await navButtons.nth(count - 2).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/07-section-jump.png` });
  console.log('✓ 07-section-jump.png');
}

// Family editor
await page.goto(BASE + `/family/${target.familyId}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/03-family-editor.png` });
console.log('✓ 03-family-editor.png');

await browser.close();
console.log('done →', OUT);
