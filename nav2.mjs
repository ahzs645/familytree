import { boot } from './nav.mjs';
const {b,p,H,OUT}=await boot(1440,900);
await p.goto(H+'persons',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
const heads=await p.evaluate(()=>{
  const out=[];
  document.querySelectorAll('div').forEach(d=>{
    if(d.children.length===0){ const s=getComputedStyle(d); const t=d.textContent.trim();
      if(t && t.length<=3 && (s.backgroundColor!=='rgba(0, 0, 0, 0)'||s.textTransform==='uppercase'||parseFloat(s.letterSpacing)>0)) out.push({t, codes:[...t].map(c=>'U+'+c.codePointAt(0).toString(16))}); }
  });
  return out;
});
console.log('Persons list section headers:');
heads.slice(0,14).forEach(h=>console.log(`  "${h.t}"  ${h.codes.join(' ')}`));
await b.close();
