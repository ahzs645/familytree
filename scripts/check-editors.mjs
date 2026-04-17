/**
 * Verify the rebuilt editors render every section against real data.
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
  const db = getLocalDatabase();
  await db.open();
  await db.clearAll();
  localStorage.removeItem('cloudtreeweb-has-imported');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const sample = await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  const persons = await db.query('Person', { limit: 1 });
  const families = await db.query('Family', { limit: 1 });
  const places = await db.query('Place', { limit: 1 });
  const sources = await db.query('Source', { limit: 1 });
  return {
    person: persons.records[0]?.recordName,
    family: families.records[0]?.recordName,
    place: places.records[0]?.recordName,
    source: sources.records[0]?.recordName,
  };
});

const ROUTES = [
  {
    path: '/person/' + sample.person,
    label: 'Person',
    expectSections: ['Parents', 'Name & Gender', 'Additional Names', 'Events', 'Facts', 'Notes', 'Source Citations', 'Influential Persons', 'Labels', 'Reference Numbers', 'Bookmarks', 'Private', 'Last Edited'],
  },
  {
    path: '/family/' + sample.family,
    label: 'Family',
    expectSections: ['Man', 'Woman', 'Children', 'Family Events', 'Media', 'Notes', 'Source Citations', 'Influential Persons', 'Labels', 'Reference Numbers', 'Bookmarks', 'Private', 'Last Edited'],
  },
  {
    path: '/places',
    label: 'Places',
    expectSections: ['Place Name', 'Place Details', 'Coordinate', 'Map', 'Media', 'Notes', 'Source Citations', 'Labels', 'Reference Numbers', 'Bookmarks', 'Private', 'Last Edited'],
  },
  {
    path: '/sources',
    label: 'Sources',
    expectSections: ['Source Information', 'Source Text', 'Referenced Entries', 'Media', 'Notes', 'Labels', 'Reference Numbers', 'Bookmarks', 'Private', 'Last Edited'],
  },
];

const results = [];
for (const r of ROUTES) {
  const before = errors.length;
  await page.goto(BASE + r.path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const text = await page.evaluate(() => document.body.textContent);
  const missing = r.expectSections.filter((s) => !text.includes(s));
  const errsHere = errors.slice(before);
  results.push({
    path: r.path,
    label: r.label,
    found: r.expectSections.length - missing.length,
    expected: r.expectSections.length,
    missing,
    errors: errsHere,
  });
  if (errsHere.length) console.log(`!! errors on ${r.path}:`, errsHere);
}

// Editor-write loop: edit a person's first name + a label, save, verify persisted
const writeBefore = errors.length;
await page.goto(BASE + '/person/' + sample.person, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const firstNameInput = page.locator('input').first();
await firstNameInput.fill('SMOKETEST');
await page.locator('label:has-text("Important")').first().click();
await page.click('button:has-text("Save changes")');
await page.waitForTimeout(800);
const persisted = await page.evaluate(async (id) => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  const r = await db.getRecord(id);
  const lbl = (await db.query('LabelRelation', { referenceField: 'targetPerson', referenceValue: id, limit: 50 })).records;
  const hasImportant = lbl.some((rel) => {
    const v = rel.fields?.label?.value;
    return typeof v === 'string' ? v.includes('Important') : v?.recordName?.includes('Important');
  });
  return { firstName: r?.fields?.firstName?.value, hasImportant, labelCount: lbl.length };
}, sample.person);

console.log('=== EDITOR SECTIONS ===');
for (const r of results) {
  console.log(`${r.label.padEnd(8)} ${r.found}/${r.expected}${r.missing.length ? ' missing: ' + r.missing.join(', ') : ''}${r.errors.length ? ' [' + r.errors.length + ' err]' : ''}`);
}
console.log('\n=== EDITOR WRITE ===');
console.log(JSON.stringify(persisted, null, 2));
console.log('errors during write:', errors.slice(writeBefore));

await browser.close();
const totalErrors = results.reduce((s, r) => s + r.errors.length, 0) + errors.slice(writeBefore).length;
const anyMissing = results.some((r) => r.missing.length > 0);
process.exit(totalErrors > 0 || anyMissing || persisted.firstName !== 'SMOKETEST' ? 1 : 0);
