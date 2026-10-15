import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {gestures,activities} from '../src/motion.js';
const {chromium,webkit}=createRequire(import.meta.url)('@playwright/test');
const root=fileURLToPath(new URL('../',import.meta.url)),url=process.env.HINT_PREVIEW_URL||'http://127.0.0.1:8767/versions/v3.1/preview/index.html';
const names=Object.keys(gestures).filter(id=>id!=='deliver-letter');assert.equal(names.length,20);
const state=page=>page.evaluate(()=>document.getElementById('hint-gestures-v3').mascot.getState());
const call=(page,method,...args)=>page.evaluate(({method,args})=>document.getElementById('hint-gestures-v3').mascot[method](...args),{method,args});
const ready=page=>page.waitForFunction(()=>document.getElementById('hint-gestures-v3').mascot);
const done=page=>page.waitForFunction(()=>!document.getElementById('hint-gestures-v3').mascot.getState().active,null,{timeout:15000});
const report=[];
for(const engine of process.argv.slice(2).length?process.argv.slice(2):['chromium','webkit']){
 const browser=await ({chromium,webkit}[engine]).launch(engine==='chromium'?{channel:'chrome',headless:true}:{headless:true});
 const errors=[],checks=[],shots=[];
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await ready(page);
  for(const width of [320,390,430]){
   await page.setViewportSize({width,height:844});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' overflow');
   const heights=await page.locator('.hint-actions button,[data-gesture],[data-scene]').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>n.getBoundingClientRect().height));
   assert.ok(heights.every(h=>h>=44));
   for(const id of names){
    await call(page,'resetScene');assert.ok(await call(page,'playGesture',id));
    await call(page,'seek',({'wink-left':.65,'wink-right':.75,nod:.9,celebration:1.1}[id]??gestures[id].duration*.42));
    const s=await state(page);assert.equal(s.gesture,id);assert.equal(s.letter,'held');
    const finite=await page.evaluate(()=>Object.values(document.getElementById('hint-gestures-v3').mascot.getPose()).every(Number.isFinite));assert.ok(finite,id);
   }
   await call(page,'resetScene');await call(page,'playGesture','curious');await call(page,'seek',1.3);
   await page.screenshot({path:path.join(root,`evidence/${engine}-${width}.png`),fullPage:true});shots.push({width,gestures:names.length});
  }
  checks.push('20 actions at 320, 390, and 430 px','44 px touch controls');
  await call(page,'resetScene');await call(page,'playGesture','wink-left');await call(page,'seek',1.9);
  await page.locator('[data-play]').focus();await page.keyboard.press('Enter');assert.ok((await state(page)).active);
  const t=(await state(page)).time;await page.locator('.hint-character').tap();assert.ok((await state(page)).time>=t);
  await call(page,'pause');const frozen=await state(page);await page.waitForTimeout(150);assert.equal((await state(page)).clock,frozen.clock);
  await page.locator('[data-pause]').tap();await done(page);checks.push('keyboard','touch and repeat taps','pause and resume');
  await call(page,'resetScene');await call(page,'playGesture','offer-letter');await call(page,'seek',2.4);
  assert.equal((await state(page)).letter,'offered');await page.locator('.hint-character').tap();assert.equal(await call(page,'acceptLetter'),false);
  await done(page);assert.equal((await state(page)).letter,'delivered');
  for(const id of names.filter(n=>n!=='offer-letter')){
   await call(page,'playGesture',id);await call(page,'seek',gestures[id].duration);assert.equal((await state(page)).letter,'delivered');
  }
  checks.push('single handoff','all reactions preserve delivered state');
  await call(page,'setActivity','listening');await call(page,'resume');await page.waitForTimeout(150);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  const background=await state(page);await page.waitForTimeout(150);assert.equal((await state(page)).time,background.time);
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(150);assert.ok((await state(page)).time>background.time);
  checks.push('simulated background suspension');
  await call(page,'pause');await page.locator('.hint-inspect summary').click();await page.locator('[data-hide-labels]').check();await page.locator('[data-accents]').uncheck();
  assert.equal(await page.locator('[data-title]').evaluate(n=>getComputedStyle(n).visibility),'hidden');
  assert.equal(await page.locator('[data-gesture] option').first().textContent(),'Gesture A');
  await call(page,'setActivity','thinking');await call(page,'seek',2);assert.equal(await page.evaluate(()=>document.getElementById('hint-gestures-v3').mascot.getPose().question),0);
  for(const size of [96,160]){
   await page.locator('[data-size]').selectOption(String(size));assert.equal(Math.round(await page.locator('canvas').first().evaluate(n=>n.getBoundingClientRect().width)),size);
   await page.screenshot({path:path.join(root,`evidence/${engine}-small-${size}.png`),fullPage:true});
  }
  checks.push('hidden names and accents','96 and 160 px previews');
  await page.locator('[data-size]').selectOption('344');await page.locator('.hint-inspect summary').click();
  for(const [details,frame] of [['[data-v3-reference]','[data-v3]'],['[data-v2-reference]','[data-v2]'],['[data-v1-reference]','[data-v1]'],['[data-reference]','[data-approved]']]){
   await page.locator(details+' summary').click();await page.frameLocator(frame).locator('canvas[data-ready="true"]').first().waitFor();await page.locator(details+' summary').click();
  }
  checks.push('saved v3, v2, v1, and approved greeting comparisons');
  await call(page,'resetScene');await call(page,'playGesture','listening');await page.locator('[data-reference] summary').click();await page.locator('[data-approved]').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>!document.getElementById('hint-gestures-v3').mascot.getState().visible);const offscreen=await state(page);
  await page.waitForTimeout(150);assert.equal((await state(page)).time,offscreen.time);
  await page.locator('canvas').first().scrollIntoViewIfNeeded();await page.waitForTimeout(200);assert.ok((await state(page)).time>offscreen.time);checks.push('offscreen suspension');
  const reduced=await context.newPage();await reduced.emulateMedia({reducedMotion:'reduce'});reduced.on('pageerror',e=>errors.push(e.message));await reduced.goto(url);await ready(reduced);
  const rest=await state(reduced);await reduced.waitForTimeout(180);assert.equal((await state(reduced)).clock,rest.clock);assert.ok(rest.paused);
  for(const activity of activities){await call(reduced,'setActivity',activity);const s=await state(reduced);await reduced.waitForTimeout(50);assert.equal((await state(reduced)).clock,s.clock);assert.ok((await state(reduced)).paused);}
  await call(reduced,'playGesture','wink-right');await done(reduced);assert.ok((await state(reduced)).paused);assert.equal((await state(reduced)).clock,0);checks.push('reduced motion and explicit one-shot playback');
  assert.deepEqual(errors,[]);const result={engine,passed:true,shots,checks,errors};report.push(result);
  await writeFile(path.join(root,`evidence/${engine}-checks.json`),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await browser.close();}
}
await writeFile(path.join(root,'evidence/browser-checks.json'),JSON.stringify(report,null,2)+'\n');
