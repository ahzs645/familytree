import { boot } from './nav.mjs';
const W=Number(process.argv[2]);
const {b,p,H,OUT}=await boot(W,W<800?844:900);
await p.goto(H+'heritage-tree',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(11000);
const r=await p.evaluate(()=>{
  const el=document.querySelector('.heritage-tree-view');
  if(!el) return {err:'no .heritage-tree-view'};
  const s=getComputedStyle(el);
  const vw=document.documentElement.clientWidth;
  const kids=[...el.querySelectorAll('a,button')].map(x=>({t:((x.getAttribute('aria-label')||'')+' '+x.textContent.trim()).trim().slice(0,24),
    L:Math.round(x.getBoundingClientRect().left),R:Math.round(x.getBoundingClientRect().right)}));
  return {vw, scrollW:el.scrollWidth, clientW:el.clientWidth, overflowX:s.overflowX, overflow:s.overflow,
          offscreen:kids.filter(k=>k.R>vw||k.L<0), all:kids.length};
});
console.log(`@${W}`, JSON.stringify(r,null,1));
await p.screenshot({path:`${OUT}/shots/ht-${W}.png`});
await b.close();
