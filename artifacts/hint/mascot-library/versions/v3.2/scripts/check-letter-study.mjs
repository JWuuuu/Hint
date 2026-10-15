import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium,webkit}=createRequire(import.meta.url)('@playwright/test');
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'evidence/letter-scene');
await mkdir(path.join(out,'videos'),{recursive:true});
const report=[];
for(const engine of ['chromium','webkit']){
  const browser=await ({chromium,webkit}[engine]).launch(engine==='chromium'?{channel:'chrome',headless:true}:{headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,recordVideo:{dir:path.join(out,'videos/raw'),size:{width:390,height:844}}});
  const page=await context.newPage(),errors=[],checks=[];
  page.on('pageerror',error=>errors.push(error.message));
  const call=(method,...args)=>page.evaluate(({method,args})=>window.hintLetter[method](...args),{method,args});
  const state=()=>call('getState');
  try{
    await page.goto('http://127.0.0.1:8767/versions/v3.2/preview/letter.html');await page.waitForFunction(()=>window.hintLetter);
    await page.evaluate(async()=>{
      window.hintLetter.destroy();window.letterEvents={accept:0,handoff:0,complete:0};
      const {createLetterStudy}=await import('../src/letter-study.js');
      const {assets}=await import('./hint-assets.js');
      window.hintLetter=await createLetterStudy(document.getElementById('hint-letter'),{assets,onLetterAccepted:()=>window.letterEvents.accept++,onLetterHandoff:()=>window.letterEvents.handoff++,onComplete:()=>window.letterEvents.complete++});
    });
    assert.equal(await call('acceptLetter'),false);
    await page.waitForFunction(()=>window.hintLetter.getState().letter==='offered');
    await page.waitForTimeout(500);assert.equal((await state()).letter,'offered');
    await page.locator('[data-stage]').screenshot({path:path.join(out,`${engine}-offer.png`)});
    await page.locator('[data-accept]').tap();assert.equal(await call('acceptLetter'),false);
    assert.equal((await page.evaluate(()=>window.letterEvents)).accept,1);
    await page.waitForTimeout(120);await call('pause');const frozen=await state();
    await page.waitForTimeout(220);assert.equal((await state()).clock,frozen.clock);assert.equal((await state()).time,frozen.time);
    await call('setMotionPolicy',{visible:false});await call('setMotionPolicy',{visible:true});assert.equal((await state()).paused,true);
    await call('resume');
    await page.waitForFunction(()=>window.hintLetter.getState().phase==='reading',null,{timeout:10000});
    assert.deepEqual(await page.evaluate(()=>window.letterEvents),{accept:1,handoff:1,complete:1});
    assert.equal((await state()).letter,'delivered');
    await page.locator('[data-flip]').focus();await page.keyboard.press('Enter');assert.equal(await call('flipCard'),false);
    await page.waitForTimeout(900);assert.equal((await state()).flipped,true);
    for(const width of [320,390,430]){
      await page.setViewportSize({width,height:844});await page.waitForTimeout(80);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.locator('[data-stage]').screenshot({path:path.join(out,`${engine}-reading-${width}.png`)});
    }
    checks.push('normal-speed offer, tap acceptance, connected handoff, envelope opening, card extraction and keyboard flip');
    checks.push('accept, handoff and scene completion fire once; repeat taps do not restart movement');
    checks.push('pause and visibility preserve time and letter ownership; 320/390/430 layouts fit');
    await call('setMotionPolicy',{visible:false});const hidden=(await state()).clock;await page.waitForTimeout(180);assert.equal((await state()).clock,hidden);
    await call('setMotionPolicy',{visible:true});await page.waitForTimeout(130);assert.ok((await state()).clock>hidden);
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>window.hintLetter.getState().reduced);await call('replay');assert.equal((await state()).letter,'offered');
    const reduced=(await state()).clock;await page.waitForTimeout(180);assert.equal((await state()).clock,reduced);
    await page.locator('[data-accept]').tap();assert.equal((await state()).letter,'delivered');assert.equal((await state()).actingPhase,'card-ready');
    await page.locator('[data-flip]').tap();assert.equal((await state()).flipTime,1);
    checks.push('reduced motion retains the same interactive steps without travel animations');
    await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>!window.hintLetter.getState().reduced);await call('replay');await call('setSpeed',.5);
    await page.waitForFunction(()=>window.hintLetter.getState().letter==='offered',null,{timeout:12000});
    await page.locator('[data-accept]').tap();
    await page.waitForFunction(()=>window.hintLetter.getState().phase==='reading',null,{timeout:14000});
    await page.locator('[data-flip]').tap();await page.waitForTimeout(1500);
    checks.push('full half-speed offer, handoff, opening, extraction and flip');
    await call('pause');await call('destroy');const stopped=(await state()).clock;await page.waitForTimeout(180);assert.equal((await state()).clock,stopped);
    assert.deepEqual(errors,[]);report.push({engine,passed:true,checks,errors});
    await writeFile(path.join(out,`${engine}-checks.json`),JSON.stringify(report.at(-1),null,2)+'\n');
  }finally{
    const video=page.video();await context.close();if(video)await video.saveAs(path.join(out,'videos',`${engine}-letter-review.webm`));await browser.close();
  }
  console.log(JSON.stringify(report.at(-1)));
}
await writeFile(path.join(out,'browser-checks.json'),JSON.stringify(report,null,2)+'\n');
