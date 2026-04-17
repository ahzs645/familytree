/**
 * Verify Place editor pulls coordinates from the linked Coordinate record,
 * and the Change Log expanded view shows sentence-style sub-entries.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

const BASE = 'http://localhost:3000';
await page.goto(BASE + '/');
await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  await getLocalDatabase().clearAll();
  localStorage.removeItem('cloudtreeweb-has-imported');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Find a place that has a linked coordinate
const target = await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  const { records: coords } = await db.query('Coordinate', { limit: 100 });
  for (const c of coords) {
    const placeRef = c.fields?.place?.value;
    const placeId = typeof placeRef === 'string' ? placeRef.split('---')[0] : placeRef?.recordName;
    if (placeId) {
      const place = await db.getRecord(placeId);
      if (place) return {
        placeId,
        placeName: place.fields?.placeName?.value || place.fields?.place?.value,
        expectedLat: c.fields?.latitude?.value,
        expectedLon: c.fields?.longitude?.value,
      };
    }
  }
  return null;
});
console.log('Coordinate target:', target);

await page.goto(BASE + '/places', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Click the row matching our target place
if (target) {
  await page.locator(`text="${target.placeName}"`).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
}

const placeCheck = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input[type="text"], input:not([type])')];
  // Heuristic: latitude/longitude inputs are inside a section labeled "Coordinate"
  const coordSection = [...document.querySelectorAll('div')].find((d) => d.textContent?.startsWith('Coordinate') && d.querySelector('input'));
  const coordInputs = coordSection ? [...coordSection.querySelectorAll('input')].slice(0, 2).map((i) => i.value) : [];
  return { coordInputs };
});
console.log('Place editor coord inputs:', placeCheck);

// Change Log expand
await page.goto(BASE + '/change-log', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.locator('main button.flex.items-center.w-full').first().click();
await page.waitForTimeout(800);
const cl = await page.evaluate(() => {
  const expanded = document.querySelector('main .border-t.border-border.bg-background\\/60');
  if (!expanded) return { html: '(none)' };
  const lines = [...expanded.querySelectorAll(':scope > div')].map((d) => d.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return { lineCount: lines.length, lines: lines.slice(0, 5) };
});
console.log('First expanded change-log entry sentences:', cl);
console.log('errors:', errors.length ? errors : '(none)');

await browser.close();
process.exit(errors.length ? 1 : 0);
