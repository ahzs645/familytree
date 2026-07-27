import { boot } from './nav.mjs';
const {b,p,H,OUT}=await boot(1440,900);
console.log('=== DESKTOP DRAWER ===');
await p.goto(H+'persons',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000);
const groups=await p.evaluate(()=>[...document.querySelectorAll('aside button, nav button')]
  .filter(x=>x.textContent.trim()&&/^[A-Z& ]+$/.test(x.textContent.trim()))
  .map(x=>({t:x.textContent.trim(),exp:x.getAttribute('aria-expanded')})));
console.log('group headers:', JSON.stringify(groups));
const links=await p.evaluate(()=>[...document.querySelectorAll('aside a, nav a')].map(a=>a.textContent.trim()).filter(Boolean));
console.log(`visible links on load: ${links.length} ::`, links.join(' | '));
await p.screenshot({path:OUT+'/shots/n-desktop-default.png'});

console.log('\n--- expand every group ---');
for(const g of groups){
  await p.getByRole('button',{name:g.t,exact:true}).first().click().catch(e=>console.log('  click fail',g.t));
  await p.waitForTimeout(500);
}
const allLinks=await p.evaluate(()=>[...document.querySelectorAll('aside a, nav a')].map(a=>a.textContent.trim()).filter(Boolean));
console.log(`links after expanding all: ${allLinks.length}`);
const h=await p.evaluate(()=>{const el=document.querySelector('aside');return {scrollH:el?.scrollHeight,clientH:el?.clientHeight};});
console.log('drawer scrollHeight/clientHeight:',JSON.stringify(h), h.scrollH>h.clientH?'(scrolls — ok)':'(fits)');
await p.screenshot({path:OUT+'/shots/n-desktop-allgroups.png'});

console.log('\n--- rail (collapsed) mode ---');
const collapseBtn=p.locator('aside button').filter({has:p.locator('svg')}).first();
await p.getByRole('button',{name:/collaps|expand/i}).first().click().catch(async()=>{ await collapseBtn.click(); });
await p.waitForTimeout(1200);
const railW=await p.evaluate(()=>document.querySelector('aside')?.getBoundingClientRect().width);
const railText=await p.evaluate(()=>document.querySelector('aside')?.innerText.replace(/\s+/g,' ').slice(0,120));
console.log('rail width:',railW,' text:',JSON.stringify(railText));
await p.screenshot({path:OUT+'/shots/n-desktop-rail.png'});

console.log('\n--- command palette ---');
await p.keyboard.press('Control+k'); await p.waitForTimeout(1200);
let paletteOpen=await p.evaluate(()=>!!document.querySelector('[role=dialog], [class*=palette]'));
console.log('opened with Ctrl+K:',paletteOpen);
if(paletteOpen){
  await p.keyboard.type('marriage'); await p.waitForTimeout(900);
  const res=await p.evaluate(()=>[...document.querySelectorAll('[role=option],[role=dialog] button,[role=dialog] li')].map(x=>x.textContent.trim()).filter(Boolean).slice(0,8));
  console.log('  results for "marriage":',JSON.stringify(res));
  await p.screenshot({path:OUT+'/shots/n-desktop-palette.png'});
  await p.keyboard.press('Escape'); await p.waitForTimeout(600);
  console.log('  closes on Escape:', !(await p.evaluate(()=>!!document.querySelector('[role=dialog]'))));
}
await b.close();
