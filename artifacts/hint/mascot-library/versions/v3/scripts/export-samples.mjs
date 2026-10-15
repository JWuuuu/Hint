import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('@playwright/test');
const sharp=createRequire(process.env.HINT_TOOLS_PACKAGE||import.meta.url)('sharp');
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'samples');await mkdir(out,{recursive:true});
const all=['idle','welcome','offer-letter','listening','thinking','reading','speaking','waiting','wink-left','wink-right','nod','shake-head','celebration','curious','surprised','shy','comfort','disappointed','frustrated','sleepy'];
const ids=process.argv.slice(2).filter(a=>!a.startsWith('--'));if(!ids.length)ids.push(...all);
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:430,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const results=[];
try{
 await page.goto(process.env.HINT_PREVIEW_URL||'http://127.0.0.1:8767/versions/v3/preview/index.html');await page.waitForFunction(()=>document.getElementById('hint-gestures-v3').mascot);
 for(const id of ids){
  const data=await page.evaluate(async id=>{
   const api=document.getElementById('hint-gestures-v3').mascot,source=document.querySelector('canvas');
   api.resetScene();api.setSpeed(1);api.setAccentsVisible(false);api.pause();
   const canvas=document.createElement('canvas');canvas.width=canvas.height=640;const c=canvas.getContext('2d');
   const stream=canvas.captureStream(30),mimeType=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';
   const recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:3500000}),chunks=[];
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   const total=id==='offer-letter'?6.5:({idle:7,listening:7,thinking:7,reading:8,speaking:8,waiting:8}[id]||api.getState().duration);
   const frames=[],times=[],states=[],deltas=[];let last=performance.now(),stopped=false,renderFrame=0,next=0;
   const start=performance.now();
   function draw(now){
    c.fillStyle='#faf7f2';c.fillRect(0,0,640,640);const state=api.getState();
    const ease=x=>{const t=Math.max(0,Math.min(1,x));return t*t*t*(t*(t*6-15)+10);};
    const received=state.gesture==='deliver-letter'?ease(state.time/.32):state.letter==='delivered'?1:0;
    const lift=state.gesture==='deliver-letter'?ease(state.time/.42)*(1-ease((state.time-.48)/.84)):0;
    if(received){c.save();c.globalAlpha=received;c.fillStyle='#f0e5e9';c.strokeStyle='#deccd5';c.lineWidth=2;c.beginPath();c.roundRect(110,501+8*(1-received)-lift*169.6,420,147,26);c.fill();c.stroke();c.restore();}
    c.drawImage(source,0,0,640,640);const elapsed=(now-start)/1000;
    deltas.push(now-last);last=now;
    if(elapsed>=next){frames.push(canvas.toDataURL());times.push(elapsed);states.push({gesture:state.gesture,time:state.time,letter:state.letter,phase:state.phase});next+=.6;}
    if(!stopped)renderFrame=requestAnimationFrame(draw);
   }
   const wait=ms=>new Promise(r=>setTimeout(r,ms));
   const finished=()=>new Promise(resolve=>{function poll(){if(!api.getState().active)resolve();else requestAnimationFrame(poll);}requestAnimationFrame(poll);});
   recorder.start();draw(performance.now());await wait(180);
   if(['idle','listening','thinking','reading','speaking','waiting'].includes(id)){
    api.setActivity(id);api.resume();await wait(id==='idle'?6500:6000);api.setActivity('idle');await wait(1000);
   }else{
    api.playGesture(id);await finished();
    if(id==='offer-letter'){await wait(900);api.acceptLetter();await finished();}
    await wait(550);
   }
   api.pause();stopped=true;cancelAnimationFrame(renderFrame);
   const done=new Promise(resolve=>recorder.onstop=resolve);recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());
   const video=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(chunks,{type:mimeType}));});
   return {video,frames,times,states,deltas,elapsed:(performance.now()-start)/1000};
  },id);
  const dir=path.join(out,id);await mkdir(dir,{recursive:true});
  const webm=path.join(dir,'motion.webm'),mp4=path.join(dir,'motion.mp4');await writeFile(webm,Buffer.from(data.video,'base64'));
  execFileSync('/opt/homebrew/bin/ffmpeg',['-hide_banner','-loglevel','error','-y','-i',webm,'-an','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',mp4]);
  const selected=data.frames.length<=12?data.frames.map((_,i)=>i):Array.from({length:12},(_,i)=>Math.round(i*(data.frames.length-1)/11));
  const tiles=[];
  for(let i=0;i<selected.length;i++){
   const j=selected[i],png=Buffer.from(data.frames[j].split(',')[1],'base64');await writeFile(path.join(dir,`frame-${String(i).padStart(2,'0')}.png`),png);
   const label=Buffer.from(`<svg width="220" height="240" xmlns="http://www.w3.org/2000/svg"><text x="10" y="233" fill="#6c445f" font-family="sans-serif" font-size="12">${data.times[j].toFixed(2)} s</text></svg>`);
   const tile=await sharp({create:{width:220,height:240,channels:4,background:'#faf7f2'}}).composite([{input:await sharp(png).resize(220).toBuffer(),left:0,top:0},{input:label}]).png().toBuffer();tiles.push({input:tile,left:i%4*220,top:Math.floor(i/4)*240});
  }
  await sharp({create:{width:880,height:Math.ceil(selected.length/4)*240,channels:4,background:'#faf7f2'}}).composite(tiles).png().toFile(path.join(dir,'keyframes.png'));
  const ordered=data.deltas.slice(2).sort((a,b)=>a-b),result={gesture:id,seconds:data.elapsed,sampleTimes:selected.map(i=>data.times[i]),sampleStates:selected.map(i=>data.states[i]),medianFrameMs:ordered[Math.floor(ordered.length*.5)],p95FrameMs:ordered[Math.floor(ordered.length*.95)],decorativeAccents:false,errors:[...errors]};
  assert.deepEqual(errors,[]);await writeFile(path.join(dir,'review.json'),JSON.stringify(result,null,2)+'\n');results.push(result);console.log(JSON.stringify({gesture:id,seconds:data.elapsed,frames:selected.length,errors}));
 }
 if(ids.length===all.length)await writeFile(path.join(out,'index.json'),JSON.stringify(results,null,2)+'\n');
}finally{await browser.close();}
