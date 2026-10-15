import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium,webkit}=createRequire(import.meta.url)('@playwright/test');
const results=[];
for(const [name,engine] of Object.entries({chromium,webkit})){
 const browser=await engine.launch(name==='chromium'?{channel:'chrome',headless:true}:{headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await page.goto(process.env.HINT_PREVIEW_URL||'http://127.0.0.1:8767/versions/v3.2/preview/index.html');
  await page.waitForFunction(()=>document.getElementById('hint-gestures-v3').mascot);
  const report=await page.evaluate(()=>{
   const api=document.getElementById('hint-gestures-v3').mascot,source=document.querySelector('canvas');
   api.resetScene();api.playGesture('offer-letter');api.seek(2.4);api.acceptLetter();
   const target=document.createElement('canvas');target.width=target.height=768;const ctx=target.getContext('2d');
   const read=t=>{api.seek(t);ctx.clearRect(0,0,768,768);ctx.drawImage(source,0,0);return ctx.getImageData(0,0,768,768).data;};
   const before=read(.4799),after=read(.4801);let changed=0,maxDelta=0;
   for(let i=0;i<before.length;i+=4){
    const delta=Math.max(Math.abs(before[i+3]-after[i+3]),...[0,1,2].map(c=>Math.abs(before[i+c]*before[i+3]/255-after[i+c]*after[i+3]/255)));
    if(delta>40)changed++;maxDelta=Math.max(maxDelta,delta);
   }
   return {sampleTimes:[.4799,.4801],pixelsOver40:changed,maxDelta};
  });
  results.push({engine:name,...report});console.log(JSON.stringify(results.at(-1)));
  assert.ok(report.pixelsOver40<10,'The layer change at handoff must not expose or cover a patch of the paw');
 }finally{await browser.close();}
}
await writeFile(new URL('../evidence/handoff-continuity.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
