import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require('@playwright/test');
const sharp=createRequire(process.env.HINT_TOOLS_PACKAGE||import.meta.url)('sharp');
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'evidence/entrance');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.goto('http://127.0.0.1:8767/versions/v3.2/preview/journey.html');
await page.waitForFunction(()=>window.hintJourney);
const times=[1.8,3.04,3.32,3.5,3.68,3.84,3.98,4.16,4.35,4.8,6.14,9.0];
const frames=[];
for(const t of times){
  await page.evaluate(t=>window.hintJourney.seek(t),t);
  const filename=path.join(out,`frame-${t.toFixed(2)}.png`);await page.locator('[data-stage]').screenshot({path:filename});
  frames.push({time:t,state:await page.evaluate(()=>window.hintJourney.getState()),file:filename});
}
await page.locator('[data-continue]').click();
await page.evaluate(()=>window.hintJourney.resume());await page.waitForTimeout(1100);await page.evaluate(()=>window.hintJourney.pause());
await page.locator('[data-stage]').screenshot({path:path.join(out,'profile.png')});
const width=195,height=420,tiles=[];
for(let i=0;i<frames.length;i++){
  const frame=frames[i],buffer=await sharp(frame.file).resize(195,390).png().toBuffer();
  const label=Buffer.from(`<svg width="195" height="30"><rect width="100%" height="100%" fill="#eee7ed"/><text x="10" y="20" font-family="sans-serif" font-size="12" fill="#61455b">${frame.time.toFixed(2)}s · ${frame.state.phase}</text></svg>`);
  const x=(i%4)*width,y=Math.floor(i/4)*height;tiles.push({input:buffer,left:x,top:y},{input:label,left:x,top:y+390});
}
await sharp({create:{width:width*4,height:height*3,channels:4,background:'#eee7ed'}}).composite(tiles).png().toFile(path.join(out,'contact-sheet.png'));
await writeFile(path.join(out,'frames.json'),JSON.stringify({errors,frames:frames.map(({file,...entry})=>entry)},null,2)+'\n');
await browser.close();console.log(JSON.stringify({errors,out}));
