import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

await page.goto('http://localhost:3000/');
await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  await getLocalDatabase().clearAll();
  localStorage.removeItem('cloudtreeweb-has-imported');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const result = await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const { getSubEntriesForEntry } = await import('/src/lib/changeLogQuery.js');
  const db = getLocalDatabase();
  const target = 'changelogentry-534';
  const entry = await db.getRecord(target);
  const subs = await getSubEntriesForEntry(target);

  // Manual count by direct iteration
  const all = await db.query('ChangeLogSubEntry', { limit: 100000 });
  const manualMatches = all.records.filter((r) => {
    const ref = r.fields?.superEntry?.value;
    const s = typeof ref === 'string' ? ref.split('---')[0] : ref?.recordName;
    return s === target;
  });

  return {
    entryFound: !!entry,
    entryRecordName: entry?.recordName,
    queryReturned: subs.length,
    manualMatch: manualMatches.length,
    sampleManualSuperEntry: manualMatches[0]?.fields?.superEntry,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
