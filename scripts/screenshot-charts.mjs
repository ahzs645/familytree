/**
 * Capture screenshots of every chart type from the Charts page Type dropdown,
 * including ones (Double Ancestor, Relationship Path) that require a second
 * person to be picked.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const OUT = resolve('scripts/screenshots');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
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

// Pick a primary person with parents + children, and a related second person
// (a grandparent — guarantees both Double Ancestor and Relationship Path render).
const sample = await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  const persons = (await db.query('Person', { limit: 100000 })).records;
  for (const p of persons) {
    const parents = await db.getPersonsParents(p.recordName);
    const families = await db.getPersonsChildrenInformation(p.recordName);
    if (parents.length === 0 || !families.some((f) => f.children.length > 0)) continue;
    const fatherId = parents[0].man?.recordName;
    if (!fatherId) continue;
    const grandparents = await db.getPersonsParents(fatherId);
    const grandfather = grandparents[0]?.man?.recordName;
    if (!grandfather) continue;
    return { primary: p.recordName, second: grandfather };
  }
  return null;
});
console.log('Picked', sample);

// Set primary via the shared ActivePersonContext
await page.evaluate((id) => sessionStorage.setItem('cloudtreeweb:activePerson', id), sample.primary);

const SHOTS = [
  { type: 'ancestor',        file: '03-charts-ancestor.png' },
  { type: 'descendant',      file: '04-charts-descendant.png' },
  { type: 'hourglass',       file: '05-charts-hourglass.png' },
  { type: 'tree',            file: '06-charts-tree.png' },
  { type: 'double-ancestor', file: '06b-charts-double-ancestor.png', second: true },
  { type: 'fan',             file: '07-charts-fan.png' },
  { type: 'relationship',    file: '07b-charts-relationship.png', second: true },
  { type: 'virtual',         file: '08-charts-virtual.png' },
];

for (const s of SHOTS) {
  await page.goto(BASE + `/charts?type=${s.type}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);

  // For Double Ancestor / Relationship Path, drive the second-person picker.
  if (s.second) {
    // Look up the target person's name so we can search the picker for it.
    const secondName = await page.evaluate(async (id) => {
      const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
      const r = await getLocalDatabase().getRecord(id);
      return r?.fields?.cached_fullName?.value || r?.fields?.firstName?.value || '';
    }, sample.second);
    // Click the picker trigger labelled "Choose person…".
    const trigger = page.locator('button:has-text("Choose person…")').first();
    await trigger.click().catch(() => {});
    await page.waitForTimeout(200);
    // Type the name into the popover search input.
    if (secondName) {
      await page.locator('input[placeholder="Search…"]').first().fill(secondName).catch(() => {});
      await page.waitForTimeout(300);
      // Click the first matching row.
      await page
        .locator(`div:has-text("${secondName}")`)
        .last()
        .click({ timeout: 1500 })
        .catch(() => {});
    }
    await page.waitForTimeout(1500);
  }

  await page.screenshot({ path: `${OUT}/${s.file}`, fullPage: false });
  console.log(`✓ ${s.type} → ${s.file}`);
}

console.log('\nerrors:', errors.length ? errors : '(none)');
await browser.close();
