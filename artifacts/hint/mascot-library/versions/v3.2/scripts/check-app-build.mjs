import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium,webkit}=createRequire(import.meta.url)('@playwright/test');
const out=fileURLToPath(new URL('../evidence/app-guide/',import.meta.url)),report=[];
for(const engine of ['chromium','webkit']){
  const browser=await {chromium,webkit}[engine].launch(engine==='chromium'?{channel:'chrome'}:{});
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{localStorage.setItem('hint_onboarding_complete_v3','1');localStorage.setItem('hint_launch_seen_v2','1');});
  await page.route('**/api/**',route=>route.fulfill({status:503,json:{error:'ISOLATED_TEST_UNMOCKED_API'}}));
  try{
    await page.goto('http://127.0.0.1:5194/app/ask?hintPreview=embedded');
    await page.waitForFunction(()=>document.querySelector('[data-testid="hint-guide-layer"] canvas')?.dataset.ready==='true');
    await page.locator('.hint-launch-intro').waitFor({state:'detached'});
    const assets=await page.evaluate(()=>performance.getEntriesByType('resource').filter(entry=>entry.name.includes('hint-assets')).map(entry=>({url:new URL(entry.name).pathname,bytes:entry.decodedBodySize})));
    assert.equal(assets.length,1);assert.ok(assets[0].bytes>1000);
    await page.getByRole('button',{name:'Hint',exact:true}).tap();await page.locator('textarea').fill('A small question.');
    await page.waitForTimeout(1000);
    const actor=await page.locator('[data-hint-guide-slot]').boundingBox();assert.equal(actor.width,96);
    assert.deepEqual(errors,[]);await page.screenshot({path:out+`${engine}-production.png`});
    await page.goto('http://127.0.0.1:5194/app?hintPreview=embedded&onboarding=reset');
    await page.waitForFunction(()=>Number(document.querySelector('[data-testid="hint-guide-layer"]')?.dataset.clock)>=4.9);
    assert.equal(await page.getByTestId('hint-guide-layer').getAttribute('data-introduction'),'welcome');
    await page.getByRole('button',{name:'Hint',exact:true}).tap();await page.waitForTimeout(620);
    await page.screenshot({path:out+`${engine}-production-onboarding.png`});
    await page.getByTestId('button-start-onboarding').tap();await page.getByTestId('onboarding-name').waitFor();await page.waitForTimeout(1100);
    assert.equal(await page.locator('.hint-onboarding-step').evaluate(node=>getComputedStyle(node).opacity),'1');
    assert.deepEqual(errors,[]);
    report.push({engine,passed:true,buildFlag:'VITE_HINT_GUIDE_V32=1',assets,checks:['Ask invitation and compact typing position','first welcome, wink and form transition'],errors});console.log(JSON.stringify(report.at(-1)));
  }finally{await browser.close();}
}
await writeFile(out+'production-checks.json',JSON.stringify(report,null,2)+'\n');
