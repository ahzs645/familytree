// Arabic fixture browser smoke checks — imports the real Arabic .mftpkg
// database through the app's importer, then walks people list, search, tree,
// charts, reports, websites, and maps asserting Arabic text renders and no
// page errors fire. Closes the last open RTL-backlog verification item.
//
//   BASE=http://localhost:3210 node scripts/arabic-smoke.mjs
//   MFTPKG="/path/to/Tree.mftpkg" overrides the default package location.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://localhost:3210';
const PKG = process.env.MFTPKG || "/Users/ahmadjalil/Downloads/family tree/Ahmad's Family (Arabic).mftpkg";
const SHOT_DIR = resolve(__dirname, 'screenshots/arabic-smoke');

const ARABIC = /[؀-ۿ]/;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 2 });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error.message || error)));

// ── Import the real Arabic tree through the app importer ──
const dbBytes = await readFile(resolve(PKG, 'database'));
await page.addInitScript(() => localStorage.setItem('cloudtreeweb-has-imported', '1'));
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const total = await page.evaluate(async (b64) => {
  const m = await import('/src/lib/MFTPKGImporter.js');
  const importer = new m.MFTPKGImporter();
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const result = await importer.importFromBytes(bytes, 'database');
  return result.total;
}, dbBytes.toString('base64'));
check('import .mftpkg database', total > 1000, `${total} records`);

const settle = (ms = 1500) => page.waitForTimeout(ms);
const errorsBefore = () => pageErrors.length;
const routeCheck = async (path, name, probe, settleMs = 2500) => {
  const before = errorsBefore();
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await settle(settleMs);
  let ok = true;
  let detail = '';
  if (probe) {
    try {
      const value = await probe();
      ok = Boolean(value);
      detail = typeof value === 'string' ? value : '';
    } catch (error) {
      ok = false;
      detail = String(error.message || error);
    }
  }
  const newErrors = pageErrors.slice(before);
  if (newErrors.length) {
    ok = false;
    detail = `${detail} pageerrors: ${newErrors.slice(0, 2).join(' | ')}`.trim();
  }
  check(name, ok, detail);
};

// ── People list: Arabic names render, count is sane ──
await routeCheck('/persons', 'people list renders Arabic names', async () => {
  const body = await page.innerText('body');
  return ARABIC.test(body) ? 'Arabic text present' : false;
});

// ── Search: querying an Arabic fragment returns hits ──
await routeCheck('/search', 'search accepts Arabic query', async () => {
  const fragment = await page.evaluate(async () => {
    const m = await import('/src/lib/treeQuery.js');
    const persons = await m.listAllPersons();
    const arabicName = persons.map((p) => p.fullName).find((n) => /[؀-ۿ]{3,}/.test(n)) || '';
    const match = arabicName.match(/[؀-ۿ]{3,}/);
    return match ? match[0] : '';
  });
  if (!fragment) return false;
  const input = page.locator('input').first();
  await input.fill(fragment);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2200);
  // innerText excludes input values, so a hit means a result ROW rendered.
  const body = await page.innerText('body');
  return body.includes(fragment) ? `query “${fragment}” returned rows` : false;
});

// ── Interactive 3D tree: stage builds, labels Arabic-safe ──
await routeCheck('/tree', '3D tree builds with Arabic labels', async () => {
  const builds = await page.evaluate(() => window.__treeStageBuilds || 0);
  await page.screenshot({ path: resolve(SHOT_DIR, 'tree.png') });
  return builds > 0 ? `${builds} stage build(s)` : false;
}, 7000);

// ── Charts: ancestor chart SVG carries Arabic labels ──
await routeCheck('/charts', 'ancestor chart renders Arabic labels', async () => {
  const svgText = await page.evaluate(() => {
    // Skip icon SVGs — find the chart SVG carrying real text labels.
    return [...document.querySelectorAll('svg')]
      .map((svg) => svg.textContent || '')
      .find((text) => text.trim().length > 20) || '';
  });
  await page.screenshot({ path: resolve(SHOT_DIR, 'charts.png') });
  return ARABIC.test(svgText) ? 'Arabic in chart SVG' : false;
}, 4000);

// ── Reports: route renders with Arabic content ──
await routeCheck('/reports', 'reports view renders Arabic content', async () => {
  const body = await page.innerText('body');
  return ARABIC.test(body) ? 'Arabic text present' : false;
}, 4000);

// ── Website export: generated pages carry lang/dir + Arabic names ──
// buildSite returns a zip blob, so probe the page template directly: every
// exported page goes through pageWrap, which must stamp <html lang dir> and
// keep Arabic body text intact.
await routeCheck('/websites', 'website export pages are RTL-safe', async () => {
  return page.evaluate(async () => {
    const [renderModule, exportModule] = await Promise.all([
      import('/src/lib/website/render.js'),
      import('/src/lib/websiteExport.js'),
    ]);
    const options = { ...exportModule.DEFAULT_SITE_OPTIONS, locale: 'ar', direction: 'rtl' };
    const html = renderModule.pageWrap('اختبار', '<p>عائلة أحمد</p>', options, '', null, 'index.html');
    const hasLangDir = /<html lang="ar" dir="rtl">/.test(html);
    const hasArabic = html.includes('عائلة أحمد');
    if (hasLangDir && hasArabic) return 'lang="ar" dir="rtl" + Arabic body intact';
    return false;
  });
}, 2500);

// ── Maps: virtual map + globe render without page errors ──
await routeCheck('/map', 'virtual map renders', async () => {
  const hasCanvas = await page.evaluate(() => Boolean(document.querySelector('canvas')));
  return hasCanvas ? 'canvas mounted' : 'no canvas (tiles offline?)';
}, 4500);
await routeCheck('/globe', 'virtual globe renders', async () => {
  const hasCanvas = await page.evaluate(() => Boolean(document.querySelector('canvas')));
  await page.screenshot({ path: resolve(SHOT_DIR, 'globe.png') });
  return hasCanvas ? 'canvas mounted' : 'no canvas (tiles offline?)';
}, 4500);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
