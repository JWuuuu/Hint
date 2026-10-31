import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('@playwright/test');
const sharp=createRequire(process.env.HINT_TOOLS_PACKAGE||import.meta.url)('sharp');
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'evidence/conversation/holds');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),report=[];
for(const [activity,room,phase] of [['idle','ask','idle'],['waiting','voice','preparing'],['listening','voice','listening'],['thinking','voice','thinking'],['reading','ask','reading'],['speaking','voice','speaking']]){
  const folder=path.join(out,activity);await mkdir(folder,{recursive:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,recordVideo:{dir:path.join(folder,'raw'),size:{width:390,height:844}}});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:8767/versions/v3.2/preview/conversation.html');await page.waitForFunction(()=>window.hintConversation);
  await page.evaluate(({room,phase})=>{window.hintConversation.setRoom(room);window.hintConversation.setPhase(phase);window.hintConversation.setAccentsVisible(false);document.querySelector('[data-stage]').dataset.labels='hidden';},{room,phase});
  await page.waitForFunction(()=>{const state=window.hintConversation.getState();return !state.transitioning&&state.phase==='holding';});
  const result=await page.evaluate(async()=>{
    const start=performance.now(),initial=window.hintConversation.getState().clock,samples=[],frames=[],intervals=[];
    let last=start,next=0;
    await new Promise(resolve=>{const tick=now=>{
      intervals.push(now-last);last=now;
      if(now-start>=next*1000){samples.push({wallSeconds:(now-start)/1000,...window.hintConversation.getFrame()});frames.push(document.querySelector('[data-canvas]').toDataURL());next+=5;}
      if(now-start>=60000){resolve();return;}requestAnimationFrame(tick);
    };requestAnimationFrame(tick);});
    window.hintConversation.pause();intervals.sort((a,b)=>a-b);
    return {samples,frames,clockAdvance:window.hintConversation.getState().clock-initial,frameCount:intervals.length,p50:intervals[Math.floor(intervals.length*.5)],p95:intervals[Math.floor(intervals.length*.95)]};
  });
  assert.ok(result.clockAdvance>58,`${activity} clock ${result.clockAdvance}`);
  assert.ok(result.samples.every(sample=>sample.state.activity===activity&&sample.state.phase==='holding'));
  assert.deepEqual(errors,[]);
  const tiles=[];
  for(let i=0;i<result.frames.length;i++){
    const pixels=Buffer.from(result.frames[i].split(',')[1],'base64');await writeFile(path.join(folder,`${i}.png`),pixels);
    tiles.push({input:await sharp(pixels).resize(156,312).flatten({background:'#faf6f2'}).png().toBuffer(),left:i%7*156,top:Math.floor(i/7)*334+22});
    tiles.push({input:Buffer.from(`<svg width="156" height="22"><text x="8" y="16" fill="#75576a" font-family="sans-serif" font-size="11">${result.samples[i].wallSeconds.toFixed(0)} s</text></svg>`),left:i%7*156,top:Math.floor(i/7)*334});
  }
  await sharp({create:{width:1092,height:Math.ceil(tiles.length/14)*334,channels:4,background:'#efe6ec'}}).composite(tiles).png().toFile(path.join(folder,'contact-sheet.png'));
  const video=page.video();await context.close();if(video)await video.saveAs(path.join(folder,`${activity}-60-seconds.webm`));
  const {frames,...data}=result;const entry={activity,wallSeconds:60,errors,...data};report.push(entry);
  await writeFile(path.join(folder,'review.json'),JSON.stringify(entry,null,2)+'\n');console.log(JSON.stringify({activity,wallSeconds:60,clockAdvance:result.clockAdvance,frames:result.frameCount,p95:result.p95,errors}));
}
await browser.close();await writeFile(path.join(out,'review.json'),JSON.stringify(report,null,2)+'\n');
