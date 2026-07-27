import { boot } from './nav.mjs';
const {b,p,H}=await boot(1440,900);
await p.goto(H+'persons',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
const heads=await p.evaluate(()=>{const out=[];
  document.querySelectorAll('div').forEach(d=>{ if(d.children.length===0){const s=getComputedStyle(d);const t=d.textContent.trim();
    if(t&&t.length<=3&&(s.backgroundColor!=='rgba(0, 0, 0, 0)'||parseFloat(s.letterSpacing)>0))out.push(t);}});
  return out;});
console.log('section headers now:', JSON.stringify(heads.slice(0,16)));
console.log('duplicate alef sections?', heads.filter(h=>['أ','إ','آ','ا'].includes(h)).length, '(want 1)');

console.log('\n--- search a single Arabic letter ---');
const box=p.locator('input[placeholder*="Search persons"]').first();
for (const q of ['د','ا','أحمد']) {
  await box.fill(q); await p.waitForTimeout(1800);
  const n=await p.evaluate(()=>document.querySelectorAll('input[type=checkbox]').length);
  console.log(`  "${q}" -> ${n} rows`);
}
await b.close();
