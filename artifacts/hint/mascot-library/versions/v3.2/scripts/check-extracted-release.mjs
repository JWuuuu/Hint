import { createRequire } from 'node:module';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';

const {chromium,webkit}=createRequire(import.meta.url)('@playwright/test');
if(!process.argv[2])throw Error('Pass the extracted release folder.');
const root=path.resolve(process.argv[2]);
const manifest=JSON.parse(await readFile(path.join(root,'MANIFEST.json'),'utf8'));
const hash=file=>readFile(file).then(bytes=>createHash('sha256').update(bytes).digest('hex'));
for(const [name,expected] of Object.entries(manifest.files))assert.equal(await hash(path.join(root,name)),expected,name);
const protectedFiles=JSON.parse(await readFile(path.join(root,'approved/v1/checksums.json'),'utf8')).files;
for(const name of Object.keys(protectedFiles))assert.equal((await stat(path.join(root,'approved/v1',name))).mode&0o222,0,name);
const build=execFileSync(process.execPath,[path.join(root,'scripts/build.mjs')],{cwd:root,encoding:'utf8'});
for(const name of ['preview/index.html','preview/hint-gestures.html','preview/hint-assets.js'])assert.equal(await hash(path.join(root,name)),manifest.files[name],'Independent build changed '+name);
const testOutput=execFileSync(process.execPath,['--test',path.join(root,'scripts/motion.test.mjs')],{cwd:root,encoding:'utf8'});
const testCount=Number(testOutput.match(/tests (\d+)/)?.[1]);
assert.ok(testCount>=12);
const browsers=[];
for(const [name,engine,options] of [['Chrome',chromium,{channel:'chrome',headless:true}],['WebKit',webkit,{headless:true}]]){
  const browser=await engine.launch(options);
  try{
    const context=await browser.newContext({viewport:{width:390,height:850},hasTouch:true,reducedMotion:'reduce'});
    await context.route(/^https?:\/\//,route=>route.abort());
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('file://'+path.join(root,'preview/index.html'));
    await page.waitForFunction(()=>document.getElementById('hint-gestures-v3').mascot);
    const poses=await page.evaluate(()=>{
      const api=document.getElementById('hint-gestures-v3').mascot;
      const ids=Array.from(document.querySelectorAll('[data-gesture] option'),o=>o.value);
      return ids.filter(id=>id!=='offer-letter').map(id=>[id,id==='welcome'?2.1:1]).map(([id,time])=>{
        api.resetScene();api.setAccentsVisible(false);api.playGesture(id);api.seek(time);
        return {id,pose:api.getPose(),letter:api.getState().letter};
      });
    });
    assert.ok(poses.every(row=>Object.values(row.pose).every(Number.isFinite)&&row.letter==='held'));
    await page.evaluate(()=>{
      const api=document.getElementById('hint-gestures-v3').mascot;
      api.resetScene();api.playGesture('offer-letter');api.seek(2.4);
    });
    assert.equal(await page.evaluate(()=>document.getElementById('hint-gestures-v3').mascot.getState().letter),'offered');
    await page.locator('[data-play]').tap();
    await page.evaluate(()=>document.getElementById('hint-gestures-v3').mascot.seek(1.8));
    assert.equal(await page.evaluate(()=>document.getElementById('hint-gestures-v3').mascot.getState().letter),'delivered');
    await page.locator('[data-v3-reference] summary').click();
    await page.frameLocator('[data-v3]').locator('canvas[data-ready="true"]').first().waitFor();
    await page.locator('[data-v3-reference] summary').click();
    await page.locator('[data-v2-reference] summary').click();
    await page.frameLocator('[data-v2]').locator('canvas[data-ready="true"]').first().waitFor();
    await page.locator('[data-v2-reference] summary').click();
    await page.locator('[data-v1-reference] summary').click();
    await page.frameLocator('[data-v1]').locator('canvas[data-ready="true"]').waitFor();
    assert.equal(await page.frameLocator('[data-v1]').locator('[data-gesture] option').count(),7);
    await page.locator('[data-v1-reference] summary').click();
    await page.locator('[data-reference] summary').click();
    await page.frameLocator('[data-approved]').locator('canvas[data-ready="true"]').waitFor();
    assert.equal(await page.frameLocator('[data-approved]').locator('h2').textContent(),'Hey, welcome to Hint.');
    await page.locator('[data-reference] summary').click();
    for(const width of [320,390,430]){
      await page.setViewportSize({width,height:850});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    await page.goto('file://'+path.join(root,'samples/index.html'));
    assert.equal(await page.locator('video').count(),20);
    for(let i=0;i<20;i++){
      const video=page.locator('video').nth(i);await video.scrollIntoViewIfNeeded();
      const loaded=await video.evaluate(async v=>{v.preload='auto';v.load();await new Promise((resolve,reject)=>{v.onloadeddata=resolve;v.onerror=()=>reject(Error('Offline clip failed'));});return v.duration>1&&v.videoWidth===640;});assert.ok(loaded);
    }
    assert.deepEqual(errors,[]);
    browsers.push({browser:name,offline:true,widths:[320,390,430],gestures:20,clips:20,delivery:true,comparisons:true,errors});
  }finally{await browser.close();}
}
const result={version:manifest.version,verifiedFiles:Object.keys(manifest.files).length,readOnlyApprovedFiles:Object.keys(protectedFiles).length,independentBuild:true,builtInTestsPassed:testCount,browsers,build:{...JSON.parse(build.trim()),output:'preview/hint-gestures.html'}};
await writeFile(process.argv[3]||path.join(root,'EXTRACTED-CHECK.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
