// Diagnose diagonal connector trunks in the 3D tree layout with the real dataset.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch();
const p = await b.newPage();
const data = await readFile(resolve(__dirname, '../public/family-data.json'), 'utf8');
await p.addInitScript(() => localStorage.setItem('cloudtreeweb-has-imported', '1'));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
const report = await p.evaluate(async (j) => {
  const dataMod = await import('/src/lib/data/index.js');
  await dataMod.getAppDataClient().records.importDataset(JSON.parse(j));
  const tq = await import('/src/lib/treeQuery.js');
  const layoutMod = await import('/src/components/interactive/threeDTree/layout.js');
  const start = await tq.findStartPerson();
  const startId = start.recordName;
  const graph = await tq.buildInteractiveFamilyGraph(startId, {});
  const layout = layoutMod.buildInteractiveLayout(null, null, startId, graph, {});
  const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));
  // families whose parent-couple midpoint is far in x from their children span
  const out = [];
  for (const fam of graph.families || []) {
    const parents = (fam.parents || []).map((id) => nodeById.get(id)).filter(Boolean);
    const children = (fam.children || []).map((id) => nodeById.get(id)).filter(Boolean);
    if (!parents.length || !children.length) continue;
    const coupleX = parents.reduce((s, n) => s + n.x, 0) / parents.length;
    const minC = Math.min(...children.map((n) => n.x));
    const maxC = Math.max(...children.map((n) => n.x));
    const dist = coupleX < minC ? minC - coupleX : coupleX > maxC ? coupleX - maxC : 0;
    const childSpan = maxC - minC;
    if (dist > 200 || childSpan > 1200) {
      out.push({
        family: fam.id, dist: Math.round(dist), childSpan: Math.round(childSpan),
        parentGen: parents[0].generation,
        parents: parents.map((n) => `${n.id}@${Math.round(n.x)},g${n.generation}`),
        children: children.map((n) => `${n.id}@${Math.round(n.x)},g${n.generation}`),
      });
    }
  }
  return { nodes: layout.nodes.length, links: layout.links.length, suspicious: out };
}, data);
console.log(JSON.stringify(report, null, 1));
await b.close();
