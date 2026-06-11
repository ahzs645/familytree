// End-to-end test of the DEPLOYED site: import the real .mftpkg via the UI,
// then navigate to /tree and screenshot the rendered 3D tree.
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'https://projects.ahmadjalil.com/familytree';
const PKG = process.env.PKG || "/Users/ahmadjalil/Downloads/family tree/Ahmad's Family (Arabic).mftpkg";
const OUT = process.env.OUT || resolve(__dirname, 'screenshots/mft-port/live-tree-imported.png');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 760 }, deviceScaleFactor: 2 });
const logs = [];
p.on('pageerror', (e) => logs.push('PAGEERR: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') logs.push('CONSOLE: ' + m.text()); });
p.on('requestfailed', (r) => logs.push(`REQFAIL: ${r.url()} — ${r.failure()?.errorText}`));
await p.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });
// feed the hidden file input directly
const input = p.locator('input[type=file]').first();
await input.waitFor({ state: 'attached', timeout: 20000 });
await input.setInputFiles(PKG);
// wait for import to finish: person count / success text or just generous settle
await p.waitForTimeout(3000);
await p.waitForFunction(() => !/importing|parsing|reading/i.test(document.body.innerText || ''), { timeout: 120000 }).catch(() => logs.push('WAIT: import busy-text never cleared'));
await p.waitForTimeout(Number(process.env.SETTLE_IMPORT || 8000));
console.log('--- post-import body ---\n' + (await p.evaluate(() => (document.body.innerText || '').slice(0, 400))));
// SPA-navigate to /tree by clicking a link if present, else hard nav
await p.goto(BASE + '/tree', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForFunction(() => !/Loading tree/.test(document.body.innerText || ''), { timeout: 45000 }).catch(() => logs.push('WAIT: Loading tree never cleared'));
await p.waitForTimeout(Number(process.env.SETTLE || 8000));
await p.screenshot({ path: OUT });
console.log('saved', OUT);
console.log('--- tree body ---\n' + (await p.evaluate(() => (document.body.innerText || '').slice(0, 300))));
console.log('--- logs (' + logs.length + ') ---');
for (const l of logs.slice(0, 30)) console.log(l);
await b.close();
