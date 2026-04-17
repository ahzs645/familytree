/**
 * Capture screenshots of every interactive view into scripts/screenshots/.
 * Sets a known active person up front so per-person views show real data.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const OUT = resolve('scripts/screenshots');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const BASE = 'http://localhost:3000';
await page.goto(BASE + '/');
await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  await getLocalDatabase().clearAll();
  localStorage.removeItem('cloudtreeweb-has-imported');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Pick a person that has parents AND children for richer views.
const sample = await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  const persons = (await db.query('Person', { limit: 100000 })).records;
  for (const p of persons) {
    const parents = await db.getPersonsParents(p.recordName);
    const families = await db.getPersonsChildrenInformation(p.recordName);
    if (parents.length > 0 && families.some((f) => f.children.length > 0)) {
      return { recordName: p.recordName };
    }
  }
  return { recordName: persons[0]?.recordName };
});
await page.evaluate((id) => sessionStorage.setItem('cloudtreeweb:activePerson', id), sample.recordName);

const family = await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const fams = await getLocalDatabase().query('Family', { limit: 1 });
  return fams.records[0]?.recordName;
});

const SHOTS = [
  { path: '/', file: '01-home.png', wait: 800 },
  { path: '/tree', file: '02-tree.png', wait: 1200 },
  { path: '/charts?type=ancestor', file: '03-charts-ancestor.png', wait: 1200 },
  { path: '/charts?type=descendant', file: '04-charts-descendant.png', wait: 1200 },
  { path: '/charts?type=hourglass', file: '05-charts-hourglass.png', wait: 1200 },
  { path: '/charts?type=tree', file: '06-charts-tree.png', wait: 1200 },
  { path: '/charts?type=fan', file: '07-charts-fan.png', wait: 1200 },
  { path: '/charts?type=virtual', file: '08-charts-virtual.png', wait: 1200 },
  { path: '/map', file: '09-map.png', wait: 2500 },
  { path: '/globe', file: '09b-globe.png', wait: 3500 },
  { path: '/saved-charts', file: '09c-saved-charts.png', wait: 800 },
  { path: '/maps-diagram', file: '10-maps-diagram.png', wait: 2500 },
  { path: '/places', file: '11-places.png', wait: 1200 },
  { path: '/sources', file: '12-sources.png', wait: 1200 },
  { path: '/events', file: '13-events.png', wait: 1200 },
  { path: '/media', file: '14-media.png', wait: 800 },
  { path: '/search', file: '15-search.png', wait: 800 },
  { path: '/duplicates', file: '16-duplicates.png', wait: 800 },
  { path: '/reports', file: '17-reports.png', wait: 1500 },
  { path: '/books', file: '18-books.png', wait: 1500 },
  { path: '/change-log', file: '19-change-log.png', wait: 1200 },
  { path: '/statistics', file: '20-statistics.png', wait: 2000 },
  { path: '/plausibility', file: '21-plausibility.png', wait: 2000 },
  { path: '/maintenance', file: '22-maintenance.png', wait: 800 },
  { path: '/bookmarks', file: '23-bookmarks.png', wait: 800 },
  { path: '/todos', file: '24-todos.png', wait: 800 },
  { path: '/stories', file: '25-stories.png', wait: 800 },
  { path: '/groups', file: '26-groups.png', wait: 800 },
  { path: '/dna', file: '27-dna.png', wait: 800 },
  { path: '/repositories', file: '28-repositories.png', wait: 800 },
  { path: '/slideshow', file: '29-slideshow.png', wait: 1200 },
  { path: '/world-history', file: '30-world-history.png', wait: 1500 },
  { path: '/research', file: '31-research.png', wait: 2000 },
  { path: '/templates', file: '32-templates.png', wait: 800 },
  { path: '/labels', file: '33-labels.png', wait: 800 },
  { path: '/quiz', file: '34-quiz.png', wait: 1500 },
  { path: '/backup', file: '35-backup.png', wait: 800 },
  { path: '/export', file: '36-export.png', wait: 800 },
  { path: '/person/' + sample.recordName, file: '37-person-editor.png', wait: 1500 },
];
if (family) SHOTS.push({ path: '/family/' + family, file: '38-family-editor.png', wait: 1500 });
SHOTS.push({ path: '/classic', file: '39-classic.png', wait: 2500 });

let done = 0;
for (const s of SHOTS) {
  await page.goto(BASE + s.path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(s.wait);
  // Force a tile flush for maps
  if (s.path.includes('/map')) {
    await page.waitForFunction(() => {
      const c = document.querySelector('canvas.maplibregl-canvas');
      return c && c.width > 0;
    }, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: `${OUT}/${s.file}`, fullPage: false });
  done++;
  console.log(`${done}/${SHOTS.length} ${s.path} → ${s.file}`);
}

await browser.close();
console.log(`\nSaved ${done} screenshots to ${OUT}/`);
