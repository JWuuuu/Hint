import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium,webkit}=createRequire(import.meta.url)('@playwright/test');
const report=[];
for(const [name,engine] of Object.entries({chromium,webkit})){
 const browser=await engine.launch(name==='chromium'?{channel:'chrome',headless:true}:{headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.HINT_SAMPLES_URL||'http://127.0.0.1:8767/versions/v3/samples/index.html');
  assert.equal(await page.locator('video').count(),20);const clips=[];
  for(let i=0;i<20;i++){
   const video=page.locator('video').nth(i);await video.scrollIntoViewIfNeeded();
   const data=await video.evaluate(async video=>{
    video.preload='auto';video.load();await new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=()=>reject(Error('Video did not load'));});
    video.currentTime=video.duration*.42;await new Promise(resolve=>video.onseeked=resolve);await video.play();
    await new Promise(resolve=>setTimeout(resolve,100));video.pause();
    return {label:video.getAttribute('aria-label'),duration:video.duration,width:video.videoWidth,height:video.videoHeight,time:video.currentTime};
   });assert.ok(data.duration>1&&data.width===640&&data.height===640);clips.push(data);
  }
  await page.locator('[data-speed=".5"]').click();assert.ok(await page.locator('video').evaluateAll(videos=>videos.every(v=>v.playbackRate===.5)));
  await page.locator('#names').check();assert.equal(await page.locator('h2').first().evaluate(n=>getComputedStyle(n).visibility),'hidden');
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  assert.deepEqual(errors,[]);report.push({engine:name,clips,errors,passed:true});console.log(JSON.stringify({engine:name,clips:clips.length,passed:true,errors}));
 }finally{await browser.close();}
}
await writeFile(new URL('../evidence/gallery-checks.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
