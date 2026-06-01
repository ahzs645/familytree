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
await p.waitForFunction(() => !/Loading tree/.test(document.body.innerText || ''), { timeout: 30000 }).catch(() => {});
await p.waitForTimeout(3500);
const camActive = () => p.evaluate(() => { try { const s = JSON.parse(localStorage.getItem('cloudtreeweb:interactive-tree-camera-state') || '{}'); return (s?.topDown || s?.topDownTilted)?.activeId || null; } catch { return null; } });
const box = await p.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const before = await camActive();
let rerootedTo = null;
outer:
for (let fy = 0.32; fy <= 0.62; fy += 0.06) {
  for (let fx = 0.25; fx <= 0.75; fx += 0.06) {
    await p.mouse.dblclick(box.x + box.w * fx, box.y + box.h * fy);
    await p.waitForTimeout(900);
    const a = await camActive();
    if (a !== before) { rerootedTo = a; break outer; }
  }
}
console.log('before:', before, '| double-click re-rooted to:', rerootedTo, '| changed?', rerootedTo !== null);
console.log('errors:', JSON.stringify(errs.slice(0, 5)));
await b.close();
