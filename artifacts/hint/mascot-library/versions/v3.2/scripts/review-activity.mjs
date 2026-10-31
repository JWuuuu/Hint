import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)('@playwright/test');
const sharp=createRequire(process.env.HINT_TOOLS_PACKAGE||import.meta.url)('sharp');
const root=fileURLToPath(new URL('../',import.meta.url));
const id=process.argv[2]||'listening';
const seconds=Number(process.env.HINT_REVIEW_SECONDS||60);
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,recordVideo:{dir:path.join(root,'evidence/videos'),size:{width:390,height:844}}});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.HINT_PREVIEW_URL||'http://127.0.0.1:8767/versions/v3.2/preview/index.html');
await page.waitForFunction(()=>document.getElementById('hint-gestures-v3').mascot);
const data=await page.evaluate(async({id,seconds})=>{
 const root=document.getElementById('hint-gestures-v3'),api=root.mascot,canvas=root.querySelector('canvas');
 api.resetScene();api.setAccentsVisible(false);api.setActivity(id);api.resume();root.dataset.labelsHidden='true';
 const start=performance.now(),frames=[],samples=[];let last=0,next=0,restarted=false;
 await new Promise(resolve=>{function step(now){const s=api.getState();if(s.time<last)restarted=true;last=s.time;
  if(now-start>=next*1000){frames.push(canvas.toDataURL());samples.push({wall:(now-start)/1000,state:s,pose:api.getPose()});next+=5;}
  if(now-start>=seconds*1000){resolve();return;}requestAnimationFrame(step);}requestAnimationFrame(step);});
 api.pause();return {frames,samples,restarted};
},{id,seconds});
const folder=path.join(root,'evidence/activities',id);await mkdir(folder,{recursive:true});
const tiles=[];
for(let i=0;i<data.frames.length;i++){
 const png=Buffer.from(data.frames[i].split(',')[1],'base64');await writeFile(path.join(folder,i+'.png'),png);
 const label=Buffer.from(`<svg width="180" height="202" xmlns="http://www.w3.org/2000/svg"><text x="8" y="194" font-family="sans-serif" font-size="12" fill="#6c445f">${data.samples[i].wall.toFixed(0)} s</text></svg>`);
 tiles.push({input:await sharp({create:{width:180,height:202,channels:4,background:'#faf7f2'}}).composite([{input:await sharp(png).resize(180).toBuffer(),left:0,top:0},{input:label}]).png().toBuffer(),left:i%4*180,top:Math.floor(i/4)*202});
}
await sharp({create:{width:720,height:Math.ceil(tiles.length/4)*202,channels:4,background:'#faf7f2'}}).composite(tiles).png().toFile(path.join(root,'evidence',id+'-activity.png'));
const video=page.video();await context.close();await video.saveAs(path.join(root,'evidence/videos',id+'-activity.webm'));await video.delete();
const report={activity:id,seconds,samples:data.samples,restarted:data.restarted,errors};
await writeFile(path.join(folder,'review.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({activity:id,seconds,samples:data.samples.length,restarted:data.restarted,errors}));await browser.close();
