import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire('/Users/jwu/Documents/Hint-main/artifacts/hint/package.json');
const {chromium,webkit}=require('@playwright/test');
const dir=new URL('./',import.meta.url).pathname;
const results=[];
for(const [name,engine,options] of [['chromium',chromium,{channel:'chrome'}],['webkit',webkit,{}]]){
  const browser=await engine.launch({headless:true,...options});
  const errors=[];
  const page=await browser.newPage({viewport:{width:390,height:850},deviceScaleFactor:2});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:5194/');
  const f=page.frameLocator('iframe'), c=f.locator('canvas');
  await f.locator('canvas[data-ready=true]').waitFor();
  await page.waitForTimeout(1250);
  const active=Number(await c.getAttribute('data-gesture'));assert(active>.4&&active<3);
  await f.locator('.hint-character').click();
  const afterTap=Number(await c.getAttribute('data-gesture'));assert(afterTap>=active,'Click during a wave must not reset it');
  await f.locator('[data-pause]').click();
  const frozen=await c.getAttribute('data-time');await page.waitForTimeout(160);assert.equal(await c.getAttribute('data-time'),frozen);
  await f.locator('[data-wave]').click();await page.waitForTimeout(200);assert(Number(await c.getAttribute('data-gesture'))>afterTap);
  await f.locator('summary').click();
  for(const t of [0,240,550,750,1130,1430,1720,2100,2470,3160,3650,4070,4500]){
    await f.locator('input').evaluate((el,n)=>{el.value=String(n);el.dispatchEvent(new Event('input',{bubbles:true}));},t);
    assert.equal(Math.round(Number(await c.getAttribute('data-gesture'))*1000),t);
  }
  const rest=await c.getAttribute('data-pose');
  await f.locator('input').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await c.getAttribute('data-pose'),rest,'The whole character must return to the same rest pose');
  for(const width of [320,390,736]){
    await page.setViewportSize({width,height:900});await page.waitForTimeout(80);
    const fit=await f.locator('#hint-drawn-paw').evaluate(el=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,buttons:[...el.querySelectorAll('button')].map(b=>b.getBoundingClientRect().height)}));
    assert(fit.scroll<=fit.width+1,`Overflow at ${width}`);assert(fit.buttons.every(h=>h>=44));
  }
  await page.setViewportSize({width:390,height:900});
  await f.locator('input').evaluate(el=>{el.value='1430';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await f.locator('.hint-card').screenshot({path:dir+`drawn-paw-${name}-preview.png`});
  await f.locator('input').evaluate(el=>{el.value='4500';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await f.locator('[data-wave]').click();
  const started=Date.now();
  await f.locator('canvas[data-gesture="4.500"]').waitFor({timeout:9000});
  const runMilliseconds=Date.now()-started;assert(runMilliseconds<6500,'The wave should play near its authored duration');
  const endPose=await c.getAttribute('data-pose');await page.waitForTimeout(250);assert.equal(await c.getAttribute('data-gesture'),'4.500');assert.equal(await c.getAttribute('data-pose'),endPose);
  const reduced=await browser.newPage({viewport:{width:390,height:900},reducedMotion:'reduce'});await reduced.goto('http://127.0.0.1:5194/');const rf=reduced.frameLocator('iframe');await rf.locator('canvas[data-ready=true]').waitFor();await reduced.waitForTimeout(180);assert.equal(await rf.locator('canvas').getAttribute('data-gesture'),'0.000');assert.equal(await rf.locator('canvas').getAttribute('data-time'),'0.000');
  await rf.locator('[data-wave]').click();await reduced.waitForTimeout(250);assert(Number(await rf.locator('canvas').getAttribute('data-gesture'))>0);assert.equal(await rf.locator('canvas').getAttribute('data-time'),'0.000');
  assert.deepEqual(errors,[]);results.push({browser:name,autoplay:true,pause:true,noRestartOnTap:true,resume:true,scrub:true,seamlessRest:true,oneShot:true,runMilliseconds,widths:[320,390,736],reducedMotion:true,errors});
  await browser.close();
}
await writeFile(dir+'drawn-paw-check.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
