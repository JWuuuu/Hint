import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium,webkit}=createRequire(import.meta.url)('@playwright/test');
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'evidence/greeting-reactions');
await mkdir(path.join(out,'videos'),{recursive:true});
const report=[];
for(const engine of ['chromium','webkit']){
  const browser=await ({chromium,webkit}[engine]).launch(engine==='chromium'?{channel:'chrome',headless:true}:{headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,recordVideo:{dir:path.join(out,'videos/raw'),size:{width:390,height:844}}});
  const page=await context.newPage(),errors=[],checks=[];
  page.on('pageerror',error=>errors.push(error.message));
  const call=(method,...args)=>page.evaluate(({method,args})=>window.hintJourney[method](...args),{method,args});
  const state=()=>call('getState');
  const peak=side=>page.waitForFunction(side=>{const s=window.hintJourney.getState();return s.pose[side]>.98;},side);
  const shot=name=>page.locator('[data-stage]').screenshot({path:path.join(out,`${engine}-${name}.png`)});
  try{
    await page.goto('http://127.0.0.1:8767/versions/v3.2/preview/journey.html');await page.waitForFunction(()=>window.hintJourney);
    await call('replay');await page.waitForFunction(()=>window.hintJourney.getState().time>5.35);
    assert.equal((await state()).phase,'welcome');
    await page.locator('[data-actor]').tap();assert.equal((await state()).reaction,'wink-left');
    assert.equal(await call('react'),false);
    await peak('eyeRight');
    const left=await state();assert.ok(left.pose.eyeLeft<.05);assert.ok(left.pose.pawWave>.99);assert.ok(Math.abs(left.pose.waveTime-(left.time-4.42))<1e-8);
    await shot('wave-and-left-wink');
    await page.waitForFunction(()=>window.hintJourney.getState().reaction===null);
    await page.locator('[data-actor]').focus();await page.keyboard.press('Enter');
    assert.equal((await state()).reaction,'wink-right');await peak('eyeLeft');
    const right=await state();assert.ok(right.pose.eyeRight<.05);assert.ok(right.pose.pawWave>.99);
    await shot('wave-and-right-wink');
    checks.push('welcome waves automatically; touch overlays a left wink while the original paw sequence continues');
    checks.push('a later keyboard activation uses the opposite wink; repeated taps do not restart a reaction');
    await call('pause');const frozen=await state();await page.waitForTimeout(180);assert.deepEqual((await state()).pose,frozen.pose);
    await call('setMotionPolicy',{visible:false});await call('setMotionPolicy',{visible:true});assert.equal((await state()).paused,true);
    await call('resume');await page.waitForFunction(()=>window.hintJourney.getState().reaction===null);
    checks.push('pause and background suspension preserve the combined gesture');
    for(const width of [320,390,430]){
      await page.setViewportSize({width,height:844});await call('replay');await call('seek',5.35);await call('resume');
      await page.locator('[data-actor]').tap();await peak('eyeRight');await call('pause');await shot(`phone-${width}`);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    checks.push('tap response and one-eye expression remain visible at 320, 390 and 430 px widths');
    await page.setViewportSize({width:390,height:844});await call('replay');await call('seek',5.35);await call('setSpeed',.5);await call('resume');
    await page.locator('[data-actor]').tap();await peak('eyeRight');await shot('half-speed-wink');
    const transition=await page.evaluate(()=>{const before=window.hintJourney.getState();window.hintJourney.continue();return {before,after:window.hintJourney.getState()};});
    for(const key of ['pawWave','waveTime','headRoll','headYaw','eyeLeft','eyeRight'])assert.equal(transition.after.pose[key],transition.before.pose[key],key);
    await page.waitForFunction(()=>window.hintJourney.getState().phase==='profile');
    checks.push('half-speed wave and wink remain coordinated; navigation carries the exact pose into the form');
    await call('setSpeed',1);await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>window.hintJourney.getState().reduced);await call('replay');
    assert.equal(await call('react'),false);await page.locator('[data-continue]').tap();assert.equal((await state()).phase,'profile');
    checks.push('reduced motion keeps the greeting still and navigation immediately usable');
    assert.deepEqual(errors,[]);report.push({engine,passed:true,checks,errors});
  }finally{
    const video=page.video();await context.close();if(video)await video.saveAs(path.join(out,'videos',`${engine}-greeting-reactions.webm`));await browser.close();
  }
  console.log(JSON.stringify(report.at(-1)));
}
await writeFile(path.join(out,'browser-checks.json'),JSON.stringify(report,null,2)+'\n');
