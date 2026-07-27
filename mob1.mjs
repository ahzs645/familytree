import { boot } from './nav.mjs';
const {b,p,H,OUT}=await boot(390,844);
console.log('=== MOBILE 390x844 ===');
await p.goto(H+'persons',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
await p.screenshot({path:OUT+'/shots/m1-persons.png'});
console.log('visible top bar:', (await p.locator('header').first().innerText().catch(()=>'')).replace(/\s+/g,' ').slice(0,120));

console.log('\n--- open the menu ---');
const menuBtn=p.locator('header button').first();
console.log('first header button aria-label:', await menuBtn.getAttribute('aria-label'));
await menuBtn.click(); await p.waitForTimeout(1500);
await p.screenshot({path:OUT+'/shots/m1-menu.png'});
const menu=await p.evaluate(()=>{
  const links=[...document.querySelectorAll('a')].filter(a=>a.offsetParent!==null).map(a=>a.textContent.trim()).filter(Boolean);
  const heads=[...document.querySelectorAll('button')].filter(x=>x.offsetParent!==null&&/^[A-Z&\s]+$/.test(x.textContent.trim())&&x.textContent.trim().length>3).map(x=>x.textContent.trim());
  return {links, heads, scrollH:document.body.scrollHeight, clientH:document.documentElement.clientHeight};
});
console.log('group headers in menu:', JSON.stringify(menu.heads));
console.log(`links visible: ${menu.links.length} ::`, menu.links.slice(0,25).join(' | '));

console.log('\n--- tap target sizes in the menu ---');
const taps=await p.evaluate(()=>{
  const els=[...document.querySelectorAll('a,button')].filter(e=>e.offsetParent!==null);
  const small=els.map(e=>({t:(e.textContent||'').trim().slice(0,22),h:Math.round(e.getBoundingClientRect().height),w:Math.round(e.getBoundingClientRect().width)}))
    .filter(x=>x.h>0&&x.h<44);
  return {total:els.length, small:small.slice(0,10), smallCount:small.length};
});
console.log(`interactive elements: ${taps.total}, below 44px tall: ${taps.smallCount}`);
console.log('  examples:', JSON.stringify(taps.small));
await b.close();
