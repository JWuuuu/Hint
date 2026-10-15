import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium,webkit}=createRequire(import.meta.url)('@playwright/test');
const results=[];
for(const [name,engine] of Object.entries({chromium,webkit})){
 const browser=await engine.launch(name==='chromium'?{channel:'chrome',headless:true}:{headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.HINT_PREVIEW_URL||'http://127.0.0.1:8767/versions/v3.1/preview/index.html')+'?gesture=frustrated&pose=1');
  await page.waitForFunction(()=>document.getElementById('hint-gestures-v3').mascot);
  const state=()=>page.evaluate(()=>document.getElementById('hint-gestures-v3').mascot.getState());
  assert.equal((await state()).gesture,'frustrated');assert.equal((await state()).paused,true);assert.equal((await state()).time,1.5);
  assert.ok(await page.locator('[data-gesture]').isEnabled());
  await page.locator('[data-gesture]').selectOption('disappointed');
  await page.locator('[data-main-pose]').tap();assert.equal((await state()).time,1.8);assert.equal((await state()).paused,true);
  await page.locator('[data-gesture]').selectOption('reading');await page.waitForTimeout(150);
  assert.equal((await state()).activity,'reading');assert.equal((await state()).paused,false);
  await page.locator('[data-main-pose]').tap();assert.equal((await state()).paused,true);
  const faces=await page.evaluate(async()=>{
   const {createFacePainter}=await import('../src/face.js'),{sampleGesture}=await import('../src/motion.js'),{assets}=await import('../preview/hint-assets.js');
   const eye=new Image();eye.src=assets.images['expression-eyes'];await eye.decode();
   const painter=createFacePainter(eye);
   return [['idle',0,300,19],['frustrated',1.5,296,13],['disappointed',1.8,300,19]].map(([id,time,cx,width])=>{
    const pose=sampleGesture(id,time),canvas=painter.paint(pose,{x:0,y:0}),pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    const centers=[],edges=[];
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
     const gx=196+x/2,gy=230+y/2,n=(y*canvas.width+x)*4,d=Math.abs(gx-cx);
     if(gy<285||gy>318||pixels[n+3]<180||pixels[n]>150)continue;
     if(d<1.5)centers.push(gy);else if(d>width/2-2&&d<width/2+1)edges.push(gy);
    }
    const average=a=>a.reduce((sum,v)=>sum+v,0)/a.length;
    return {id,middleMinusCorners:average(centers)-average(edges)};
   });
  });
  assert.ok(faces[0].middleMinusCorners>2,'The resting smile is retained');
  assert.ok(faces.slice(1).every(row=>row.middleMinusCorners< -2),'Negative emotions must have downturned mouths');
  assert.deepEqual(errors,[]);results.push({engine:name,heldPose:true,switchFromHeldPose:true,readingResumes:true,faces,errors});
 }finally{await browser.close();}
}
await writeFile(new URL('../evidence/expression-controls.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results));
