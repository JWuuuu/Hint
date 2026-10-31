import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawn} from 'node:child_process';
const {chromium}=createRequire(import.meta.url)('@playwright/test');
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'evidence/greeting-reactions');
await mkdir(path.join(out,'frames'),{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:320,height:744},deviceScaleFactor:1});
await page.addInitScript(()=>{
  let now=1000,id=0;const callbacks=new Map();
  window.requestAnimationFrame=callback=>{callbacks.set(++id,callback);return id;};
  window.cancelAnimationFrame=id=>callbacks.delete(id);
  window.advanceGreetingFrame=ms=>{now+=ms;const queued=[...callbacks.values()];callbacks.clear();for(const callback of queued)callback(now);};
});
await page.goto('http://127.0.0.1:8767/versions/v3.2/preview/journey.html');await page.waitForFunction(()=>window.hintJourney,null,{polling:50});
await page.evaluate(()=>{window.hintJourney.seek(4.4);window.hintJourney.resume();window.advanceGreetingFrame(0);});
const clip=await page.evaluate(()=>{const b=document.querySelector('[data-stage]').getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};});
const peaks=[];
for(let frame=0;frame<420;frame++){
  if(frame===60||frame===306)await page.evaluate(()=>document.querySelector('[data-actor]').click());
  await page.evaluate(()=>window.advanceGreetingFrame(1000/60));
  await page.screenshot({clip,path:path.join(out,'frames',String(frame).padStart(4,'0')+'.png')});
  if([98,351].includes(frame))peaks.push(await page.evaluate(()=>window.hintJourney.getState()));
}
await browser.close();
const output=path.join(out,'welcome-wave-and-wink.mp4');
await new Promise((resolve,reject)=>{
  const process=spawn('ffmpeg',['-y','-loglevel','error','-framerate','60','-i',path.join(out,'frames','%04d.png'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',output],{stdio:'inherit'});
  process.on('error',reject);process.on('close',code=>code===0?resolve():reject(Error('Video export failed: '+code)));
});
await writeFile(path.join(out,'sample.json'),JSON.stringify({output:path.basename(output),fps:60,duration:7,peaks},null,2)+'\n');
console.log(JSON.stringify({output,frames:420,fps:60}));
