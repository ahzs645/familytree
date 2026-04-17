/**
 * Switch through every chart type with the REAL imported tree and verify each
 * one actually renders content (svg rects/paths/circles + at least one real
 * person name from the data).
 */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

const BASE = 'http://localhost:3000';

await page.goto(BASE + '/');
await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  await db.open();
  await db.clearAll();
  localStorage.removeItem('cloudtreeweb-has-imported');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// Confirm import
const counts = await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const s = await getLocalDatabase().getSummary();
  return { persons: s.types.Person, families: s.types.Family, childRelations: s.types.ChildRelation };
});
console.log('Counts:', counts);

// Pick someone with parents AND children to give every chart real input
const pickedPerson = await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  const persons = (await db.query('Person', { limit: 100000 })).records;
  for (const p of persons) {
    const parents = await db.getPersonsParents(p.recordName);
    const families = await db.getPersonsChildrenInformation(p.recordName);
    const hasChildren = families.some(f => f.children.length > 0);
    if (parents.length > 0 && hasChildren) {
      return { recordName: p.recordName, fullName: p.fields?.cached_fullName?.value };
    }
  }
  return null;
});
console.log('Picked:', pickedPerson);

// Set as active person via sessionStorage
await page.evaluate((id) => {
  sessionStorage.setItem('cloudtreeweb:activePerson', id);
}, pickedPerson.recordName);

const CHART_TYPES = ['ancestor', 'descendant', 'hourglass', 'tree', 'double-ancestor', 'fan', 'relationship', 'virtual'];

const results = {};
for (const type of CHART_TYPES) {
  errors.length = 0;
  await page.goto(`${BASE}/charts?type=${type}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // Some chart types need a second person — pick whoever's first in dropdown
  if (type === 'double-ancestor' || type === 'relationship') {
    const triggers = await page.locator('button:has-text("Choose person…")').all();
    if (triggers.length > 0) {
      await triggers[0].click();
      await page.waitForTimeout(150);
      // Click the first person row in the popover
      const firstRow = await page.locator('[style*="cursor: pointer"]').filter({ hasText: /\w+/ }).nth(2);
      try {
        await firstRow.click({ timeout: 1500 });
      } catch {
        /* ignore */
      }
      await page.waitForTimeout(700);
    }
  }
  const stats = await page.evaluate(() => {
    const svg = document.querySelector('svg');
    return {
      hasSvg: !!svg,
      rects: document.querySelectorAll('svg rect').length,
      paths: document.querySelectorAll('svg path').length,
      circles: document.querySelectorAll('svg circle').length,
      texts: document.querySelectorAll('svg text').length,
      sampleTexts: [...document.querySelectorAll('svg text')].map(t => t.textContent).filter(Boolean).slice(0, 5),
      bodySnippet: document.body.innerText.slice(0, 250),
    };
  });
  results[type] = { stats, errors: [...errors] };
}

console.log('\n=== CHART RESULTS ===');
for (const [type, r] of Object.entries(results)) {
  const ok = r.stats.hasSvg && (r.stats.rects + r.stats.circles + r.stats.paths) > 0 && r.errors.length === 0;
  console.log(`\n${type}: ${ok ? 'OK' : 'FAIL'}`);
  console.log('  rects/paths/circles/texts:', r.stats.rects, '/', r.stats.paths, '/', r.stats.circles, '/', r.stats.texts);
  console.log('  sample texts:', r.stats.sampleTexts);
  if (r.errors.length) console.log('  errors:', r.errors);
  if (!r.stats.hasSvg) console.log('  body:', r.stats.bodySnippet);
}

// Verify relationship-path algorithm on real data, decoupled from picker UI.
const relCheck = await page.evaluate(async (rootId) => {
  const { findRelationshipPath } = await import('/src/lib/relationshipPath.js');
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  // Use the proband and one of their grandparents as a known-related pair.
  const parents = await db.getPersonsParents(rootId);
  if (parents.length === 0) return { skipped: 'no parents' };
  const fatherRef = parents[0]?.man?.recordName;
  if (!fatherRef) return { skipped: 'no father' };
  const grandparents = await db.getPersonsParents(fatherRef);
  const grandfather = grandparents[0]?.man?.recordName;
  if (!grandfather) return { skipped: 'no grandfather' };
  const result = await findRelationshipPath(rootId, grandfather);
  return {
    rootId,
    grandfather,
    label: result?.label,
    steps: result?.steps?.map((s) => s.person?.fullName || '?'),
  };
}, pickedPerson.recordName);
console.log('\n=== RELATIONSHIP ALGORITHM ===');
console.log(JSON.stringify(relCheck, null, 2));

await browser.close();
