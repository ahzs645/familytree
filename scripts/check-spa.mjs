/**
 * End-to-end smoke test for the SPA against real data.
 *
 * Loads public/family-data.json into IndexedDB, navigates every route via
 * react-router, checks for JS errors and that expected DOM shows up.
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DATA_PATH = resolve('public/family-data.json');
if (!existsSync(DATA_PATH)) {
  console.error('public/family-data.json missing — run extract-mftpkg first.');
  process.exit(2);
}
const dataSize = Math.round(readFileSync(DATA_PATH).length / 1024);

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const allErrors = [];
page.on('pageerror', (e) => allErrors.push({ where: page.url(), msg: 'pageerror: ' + e.message }));
page.on('console', (m) => {
  if (m.type() === 'error') allErrors.push({ where: page.url(), msg: 'console.error: ' + m.text() });
});

const BASE = 'http://localhost:3000';

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
// Clear IndexedDB, import the real JSON, then let main.jsx re-mount.
await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  await db.open();
  await db.clearAll();
  // Force auto-load path on the next reload.
  localStorage.removeItem('cloudtreeweb-has-imported');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const summary = await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const s = await getLocalDatabase().getSummary();
  return s;
});

const routes = [
  {
    path: '/',
    check: async () => ({
      hasImportZone: (await page.locator('text=Import Family Tree').count()) > 0,
      hasPersonCount: /persons/.test(await page.textContent('body')),
    }),
  },
  {
    path: '/tree',
    waitFor: 'text=Parents',
    check: async () => ({
      rowsInList: await page.locator('[style*="cursor"]').count(),
      hasFocus: (await page.locator('text=Partners').count()) > 0,
    }),
  },
  {
    path: '/charts',
    waitFor: 'svg',
    check: async () => ({
      svgRects: await page.locator('svg rect').count(),
      hasCanvas: (await page.locator('svg').count()) > 0,
    }),
  },
  {
    path: '/search',
    waitFor: 'text=Entity',
    check: async () => ({
      hasSmartScopes: (await page.locator('text=Smart Scope').count()) > 0,
      scopeRun: await (async () => {
        try {
          await page.selectOption('select:has(option[value="persons-19c"])', 'persons-19c');
          await page.waitForTimeout(500);
          return await page.locator('tbody tr').count();
        } catch {
          return -1;
        }
      })(),
    }),
  },
  {
    path: '/duplicates',
    waitFor: 'text=Find Duplicates',
    check: async () => {
      const hasScan = (await page.locator('button:has-text("Scan")').count()) > 0;
      if (!hasScan) return { hasScan };
      await page.click('button:has-text("Scan")');
      await page.waitForTimeout(1500);
      const pairs = await page.locator('button:has-text("Merge →")').count();
      return { hasScan, pairsFound: pairs };
    },
  },
  {
    path: '/reports',
    waitFor: 'text=Export',
    check: async () => ({
      previewHasTitle: (await page.locator('h1').count()) > 0,
      hasExportButtons: (await page.locator('button:has-text("HTML")').count()) > 0,
    }),
  },
  {
    path: '/books',
    waitFor: 'text=Sections',
    check: async () => ({
      hasTocHeader: (await page.locator('h2:has-text("Table of Contents")').count()) > 0,
      hasSectionList: (await page.locator('text=SECTION 1').count()) > 0,
    }),
  },
];

const results = [];
for (const r of routes) {
  const before = allErrors.length;
  await page.goto(BASE + r.path, { waitUntil: 'networkidle' });
  if (r.waitFor) {
    try {
      await page.waitForSelector(r.waitFor, { timeout: 5000 });
    } catch {
      /* fall through — record will show */
    }
  }
  await page.waitForTimeout(600);
  let check = {};
  try {
    check = await r.check();
  } catch (e) {
    check = { failed: e.message };
  }
  const errorsHere = allErrors.slice(before).map((x) => x.msg);
  results.push({ path: r.path, check, errors: errorsHere });
}

// Check Arabic text specifically — pick a sample person name containing Arabic chars.
await page.goto(BASE + '/tree');
await page.waitForTimeout(600);
const arabicSample = await page.evaluate(() => {
  const text = document.body.innerText;
  const m = text.match(/[\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+)?/);
  return m ? m[0] : null;
});

console.log('=== DATA ===');
console.log(`public/family-data.json: ${dataSize} KB`);
console.log('IndexedDB summary:', JSON.stringify(summary.types));
console.log('\n=== ROUTES ===');
for (const r of results) {
  console.log(`\n${r.path}`);
  console.log('  check:', JSON.stringify(r.check));
  console.log('  errors:', r.errors.length ? r.errors : '(none)');
}
console.log('\n=== ARABIC ===');
console.log('Sample Arabic text on /tree:', arabicSample || '(none found)');

await browser.close();
const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
process.exit(totalErrors > 0 ? 1 : 0);
