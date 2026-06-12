// /tree capture with viewer-option overrides seeded BEFORE load — used to
// verify orientation / minification options. OPTS is a JSON object merged over
// the defaults, e.g.:
//   OPTS='{"generationDirection":"leftToRight"}' node scripts/capture-tree-options.mjs
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT || resolve(__dirname, 'screenshots/mft-port/current-options.png');
const OPTS = process.env.OPTS || '{}';
const BASE = process.env.BASE || 'http://localhost:3000';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 760 }, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message));
await p.addInitScript((opts) => {
  localStorage.setItem('cloudtreeweb-has-imported', '1');
  localStorage.setItem(
    'cloudtreeweb:interactive-tree-viewer-options',
    JSON.stringify({ version: 7, ...JSON.parse(opts) })
  );
}, OPTS);
const data = await readFile(resolve(__dirname, '../public/family-data.json'), 'utf8');
await p.goto(BASE + '/', { waitUntil: 'networkidle' });
await p.evaluate(async (j) => { const m = await import('/src/lib/data/index.js'); await m.getAppDataClient().records.importDataset(JSON.parse(j)); }, data);
await p.goto(BASE + '/tree', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !/Loading tree/.test(document.body.innerText || ''), { timeout: 30000 }).catch(() => {});
await p.waitForTimeout(Number(process.env.SETTLE || 6000));
await p.evaluate(() => {
  document.querySelectorAll('header, nav, aside, footer, .toolbar, [class*=toolbar], [class*=panel], [class*=dock], [class*=Dock], [class*=footer], [class*=overlay], [class*=hud]').forEach((e) => { e.style.opacity = '0.04'; });
  document.querySelectorAll('div').forEach((e) => {
    const s = getComputedStyle(e);
    if ((s.position === 'fixed' || s.position === 'absolute') && e.querySelector('button') && !e.querySelector('canvas')) e.style.opacity = '0.04';
  });
});
await p.screenshot({ path: OUT });
console.log('saved', OUT);
console.log('errors:', JSON.stringify(errs.slice(0, 5)));
await b.close();
