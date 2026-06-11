// Sample pixel colors from a reference screenshot at normalized coords.
import { chromium } from 'playwright';
const FILE = process.argv[2];
const POINTS = JSON.parse(process.argv[3] || '[]'); // [[name, nx, ny], ...]
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file://' + FILE);
const out = await p.evaluate(async (points) => {
  const img = document.querySelector('img');
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return points.map(([name, nx, ny]) => {
    const x = Math.round(nx * img.naturalWidth), y = Math.round(ny * img.naturalHeight);
    const d = ctx.getImageData(x, y, 1, 1).data;
    const hex = '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    return `${name} (${x},${y}): ${hex} rgb(${d[0]},${d[1]},${d[2]})`;
  });
}, POINTS);
console.log(`image: ${FILE}`);
for (const line of out) console.log(line);
await b.close();
