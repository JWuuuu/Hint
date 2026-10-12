import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gestures} from '../src/motion.js';

const {chromium}=createRequire(import.meta.url)('@playwright/test');
const dir=fileURLToPath(new URL('../',import.meta.url));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:850},reducedMotion:'reduce'});
await page.goto(process.env.HINT_PREVIEW_URL||'http://127.0.0.1:8767/versions/v3/preview/index.html');
await page.waitForFunction(()=>document.getElementById('hint-gestures-v3').mascot);
const results=[];
try{
  for(const id of Object.keys(gestures)){
    const result=await page.evaluate(async id=>{
      const api=document.getElementById('hint-gestures-v3').mascot;
      if(id!=='deliver-letter')api.resetScene();
      api.setSpeed(.5);api.setAccentsVisible(false);
      const start=performance.now(),frames=[],midpoints=[];
      if(id==='deliver-letter')api.acceptLetter();else api.playGesture(id);
      await new Promise(resolve=>{
        let last=start,nextImage=.18;
        function sample(now){
          const s=api.getState();frames.push({dt:now-last,time:s.time});last=now;
          if(s.time>=nextImage){midpoints.push({time:s.time,png:document.querySelector('canvas').toDataURL('image/png').split(',')[1]});nextImage+=s.duration/5;}
          if(s.active)requestAnimationFrame(sample);else resolve();
        }
        requestAnimationFrame(sample);
      });
      const state=api.getState();
      return {gesture:id,elapsed:performance.now()-start,duration:state.duration,frames,midpoints,state};
    },id);
    for(let i=1;i<result.frames.length;i++)assert.ok(result.frames[i].time>=result.frames[i-1].time);
    assert.ok(result.elapsed>=result.duration*2000-60&&result.elapsed<result.duration*2000+1600,`${id}: half-speed duration`);
    assert.equal(result.state.paused,true);
    for(let i=0;i<result.midpoints.length;i++)await writeFile(path.join(dir,`evidence/slow-${id}-${i}.png`),Buffer.from(result.midpoints[i].png,'base64'));
    const dts=result.frames.slice(2).map(f=>f.dt).sort((a,b)=>a-b);
    const item={gesture:id,speed:.5,elapsedMilliseconds:Math.round(result.elapsed),expectedMilliseconds:result.duration*2000,frames:result.frames.length,medianFrameMilliseconds:dts[Math.floor(dts.length*.5)],p95FrameMilliseconds:dts[Math.floor(dts.length*.95)],monotonic:true,endsPaused:true};
    results.push(item);console.log(JSON.stringify(item));
  }
  await writeFile(path.join(dir,'evidence/slow-playback.json'),JSON.stringify(results,null,2)+'\n');
}finally{await browser.close();}
