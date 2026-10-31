import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
process.env.HINT_REVIEW_HELPERS_ONLY='1';
const {isolatedContext}=await import('./check-app-onboarding.mjs');
const {chromium}=createRequire(import.meta.url)('@playwright/test');
const sharp=createRequire(process.env.HINT_TOOLS_PACKAGE||import.meta.url)('sharp');
const out=fileURLToPath(new URL('../evidence/app-onboarding/',import.meta.url)),frames=[];
const browser=await chromium.launch({channel:'chrome'});
const {context}=await isolatedContext(browser),page=await context.newPage();
await context.addInitScript(()=>{
  let now=1000,id=0;const callbacks=new Map();
  window.requestAnimationFrame=callback=>{callbacks.set(++id,callback);return id;};
  window.cancelAnimationFrame=id=>callbacks.delete(id);
  window.advanceHintReview=ms=>{const count=Math.max(1,Math.ceil(ms/(1000/60)));for(let i=0;i<count;i++){now+=ms/count;const queued=[...callbacks.values()];callbacks.clear();for(const cb of queued)cb(now);}};
});
await page.goto('http://127.0.0.1:5173/app/ask?hintGuide=v3.2&hintPreview=embedded&onboarding=reset');
await page.waitForFunction(()=>document.querySelector('[data-testid="hint-guide-layer"] canvas')?.dataset.ready==='true',null,{polling:50});
const advance=ms=>page.evaluate(ms=>window.advanceHintReview(ms),ms);
const shot=async name=>{await page.screenshot({path:path.join(out,`${name}.png`)});frames.push({name,state:await page.getByTestId('hint-guide-layer').evaluate(node=>({...node.dataset}))});};
await advance(0);let previous=0;
for(const t of [0,2.95,3.27,3.6,4.04,4.60,5.10]) {await advance((t-previous)*1000);previous=t;await shot(`frame-${t.toFixed(2)}`);}
await page.evaluate(()=>document.querySelector('[aria-label="Hint"]').click());await advance(600);await shot('frame-wave-wink');
await advance(3350);await shot('frame-rest');
await page.evaluate(()=>document.querySelector('[data-testid="button-start-onboarding"]').click());
await page.waitForFunction(()=>document.querySelector('[data-testid="onboarding-name"]'),null,{polling:50});
previous=0;
for(const t of [.10,.30,.50,.70,.95]) {await advance((t-previous)*1000);previous=t;await shot(`form-${t.toFixed(2)}`);}
const tiles=[],width=195,height=444,columns=5;
for(let i=0;i<frames.length;i++) {
  const {name}=frames[i],left=i%columns*width,top=Math.floor(i/columns)*height;
  tiles.push({input:await sharp(path.join(out,name+'.png')).resize(width,422).png().toBuffer(),left,top:top+22});
  tiles.push({input:Buffer.from(`<svg width="195" height="22"><text x="8" y="16" fill="#624958" font-family="sans-serif" font-size="11">${name}</text></svg>`),left,top});
}
await sharp({create:{width:columns*width,height:Math.ceil(frames.length/columns)*height,channels:4,background:'#ede5ea'}}).composite(tiles).png().toFile(path.join(out,'keyframes.png'));
await context.close();
const {context:shortContext}=await isolatedContext(browser,{viewport:{width:320,height:568},reducedMotion:'reduce'}),short=await shortContext.newPage();
await short.goto('http://127.0.0.1:5173/app/ask?hintGuide=v3.2&hintPreview=embedded');await short.getByTestId('hint-guide-layer').waitFor();await short.waitForTimeout(350);
const begin=await short.getByTestId('button-start-onboarding').boundingBox();
await short.screenshot({path:path.join(out,'short-phone-320x568.png')});
assert.ok(begin.y+begin.height<=568,'The primary welcome action should fit a 320 by 568 viewport');
const profiles=await short.locator('.hint-guide-welcome-actions details').boundingBox();
assert.ok(profiles.y+profiles.height<=568,'The closed profile switcher should also fit without being cut off');
await shortContext.close();
const {context:frameContext}=await isolatedContext(browser,{viewport:{width:1024,height:900}}),framed=await frameContext.newPage();
await framed.goto('http://127.0.0.1:5173/app?hintGuide=v3.2&onboarding=reset');
const phone=framed.frameLocator('iframe');await phone.getByTestId('hint-guide-layer').waitFor();
await phone.locator('[data-testid="hint-guide-layer"][data-introduction="welcome"]').waitFor();
await framed.screenshot({path:path.join(out,'device-preview-frame.png')});
assert.equal(await phone.getByTestId('button-start-onboarding').isEnabled(),true);
await frameContext.close();await browser.close();
await writeFile(path.join(out,'keyframes.json'),JSON.stringify({frames,shortViewport:{width:320,height:568,begin},deviceFrame:true},null,2)+'\n');
console.log(JSON.stringify({frames:frames.length,shortViewport:true,deviceFrame:true}));
