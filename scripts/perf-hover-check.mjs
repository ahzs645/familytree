// Sanity-check pointer-move responsiveness on /tree after the hover decoupling.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 760 } });
const errs = [];
p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message));
await p.addInitScript(() => localStorage.setItem('cloudtreeweb-has-imported', '1'));
const data = await readFile(resolve(__dirname, '../public/family-data.json'), 'utf8');
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.evaluate(async (j) => { const m = await import('/src/lib/data/index.js'); await m.getAppDataClient().records.importDataset(JSON.parse(j)); }, data);
await p.goto('http://localhost:3000/tree', { waitUntil: 'networkidle' });
await p.waitForTimeout(7000);
// sweep the cursor across the tree; measure wall time for N moves
const t0 = Date.now();
let moves = 0;
for (let y = 120; y <= 600; y += 60) {
  for (let x = 100; x <= 1340; x += 60) {
    await p.mouse.move(x, y);
    moves += 1;
  }
}
const elapsed = Date.now() - t0;
console.log(`moves: ${moves}, total ${elapsed}ms, avg ${(elapsed / moves).toFixed(1)}ms/move`);
// single-click select + double-click re-root still work
await p.mouse.click(720, 300);
await p.waitForTimeout(600);
await p.mouse.dblclick(720, 300);
await p.waitForTimeout(2500);
console.log('errors:', JSON.stringify(errs.slice(0, 8)));
await b.close();
