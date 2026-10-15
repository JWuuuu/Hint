import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium,webkit}=createRequire(import.meta.url)('@playwright/test');
const out=fileURLToPath(new URL('../evidence/app-onboarding/',import.meta.url));
await mkdir(out,{recursive:true});
const reports=[];

export async function isolatedContext(browser,options={}) {
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1,...options});
  await context.addInitScript(()=>{
    localStorage.setItem('hint_launch_seen_v2','1');
    const get=Storage.prototype.getItem;
    Storage.prototype.getItem=function(key){
      if(key.startsWith('hint_device_session_v1:')&&!get.call(this,key))this.setItem(key,JSON.stringify({token:'isolated-fixture-token-000000000000000000000000000000',ownerId:'isolated-guide-review',expiresAt:'2099-01-01T00:00:00Z'}));
      return get.call(this,key);
    };
  });
  const requests=[];
  await context.route('**/api/**',async route=>{
    const request=route.request(),url=new URL(request.url());requests.push({path:url.pathname,method:request.method()});
    if(url.pathname==='/api/profile'){
      if(request.method()==='GET')return route.fulfill({status:404,json:{error:'PROFILE_NOT_FOUND'}});
      return route.fulfill({json:{...request.postDataJSON(),createdAt:'2026-10-12T00:00:00Z',updatedAt:'2026-10-12T00:00:00Z'}});
    }
    if(url.pathname==='/api/readings')return route.fulfill({json:[]});
    return route.fulfill({status:503,json:{error:'ISOLATED_TEST_UNMOCKED_API'}});
  });
  return {context,requests};
}

