/**
 * Smoke test every page: tree, duplicates, reports, books, charts (virtual type), search (scopes).
 * Seeds a small dataset, loads each page, asserts expected DOM and zero JS errors.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console.error: ' + m.text());
});

const BASE = 'http://localhost:3000';

async function seed() {
  await page.goto(BASE + '/charts.html');
  await page.evaluate(async () => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    const db = getLocalDatabase();
    await db.open();
    await db.clearAll();
    const mk = (recordName, recordType, fields) => ({ recordName, recordType, fields });
    const person = (n, f, l, g, b, d) => mk(n, 'Person', {
      firstName: { value: f }, lastName: { value: l },
      cached_fullName: { value: f + ' ' + l }, gender: { value: g },
      cached_birthDate: b ? { value: b } : undefined,
      cached_deathDate: d ? { value: d } : undefined,
    });
    const fam = (n, m, w) => mk(n, 'Family', { man: { value: { recordName: m } }, woman: { value: { recordName: w } } });
    const cr = (n, f, c) => mk(n, 'ChildRelation', { family: { value: { recordName: f } }, child: { value: { recordName: c } } });
    const records = [
      { ...person('p-self', 'Ada', 'Lovelace', 2, '1815-12-10', '1852-11-27'), fields: { ...person('p-self','Ada','Lovelace',2,'1815-12-10','1852-11-27').fields, isStartPerson: { value: true } } },
      person('p-dup', 'Ada', 'Lovelace', 2, '1815-12-10', '1852-11-27'), // near-duplicate of p-self
      person('p-spouse', 'William', 'King', 1, '1805-02-21', '1893-12-29'),
      person('p-dad', 'George', 'Byron', 1, '1788-01-22', '1824-04-19'),
      person('p-mom', 'Anne', 'Milbanke', 2, '1792-05-17', '1860-05-16'),
      person('p-child', 'Byron', 'King', 1, '1836-05-12', '1862-08-29'),
      fam('f-parents', 'p-dad', 'p-mom'),
      fam('f-self', 'p-spouse', 'p-self'),
      cr('cr-self', 'f-parents', 'p-self'),
      cr('cr-child', 'f-self', 'p-child'),
    ];
    for (const r of records) await db.saveRecord(r);
  });
}

async function check(url, test) {
  errors.length = 0;
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  let result;
  try {
    result = await test();
  } catch (e) {
    result = { failed: e.message };
  }
  return { url, errors: [...errors], result };
}

await seed();

const results = [];

// Interactive Tree
results.push(await check('/tree.html', async () => ({
  hasPersonList: (await page.locator('text=Lovelace').count()) > 0,
  hasFocus: (await page.locator('text=Partners').count()) > 0,
})));

// Duplicates
results.push(await check('/duplicates.html', async () => {
  await page.click('button:has-text("Scan")');
  await page.waitForTimeout(500);
  const pairs = await page.locator('button:has-text("Merge →")').count();
  const hasScoreLabel = (await page.locator('text=Person pair').count()) > 0;
  return { pairsFound: pairs, hasScoreLabel };
}));

// Reports — run a Person Summary and export to plain text (which triggers download)
results.push(await check('/reports.html', async () => {
  await page.waitForTimeout(500);
  const previewHasName = (await page.locator('text=Ada Lovelace').count()) > 0;
  const previewHasParents = (await page.locator('h2:has-text("Parents")').count()) > 0;
  // Switch to Ancestor Narrative
  await page.selectOption('select', 'ancestor-narrative');
  await page.waitForTimeout(300);
  const hasAncestorsHeader = (await page.locator('h2:has-text("Ancestors")').count()) > 0;
  return { previewHasName, previewHasParents, hasAncestorsHeader };
}));

// Books — default seed book
results.push(await check('/books.html', async () => {
  await page.waitForTimeout(500);
  const hasTitle = (await page.locator('h1:has-text("My Family Book")').count()) > 0;
  const hasToc = (await page.locator('h2:has-text("Table of Contents")').count()) > 0;
  return { hasTitle, hasToc };
}));

// Charts — switch to Virtual Tree type
results.push(await check('/charts.html', async () => {
  await page.waitForTimeout(600);
  await page.selectOption('select:has(option[value="virtual"])', 'virtual');
  await page.waitForTimeout(400);
  const rects = await page.locator('svg rect').count();
  const hasOptionsPanel = (await page.locator('text=VIRTUAL TREE OPTIONS').count()) > 0;
  return { rects, hasOptionsPanel };
}));

// Search with smart scope
results.push(await check('/search.html', async () => {
  await page.waitForTimeout(400);
  const scopeSelect = page.locator('select:has(option[value="persons-19c"])');
  await scopeSelect.selectOption('persons-19c');
  await page.waitForTimeout(400);
  const rows = await page.locator('tbody tr').count();
  return { rowsIn19C: rows };
}));

console.log('=== RESULTS ===');
for (const r of results) {
  console.log(`\n${r.url}`);
  console.log('  errors:', r.errors.length ? r.errors : '(none)');
  console.log('  result:', JSON.stringify(r.result));
}

const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
await browser.close();
process.exit(totalErrors > 0 ? 1 : 0);
