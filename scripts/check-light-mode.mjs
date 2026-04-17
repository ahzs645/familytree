/**
 * Verify that every route honours the light/dark theme toggle.
 * Snapshot the computed background + text colors of the top app <main>
 * element in each mode — they must differ.
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
await page.evaluate(() => {
  localStorage.setItem('cloudtreeweb:theme', 'light');
  document.documentElement.classList.remove('dark');
});
await page.waitForTimeout(300);

const sample = await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  const persons = await db.query('Person', { limit: 1 });
  const families = await db.query('Family', { limit: 1 });
  return { personId: persons.records[0]?.recordName, familyId: families.records[0]?.recordName };
});

const ROUTES = [
  { path: '/', label: 'Home' },
  { path: '/tree', label: 'Tree' },
  { path: '/charts', label: 'Charts' },
  { path: '/map', label: 'Map' },
  { path: '/places', label: 'Places' },
  { path: '/sources', label: 'Sources' },
  { path: '/events', label: 'Events' },
  { path: '/media', label: 'Media' },
  { path: '/search', label: 'Search' },
  { path: '/duplicates', label: 'Duplicates' },
  { path: '/reports', label: 'Reports' },
  { path: '/books', label: 'Books' },
  { path: '/change-log', label: 'ChangeLog' },
  sample.personId && { path: '/person/' + sample.personId, label: 'PersonEdit' },
  sample.familyId && { path: '/family/' + sample.familyId, label: 'FamilyEdit' },
].filter(Boolean);

function readComputed() {
  return page.evaluate(() => {
    const body = document.body;
    const main = document.querySelector('main') || body;
    const bs = getComputedStyle(body);
    const ms = getComputedStyle(main);
    const header = document.querySelector('header');
    const hs = header ? getComputedStyle(header) : null;
    return {
      bodyBg: bs.backgroundColor,
      bodyFg: bs.color,
      mainBg: ms.backgroundColor,
      headerBg: hs?.backgroundColor || null,
      dark: document.documentElement.classList.contains('dark'),
    };
  });
}

const report = [];
for (const r of ROUTES) {
  const snapErrors = [];
  errors.length = 0;
  // LIGHT
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('cloudtreeweb:theme', 'light');
  });
  await page.goto(BASE + r.path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const light = await readComputed();
  // DARK
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('cloudtreeweb:theme', 'dark');
  });
  await page.waitForTimeout(300);
  const dark = await readComputed();
  report.push({ path: r.path, light, dark, errors: [...errors] });
}

console.log('path'.padEnd(26), 'light.body'.padEnd(20), 'dark.body'.padEnd(20), 'flip?');
for (const r of report) {
  const flipped = r.light.bodyBg !== r.dark.bodyBg;
  console.log(
    r.path.padEnd(26),
    r.light.bodyBg.padEnd(20),
    r.dark.bodyBg.padEnd(20),
    flipped ? 'yes' : 'NO',
    r.errors.length ? `[${r.errors.length} err]` : ''
  );
}

await browser.close();
const anyBroken = report.some((r) => r.light.bodyBg === r.dark.bodyBg || r.errors.length > 0);
process.exit(anyBroken ? 1 : 0);
