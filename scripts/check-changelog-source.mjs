/**
 * Verify the change log loads legacy entries and the source/place editors
 * resolve their template dropdowns from real records.
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
  await getLocalDatabase().clearAll();
  localStorage.removeItem('cloudtreeweb-has-imported');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Change Log
const beforeCl = errors.length;
await page.goto(BASE + '/change-log', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const cl = await page.evaluate(() => {
  const header = document.querySelector('header span:last-of-type')?.textContent || '';
  const rowCount = document.querySelectorAll('main button.flex.items-center.w-full').length;
  const sample = [...document.querySelectorAll('main button.flex.items-center.w-full')].slice(0, 3).map((b) => b.textContent.replace(/\s+/g, ' ').trim());
  return { header, rowCount, sample };
});

// Sources — verify template dropdown shows real templates (not my hardcoded names)
const beforeSrc = errors.length;
await page.goto(BASE + '/sources', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const src = await page.evaluate(() => {
  const select = [...document.querySelectorAll('select')].find((s) => s.previousSibling || s.parentElement?.previousSibling);
  // Easier: find select inside the page that contains "Template"
  const all = [...document.querySelectorAll('select')];
  const tpl = all.find((s) => s.options.length > 5 && [...s.options].some((o) => /Source|Census|Bible|Book/i.test(o.textContent)));
  return {
    selectCount: all.length,
    templateOptionCount: tpl?.options.length ?? 0,
    sampleOptions: tpl ? [...tpl.options].slice(0, 5).map((o) => o.textContent) : [],
  };
});

// Places — same check for place templates
const beforePlc = errors.length;
await page.goto(BASE + '/places', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const plc = await page.evaluate(() => {
  const all = [...document.querySelectorAll('select')];
  const tpl = all.find((s) => s.options.length > 5);
  return {
    selectCount: all.length,
    templateOptionCount: tpl?.options.length ?? 0,
    sampleOptions: tpl ? [...tpl.options].slice(0, 5).map((o) => o.textContent) : [],
  };
});

console.log('=== CHANGE LOG ===');
console.log('header:', cl.header);
console.log('rows:', cl.rowCount);
console.log('sample:', cl.sample);
console.log('errors:', errors.slice(beforeCl, beforeSrc));

console.log('\n=== SOURCES ===');
console.log('templates loaded:', src.templateOptionCount);
console.log('sample:', src.sampleOptions);
console.log('errors:', errors.slice(beforeSrc, beforePlc));

console.log('\n=== PLACES ===');
console.log('templates loaded:', plc.templateOptionCount);
console.log('sample:', plc.sampleOptions);
console.log('errors:', errors.slice(beforePlc));

await browser.close();
process.exit(errors.length ? 1 : 0);
