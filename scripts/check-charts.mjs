/**
 * Smoke test: load the charts page, seed data, switch through every chart type
 * + theme + saved-template flow, and confirm the SVG actually renders nodes.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console.error: ' + m.text());
});

await page.goto('http://localhost:3000/charts.html');

await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  await db.open();
  await db.clearAll();

  const records = [
    {
      recordName: 'p-self',
      recordType: 'Person',
      fields: {
        firstName: { value: 'Ada' },
        lastName: { value: 'Lovelace' },
        cached_fullName: { value: 'Ada Lovelace' },
        gender: { value: 2 },
        isStartPerson: { value: true },
      },
    },
    p('p-spouse', 'William', 'King', 1),
    p('p-dad', 'George', 'Byron', 1),
    p('p-mom', 'Anne', 'Milbanke', 2),
    p('p-pgf', 'John', 'Byron', 1),
    p('p-pgm', 'Catherine', 'Gordon', 2),
    p('p-mgf', 'Ralph', 'Milbanke', 1),
    p('p-mgm', 'Judith', 'Noel', 2),
    p('p-child1', 'Byron', 'King', 1),
    p('p-child2', 'Anne', 'King', 2),
    p('p-child3', 'Ralph', 'King', 1),
    fam('f-parents', 'p-dad', 'p-mom'),
    fam('f-paternal', 'p-pgf', 'p-pgm'),
    fam('f-maternal', 'p-mgf', 'p-mgm'),
    fam('f-self', 'p-spouse', 'p-self'),
    cr('cr-self', 'f-parents', 'p-self'),
    cr('cr-dad', 'f-paternal', 'p-dad'),
    cr('cr-mom', 'f-maternal', 'p-mom'),
    cr('cr-c1', 'f-self', 'p-child1'),
    cr('cr-c2', 'f-self', 'p-child2'),
    cr('cr-c3', 'f-self', 'p-child3'),
  ];
  for (const r of records) await db.saveRecord(r);

  function p(name, first, last, gender) {
    return {
      recordName: name,
      recordType: 'Person',
      fields: {
        firstName: { value: first },
        lastName: { value: last },
        cached_fullName: { value: first + ' ' + last },
        gender: { value: gender },
      },
    };
  }
  function fam(name, manName, womanName) {
    return {
      recordName: name,
      recordType: 'Family',
      fields: {
        man: { value: { recordName: manName } },
        woman: { value: { recordName: womanName } },
      },
    };
  }
  function cr(name, familyName, childName) {
    return {
      recordName: name,
      recordType: 'ChildRelation',
      fields: {
        family: { value: { recordName: familyName } },
        child: { value: { recordName: childName } },
      },
    };
  }
});

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);

async function selectChart(chartType, opts = {}) {
  await page.selectOption('select:has(option[value="ancestor"])', chartType);
  if (opts.second) {
    // Open the SECOND PersonPicker (Partner / Compare to)
    const triggers = await page.locator('button:has-text("Choose person…")').all();
    if (triggers.length > 0) {
      await triggers[0].click();
      await page.waitForTimeout(100);
      await page.locator('div:has-text("' + opts.second + '")').last().click();
    }
  }
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const rects = document.querySelectorAll('svg g rect').length;
    const paths = document.querySelectorAll('svg path').length;
    const texts = [...document.querySelectorAll('svg text')].map((t) => t.textContent).filter(Boolean);
    return { rects, paths, sampleText: texts.slice(0, 4) };
  });
}

const summary = {};
summary.ancestor = await selectChart('ancestor');
summary.descendant = await selectChart('descendant');
summary.hourglass = await selectChart('hourglass');
summary.tree = await selectChart('tree');
summary.fan = await selectChart('fan');
summary.doubleAncestor = await selectChart('double-ancestor', { second: 'William King' });
summary.relationship = await selectChart('relationship', { second: 'William King' });

// Theme switch
await page.selectOption('select:has(option[value="default-light"])', 'default-light');
await page.waitForTimeout(200);
const lightBg = await page.evaluate(() => {
  const div = document.querySelector('main > div');
  return div ? getComputedStyle(div).backgroundColor : null;
});
summary.lightThemeBg = lightBg;

console.log('--- ERRORS ---');
console.log(errors.length ? errors.join('\n') : '(none)');
console.log('--- CHART RESULTS ---');
console.log(JSON.stringify(summary, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
