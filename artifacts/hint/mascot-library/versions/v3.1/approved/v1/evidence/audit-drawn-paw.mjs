import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const {chromium}=createRequire('/Users/jwu/Documents/Hint-main/artifacts/hint/package.json')('@playwright/test');
const sharp=createRequire('/Users/jwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const dir=new URL('./',import.meta.url).pathname;
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:740,height:920},reducedMotion:'reduce'});
await page.goto('http://127.0.0.1:5195/');const f=page.frameLocator('iframe');await f.locator('canvas[data-ready=true]').waitFor();
function components(data,w,h){
 const mask=new Uint8Array(w*h),queue=new Int32Array(w*h),counts=[];let area=0;
 for(let n=0;n<mask.length;n++)if(data[n*4+3]>64){mask[n]=1;area++;}
 for(let n=0;n<mask.length;n++)if(mask[n]){let head=0,tail=1;queue[0]=n;mask[n]=0;while(head<tail){const at=queue[head++],x=at%w,y=(at-x)/w;for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]){const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const next=yy*w+xx;if(mask[next]){mask[next]=0;queue[tail++]=next;}}}if(tail>=20)counts.push(tail);}
 return {area,components:counts.sort((a,b)=>b-a)};
}
const report=[],handTiles=[];
for(let frame=0;frame<=135;frame++){
 const t=frame/30,entry={t};
 for(const [label,layer]of [['arm',1],['whole',null]]){
  const dataURL=await f.locator('input').evaluate((el,{t,layer})=>{window.reviewClock=t;window.reviewLayer=layer===null?undefined:layer;el.value=String(Math.round(t*1000));el.dispatchEvent(new Event('input',{bubbles:true}));return document.querySelector('canvas').toDataURL();},{t,layer});
  const png=Buffer.from(dataURL.split(',')[1],'base64');
  const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});entry[label]=components(data,info.width,info.height);
  if(label==='arm'&&frame%12===0){const tile=await sharp(png).extract({left:85,top:260,width:240,height:310}).resize(168,217).flatten({background:'#ede5e8'}).png().toBuffer();handTiles.push({input:tile,left:(handTiles.length%6)*168,top:Math.floor(handTiles.length/6)*217});}
  if(label==='whole'&&[15,24,43,58,77,113,126].includes(frame))await writeFile(dir+`drawn-paw-audit-${frame}.png`,png);
 }
 report.push(entry);
}
const summary={frames:report.length,majorArmPieces:[...new Set(report.map(r=>r.arm.components.length))],majorWholePieces:[...new Set(report.map(r=>r.whole.components.length))],armAreaRange:[Math.min(...report.map(r=>r.arm.area)),Math.max(...report.map(r=>r.arm.area))]};
await sharp({create:{width:1008,height:434,channels:4,background:'#ede5e8'}}).composite(handTiles).png().toFile(dir+'drawn-paw-continuity.png');
await writeFile(dir+'drawn-paw-frame-audit.json',JSON.stringify({summary,frames:report},null,2));console.log(JSON.stringify(summary));await browser.close();
