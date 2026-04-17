import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const OUT = resolve('scripts/screenshots');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const BASE = 'http://localhost:3000';
await page.goto(BASE + '/');
await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  await getLocalDatabase().clearAll();
  localStorage.removeItem('cloudtreeweb-has-imported');
  // seed a saved chart so the gallery isn't empty
  const { saveChartTemplate, newTemplateId } = await import('/src/lib/chartTemplates.js');
  await saveChartTemplate({ id: newTemplateId(), name: 'Ancestor — 5 generations', chartType: 'ancestor', themeId: 'auto', generations: 5 });
  await saveChartTemplate({ id: newTemplateId(), name: 'Fan — full circle', chartType: 'fan', themeId: 'auto', generations: 6 });
  await saveChartTemplate({ id: newTemplateId(), name: 'Hourglass overview', chartType: 'hourglass', themeId: 'auto', generations: 4 });
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Pick a person with events to make MiniTimeline visible on /tree
const sample = await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  const persons = (await db.query('Person', { limit: 100000 })).records;
  for (const p of persons) {
    const ev = await db.query('PersonEvent', { referenceField: 'person', referenceValue: p.recordName, limit: 10 });
    if (ev.records.length >= 2) return p.recordName;
  }
  return persons[0]?.recordName;
});
await page.evaluate((id) => sessionStorage.setItem('cloudtreeweb:activePerson', id), sample);

const SHOTS = [
  { path: '/globe', file: '09b-globe.png', wait: 4000 },
  { path: '/saved-charts', file: '09c-saved-charts.png', wait: 800 },
  { path: '/tree', file: '02-tree-with-mini-timeline.png', wait: 1500 },
];

for (const s of SHOTS) {
  await page.goto(BASE + s.path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(s.wait);
  if (s.path === '/globe') {
    await page.waitForFunction(() => {
      const c = document.querySelector('canvas.maplibregl-canvas');
      return c && c.width > 200;
    }, { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: `${OUT}/${s.file}`, fullPage: false });
  console.log(`✓ ${s.path} → ${s.file}`);
}
await browser.close();
