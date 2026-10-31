import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const sharp=createRequire('/Users/jwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const dir=new URL('./',import.meta.url).pathname;
const original='/Users/jwu/.codex/generated_images/01a11972-38ff-7360-8a73-4ebb1d5f6577/exec-8cc96d07-7790-41f6-b00d-2aa97ea65b6d.png';
const sheet='/Users/jwu/.codex/generated_images/01a11972-38ff-7360-8a73-4ebb1d5f6577/exec-4de060e1-6e5f-4b9f-a8b2-86155918cb97.png';
await mkdir(dir+'paw-poses',{recursive:true});
const size=640;
const {data:reference}=await sharp(original).resize(size,size).ensureAlpha().raw().toBuffer({resolveWithObject:true});
function landmark(data,w,box){
  let sx=0,sy=0,total=0;
  for(let y=box[1];y<box[3];y++)for(let x=box[0];x<box[2];x++){
    const i=(y*w+x)*4,[r,g,b,a]=data.subarray(i,i+4);
    if(a<180||r-g<18||b-g<10||g>95||r>165)continue;
    const weight=(180-r)*(a/255);sx+=x*weight;sy+=y*weight;total+=weight;
  }
  if(!total)throw Error('Missing landmark');return [sx/total,sy/total];
}
const target=[landmark(reference,size,[215,220,268,296]),landmark(reference,size,[325,250,380,319]),landmark(reference,size,[265,380,316,443])];
function solve(a,b){
  const m=a.map((r,i)=>[...r,b[i]]);
  for(let i=0;i<3;i++){let pivot=i;for(let j=i+1;j<3;j++)if(Math.abs(m[j][i])>Math.abs(m[pivot][i]))pivot=j;[m[i],m[pivot]]=[m[pivot],m[i]];const d=m[i][i];for(let k=i;k<4;k++)m[i][k]/=d;for(let j=0;j<3;j++)if(i!==j){const factor=m[j][i];for(let k=i;k<4;k++)m[j][k]-=factor*m[i][k];}}
  return m.map(r=>r[3]);
}
function sample(data,w,h,x,y,out,at){
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;let a=0,r=0,g=0,b=0;
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
    const xx=ix+dx,yy=iy+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;
    const n=(yy*w+xx)*4,weight=(dx?fx:1-fx)*(dy?fy:1-fy)*data[n+3]/255;
    a+=weight;r+=data[n]*weight;g+=data[n+1]*weight;b+=data[n+2]*weight;
  }
  if(a){out[at]=Math.round(r/a);out[at+1]=Math.round(g/a);out[at+2]=Math.round(b/a);out[at+3]=Math.round(a*255);}
}
const report=[],tiles=[];
for(let n=0;n<6;n++){
  const {data}=await sharp(sheet).extract({left:(n%3)*512,top:Math.floor(n/3)*512,width:512,height:512}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const source=[landmark(data,512,[177,207,228,257]),landmark(data,512,[282,216,330,271]),landmark(data,512,[218,322,281,388])];
  const coords=target.map(p=>[...p,1]),mx=solve(coords,source.map(p=>p[0])),my=solve(coords,source.map(p=>p[1]));
  const out=Buffer.alloc(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)sample(data,512,512,mx[0]*x+mx[1]*y+mx[2],my[0]*x+my[1]*y+my[2],out,(y*size+x)*4);
  const file=dir+`paw-poses/pose-${n}.png`;await sharp(out,{raw:{width:size,height:size,channels:4}}).png().toFile(file);
  report.push({frame:n,source,target,mx,my});
  const label=Buffer.from(`<svg width="320" height="342" xmlns="http://www.w3.org/2000/svg"><text x="12" y="334" font-family="sans-serif" font-size="14" fill="#51384a">${n}</text></svg>`);
  const tile=await sharp({create:{width:320,height:342,channels:4,background:'#faf7f2'}}).composite([{input:await sharp(file).resize(320).toBuffer(),top:0,left:0},{input:label}]).png().toBuffer();tiles.push({input:tile,left:(n%3)*320,top:Math.floor(n/3)*342});
}
await sharp(reference,{raw:{width:size,height:size,channels:4}}).png().toFile(dir+'paw-poses/original.png');
await sharp({create:{width:960,height:684,channels:4,background:'#faf7f2'}}).composite(tiles).png().toFile(dir+'paw-aligned-review.png');
await writeFile(dir+'paw-poses/landmarks.json',JSON.stringify(report,null,2));console.log(JSON.stringify({target,frames:report.length}));
