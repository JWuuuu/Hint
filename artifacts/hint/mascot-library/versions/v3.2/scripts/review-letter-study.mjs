import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)('@playwright/test');
const sharp=createRequire(process.env.HINT_TOOLS_PACKAGE||import.meta.url)('sharp');
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'evidence/letter-scene');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.goto('http://127.0.0.1:8767/versions/v3.2/preview/letter.html');
await page.waitForFunction(()=>window.hintLetter);
const frames=[];
for(const [phase,time] of [...[0,.42,1,1.65,2.4].map(t=>['offer',t]),...[0,.479,.481,.7,1.1,1.62,1.9,2.24,2.6,2.95,3.18,3.6].map(t=>['delivery',t])]){
  await page.evaluate(([phase,t])=>window.hintLetter.seek(phase,t),[phase,time]);
  const filename=`${phase}-${String(time).replace('.','_')}.png`;
  await page.locator('[data-stage]').screenshot({path:path.join(out,filename)});frames.push({phase,time,filename,state:await page.evaluate(()=>window.hintLetter.getState())});
}
await page.evaluate(()=>{window.hintLetter.flipCard();window.hintLetter.resume();});
await page.waitForTimeout(1000);await page.evaluate(()=>window.hintLetter.pause());
await page.locator('[data-stage]').screenshot({path:path.join(out,'reading.png')});frames.push({phase:'reading',time:1,filename:'reading.png'});
await browser.close();
const width=195,height=412,cols=6,rows=Math.ceil(frames.length/cols),tiles=[];
for(let i=0;i<frames.length;i++){
  const frame=frames[i],top=Math.floor(i/cols)*height,left=i%cols*width;
  tiles.push({input:await sharp(await readFile(path.join(out,frame.filename))).resize({width:195,height:390}).png().toBuffer(),top:top+22,left});
  tiles.push({input:Buffer.from(`<svg width="195" height="22"><text x="8" y="16" fill="#64475b" font-family="sans-serif" font-size="11">${frame.phase} ${frame.time.toFixed(3)} s</text></svg>`),top,left});
}
await sharp({create:{width:cols*width,height:rows*height,channels:4,background:'#ece5e8'}}).composite(tiles).png().toFile(path.join(out,'contact-sheet.png'));
await writeFile(path.join(out,'frames.json'),JSON.stringify({frames,errors},null,2)+'\n');
console.log(JSON.stringify({output:out,frames:frames.length,errors}));
