import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('@playwright/test');
const sharp=createRequire(process.env.HINT_TOOLS_PACKAGE||import.meta.url)('sharp');
const root=fileURLToPath(new URL('../',import.meta.url));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:430,height:900},reducedMotion:'reduce'});
const url=process.env.HINT_PREVIEW_URL||'http://127.0.0.1:8767/versions/v3/preview/index.html';
await page.goto(url);await page.waitForFunction(()=>document.getElementById('hint-gestures-v3').mascot);
const keys=[['idle',1.6],['welcome',1.72],['offer-letter',2.4],['listening',1.8],['thinking',1.8],['reading',2],['speaking',1.6],['waiting',2],['wink-left',.65],['wink-right',.75],['nod',.88],['shake-head',.78],['celebration',1.1],['curious',1.3],['surprised',.8],['shy',1.6],['comfort',1.6],['disappointed',1.8],['frustrated',1.5],['sleepy',1.8]];
const faces=await page.evaluate(async keys=>{
  const {assets}=await import('../preview/hint-assets.js');
  const {createFacePainter}=await import('../src/face.js');
  const {sampleGesture}=await import('../src/motion.js');
  const eyes=new Image();eyes.src=assets.images['expression-eyes'];await eyes.decode();
  const painter=createFacePainter(eyes);
  return keys.map(([id,t])=>{const pose=sampleGesture(id,t);return painter.paint(pose,{x:pose.gazeX,y:pose.gazeY}).toDataURL().split(',')[1];});
},keys);
const faceTiles=[],mouths=[],hashes=[];
for(let i=0;i<keys.length;i++){
  const png=Buffer.from(faces[i],'base64');
  mouths.push(await sharp(png).extract({left:158,top:116,width:128,height:102}).ensureAlpha().raw().toBuffer());
  hashes.push(createHash('sha256').update(png).digest('hex'));
  const label=Buffer.from('<svg width="224" height="150" xmlns="http://www.w3.org/2000/svg"><text x="10" y="140" font-family="sans-serif" font-size="12" fill="#6c445f">'+keys[i][0]+'</text></svg>');
  const tile=await sharp({create:{width:224,height:150,channels:4,background:'#f9efe4'}}).composite([{input:await sharp(png).resize(224,120).toBuffer(),top:0,left:0},{input:label}]).png().toBuffer();
  faceTiles.push({input:tile,left:i%4*224,top:Math.floor(i/4)*150});
}
assert.ok(new Set(hashes).size>=17,'Facial variation was lost');
const mouthChanges=mouths.map((pixels,i)=>{let count=0;for(let n=0;n<pixels.length;n+=4)if([0,1,2,3].some(c=>Math.abs(pixels[n+c]-mouths[0][n+c])>20))count++;return {gesture:keys[i][0],changedPixels:count};});
assert.ok(mouthChanges.filter(v=>['thinking','celebration','surprised','sleepy'].includes(v.gesture)).every(v=>v.changedPixels>100),'Main expression mouth was lost');
await sharp({create:{width:896,height:750,channels:4,background:'#f9efe4'}}).composite(faceTiles).png().toFile(path.join(root,'evidence/facial-expressions.png'));
const fullTiles=[],smallTiles=[],avatarTiles=[],emptyTiles=[];
for(let i=0;i<keys.length;i++){
  const [id,time]=keys[i];
  for(const empty of [false,true]){
    await page.evaluate(({id,time,empty})=>{
      const a=document.getElementById('hint-gestures-v3').mascot;a.resetScene();a.setAccentsVisible(false);
      if(empty){a.playGesture('offer-letter');a.seek(2.4);a.acceptLetter();a.seek(1.8);}
      if(id!=='neutral'&&!(empty&&id==='offer-letter')){a.playGesture(id);a.seek(time);}
      a.pause();
    },{id,time,empty});
    const png=await page.locator('canvas').screenshot();
    if(!empty){
      fullTiles.push({input:await sharp(png).resize(220).toBuffer(),left:i%4*220,top:Math.floor(i/4)*220});
      smallTiles.push({input:await sharp(png).resize(160).toBuffer(),left:i%4*180+10,top:Math.floor(i/4)*180+10});
      avatarTiles.push({input:await sharp(png).resize(96).toBuffer(),left:i%4*116+10,top:Math.floor(i/4)*116+10});
    }else emptyTiles.push({input:await sharp(png).resize(220).toBuffer(),left:i%4*220,top:Math.floor(i/4)*220});
  }
}
for(const [name,width,height,tiles] of [['unlabeled-poses',880,1100,fullTiles],['unlabeled-small',720,900,smallTiles],['unlabeled-avatar',464,580,avatarTiles],['empty-paw-poses',880,1100,emptyTiles]]){
  await sharp({create:{width,height,channels:4,background:'#faf7f2'}}).composite(tiles).png().toFile(path.join(root,'evidence/'+name+'.png'));
}
const report={distinctFaceDrawings:new Set(hashes).size,mouthChanges,poseOrder:keys.map(k=>k[0]),decorativeAccents:false,sizes:[220,160,96]};
await writeFile(path.join(root,'evidence/expression-inspection.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));await browser.close();
