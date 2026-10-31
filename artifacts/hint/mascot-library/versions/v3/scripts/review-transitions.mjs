import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)('@playwright/test');
const sharp=createRequire(process.env.HINT_TOOLS_PACKAGE||import.meta.url)('sharp');
const root=fileURLToPath(new URL('../',import.meta.url)),browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:430,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.HINT_PREVIEW_URL||'http://127.0.0.1:8767/versions/v3/preview/index.html');await page.waitForFunction(()=>document.getElementById('hint-gestures-v3').mascot);
 const pairs=[['welcome','thinking'],['listening','thinking'],['thinking','reading'],['reading','speaking'],['speaking','listening']],report=[];
 for(const empty of [false,true])for(const speed of [1,.5]){
  const tiles=[];
  for(let index=0;index<pairs.length;index++){
   const [from,to]=pairs[index];
   const result=await page.evaluate(async({from,to,empty,speed})=>{
    const a=document.getElementById('hint-gestures-v3').mascot,c=document.querySelector('canvas');a.resetScene();a.setSpeed(speed);a.setAccentsVisible(false);
    if(empty){a.playGesture('offer-letter');a.seek(2.4);a.acceptLetter();a.seek(1.8);}
    if(from==='welcome'){a.playGesture('welcome');a.seek(2.1);}else{a.setActivity(from);a.seek(2);}
    a.setActivity(to);const frames=[c.toDataURL()],times=[0];a.resume();let next=1;
    await new Promise(resolve=>{function step(){const s=a.getState();if(s.time>=next*.12){frames.push(c.toDataURL());times.push(s.time);next++;}if(next===7){a.pause();resolve();}else requestAnimationFrame(step);}requestAnimationFrame(step);});
    return {frames,times,letter:a.getState().letter};
   },{from,to,empty,speed});
   for(let j=0;j<result.frames.length;j++){
    const png=Buffer.from(result.frames[j].split(',')[1],'base64'),label=Buffer.from(`<svg width="160" height="186" xmlns="http://www.w3.org/2000/svg"><text x="4" y="179" font-family="sans-serif" fill="#6c445f" font-size="10">${from} → ${to} · ${result.times[j].toFixed(2)}</text></svg>`);
    const tile=await sharp({create:{width:160,height:186,channels:4,background:'#faf7f2'}}).composite([{input:await sharp(png).resize(160).toBuffer(),top:0,left:0},{input:label}]).png().toBuffer();tiles.push({input:tile,left:j*160,top:index*186});
   }
   report.push({from,to,speed,letter:result.letter,frames:result.frames.length});
  }
  await sharp({create:{width:1120,height:930,channels:4,background:'#faf7f2'}}).composite(tiles).png().toFile(path.join(root,`evidence/transitions-${empty?'empty':'held'}-${speed===1?'normal':'slow'}.png`));
 }
 await writeFile(path.join(root,'evidence/transition-review.json'),JSON.stringify({report,errors},null,2)+'\n');console.log(JSON.stringify({transitions:report.length,frames:report.reduce((n,r)=>n+r.frames,0),errors}));
}finally{await browser.close();}
