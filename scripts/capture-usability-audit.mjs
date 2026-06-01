/**
 * Usability audit capture — screenshots every representative route at BOTH
 * desktop (1440x900) and mobile (390x844) viewports, plus a few interaction
 * states (mobile nav drawer open, person/family editors, list detail pane).
 *
 * Output: scripts/screenshots/audit/{desktop,mobile}/NN-name.png
 * Seeds the real dataset per context (see feedback-screenshot-seeding memory).
 */
import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE = 'http://localhost:3000';
const OUT_D = resolve('scripts/screenshots/audit/desktop');
const OUT_M = resolve('scripts/screenshots/audit/mobile');
await mkdir(OUT_D, { recursive: true });
await mkdir(OUT_M, { recursive: true });

const datasetJson = await readFile('public/family-data.json', 'utf8');

async function seed(page) {
  await page.addInitScript(() => localStorage.setItem('cloudtreeweb-has-imported', '1'));
  await page.goto(BASE + '/');
  await page.evaluate(async (jsonText) => {
    const { getAppDataClient } = await import('/src/lib/data/index.js');
    await getAppDataClient().records.importDataset(JSON.parse(jsonText));
  }, datasetJson);
  await page.waitForFunction(async () => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    return (await getLocalDatabase().query('Person', { limit: 1 })).records.length > 0;
  }, { timeout: 20000 });
}

async function pickTargets(page) {
  return page.evaluate(async () => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    const db = getLocalDatabase();
    const persons = (await db.query('Person', { limit: 100000 })).records;
    let best = null, bestScore = -1;
    for (const p of persons.slice(0, 400)) {
      const [ev, fa, no] = await Promise.all([
        db.query('PersonEvent', { referenceField: 'person', referenceValue: p.recordName, limit: 20 }),
        db.query('PersonFact', { referenceField: 'person', referenceValue: p.recordName, limit: 20 }),
        db.query('Note', { referenceField: 'person', referenceValue: p.recordName, limit: 20 }),
      ]);
      const score = ev.records.length * 2 + fa.records.length + no.records.length;
      if (score > bestScore) { bestScore = score; best = p.recordName; }
    }
    const fams = (await db.query('Family', { limit: 50 })).records;
    return { personId: best, familyId: fams[0]?.recordName };
  });
}

// Representative route set covering every archetype.
function buildShots(t) {
  return [
    { path: '/', file: '01-home', wait: 900 },
    { path: '/persons', file: '02-persons', wait: 1000 },
    { path: '/families', file: '03-families', wait: 900 },
    { path: '/places', file: '04-places', wait: 1100 },
    { path: '/sources', file: '05-sources', wait: 1100 },
    { path: '/events', file: '06-events', wait: 1000 },
    { path: '/media', file: '07-media', wait: 900 },
    { path: '/todos', file: '08-todos', wait: 800 },
    { path: '/stories', file: '09-stories', wait: 800 },
    { path: '/dna', file: '10-dna', wait: 800 },
    { path: '/repositories', file: '11-repositories', wait: 800 },
    { path: '/groups', file: '12-groups', wait: 800 },
    { path: '/labels', file: '13-labels', wait: 800 },
    { path: '/tribal-affiliations', file: '14-tribal', wait: 800 },
    { path: '/research', file: '15-research', wait: 1200 },
    { path: '/search', file: '16-search', wait: 800 },
    { path: '/duplicates', file: '17-duplicates', wait: 900 },
    { path: '/reports', file: '18-reports', wait: 1500 },
    { path: '/books', file: '19-books', wait: 1400 },
    { path: '/statistics', file: '20-statistics', wait: 1800 },
    { path: '/plausibility', file: '21-plausibility', wait: 1500 },
    { path: '/backup', file: '22-backup', wait: 800 },
    { path: '/export', file: '23-export', wait: 900 },
    { path: '/settings/general', file: '24-settings-general', wait: 900 },
    { path: '/settings/formats', file: '25-settings-formats', wait: 900 },
    { path: '/tree', file: '26-tree', wait: 1500, tree: true },
    { path: '/heritage-tree', file: '27-heritage-tree', wait: 1500 },
    { path: '/charts?type=ancestor', file: '28-charts-ancestor', wait: 1500 },
    { path: '/charts?type=fan', file: '29-charts-fan', wait: 1500 },
    { path: '/map', file: '30-map', wait: 2500, map: true },
    { path: '/globe', file: '31-globe', wait: 3500 },
    { path: '/maps-diagram', file: '32-maps-diagram', wait: 2500, map: true },
    { path: '/person/new', file: '33-person-new', wait: 1000 },
  ];
}

async function settle(page, s) {
  await page.goto(BASE + s.path, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(s.wait);
  if (s.tree) {
    await page.waitForFunction(() => !/Loading tree/i.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
  if (s.map) {
    await page.waitForFunction(() => {
      const c = document.querySelector('canvas.maplibregl-canvas');
      return c && c.width > 0;
    }, { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }
}

async function run(label, viewport, outDir) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await seed(page);
  const targets = await pickTargets(page);
  const shots = buildShots();
  // Editor shots use the discovered ids.
  const editorShots = [
    { path: `/person/${targets.personId}`, file: '40-person-editor-top', wait: 1500 },
    { path: `/person/${targets.personId}`, file: '41-person-editor-scrolled', wait: 1500, scroll: 1200 },
    { path: `/family/${targets.familyId}`, file: '42-family-editor', wait: 1500 },
  ];
  const all = [...shots, ...editorShots];

  let done = 0;
  for (const s of all) {
    await settle(page, s);
    if (s.scroll) {
      await page.evaluate((y) => {
        const main = document.querySelector('main');
        const scroller = main?.querySelector('[class*="overflow-y"]') || main;
        (scroller || window).scrollBy?.(0, y);
        if (scroller && 'scrollTop' in scroller) scroller.scrollTop = y;
      }, s.scroll);
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: `${outDir}/${s.file}.png`, fullPage: false });
    done++;
    console.log(`[${label}] ${done}/${all.length} ${s.path} -> ${s.file}.png`);
  }

  // Mobile-only: capture the nav drawer open + a list detail pane.
  if (label === 'mobile') {
    await settle(page, { path: '/persons', file: 'x', wait: 1000 });
    // open mobile menu (button with aria-label nav.mobileMenu / Menu icon, top-right)
    const menuBtn = page.locator('header button[aria-label]').last();
    await menuBtn.click().catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${outDir}/50-mobile-nav-open.png` });
    console.log(`[mobile] nav drawer open -> 50-mobile-nav-open.png`);
    // close & tap first person to show detail pane
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
    const firstRow = page.locator('main button, main a').first();
    await firstRow.click().catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${outDir}/51-persons-detail-pane.png` });
    console.log(`[mobile] persons detail pane -> 51-persons-detail-pane.png`);
  }

  await ctx.close();
}

const browser = await chromium.launch();
await run('desktop', { width: 1440, height: 900 }, OUT_D);
await run('mobile', { width: 390, height: 844 }, OUT_M);
await browser.close();
console.log('\nDONE. Desktop ->', OUT_D, '\nMobile  ->', OUT_M);
