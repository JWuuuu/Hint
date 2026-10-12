import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)('@playwright/test');
const sharp=createRequire(process.env.HINT_TOOLS_PACKAGE||import.meta.url)('sharp');
const root=fileURLToPath(new URL('../',import.meta.url));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:430,height:880},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.HINT_PREVIEW_URL||'http://127.0.0.1:8767/versions/v3.2/preview/index.html');
await page.waitForFunction(()=>document.getElementById('hint-gestures-v3').mascot);
const report=[];
const empty=process.argv.includes('--empty');
const ids=process.argv.slice(2).filter(a=>!a.startsWith('--'));
for(const id of ids)for(const speed of [1,.5]){
  const data=await page.evaluate(async({id,speed,empty})=>{
    const api=document.getElementById('hint-gestures-v3').mascot,canvas=document.querySelector('canvas');
    api.resetScene();api.setSpeed(speed);api.setAccentsVisible(false);
    if(empty){api.playGesture('offer-letter');api.seek(2.4);api.acceptLetter();api.seek(1.8);}
    if(id==='deliver-letter'){api.playGesture('offer-letter');api.seek(2.4);api.acceptLetter();}
    else api.playGesture(id);
    const duration=api.getState().duration,start=performance.now(),frames=[canvas.toDataURL()],times=[0],deltas=[];
    let next=1,last=start,previousTime=0,monotonic=true;
    await new Promise(resolve=>{
      function step(now){
        const s=api.getState();deltas.push(now-last);last=now;
        if(s.time<previousTime)monotonic=false;previousTime=s.time;
        if(s.time>=duration*next/11&&next<12){frames.push(canvas.toDataURL());times.push(s.time);next++;}
        if(!s.active){resolve();return;}requestAnimationFrame(step);
      }requestAnimationFrame(step);
    });
    return {frames,times,elapsed:performance.now()-start,deltas,monotonic};
  },{id,speed,empty});
  const tiles=[];
  for(let i=0;i<data.frames.length;i++){
    const png=Buffer.from(data.frames[i].split(',')[1],'base64');
    const caption=Buffer.from('<svg width="220" height="244" xmlns="http://www.w3.org/2000/svg"><text x="10" y="235" font-family="sans-serif" font-size="12" fill="#6c445f">'+data.times[i].toFixed(2)+' s</text></svg>');
    const tile=await sharp({create:{width:220,height:244,channels:4,background:'#faf7f2'}}).composite([{input:await sharp(png).resize(220).toBuffer(),left:0,top:0},{input:caption}]).png().toBuffer();
    tiles.push({input:tile,left:i%4*220,top:Math.floor(i/4)*244});
  }
  const label=speed===1?'normal':'slow';
  await sharp({create:{width:880,height:732,channels:4,background:'#faf7f2'}}).composite(tiles).png().toFile(path.join(root,'evidence',id+(empty?'-empty':'')+'-'+label+'.png'));
  const ordered=data.deltas.slice(2).sort((a,b)=>a-b);
  const result={gesture:id,letter:empty?'delivered':'held',speed,elapsed:data.elapsed,frames:ordered.length,medianFrameMs:ordered[Math.floor(ordered.length*.5)],p95FrameMs:ordered[Math.floor(ordered.length*.95)],monotonic:data.monotonic,accents:false,errors};
  report.push(result);console.log(JSON.stringify(result));
}
for(const id of ids)await writeFile(path.join(root,'evidence',id+(empty?'-empty':'')+'-playback.json'),JSON.stringify(report.filter(row=>row.gesture===id),null,2)+'\n');
await browser.close();
