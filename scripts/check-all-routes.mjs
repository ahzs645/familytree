/**
 * Visit every SPA route, confirm 0 JS errors and the page rendered something.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const allErrors = [];
page.on('pageerror', (e) => allErrors.push({ url: page.url(), msg: 'pageerror: ' + e.message }));
page.on('console', (m) => {
  if (m.type() === 'error') allErrors.push({ url: page.url(), msg: 'console.error: ' + m.text() });
});

const BASE = 'http://localhost:3000';

await page.goto(BASE + '/');
await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  await getLocalDatabase().clearAll();
  localStorage.removeItem('cloudtreeweb-has-imported');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const sample = await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  const persons = await db.query('Person', { limit: 1 });
  const families = await db.query('Family', { limit: 1 });
  return { person: persons.records[0]?.recordName, family: families.records[0]?.recordName };
});

const ROUTES = [
  '/',
  '/tree',
  '/charts',
  '/map',
  '/globe',
  '/saved-charts',
  '/maps-diagram',
  '/places',
  '/sources',
  '/events',
  '/media',
  '/search',
  '/duplicates',
  '/reports',
  '/books',
  '/change-log',
  '/statistics',
  '/plausibility',
  '/maintenance',
  '/bookmarks',
  '/todos',
  '/stories',
  '/groups',
  '/dna',
  '/repositories',
  '/slideshow',
  '/world-history',
  '/research',
  '/templates',
  '/labels',
  '/quiz',
  '/backup',
  '/export',
  sample.person && `/person/${sample.person}`,
  sample.family && `/family/${sample.family}`,
  '/classic',
].filter(Boolean);

const results = [];
for (const path of ROUTES) {
  const before = allErrors.length;
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const text = (await page.evaluate(() => document.body.textContent || '')).slice(0, 200).replace(/\s+/g, ' ').trim();
  const errs = allErrors.slice(before).map((x) => x.msg);
  results.push({ path, ok: errs.length === 0, len: text.length, sample: text.slice(0, 80), errs });
}

console.log('path'.padEnd(28), 'ok'.padEnd(4), 'preview');
for (const r of results) {
  console.log(r.path.padEnd(28), (r.ok ? '✓' : '✗').padEnd(4), r.sample);
}
console.log('\n=== ERRORS ===');
const failed = results.filter((r) => !r.ok);
if (failed.length === 0) console.log('(none)');
for (const r of failed) {
  console.log(r.path);
  for (const e of r.errs) console.log('  ' + e);
}

await browser.close();
process.exit(failed.length > 0 ? 1 : 0);
