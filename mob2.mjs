import { boot } from './nav.mjs';
const {b,p,H,OUT}=await boot(390,844);
await p.goto(H+'persons',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
const btns=await p.evaluate(()=>[...document.querySelectorAll('header button')].map((x,i)=>({i,al:x.getAttribute('aria-label'),t:x.textContent.trim()})));
console.log('header buttons:', JSON.stringify(btns));

console.log('\n=== NAV MENU ===');
await p.getByRole('button',{name:/menu|navigation/i}).first().click().catch(async()=>{ await p.locator('header button').last().click(); });
await p.waitForTimeout(1500);
await p.screenshot({path:OUT+'/shots/m2-menu.png'});
const m=await p.evaluate(()=>{
  const vis=e=>e.offsetParent!==null && e.getBoundingClientRect().height>0;
  const links=[...document.querySelectorAll('a')].filter(vis).map(a=>a.textContent.trim()).filter(Boolean);
  const btns=[...document.querySelectorAll('button')].filter(vis).map(x=>x.textContent.trim()).filter(Boolean);
  const overlay=document.querySelector('[class*=fixed][class*=inset]');
  return {links, btns:btns.slice(0,20), overlayScroll: overlay?{sh:overlay.scrollHeight,ch:overlay.clientHeight}:null};
});
console.log(`links: ${m.links.length} ::`, m.links.slice(0,30).join(' | '));
console.log('buttons:', m.btns.join(' | '));
console.log('menu scroll:', JSON.stringify(m.overlayScroll));

console.log('\n--- expand a collapsed group, then navigate ---');
const grp=p.getByRole('button',{name:/PLACES|Places & events/i}).first();
if (await grp.count()) { await grp.click(); await p.waitForTimeout(900);
  const after=await p.evaluate(()=>[...document.querySelectorAll('a')].filter(e=>e.offsetParent).map(a=>a.textContent.trim()));
  console.log('links after expanding PLACES:', after.length); }
await p.screenshot({path:OUT+'/shots/m2-menu-expanded.png'});
const target=p.getByRole('link',{name:/^Places$/}).first();
if (await target.count()) { await target.click(); await p.waitForTimeout(3500);
  console.log('navigated to:', p.url().split('/familytree')[1]);
  console.log('menu auto-closed?', !(await p.evaluate(()=>!!document.querySelector('[class*=fixed][class*=inset-0]')))); }
await p.screenshot({path:OUT+'/shots/m2-places.png'});
await b.close();
