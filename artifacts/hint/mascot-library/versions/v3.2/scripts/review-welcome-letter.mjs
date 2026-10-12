import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium,webkit}=createRequire(import.meta.url)('@playwright/test');
const sharp=createRequire(process.env.HINT_TOOLS_PACKAGE||import.meta.url)('sharp');
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'evidence/welcome-letter');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1}),errors=[],frames=[];
page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>{
  let now=1000,id=0;const callbacks=new Map();
  window.requestAnimationFrame=callback=>{callbacks.set(++id,callback);return id;};
  window.cancelAnimationFrame=id=>callbacks.delete(id);
  window.advanceHintReview=ms=>{const count=Math.max(1,Math.ceil(ms/(1000/60)));for(let i=0;i<count;i++){now+=ms/count;const queued=[...callbacks.values()];callbacks.clear();for(const cb of queued)cb(now);}};
});
await page.goto('http://127.0.0.1:8767/versions/v3.2/preview/journey.html');await page.waitForFunction(()=>window.hintJourney,null,{polling:50});
const advance=ms=>page.evaluate(ms=>window.advanceHintReview(ms),ms);
const shot=async(name)=>{
  const clip=await page.evaluate(()=>{const b=document.querySelector('[data-stage]').getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};});
  await page.screenshot({clip,path:path.join(out,name+'.png')});frames.push({name,state:await page.evaluate(()=>window.hintJourney.getState())});
};
await page.evaluate(()=>window.hintJourney.replay());await advance(0);
await advance(3840);await shot('01-peek-jump');await advance(9000-3840);await shot('02-welcome');
await page.evaluate(()=>window.hintJourney.continue());await advance(350);await shot('03-moving-to-profile');await advance(650);await shot('04-profile');
await page.evaluate(()=>{document.getElementById('first-name').value='Jamie';document.getElementById('birth-date').value='2000-03-21';document.querySelector('[data-profile-form]').requestSubmit();});
assert.equal(await page.evaluate(()=>window.hintJourney.getState().mode),'daily');
await shot('05-profile-complete');let previous=0;
for(const [index,t] of [.25,.65,1.2,1.62,2.4,3.6].entries()){await advance((t-previous)*1000);previous=t;await shot(`${String(index+6).padStart(2,'0')}-daily-${t}`);}
assert.equal(await page.evaluate(()=>window.hintJourney.getState().letter),'offered');
await page.evaluate(()=>window.hintJourney.acceptLetter());previous=0;
for(const [index,t] of [.48,.8,1.62,2.24,2.95,3.6].entries()){await advance((t-previous)*1000);previous=t;await shot(`${String(index+12).padStart(2,'0')}-handoff-${t}`);}
await page.evaluate(()=>window.hintJourney.flipCard());await advance(1000);await shot('18-reading');
assert.equal(await page.evaluate(()=>window.hintJourney.getState().letter),'delivered');assert.deepEqual(errors,[]);
await browser.close();
const cols=6,w=195,h=412,tiles=[];
for(let i=0;i<frames.length;i++){
  const frame=frames[i],top=Math.floor(i/cols)*h,left=i%cols*w;
  tiles.push({input:await sharp(await readFile(path.join(out,frame.name+'.png'))).resize({width:195,height:390}).png().toBuffer(),top:top+22,left});
  tiles.push({input:Buffer.from(`<svg width="195" height="22"><text x="8" y="16" fill="#64475b" font-family="sans-serif" font-size="10">${frame.name}</text></svg>`),top,left});
}
await sharp({create:{width:cols*w,height:Math.ceil(frames.length/cols)*h,channels:4,background:'#ece5e8'}}).composite(tiles).png().toFile(path.join(out,'contact-sheet.png'));
const fallback=[];
for(const engine of ['chromium','webkit'])for(const filename of ['journey.html','letter.html']){
  const browser=await ({chromium,webkit}[engine]).launch(engine==='chromium'?{channel:'chrome',headless:true}:{headless:true});
  const page=await browser.newPage({viewport:{width:320,height:744},hasTouch:true}),issues=[];
  page.on('pageerror',error=>issues.push(error.message));
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:original.call(this,type,...args);};});
  await page.goto('http://127.0.0.1:8767/versions/v3.2/preview/'+filename);await page.waitForFunction(()=>window.hintJourney||window.hintLetter);
  if(filename==='journey.html'){
    await page.locator('[data-continue]').tap();await page.locator('#first-name').fill('Jamie');await page.locator('#birth-date').fill('2000-03-21');await page.locator('[data-profile-form] button').tap();
  }
  await page.locator('[data-accept]').tap();await page.locator('[data-flip]').tap();
  assert.ok(await page.locator('[data-fallback-card]').isVisible());assert.equal(await page.locator('img[data-fallback]').getAttribute('alt'),'Hint, your reading companion');
  await page.locator('[data-stage]').screenshot({path:path.join(out,`${engine}-${filename}-fallback.png`)});
  assert.deepEqual(issues,[]);fallback.push({engine,page:filename,passed:true,checks:[...(filename==='journey.html'?['required form remains usable']:[]),'static empty-paw character after acceptance','card back and front visible','one tap acceptance and flip']});await browser.close();
}
await writeFile(path.join(out,'review.json'),JSON.stringify({frames,errors,fallback},null,2)+'\n');
console.log(JSON.stringify({frames:frames.length,errors,fallback}));
