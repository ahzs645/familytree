/**
 * End-to-end smoke test for the SPA against real data.
 * Loads public/family-data.json into IndexedDB, navigates every route,
 * checks for JS errors and that expected DOM shows up.
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
await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  await db.open();
  await db.clearAll();
  localStorage.removeItem('cloudtreeweb-has-imported');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

const summary = await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  return await getLocalDatabase().getSummary();
});

// Find a real person ID and a real family ID for the editor routes
const sample = await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  const persons = await db.query('Person', { limit: 1 });
  const families = await db.query('Family', { limit: 1 });
  return {
    personId: persons.records[0]?.recordName || null,
    familyId: families.records[0]?.recordName || null,
  };
});

const routes = [
  { path: '/', check: async () => ({ hasImport: (await page.locator('text=Import Family Tree').count()) > 0 }) },
  { path: '/tree', check: async () => ({ hasFocus: (await page.locator('text=Partners').count()) > 0 }) },
  { path: '/charts', check: async () => ({ svgRects: await page.locator('svg rect').count() }) },
  { path: '/places', check: async () => ({ hasItems: (await page.locator('input[placeholder*="Search places"]').count()) > 0 }) },
  { path: '/sources', check: async () => ({ hasItems: (await page.locator('input[placeholder*="Search sources"]').count()) > 0 }) },
  { path: '/events', check: async () => ({ hasFilter: (await page.locator('text=All events').count()) > 0 }) },
  { path: '/media', check: async () => ({ hasFilter: (await page.locator('text=Pictures').count()) > 0 }) },
  { path: '/search', check: async () => ({ hasScopes: (await page.locator('text=Smart Scope').count()) > 0 }) },
  { path: '/duplicates', check: async () => ({ hasScan: (await page.locator('button:has-text("Scan")').count()) > 0 }) },
  { path: '/reports', check: async () => ({ hasExport: (await page.locator('button:has-text("HTML")').count()) > 0 }) },
  { path: '/books', check: async () => ({ hasToc: (await page.locator('text=Table of Contents').count()) > 0 }) },
  { path: '/change-log', check: async () => ({ hasEntityFilter: (await page.locator('text=Entity:').count()) > 0 }) },
  sample.personId && {
    path: '/person/' + sample.personId,
    check: async () => ({ hasSave: (await page.locator('button:has-text("Save changes")').count()) > 0 }),
  },
  sample.familyId && {
    path: '/family/' + sample.familyId,
    check: async () => ({ hasChildren: (await page.locator('text=Children').count()) > 0 }),
  },
  {
    path: '/classic',
    check: async () => ({ hasIframe: (await page.locator('iframe[title="CloudTreeWeb Classic UI"]').count()) > 0 }),
  },
].filter(Boolean);

const results = [];
for (const r of routes) {
  const before = allErrors.length;
  await page.goto(BASE + r.path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  let check = {};
  try {
    check = await r.check();
  } catch (e) {
    check = { failed: e.message };
  }
  results.push({ path: r.path, check, errors: allErrors.slice(before).map((x) => x.msg) });
}

// Editor write test: change a person's middle name on the editor route, save,
// then verify the change is persisted and a ChangeLogEntry was created.
let writeResult = { skipped: true };
if (sample.personId) {
  const before = allErrors.length;
  await page.goto(BASE + '/person/' + sample.personId, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const middleInput = await page.locator('input').nth(1); // 2nd field is "Middle name"
  await middleInput.fill('SMOKE-TEST');
  await page.click('button:has-text("Save changes")');
  await page.waitForTimeout(700);
  const persisted = await page.evaluate(async (id) => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    const r = await getLocalDatabase().getRecord(id);
    return r?.fields?.nameMiddle?.value || null;
  }, sample.personId);
  const newLogCount = await page.evaluate(async () => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    const { records } = await getLocalDatabase().query('ChangeLogEntry', { limit: 100000 });
    return records.filter((r) => r.fields?.author?.value === 'You').length;
  });
  writeResult = {
    personFieldPersisted: persisted,
    newChangeLogEntries: newLogCount,
    errorsDuringWrite: allErrors.slice(before).map((x) => x.msg),
  };
}

console.log('=== DATA ===');
console.log(`public/family-data.json: ${dataSize} KB`);
console.log('Persons:', summary.types.Person, '· Families:', summary.types.Family, '· Places:', summary.types.Place, '· Sources:', summary.types.Source);
console.log('\n=== ROUTES ===');
for (const r of results) {
  console.log(`${r.path}  ${r.errors.length ? 'ERR ' + r.errors.length : 'ok'}  ${JSON.stringify(r.check)}`);
}
console.log('\n=== EDITOR WRITE ===');
console.log(JSON.stringify(writeResult, null, 2));

await browser.close();
const totalErrors = results.reduce((s, r) => s + r.errors.length, 0) + (writeResult.errorsDuringWrite?.length || 0);
process.exit(totalErrors > 0 ? 1 : 0);
