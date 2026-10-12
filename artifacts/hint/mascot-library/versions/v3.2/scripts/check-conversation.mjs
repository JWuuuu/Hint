import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium,webkit}=createRequire(import.meta.url)('@playwright/test');
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'evidence/conversation');
await mkdir(path.join(out,'videos'),{recursive:true});const report=[];
for(const engine of ['chromium','webkit']){
  const browser=await ({chromium,webkit}[engine]).launch(engine==='chromium'?{channel:'chrome',headless:true}:{headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,recordVideo:{dir:path.join(out,'videos/raw'),size:{width:390,height:844}}});
  const page=await context.newPage(),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
  const call=(method,...args)=>page.evaluate(({method,args})=>window.hintConversation[method](...args),{method,args});
  const state=()=>call('getState');
  const settle=()=>page.waitForFunction(()=>!window.hintConversation.getState().transitioning);
  const shot=name=>page.locator('[data-stage]').screenshot({path:path.join(out,`${engine}-${name}.png`)});
  try{
    await page.goto('http://127.0.0.1:8767/versions/v3.2/preview/conversation.html');await page.waitForFunction(()=>window.hintConversation);await settle();
    await shot('ask-empty');await page.locator('[data-composer] input').fill('I’m not sure what to do next.');await settle();
    assert.equal((await state()).placement,'avatar');await shot('ask-typing');
    await page.locator('[data-composer] input').press('Enter');assert.equal((await state()).activity,'thinking');
    await settle();await shot('ask-thinking');assert.equal(await call('send','Repeated message'),false);
    await page.waitForFunction(()=>window.hintConversation.getState().activity==='reading');await settle();await shot('ask-reading');
    assert.equal(await page.locator('[data-feed] .message').count(),2);assert.equal(await page.locator('[data-canvas]').count(),1);
    checks.push('text focus moves Hint away from the keyboard; sending, thinking and reading retain one canvas');
    await page.locator('[data-room="voice"]').tap();await settle();assert.equal((await state()).activity,'waiting');
    for(const phase of ['listening','thinking','preparing','speaking']){
      await page.locator('[data-phase-select]').selectOption(phase);await settle();await shot('voice-'+phase);
      const frame=await call('getFrame');assert.equal(frame.state.speaking,phase==='speaking');if(phase!=='speaking')assert.equal(frame.pose.speech,0);
    }
    await page.locator('[data-interrupt]').tap();assert.equal((await state()).activity,'listening');await settle();await shot('voice-interrupted');
    await page.locator('[data-voice-pause]').tap();const frozen=(await state()).clock;await page.waitForTimeout(300);assert.equal((await state()).clock,frozen);
    await page.locator('[data-voice-pause]').tap();await settle();assert.equal((await state()).context.phase,'starting');
    checks.push('voice preparation is waiting; speaking requires playback; interruption returns to listening; paused conversation stops the clock');
    await call('pause');await call('setMotionPolicy',{visible:false});await call('setMotionPolicy',{visible:true});assert.equal((await state()).paused,true);
    await call('resume');await call('setMotionPolicy',{visible:false});const hidden=(await state()).clock;await page.waitForTimeout(250);assert.equal((await state()).clock,hidden);
    await call('setMotionPolicy',{visible:true});await page.waitForTimeout(130);assert.ok((await state()).clock>hidden);
    checks.push('background visibility and manual pause remain independent');
    for(const width of [320,390,430]){
      await page.setViewportSize({width,height:844});await call('setPhase','thinking');await settle();await shot('thinking-'+width);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    await page.locator('[data-labels]').check();await page.locator('[data-accents]').check();await shot('thinking-without-labels');
    assert.equal((await call('getFrame')).pose.question,0);
    await call('setPhase','listening');await settle();await shot('listening-without-labels');
    checks.push('320/390/430 layouts and thinking/listening with names and accents hidden');
    await call('setSpeed',.5);await call('setPhase','speaking');await settle();const before=(await state()).clock;await page.waitForTimeout(600);const delta=(await state()).clock-before;assert.ok(delta>.18&&delta<.4,`half speed ${delta}`);await shot('half-speed-speaking');
    await page.locator('[data-leave]').tap();await settle();assert.equal((await state()).context.room,'away');assert.ok(await page.locator('[data-actor]').isHidden());
    await page.locator('[data-return]').tap();await settle();assert.equal((await state()).context.room,'ask');
    checks.push('half-speed playback and continuous exit/reentry');
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>window.hintConversation.getState().reducedMotion);
    await call('setRoom','voice');await call('setPhase','listening');const reduced=(await state()).clock;await page.waitForTimeout(250);assert.equal((await state()).clock,reduced);assert.equal((await state()).transitioning,false);await shot('reduced-listening');
    checks.push('reduced motion has immediate static states');
    await page.emulateMedia({reducedMotion:'no-preference'});await call('setPhase','thinking');await settle();
    await page.evaluate(()=>{
      window.hintLostContext=document.querySelector('[data-canvas]').getContext('webgl').getExtension('WEBGL_lose_context');
      if(!window.hintLostContext)throw new Error('WebGL context loss extension unavailable');
      window.hintLostContext.loseContext();
    });
    await page.waitForFunction(()=>!document.querySelector('[data-fallback]').hidden);
    const lost=(await state()).clock;await page.waitForTimeout(200);assert.equal((await state()).clock,lost);await shot('context-lost-fallback');
    await page.evaluate(()=>window.hintLostContext.restoreContext());
    await page.waitForFunction(()=>document.querySelector('[data-fallback]').hidden&&!window.hintConversation.getState().reducedMotion);
    await page.waitForFunction(clock=>window.hintConversation.getState().clock>clock,lost);
    assert.equal((await state()).activity,'thinking');
    checks.push('WebGL context loss shows the static fallback and restores the current activity without restarting its clock');
    await call('destroy');const destroyed=(await state()).clock;await page.waitForTimeout(200);assert.equal((await state()).clock,destroyed);assert.deepEqual(errors,[]);
    report.push({engine,passed:true,checks,errors});console.log(JSON.stringify(report.at(-1)));
  }finally{const video=page.video();await context.close();if(video)await video.saveAs(path.join(out,'videos',`${engine}-conversation-review.webm`));await browser.close();}
}
await writeFile(path.join(out,'browser-checks.json'),JSON.stringify(report,null,2)+'\n');
