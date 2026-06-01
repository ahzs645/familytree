import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, 'screenshots/mft-port');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 760 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push('CON: ' + m.text().slice(0, 200)); });
await p.addInitScript(() => localStorage.setItem('cloudtreeweb-has-imported', '1'));
const data = await readFile(resolve(__dirname, '../public/family-data.json'), 'utf8');
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.evaluate(async (j) => { const m = await import('/src/lib/data/index.js'); await m.getAppDataClient().records.importDataset(JSON.parse(j)); }, data);
// DO NOT set viewer options — let the app defaults apply (what a fresh user sees).
await p.goto('http://localhost:3000/tree', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !/Loading tree/.test(document.body.innerText || ''), { timeout: 30000 }).catch(() => {});
await p.waitForTimeout(3500);
const opts = await p.evaluate(() => localStorage.getItem('cloudtreeweb:interactive-tree-viewer-options'));
// Full page (with chrome) so we see what the user actually sees.
await p.screenshot({ path: resolve(OUT, 'live-default.png') });
console.log('viewer options after default load:', opts);
console.log('errors:', JSON.stringify(errs.slice(0, 6)));
await b.close();
