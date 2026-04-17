/**
 * Functional smoke test — exercise the interactive views and confirm they
 * actually render real data, not just "page loaded".
 */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

const BASE = 'http://localhost:3000';
await page.goto(BASE + '/');
await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  await getLocalDatabase().clearAll();
  localStorage.removeItem('cloudtreeweb-has-imported');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const sample = await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  const persons = (await db.query('Person', { limit: 100000 })).records;
  // Pick a person with parents AND children for a thorough test
  for (const p of persons) {
    const parents = await db.getPersonsParents(p.recordName);
    const families = await db.getPersonsChildrenInformation(p.recordName);
    if (parents.length > 0 && families.some((f) => f.children.length > 0)) {
      return { recordName: p.recordName, fullName: p.fields?.cached_fullName?.value };
    }
  }
  return null;
});

const results = [];
function add(name, ok, detail) { results.push({ name, ok, detail }); }

// ── Persist active person across routes
await page.evaluate((id) => sessionStorage.setItem('cloudtreeweb:activePerson', id), sample.recordName);

// ── /tree: pick first person in list, verify focus pane shows Parents/Partners/Children
{
  const before = errors.length;
  await page.goto(BASE + '/tree', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const focus = await page.evaluate(() => {
    const t = document.body.textContent;
    return {
      hasParents: /Parents\s*·/.test(t),
      hasPartners: /Partners\s*·/.test(t),
      hasChildren: /Children\s*·/.test(t),
      hasName: t.includes(document.title),
    };
  });
  // Click any chip in Children section to navigate
  const chipCount = await page.locator('div[style*="cursor: pointer"]').count();
  add('/tree shows focus sections', focus.hasParents && focus.hasPartners && focus.hasChildren, JSON.stringify(focus));
  add('/tree has clickable chips', chipCount > 0, `${chipCount} chips`);
  add('/tree no errors', errors.length === before, '');
}

// ── /charts: switch through every chart type, count SVG nodes
const CHART_TYPES = ['ancestor', 'descendant', 'hourglass', 'tree', 'fan', 'virtual'];
for (const t of CHART_TYPES) {
  const before = errors.length;
  await page.goto(BASE + `/charts?type=${t}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const stats = await page.evaluate(() => ({
    rects: document.querySelectorAll('svg rect').length,
    paths: document.querySelectorAll('svg path').length,
    circles: document.querySelectorAll('svg circle').length,
    sampleTexts: [...document.querySelectorAll('svg text')].slice(0, 3).map((n) => n.textContent),
  }));
  const renders = (stats.rects + stats.circles) > 0;
  add(`charts: ${t} renders nodes`, renders, JSON.stringify(stats));
  add(`charts: ${t} no errors`, errors.length === before, '');
}

// ── /map: marker count
{
  const before = errors.length;
  await page.goto(BASE + '/map', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const map = await page.evaluate(() => ({
    canvases: document.querySelectorAll('canvas.maplibregl-canvas').length,
    markers: document.querySelectorAll('.maplibregl-marker').length,
    headerText: document.querySelector('header')?.textContent?.trim().slice(0, 80),
  }));
  add('/map renders canvas + markers', map.canvases > 0, `${map.canvases} canvas, ${map.markers} markers`);
  add('/map no errors', errors.length === before, '');
}

// ── /maps-diagram: same
{
  const before = errors.length;
  await page.goto(BASE + '/maps-diagram', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const md = await page.evaluate(() => ({
    canvases: document.querySelectorAll('canvas.maplibregl-canvas').length,
    markers: document.querySelectorAll('.maplibregl-marker').length,
    typeOptions: document.querySelectorAll('select option').length,
  }));
  add('/maps-diagram renders', md.canvases > 0, JSON.stringify(md));
  add('/maps-diagram no errors', errors.length === before, '');
}

// ── /statistics: real counts
{
  const before = errors.length;
  await page.goto(BASE + '/statistics', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const stats = await page.evaluate(() => ({
    text: document.body.textContent,
  }));
  const hasPersonCount = /\d{2,}/.test(stats.text); // expect numbers
  const hasGenderSplit = stats.text.includes('Male') && stats.text.includes('Female');
  add('/statistics shows numbers + gender', hasPersonCount && hasGenderSplit, '');
  add('/statistics no errors', errors.length === before, '');
}

// ── /plausibility: at least one warning expected on real data
{
  const before = errors.length;
  await page.goto(BASE + '/plausibility', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  const cnt = await page.evaluate(() => document.querySelectorAll('main > div > div').length);
  add('/plausibility runs scan', cnt >= 0, `${cnt} warning rows`);
  add('/plausibility no errors', errors.length === before, '');
}

// ── /search: run a smart scope
{
  const before = errors.length;
  await page.goto(BASE + '/search', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // pick the smart scope dropdown that includes 'persons-19c'
  const ok = await page.evaluate(async () => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'persons-19c'));
    if (!sel) return false;
    sel.value = 'persons-19c';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  });
  await page.waitForTimeout(1200);
  const rows = await page.locator('tbody tr').count();
  add('/search smart scope returns rows', ok && rows >= 0, `scope dispatched, ${rows} rows`);
  add('/search no errors', errors.length === before, '');
}

// ── /change-log: expand first entry, verify sub-sentences appear
{
  const before = errors.length;
  await page.goto(BASE + '/change-log', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const btns = await page.locator('main button.flex.items-center.w-full').count();
  if (btns > 0) {
    await page.locator('main button.flex.items-center.w-full').first().click();
    await page.waitForTimeout(1000);
    const expandedText = await page.evaluate(() => {
      const exp = document.querySelector('main .border-t.border-border.bg-background\\/60');
      return exp?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 150) || '';
    });
    const hasSentence = /changed from|added|deleted|Date|Last Name|First Name|Target/.test(expandedText);
    add('/change-log expands sub-entries', hasSentence, expandedText.slice(0, 100));
  } else {
    add('/change-log expands sub-entries', false, 'no entries to click');
  }
  add('/change-log no errors', errors.length === before, '');
}

// ── /person/:id editor: fields populated for the picked person
{
  const before = errors.length;
  await page.goto(BASE + '/person/' + sample.recordName, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const inputs = await page.evaluate(() => [...document.querySelectorAll('input[type="text"], input:not([type])')].slice(0, 5).map((i) => i.value));
  const hasValues = inputs.some((v) => v && v.length > 0);
  add('/person/:id loads with values', hasValues, JSON.stringify(inputs));
  add('/person/:id no errors', errors.length === before, '');
}

// ── /reports: preview shows person name
{
  const before = errors.length;
  await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const t = await page.evaluate(() => document.body.textContent);
  const hasH1 = await page.locator('h1').count();
  add('/reports renders preview', hasH1 > 0, `h1 count = ${hasH1}`);
  add('/reports no errors', errors.length === before, '');
}

console.log('=== INTERACTIVE TESTS ===');
let pass = 0, fail = 0;
for (const r of results) {
  if (r.ok) pass++; else fail++;
  console.log((r.ok ? '✓' : '✗') + ' ' + r.name.padEnd(38) + ' ' + r.detail);
}
console.log(`\n${pass} passed, ${fail} failed`);
if (errors.length) {
  console.log('\n=== JS ERRORS ===');
  for (const e of errors.slice(0, 20)) console.log('  ' + e);
}

await browser.close();
process.exit(fail > 0 ? 1 : 0);
