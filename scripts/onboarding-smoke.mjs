import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const OUT = '/tmp/onboarding-shots';
await mkdir(OUT, { recursive: true });

const BASE = 'http://localhost:3000';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('[console.error]', msg.text());
});

await page.addInitScript(() => {
  if (sessionStorage.getItem('smoke-initialized')) return;
  sessionStorage.setItem('smoke-initialized', '1');
  localStorage.clear();
  for (const dbName of ['cloudtreeweb-local', 'cloudtreeweb-tree-library']) {
    indexedDB.deleteDatabase(dbName);
  }
});

// First-run: go to /, expect auto-redirect to /welcome.
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForURL(/\/welcome$/, { timeout: 8000 });
await page.getByRole('heading', { name: /Name your family tree/i }).waitFor({ timeout: 5000 });
await page.screenshot({ path: `${OUT}/01-welcome-step1.png` });

await page.fill('input[type="text"]', 'Smoke Test Tree');
await page.getByRole('button', { name: /^Next$/ }).click();
await page.getByRole('heading', { name: /Add yourself/i }).waitFor({ timeout: 5000 });
await page.screenshot({ path: `${OUT}/02-welcome-step2.png` });

const inputs = page.locator('form input');
await inputs.nth(0).fill('Alex');
await inputs.nth(1).fill('Tester');
await page.locator('form input').last().fill('1990');
await page.getByRole('button', { name: /Create family tree/i }).click();

// Wait until URL settles on /tree AND the body has actual tree content
// (so we know React Router has actually transitioned, not just URL changed).
await page.waitForURL(/\/tree$/, { timeout: 15000 });
await page.waitForFunction(() => !document.querySelector('h1') || !/Add yourself|Name your family tree/.test(document.querySelector('h1').textContent || ''), null, { timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/03-tree-after-onboarding.png`, fullPage: true });

const counts = await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  const people = (await db.query('Person', { limit: 100 })).records;
  const activeId = localStorage.getItem('cloudtreeweb.activeTreeId');
  return {
    count: people.length,
    names: people.map((p) => p.fields?.cached_fullName?.value),
    start: people.filter((p) => p.fields?.isStartPerson?.value).length,
    activeId,
  };
});
console.log('dataset after first onboarding:', counts);

// 3D tree view explicitly hides the nav drawer. Navigate to Home where the
// drawer (and the TreeSwitcher) is always visible.
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/04-home-with-active-tree.png`, fullPage: true });

const switcherTrigger = page.locator('aside[aria-label="Primary navigation"] button[aria-haspopup="listbox"]').first();
const switcherLabel = (await switcherTrigger.innerText().catch(() => '(not found)')).trim();
console.log('TreeSwitcher current label:', switcherLabel);
await switcherTrigger.click();
await page.waitForTimeout(300);
const dropdownItems = await page.locator('[role="listbox"] button').allInnerTexts();
console.log('TreeSwitcher items:', dropdownItems.map((t) => t.replace(/\s+/g, ' ').trim()));
await page.screenshot({ path: `${OUT}/05-tree-switcher-open.png` });

// "My family trees" on Home should also list the active tree with a "Current"
// badge — verify it's rendered and active.
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const myTreesCard = await page.locator('section').filter({ hasText: 'My family trees' }).innerText().catch(() => '(no my trees)');
console.log('Home My-trees section:', myTreesCard.replace(/\s+/g, ' ').slice(0, 200));

await browser.close();
console.log('SMOKE OK — screenshots in', OUT);
