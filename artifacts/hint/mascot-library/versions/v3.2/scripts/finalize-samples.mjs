import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {gestures,reviewTimes} from '../src/motion.js';
const sharp=createRequire(process.env.HINT_TOOLS_PACKAGE||import.meta.url)('sharp');
const root=fileURLToPath(new URL('../',import.meta.url));
const order=['idle','welcome','offer-letter','listening','thinking','reading','speaking','waiting','wink-left','wink-right','nod','shake-head','celebration','curious','surprised','shy','comfort','disappointed','frustrated','sleepy'];
const results=[];
for(const id of order){
 const dir=path.join(root,'samples',id),video=path.join(dir,'motion.mp4');
 const meta=JSON.parse(execFileSync('/opt/homebrew/bin/ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,width,height,avg_frame_rate','-of','json',video],{encoding:'utf8'}));
 const duration=Number(meta.format.duration),fps=12/duration;
 execFileSync('/opt/homebrew/bin/ffmpeg',['-hide_banner','-loglevel','error','-y','-i',video,'-vf',`fps=${fps}:start_time=0:round=near`,'-frames:v','12','-start_number','0',path.join(dir,'frame-%02d.png')]);
 const tiles=[];
 for(let i=0;i<12;i++){
  const image=path.join(dir,`frame-${String(i).padStart(2,'0')}.png`),caption=Buffer.from(`<svg width="220" height="240" xmlns="http://www.w3.org/2000/svg"><text x="10" y="233" fill="#6c445f" font-family="sans-serif" font-size="12">${(i/fps).toFixed(2)} s</text></svg>`);
  const tile=await sharp({create:{width:220,height:240,channels:4,background:'#faf7f2'}}).composite([{input:await sharp(image).resize(220).toBuffer(),left:0,top:0},{input:caption}]).png().toBuffer();tiles.push({input:tile,left:i%4*220,top:Math.floor(i/4)*240});
 }
 await sharp({create:{width:880,height:720,channels:4,background:'#faf7f2'}}).composite(tiles).png().toFile(path.join(dir,'keyframes.png'));
 const result=JSON.parse(await readFile(path.join(dir,'review.json'),'utf8'));result.video={duration,codec:meta.streams[0].codec_name,width:meta.streams[0].width,height:meta.streams[0].height};result.keyframeTimes=Array.from({length:12},(_,i)=>i/fps);result.keyframesFromVideo=true;
 await writeFile(path.join(dir,'review.json'),JSON.stringify(result,null,2)+'\n');results.push(result);
}
await writeFile(path.join(root,'samples/index.json'),JSON.stringify(results,null,2)+'\n');
const cards=order.map((id,i)=>{const frame=Math.max(0,Math.min(11,Math.round((reviewTimes[id]+.18)/results[i].video.duration*12)));return `<article><h2>${gestures[id].label}</h2><video controls playsinline preload="none" poster="${id}/frame-${String(frame).padStart(2,'0')}.png" aria-label="${gestures[id].label}"><source src="${id}/motion.mp4" type="video/mp4"></video><a href="${id}/keyframes.png">Keyframes</a> <a href="${id}/motion.mp4" download>Save clip</a></article>`;}).join('\n');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hint · 20 gestures · v3.1</title><style>*{box-sizing:border-box}body{margin:0;padding:28px 20px;background:#f3eef1;color:#51384a;font:15px/1.5 system-ui,sans-serif}main{max-width:1100px;margin:auto}h1{font:400 32px Georgia,serif;margin:12px 0}h2{font-size:15px;font-weight:500;margin:0 0 8px}p{max-width:640px;color:#796574}a{color:#6c445f;margin-right:12px}nav{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin:20px 0}button,label{min-height:44px;padding:10px 16px;border:1px solid #decfda;border-radius:12px;background:#faf7f2;color:#51384a;font:inherit}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px}article{background:#faf7f2;padding:16px;border-radius:20px;border:1px solid #e7dbe3}video{width:100%;aspect-ratio:1;display:block;border-radius:12px;margin-bottom:12px}article a{font-size:13px}body[data-hide="true"] h2{visibility:hidden}</style><main><a href="../preview/index.html">← Interactive preview</a><h1>Hint · 20 gestures · v3.1</h1><p>Each clip shows the entrance, the main pose, and the return. The letter clip includes acceptance. Quiet reading and speaking have separate movements.</p><nav><button data-speed="1">Normal speed</button><button data-speed=".5">Half speed</button><label><input type="checkbox" id="names"> Hide names</label></nav><section class="grid">${cards}</section></main><script>document.querySelectorAll('[data-speed]').forEach(button=>button.onclick=()=>document.querySelectorAll('video').forEach(video=>video.playbackRate=Number(button.dataset.speed)));document.getElementById('names').onchange=event=>document.body.dataset.hide=String(event.target.checked);document.querySelectorAll('video').forEach(video=>video.onplay=()=>document.querySelectorAll('video').forEach(other=>{if(other!==video)other.pause()}));document.addEventListener('visibilitychange',()=>{if(document.hidden)document.querySelectorAll('video').forEach(video=>video.pause())});</script></html>`;
await writeFile(path.join(root,'samples/index.html'),html);
console.log(JSON.stringify({clips:results.length,keyframes:results.length*12,format:'H.264 MP4',size:640}));
