/**
 * Verify the new Tailwind theming, maps, and expanded editors all work
 * against real imported data.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console.error: ' + m.text());
});

const BASE = 'http://localhost:3000';
await page.goto(BASE + '/');
await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  await getLocalDatabase().clearAll();
  localStorage.removeItem('cloudtreeweb-has-imported');
  localStorage.removeItem('cloudtreeweb:theme');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Check the initial theme (should pick up OS pref or light default).
const initialDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));

// Toggle theme via the nav button and verify the html class flips.
await page.click('button[title*="mode"]');
await page.waitForTimeout(200);
const afterToggle = await page.evaluate(() => document.documentElement.classList.contains('dark'));

// /map route
let mapErrors = [];
const before1 = errors.length;
await page.goto(BASE + '/map', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const mapCanvas = await page.locator('canvas.maplibregl-canvas').count();
mapErrors = errors.slice(before1);

// Pick a sample place that has no coordinates so we can test the map in the editor
const sample = await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  const persons = await db.query('Person', { limit: 1 });
  const families = await db.query('Family', { limit: 1 });
  const places = await db.query('Place', { limit: 1 });
  return {
    personId: persons.records[0]?.recordName,
    familyId: families.records[0]?.recordName,
    placeId: places.records[0]?.recordName,
  };
});

// /places with a place — look for template picker, key/values, map
const before2 = errors.length;
await page.goto(BASE + '/places', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const placesPage = await page.evaluate(() => ({
  hasTemplateLabel: document.body.textContent.includes('Place template'),
  hasKeyValues: document.body.textContent.includes('Template key/value pairs'),
  hasMap: !!document.querySelector('.maplibregl-canvas'),
  hasMapHint: document.body.textContent.includes('Click anywhere on the map'),
}));
const placesErrors = errors.slice(before2);

// /person/:id — look for additional names, facts, related views
const before3 = errors.length;
await page.goto(BASE + '/person/' + sample.personId, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const personPage = await page.evaluate(() => ({
  hasAdditional: document.body.textContent.includes('Additional names'),
  hasFacts: document.body.textContent.includes('Facts'),
  hasRelated: document.body.textContent.includes('Related views'),
  hasAncestorChart: document.body.textContent.includes('Ancestor chart'),
}));
const personErrors = errors.slice(before3);

// /family/:id — family events + note
const before4 = errors.length;
await page.goto(BASE + '/family/' + sample.familyId, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const familyPage = await page.evaluate(() => ({
  hasNote: document.body.textContent.includes('Family note'),
  hasFamilyEvents: document.body.textContent.includes('Family events'),
}));
const familyErrors = errors.slice(before4);

console.log('=== THEMING ===');
console.log('initial dark:', initialDark, '· after toggle:', afterToggle, '· flipped:', initialDark !== afterToggle);
console.log('\n=== /map ===');
console.log('maplibregl canvas count:', mapCanvas);
console.log('errors:', mapErrors);
console.log('\n=== /places ===');
console.log(JSON.stringify(placesPage, null, 2));
console.log('errors:', placesErrors);
console.log('\n=== /person ===');
console.log(JSON.stringify(personPage, null, 2));
console.log('errors:', personErrors);
console.log('\n=== /family ===');
console.log(JSON.stringify(familyPage, null, 2));
console.log('errors:', familyErrors);

await browser.close();
const total = mapErrors.length + placesErrors.length + personErrors.length + familyErrors.length;
process.exit(total > 0 ? 1 : 0);
