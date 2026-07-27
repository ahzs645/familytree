import { boot } from './nav.mjs';
const W=Number(process.argv[2]);
const {b,p,H,OUT}=await boot(W,W<800?844:900);
const ROUTES=['persons','person/person-575','families','places','sources','events','media','charts','reports','books','settings/general','export','statistics','duplicates','todos','stories','lists','publish','websites','backup','tree','heritage-tree','map','research','plausibility'];
console.log(`=== hidden horizontal overflow @${W} ===`);
for(const r of ROUTES){
  await p.goto(H+r,{waitUntil:'domcontentloaded',timeout:45000}).catch(()=>{});
  await p.waitForTimeout(r==='tree'||r==='heritage-tree'||r==='charts'?9000:3500);
  const hits=await p.evaluate(()=>{
    const vis=e=>e.offsetParent!==null&&e.getBoundingClientRect().height>0;
    const out=[];
    for(const e of document.querySelectorAll('div,nav,ul,section,header')){
      if(!vis(e))continue;
      const hidden=e.scrollWidth-e.clientWidth;
      if(hidden<40)continue;
      const s=getComputedStyle(e);
      const scrolls=/auto|scroll/.test(s.overflowX);
      const n=e.querySelectorAll('a,button').length;
      if(n<3)continue;
      out.push({cls:String(e.className).slice(0,38)||e.tagName, hidden, items:n, scrolls,
        fade: e.parentElement?.className?.includes('scroll-fade')||false});
    }
    // keep only the outermost per overflow amount
    const seen=new Set();
    return out.filter(x=>{const k=x.hidden+'-'+x.items; if(seen.has(k))return false; seen.add(k); return true;}).slice(0,3);
  });
  if(hits.length) hits.forEach(h=>console.log(`  /${r.padEnd(18)} ${h.hidden}px hidden, ${h.items} controls, scrolls=${h.scrolls}${h.fade?' (has fade)':''}  .${h.cls}`));
}
await b.close();
