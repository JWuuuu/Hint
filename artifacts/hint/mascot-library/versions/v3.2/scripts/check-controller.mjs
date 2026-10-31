import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const {chromium,webkit}=createRequire(import.meta.url)('@playwright/test');
const engines=process.argv.includes('--all')?{chromium,webkit}:{chromium};
for(const [engine,launcher] of Object.entries(engines)){
 const browser=await launcher.launch(engine==='chromium'?{channel:'chrome',headless:true}:{headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.HINT_PREVIEW_URL||'http://127.0.0.1:8767/versions/v3.2/preview/index.html');
 await page.waitForFunction(()=>document.getElementById('hint-gestures-v3').mascot);
 const results=await page.evaluate(async()=>{
  const root=document.getElementById('hint-gestures-v3'),a=root.mascot,events=[];
  root.addEventListener('hint:letter-handoff',e=>events.push({type:'handoff',...e.detail}));
  root.addEventListener('hint:gesture-complete',e=>events.push({type:'complete',...e.detail}));
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  a.resetScene();a.playGesture('offer-letter');await wait(350);const t=a.getState().time;
  const repeated=[a.playGesture('offer-letter'),a.acceptLetter()];const afterRepeat=a.getState().time;
  a.pause();const frozen=a.getState();await wait(200);const pauseStable=a.getState().time===frozen.time&&a.getState().clock===frozen.clock;
  a.seek(2.4);const seeksSilent=events.length===0;const accepted=a.acceptLetter(),duplicate=a.acceptLetter();
  a.setActivity('listening');a.setActivity('thinking');
  await wait(2200);const delivered=a.getState();
  const deliveries=events.filter(e=>e.type==='handoff').length,completions=events.filter(e=>e.gesture==='deliver-letter').length;
  await wait(900);const heldActivity=a.getState();const sameActivity=a.setActivity('thinking');
  const timeBefore=a.getState().time;await wait(100);const repeatedActivityContinues=a.getState().time>timeBefore;
  a.setActivity('reading');const from=a.getPose();a.setActivity('listening');const to=a.getPose();
  const transitionJump=Math.max(...Object.keys(from).filter(k=>k!=='waveTime').map(k=>Math.abs(from[k]-to[k])));
  const letterPreserved=a.getState().letter==='delivered';
  a.pause();a.setActivity('idle');a.resetScene();const reset=a.getState();
  return {repeated,t,afterRepeat,pauseStable,seeksSilent,accepted,duplicate,delivered,deliveries,completions,heldActivity,sameActivity,repeatedActivityContinues,transitionJump,letterPreserved,reset,events};
 });
 assert.deepEqual(results.repeated,[false,false]);assert.equal(results.afterRepeat,results.t);assert.ok(results.pauseStable&&results.seeksSilent);
 assert.ok(results.accepted&&!results.duplicate);assert.equal(results.deliveries,1);assert.equal(results.completions,1);
 assert.equal(results.delivered.letter,'delivered');assert.equal(results.delivered.activity,'thinking');assert.equal(results.delivered.mode,'activity');
 assert.ok(!results.sameActivity&&results.repeatedActivityContinues);assert.ok(results.transitionJump<.001,results.transitionJump);assert.ok(results.letterPreserved);
 assert.equal(results.reset.letter,'held');assert.equal(results.reset.activity,'idle');assert.deepEqual(errors,[]);
 await writeFile(new URL('../evidence/'+engine+'-controller.json',import.meta.url),JSON.stringify({engine,results,errors},null,2)+'\n');
 console.log(JSON.stringify({engine,passed:true,events:results.events.length}));await browser.close();
}
