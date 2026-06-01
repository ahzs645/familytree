import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 760 }, deviceScaleFactor: 1 });
const errs = [];
p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message));
await p.addInitScript(() => localStorage.setItem('cloudtreeweb-has-imported', '1'));
const data = await readFile(resolve(__dirname, '../public/family-data.json'), 'utf8');
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.evaluate(async (j) => { const m = await import('/src/lib/data/index.js'); await m.getAppDataClient().records.importDataset(JSON.parse(j)); }, data);
await p.goto('http://localhost:3000/tree', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !/Loading tree/.test(document.body.innerText || ''), { timeout: 30000 }).catch(() => {});
await p.waitForTimeout(6000);
const box = await p.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const shot = async () => { await p.mouse.move(box.x + 5, box.y + 5); await p.waitForTimeout(400); return (await p.screenshot()).length; };
const before = await shot();
// Click just below busts across the band rows (down-pins live ~ a bust-height below).
let changed = false, hitAt = null;
outer:
for (let fy = 0.20; fy <= 0.62; fy += 0.03) {
  for (let fx = 0.18; fx <= 0.82; fx += 0.035) {
    await p.mouse.click(box.x + box.w * fx, box.y + box.h * fy);
    await p.waitForTimeout(140);
    const now = await shot();
    if (Math.abs(now - before) > before * 0.02) { changed = true; hitAt = { fx: +fx.toFixed(2), fy: +fy.toFixed(2), before, now }; break outer; }
  }
}
console.log('scene changed after a click? (expansion or re-root):', changed, JSON.stringify(hitAt));
console.log('errors:', JSON.stringify(errs.slice(0, 5)));
await b.close();
