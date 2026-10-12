import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gestures } from '../src/motion.js';

const { chromium }=createRequire(import.meta.url)('@playwright/test');
const sharp=createRequire(process.env.HINT_TOOLS_PACKAGE||import.meta.url)('sharp');
const dir=fileURLToPath(new URL('../',import.meta.url));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:512,height:640},reducedMotion:'reduce'});
await page.goto(process.env.HINT_PREVIEW_URL||'http://127.0.0.1:8767/versions/v2/preview/index.html');
await page.waitForFunction(()=>document.getElementById('hint-expressive-gestures').mascot);
await page.evaluate(async()=>{
  const {assets}=await import('../preview/hint-assets.js');
  const {createRenderer}=await import('../src/renderer.js');
  const {sampleGesture}=await import('../src/motion.js');
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  document.body.replaceChildren(canvas);
  const blank=document.createElement('canvas');blank.width=blank.height=1;
  const characterAssets={...assets,images:{...assets.images,envelope:blank.toDataURL()}};
  window.auditRenderer=await createRenderer(canvas,characterAssets);
  window.renderAudit=(id,time,letter)=>{
    const pose=sampleGesture(id,time);pose.question=0;pose.sparkles=0;
    window.auditRenderer.render(pose,0,{x:pose.gazeX,y:pose.gazeY},letter,id,time);
    return canvas.toDataURL('image/png').split(',')[1];
  };
});
function components(data,width,height) {
  const seen=new Uint8Array(width*height),areas=[],queue=new Int32Array(width*height);
  for(let n=0;n<seen.length;n++){
    if(seen[n]||data[n*4+3]<128)continue;
    let head=0,tail=1;queue[0]=n;seen[n]=1;
    while(head<tail){
      const p=queue[head++],x=p%width,y=Math.floor(p/width);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const xx=x+dx,yy=y+dy;if(xx<0||xx>=width||yy<0||yy>=height)continue;
        const q=yy*width+xx;if(seen[q]||data[q*4+3]<128)continue;seen[q]=1;queue[tail++]=q;
      }
    }
    if(tail>=60)areas.push(tail);
  }
  return areas.sort((a,b)=>b-a);
}
const result=[];
try{
  for(const [id,clip] of Object.entries(gestures))for(const letter of id.includes('letter')?[id==='offer-letter'?'held':'delivered']:['held','delivered']){
    const frames=[];
    for(let i=0;i<=Math.ceil(clip.duration*30);i++){
      const time=Math.min(clip.duration,i/30),base64=await page.evaluate(({id,time,letter})=>window.renderAudit(id,time,letter),{id,time,letter});
      const {data,info}=await sharp(Buffer.from(base64,'base64')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      const areas=components(data,info.width,info.height);
      assert.equal(areas.length,1,`${id} ${letter} at ${time}: disconnected body or paw`);
      frames.push({time,area:areas[0]});
    }
    const item={gesture:id,letter,frames:frames.length,majorCharacterComponents:1,minArea:Math.min(...frames.map(f=>f.area)),maxArea:Math.max(...frames.map(f=>f.area))};
    result.push(item);console.log(JSON.stringify(item));
  }
  await writeFile(path.join(dir,'evidence/frame-audit.json'),JSON.stringify(result,null,2)+'\n');
}finally{await browser.close();}
