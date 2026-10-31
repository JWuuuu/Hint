import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
const {chromium}=createRequire('/Users/jwu/Documents/Hint-main/artifacts/hint/package.json')('@playwright/test');
const sharp=createRequire('/Users/jwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const dir=new URL('./',import.meta.url).pathname;
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:740,height:900},reducedMotion:'reduce'});
page.on('pageerror',e=>console.error(e));
await page.goto('http://127.0.0.1:5195/');const f=page.frameLocator('iframe');await f.locator('canvas[data-ready=true]').waitFor();
const times=[0,240,400,550,750,920,1130,1290,1430,1570,1720,1920,2100,2280,2470,2660,2800,2980,3160,3400,3650,3860,4070,4500],tiles=[];
for(let i=0;i<times.length;i++){
  const src=await f.locator('input').evaluate((el,t)=>{window.reviewClock=t/1000;el.value=String(t);el.dispatchEvent(new Event('input',{bubbles:true}));return document.querySelector('canvas').toDataURL();},times[i]);
  const png=Buffer.from(src.split(',')[1],'base64');
  await writeFile(dir+`paw-poses/render-${times[i]}.png`,png);
  const label=Buffer.from(`<svg width="300" height="330" xmlns="http://www.w3.org/2000/svg"><text x="14" y="320" font-size="14" fill="#51384a" font-family="sans-serif">${(times[i]/1000).toFixed(2)} s</text></svg>`);
  const tile=await sharp({create:{width:300,height:330,channels:4,background:'#faf7f2'}}).composite([{input:await sharp(png).resize(300,300).toBuffer(),top:0,left:0},{input:label}]).png().toBuffer();
  tiles.push({input:tile,left:(i%6)*300,top:Math.floor(i/6)*330});
}
await sharp({create:{width:1800,height:1320,channels:4,background:'#faf7f2'}}).composite(tiles).png().toFile(dir+'drawn-paw-review.png');
await browser.close();console.log('Saved 24 whole-character poses');
