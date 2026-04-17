import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

await page.goto('http://localhost:3000/');
await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  await getLocalDatabase().clearAll();
  localStorage.removeItem('cloudtreeweb-has-imported');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

await page.goto('http://localhost:3000/change-log', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Find the button whose parent <div> has text matching مؤيد (the user's entry)
const target = page.locator('main button.flex.items-center.w-full', { hasText: 'مؤيد' }).first();
const found = await target.count();
console.log('found target buttons:', found);
if (found > 0) {
  const label = (await target.textContent()).replace(/\s+/g, ' ').trim();
  console.log('clicking entry:', label);
  await target.click();
  await page.waitForTimeout(1500);
  const expanded = page.locator('main .border-t.border-border.bg-background\\/60').first();
  const text = (await expanded.textContent()).replace(/\s+/g, ' ').trim();
  console.log('expanded text:', text.slice(0, 400));
}
console.log('errors:', errors);
await browser.close();
