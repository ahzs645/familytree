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

// Click the third entry (the user-mentioned one was مؤيد — let's try several)
const buttonCount = await page.locator('main button.flex.items-center.w-full').count();
console.log('total entry buttons:', buttonCount);

const results = [];
for (let i = 0; i < Math.min(5, buttonCount); i++) {
  const btn = page.locator('main button.flex.items-center.w-full').nth(i);
  const label = (await btn.textContent()).replace(/\s+/g, ' ').trim().slice(0, 60);
  await btn.click();
  await page.waitForTimeout(1500);
  const expanded = page.locator('main .border-t.border-border.bg-background\\/60').first();
  const text = ((await expanded.textContent().catch(() => '(none)')) || '').replace(/\s+/g, ' ').trim().slice(0, 250);
  results.push({ i, label, text });
  // collapse before next click
  await btn.click();
  await page.waitForTimeout(300);
}

console.log(JSON.stringify(results, null, 2));
console.log('errors:', errors);
await browser.close();
