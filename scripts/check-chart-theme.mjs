import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto('http://localhost:3000/');
// Force light to start
await page.evaluate(() => {
  localStorage.setItem('cloudtreeweb:theme', 'light');
});
await page.reload({ waitUntil: 'networkidle' });
await page.goto('http://localhost:3000/charts', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

async function snap() {
  return page.evaluate(() => {
    const bodies = [...document.querySelectorAll('div')]
      .filter((d) => {
        const bg = getComputedStyle(d).backgroundColor;
        return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
      })
      .slice(0, 3)
      .map((d) => getComputedStyle(d).backgroundColor);
    const svg = document.querySelector('svg');
    const rect = svg ? getComputedStyle(svg.parentElement).backgroundColor : null;
    return { bodies, svgParentBg: rect, html: document.documentElement.className };
  });
}

const beforeToggle = await snap();
await page.click('button[title*="mode"]');
await page.waitForTimeout(800);
const afterToggle = await snap();

console.log('BEFORE toggle (light expected):', JSON.stringify(beforeToggle, null, 2));
console.log('AFTER  toggle (dark expected):', JSON.stringify(afterToggle, null, 2));
console.log('errors:', errors.length ? errors : '(none)');
await browser.close();
process.exit(errors.length || JSON.stringify(beforeToggle) === JSON.stringify(afterToggle) ? 1 : 0);
