import {createRequire} from 'node:module';
import {writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium,webkit}=createRequire(import.meta.url)('@playwright/test');
const root=fileURLToPath(new URL('../',import.meta.url)),url=process.env.HINT_PREVIEW_URL||'http://127.0.0.1:8767/versions/v3.2/preview/index.html';
const out=path.join(root,'evidence/scenes');await mkdir(out,{recursive:true});
const report=[];
for(const engine of process.argv.slice(2).length?process.argv.slice(2):['chromium','webkit']){
 const browser=await ({chromium,webkit}[engine]).launch(engine==='chromium'?{channel:'chrome',headless:true}:{headless:true});
 const errors=[],events=[],checks=[];
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,recordVideo:{dir:path.join(out,'raw'),size:{width:390,height:844}}});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const call=(method,...args)=>page.evaluate(({method,args})=>document.getElementById('hint-gestures-v3').mascot[method](...args),{method,args});
 const state=()=>call('getState');
 const phase=expected=>page.waitForFunction(expected=>document.getElementById('hint-gestures-v3').dataset.scenePhase===expected,expected,{timeout:20000});
 const shot=async name=>{await page.screenshot({path:path.join(out,`${engine}-${name}.png`),fullPage:true});events.push({name,...await state()});};
 try{
  await page.goto(url);await page.waitForFunction(()=>document.getElementById('hint-gestures-v3').scenePreview);
  await call('resetScene');
  await page.evaluate(()=>{window.handoffs=[];document.getElementById('hint-gestures-v3').addEventListener('hint:letter-handoff',e=>window.handoffs.push(e.detail));});
  await page.locator('[data-scene]').selectOption('letter');await phase('welcome');await page.waitForTimeout(1500);await shot('welcome');
  await phase('offer');await page.waitForTimeout(1300);await shot('offer');
  await phase('offered');await page.waitForTimeout(600);assert.equal((await state()).letter,'offered');assert.equal(await page.evaluate(()=>window.handoffs.length),0);
  await shot('waiting-for-acceptance');await page.locator('[data-play]').tap();await page.waitForTimeout(650);await shot('handoff');
  await phase('reading');await page.waitForTimeout(1000);await shot('reading');
  assert.equal((await state()).letter,'delivered');assert.equal((await state()).activity,'reading');assert.equal(await page.evaluate(()=>window.handoffs.length),1);
  assert.ok(await page.locator('[data-reading-card]').isVisible());checks.push('welcome → offer → waiting → one handoff → quiet reading');
  for(const width of [320,430]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot(`reading-${width}`);}
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-scene]').selectOption('voice');await phase('waiting');await shot('voice-waiting');await phase('listening');await page.waitForTimeout(1300);await shot('listening');
  await page.locator('[data-scene-next]').tap();await phase('thinking');await page.waitForTimeout(1500);await shot('thinking');
  await page.locator('[data-pause]').tap();const paused=await state();await page.waitForTimeout(250);assert.equal((await state()).clock,paused.clock);await phase('thinking');await page.locator('[data-pause]').tap();
  await phase('preparing');await shot('preparing');assert.equal((await state()).activity,'waiting');
  await phase('speaking');await page.waitForTimeout(1100);await shot('speaking');
  const before=await call('getPose');await page.locator('[data-interrupt]').tap();await phase('listening');assert.equal((await state()).activity,'listening');
  await page.waitForTimeout(900);await shot('interrupted-listening');assert.equal((await state()).letter,'delivered');
  checks.push('waiting → listening → thinking → preparation → speaking','pause freezes scene timing','interruption returns smoothly to listening','voice scene preserves delivered letter');
  await page.locator('[data-scene-next]').tap();await phase('thinking');await phase('speaking');await phase('listening');checks.push('playback completion returns to listening');
  await page.locator('[data-scene]').selectOption('letter');await phase('reading');assert.equal((await state()).letter,'delivered');checks.push('scene changes do not recreate letter');
  await page.locator('.hint-inspect summary').click();await page.locator('[data-reset]').click();await phase('welcome');assert.equal((await state()).letter,'held');await page.locator('.hint-inspect summary').click();
  await phase('offered');await page.locator('[data-scene]').selectOption('voice');assert.equal((await state()).queuedActivity,'waiting');await page.locator('[data-play]').tap();await phase('waiting');await phase('listening');assert.equal((await state()).letter,'delivered');checks.push('latest scene request waits safely for handoff');
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-scene]').selectOption('library');await page.locator('[data-scene]').selectOption('voice');await phase('waiting');assert.ok((await state()).paused);
  await page.locator('[data-scene-next]').tap();await phase('listening');await page.locator('[data-scene-next]').tap();await phase('thinking');await page.locator('[data-scene-next]').tap();await phase('preparing');await page.locator('[data-scene-next]').tap();await phase('speaking');assert.ok((await state()).paused);await page.locator('[data-interrupt]').tap();await phase('listening');checks.push('reduced-motion scene has explicit phase controls');
  assert.deepEqual(errors,[]);const result={engine,passed:true,checks,errors,events};report.push(result);await writeFile(path.join(out,`${engine}-checks.json`),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({engine,passed:true,checks,errors}));
 }finally{const video=page.video();await context.close();if(video)await video.saveAs(path.join(root,`evidence/videos/${engine}-scenes.webm`));await browser.close();}
}
await writeFile(path.join(root,'evidence/scene-checks.json'),JSON.stringify(report.map(({events,...r})=>r),null,2)+'\n');
