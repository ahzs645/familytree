import { chromium } from 'playwright';
const OUT='/tmp/claude-0/-home-user-familytree/10d8e6c3-382d-56a7-a84c-09519b33bfe6/scratchpad';
const H='http://127.0.0.1:8099/familytree/';
export async function boot(width=1440,height=900){
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const ctx=await b.newContext({viewport:{width,height},hasTouch:width<800,isMobile:width<800});
  const p=await ctx.newPage(); p.on('dialog',d=>d.accept());
  await p.goto(`${H}?url=${encodeURIComponent('http://127.0.0.1:8099/family_tree_arabic.mftpkg.zip')}`,{waitUntil:'domcontentloaded'});
  await p.getByRole('button',{name:/^Import$/}).click();
  await p.waitForSelector('[role=dialog]',{state:'detached',timeout:90000});
  return {b,ctx,p,H,OUT};
}
