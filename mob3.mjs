import { boot } from './nav.mjs';
const {b,p,H,OUT}=await boot(390,844);
const txt=async()=>(await p.locator('body').innerText()).replace(/\s+/g,' ');
const backAffordance=async()=>p.evaluate(()=>{
  const vis=e=>e.offsetParent!==null;
  return [...document.querySelectorAll('button,a')].filter(vis)
    .map(e=>((e.getAttribute('aria-label')||'')+' '+e.textContent.trim()).trim())
    .filter(t=>/back|←|◀|close|✕|×|return|list/i.test(t)).slice(0,5);
});

console.log('=== MOBILE: persons master -> detail ===');
await p.goto(H+'persons',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
const row=p.locator('input[type=checkbox]').first().locator('xpath=ancestor::*[@role="button" or self::div][1]');
await p.getByText('ابو علي',{exact:false}).first().click().catch(async()=>{ await row.click(); });
await p.waitForTimeout(3000);
console.log('after tapping a person, url:', p.url().split('/familytree')[1]);
console.log('  visible:', (await txt()).slice(0,150));
console.log('  back affordances:', JSON.stringify(await backAffordance()));
await p.screenshot({path:OUT+'/shots/m3-person-detail.png'});

console.log('\n=== MOBILE: person editor ===');
await p.goto(H+'person/person-575',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(6000);
console.log('  back affordances:', JSON.stringify(await backAffordance()));
const nav=await p.evaluate(()=>{
  const el=[...document.querySelectorAll('*')].find(e=>e.scrollWidth>e.clientWidth+10 && e.querySelectorAll('button').length>4);
  return el?{tag:el.tagName,cls:String(el.className).slice(0,50),scrollW:el.scrollWidth,clientW:el.clientWidth,btns:[...el.querySelectorAll('button')].slice(0,6).map(b=>b.textContent.trim())}:null;
});
console.log('  section nav (horizontal scroller):', JSON.stringify(nav));
await p.screenshot({path:OUT+'/shots/m3-editor.png'});

console.log('\n=== MOBILE: tree (full-screen takeover) ===');
await p.goto(H+'tree',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(10000);
console.log('  header present?', await p.evaluate(()=>!!document.querySelector('header')));
console.log('  nav menu button present?', await p.getByRole('button',{name:/Open navigation menu/i}).count());
console.log('  back affordances:', JSON.stringify(await backAffordance()));
console.log('  visible:', (await txt()).slice(0,220));
await p.screenshot({path:OUT+'/shots/m3-tree.png'});

console.log('\n=== MOBILE: charts ===');
await p.goto(H+'charts',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(10000);
console.log('  visible:', (await txt()).slice(0,200));
await p.screenshot({path:OUT+'/shots/m3-charts.png'});
await b.close();
