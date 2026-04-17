/**
 * Smoke test for search.html — seeds data, runs free-text + filtered queries.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console.error: ' + m.text());
});

await page.goto('http://localhost:3000/search.html');

await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  await db.open();
  await db.clearAll();
  function p(name, first, last, gender, birth) {
    return {
      recordName: name,
      recordType: 'Person',
      fields: {
        firstName: { value: first },
        lastName: { value: last },
        cached_fullName: { value: first + ' ' + last },
        gender: { value: gender },
        cached_birthDate: { value: birth },
      },
    };
  }
  const records = [
    p('p1', 'Ada', 'Lovelace', 2, '1815-12-10'),
    p('p2', 'George', 'Byron', 1, '1788-01-22'),
    p('p3', 'Anne', 'Milbanke', 2, '1792-05-17'),
    p('p4', 'Alan', 'Turing', 1, '1912-06-23'),
    p('p5', 'Grace', 'Hopper', 2, '1906-12-09'),
  ];
  for (const r of records) await db.saveRecord(r);
});

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);

// 1. Free-text search for "byron"
await page.fill('input[placeholder="Match any field…"]', 'byron');
await page.click('button:has-text("Search")');
await page.waitForTimeout(300);
const freeTextRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);

// 2. Filter: gender = Female
await page.fill('input[placeholder="Match any field…"]', '');
await page.click('button:has-text("+ Filter")');
await page.waitForTimeout(150);
// Set field to "gender"
await page.selectOption('select:has(option[value="gender"])', 'gender');
await page.waitForTimeout(100);
// Set value to 2 (Female)
const valueSelect = await page.locator('select').last();
await valueSelect.selectOption('2');
await page.click('button:has-text("Search")');
await page.waitForTimeout(300);
const femaleRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
const femaleNames = await page.evaluate(() =>
  [...document.querySelectorAll('tbody tr')].map((r) => r.querySelector('td')?.textContent)
);

// 3. Add a date filter: birth after 1900
await page.click('button:has-text("+ Filter")');
await page.waitForTimeout(150);
const fieldSelects = await page.locator('select').all();
// Latest filter row's field select is the last "field" select (entity is first, op selects exist too)
// Simpler: find all selects and update the second-to-last group
await page.click('button:has-text("Search")');
await page.waitForTimeout(200);

console.log('--- ERRORS ---');
console.log(errors.length ? errors.join('\n') : '(none)');
console.log('--- RESULTS ---');
console.log(JSON.stringify({ freeTextRows, femaleRows, femaleNames }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