for(const engine of process.env.HINT_REVIEW_HELPERS_ONLY?[]:process.env.HINT_REVIEW_ENGINE?[process.env.HINT_REVIEW_ENGINE]:['chromium','webkit']) {
  const browser=await {chromium,webkit}[engine].launch(engine==='chromium'?{channel:'chrome',headless:true}:{headless:true});
  const {context,requests}=await isolatedContext(browser,{recordVideo:{dir:path.join(out,'raw'),size:{width:390,height:844}}});
  const page=await context.newPage(),errors=[],checks=[];
  page.on('pageerror',e=>errors.push(e.message));
  const layer=page.getByTestId('hint-guide-layer');
  const settle=()=>page.waitForTimeout(1150);
  const shot=name=>page.screenshot({path:path.join(out,`${engine}-${name}.png`)});
  const at=async time=>page.waitForFunction(t=>Number(document.querySelector('[data-testid="hint-guide-layer"]')?.dataset.clock)>=t,time);
  try {
    await page.goto('http://127.0.0.1:5173/app/ask?hintGuide=v3.2&hintPreview=embedded&onboarding=reset');
    await layer.waitFor();await at(.15);await shot('flight');
    assert.equal(await page.getByTestId('button-start-onboarding').isEnabled(),true);
    const canvas=await layer.locator('canvas').elementHandle();
    await at(2.97);await shot('peek');await at(3.70);await shot('jump');
    await at(4.78);await shot('wave');
    await page.getByRole('button',{name:'Hint',exact:true}).tap();await page.waitForTimeout(620);await shot('wink');
    for(let i=0;i<4;i++)await page.getByRole('button',{name:'Hint',exact:true}).tap();
    await at(9.25);await shot('settled');
    assert.equal(await page.evaluate(()=>localStorage.getItem('hint_guide_welcome_seen_v32')),'1');
    checks.push('star flight, peek, jump, landing, greeting wave and tap reaction use one player; Begin is available immediately');
    for(const width of [320,390,430]) {
      await page.setViewportSize({width,height:844});await settle();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      const begin=await page.getByTestId('button-start-onboarding').boundingBox();assert.ok(begin.y>=0&&begin.y+begin.height<=844);
      await shot(`welcome-${width}`);
    }
    await page.setViewportSize({width:390,height:844});await settle();
    await page.getByTestId('button-start-onboarding').tap();await page.waitForTimeout(330);await shot('moving-to-profile');
    await settle();await shot('profile');
    assert.equal(await layer.locator('canvas').evaluate((node,original)=>node===original,canvas),true);
    assert.ok((await page.locator('[data-hint-guide-slot]').boundingBox()).width<=80);
    await page.getByTestId('button-save-onboarding-profile').tap();
    assert.equal(await page.getByRole('alert').isVisible(),true);
    assert.equal(requests.filter(r=>r.path==='/api/profile'&&r.method==='POST').length,0);
    await page.getByTestId('onboarding-name').fill('Preview Reader');
    await page.setViewportSize({width:390,height:500});await settle();await shot('profile-keyboard');
    const slot=await page.locator('[data-hint-guide-slot]').boundingBox(),input=await page.getByTestId('onboarding-name').boundingBox();
    assert.ok(slot.width<=64&&slot.y+slot.height<input.y);
    await page.setViewportSize({width:390,height:844});
    await page.getByTestId('onboarding-birth-month').selectOption('08');
    await page.getByTestId('onboarding-birth-day').selectOption('18');
    await page.getByTestId('onboarding-birth-year').selectOption('1996');
    await page.getByTestId('button-save-onboarding-profile').tap();
    await page.getByTestId('onboarding-focus-self').waitFor();await page.waitForTimeout(600);await shot('focus');
    assert.equal(requests.filter(r=>r.path==='/api/profile'&&r.method==='POST').length,1);
    await page.getByTestId('onboarding-focus-self').tap();await page.getByTestId('button-save-onboarding-focus').tap();await settle();await shot('account');
    await page.getByRole('button',{name:'Back',exact:true}).tap();
    await page.getByRole('button',{name:'Back',exact:true}).tap();
    await page.getByRole('button',{name:'Back',exact:true}).tap();await settle();
    assert.equal(await layer.getAttribute('data-introduction'),'none');
    assert.equal(await layer.locator('canvas').evaluate((node,original)=>node===original,canvas),true);
    checks.push('phone widths 320/390/430; form transition reuses the canvas; invalid data does not save; keyboard layout keeps the character clear; valid profile saves once and nods; Back does not replay the flight');
    assert.deepEqual(errors,[]);
  } catch(error) {await shot('failure');console.log(JSON.stringify({engine,error:String(error),errors,text:(await page.locator('body').innerText()).slice(-1800)}));throw error;}
  finally {const video=page.video();await context.close();if(video)await video.saveAs(path.join(out,`${engine}-welcome-to-profile.webm`));}

  for(const skipTime of [.3,3.15,4.8]) {
    const {context:skipContext}=await isolatedContext(browser);const skip=await skipContext.newPage();
    await skip.goto('http://127.0.0.1:5173/app/ask?hintGuide=v3.2&hintPreview=embedded&onboarding=reset');
    await skip.waitForFunction(t=>Number(document.querySelector('[data-testid="hint-guide-layer"]')?.dataset.clock)>=t,skipTime);
    const before=await skip.getByTestId('hint-guide-layer').locator('canvas').elementHandle();
    await skip.getByRole('button',{name:'Skip intro'}).tap();await skip.getByTestId('onboarding-name').waitFor();
    await skip.waitForTimeout(1100);
    assert.equal(await skip.getByTestId('hint-guide-layer').locator('canvas').evaluate((node,original)=>node===original,before),true);
    await skip.screenshot({path:path.join(out,`${engine}-skip-${skipTime}.png`)});await skipContext.close();
  }
  checks.push('skip during flight, peek and wave reaches the form without replacing the player');
  const {context:reducedContext}=await isolatedContext(browser,{reducedMotion:'reduce'}),reduced=await reducedContext.newPage();
  await reduced.goto('http://127.0.0.1:5173/app/ask?hintGuide=v3.2&hintPreview=embedded');
  await reduced.getByTestId('hint-guide-layer').waitFor();await reduced.waitForTimeout(500);
  const clock=await reduced.getByTestId('hint-guide-layer').getAttribute('data-clock');await reduced.waitForTimeout(250);
  assert.equal(await reduced.getByTestId('hint-guide-layer').getAttribute('data-clock'),clock);
  assert.equal(await reduced.getByTestId('hint-guide-layer').getAttribute('data-introduction'),'none');
  await reduced.screenshot({path:path.join(out,`${engine}-reduced.png`)});await reduced.getByTestId('button-start-onboarding').tap();
  await reduced.getByTestId('onboarding-name').waitFor();await reducedContext.close();
  checks.push('reduced motion presents a static welcome and keeps navigation available');
  const {context:offContext}=await isolatedContext(browser),off=await offContext.newPage();
  await off.goto('http://127.0.0.1:5173/app/ask?hintPreview=embedded');
  await off.getByTestId('button-start-onboarding').waitFor();
  assert.equal(await off.getByTestId('hint-guide-layer').count(),0);await offContext.close();
  checks.push('the original onboarding remains when the preview flag is disabled');
  reports.push({engine,passed:true,checks,errors,profileSaves:requests.filter(r=>r.path==='/api/profile'&&r.method==='POST').length,api:'isolated fixtures',keyboard:'viewport simulation',nativeDevice:false});
  console.log(JSON.stringify(reports.at(-1)));await browser.close();
}
if(reports.length)await writeFile(path.join(out,'browser-checks.json'),JSON.stringify(reports,null,2)+'\n');
