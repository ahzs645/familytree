// Reliable /tree capture — mirrors the seeding flow that renders a full tree:
// import via the data client on '/', then SPA-navigate to /tree (no second full
// page load), wait for the build, dim chrome, screenshot.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT || resolve(__dirname, 'screenshots/mft-port/current-pedigree.png');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 760 }, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message));
await p.addInitScript(() => localStorage.setItem('cloudtreeweb-has-imported', '1'));
const data = await readFile(resolve(__dirname, '../public/family-data.json'), 'utf8');
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.evaluate(async (j) => { const m = await import('/src/lib/data/index.js'); await m.getAppDataClient().records.importDataset(JSON.parse(j)); }, data);
await p.goto('http://localhost:3000/tree', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !/Loading tree/.test(document.body.innerText || ''), { timeout: 30000 }).catch(() => {});
await p.waitForTimeout(Number(process.env.SETTLE || 6000));
await p.evaluate(() => { document.querySelectorAll('header, nav, aside, .toolbar, [class*=toolbar], [class*=panel]').forEach((e) => { e.style.opacity = '0.05'; }); });
await p.screenshot({ path: OUT });
console.log('saved', OUT);
console.log('errors:', JSON.stringify(errs.slice(0, 5)));
await b.close();
