import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const sharp = createRequire(process.env.HINT_TOOLS_PACKAGE || import.meta.url)('sharp');
const dir = fileURLToPath(new URL('../', import.meta.url));
const size = 640;
const smooth = n => { n = Math.max(0, Math.min(1, n));return n*n*(3-2*n); };
const rgba = async file => sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
function eye(data, width, box) {
  let x=0,y=0,w=0;
  for(let j=Math.floor(box[1]);j<box[3];j++)for(let i=Math.floor(box[0]);i<box[2];i++){
    const n=(j*width+i)*4,[r,g,b,a]=data.subarray(n,n+4);
    if(a<180||r-g<18||b-g<10||g>95||r>165)continue;
    const v=(180-r)*a/255;x+=i*v;y+=j*v;w+=v;
  }
  if(!w)throw Error('Missing eye landmark');return [x/w,y/w];
}
function sample(data,width,height,x,y) {
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,p=[0,0,0,0];
  for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++){
    if(ix+xx<0||ix+xx>=width||iy+yy<0||iy+yy>=height)continue;
    const n=((iy+yy)*width+ix+xx)*4,w=(xx?fx:1-fx)*(yy?fy:1-fy)*data[n+3]/255;
    p[3]+=w;for(let c=0;c<3;c++)p[c]+=data[n+c]*w;
  }
  return [p[3]?p[0]/p[3]:0,p[3]?p[1]/p[3]:0,p[3]?p[2]/p[3]:0,p[3]*255];
}
const {data:original}=await rgba(path.join(dir,'assets/reference.png'));
const bounds=[[215,220,268,302],[325,250,380,322]];
const target=bounds.map(b=>eye(original,size,b));
function align(data,width,height,source) {
  const sx=source[1][0]-source[0][0],sy=source[1][1]-source[0][1];
  const tx=target[1][0]-target[0][0],ty=target[1][1]-target[0][1],den=tx*tx+ty*ty;
  const a=(sx*tx+sy*ty)/den,b=(sy*tx-sx*ty)/den,out=Buffer.alloc(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=source[0][0]+a*(x-target[0][0])-b*(y-target[0][1]);
    const v=source[0][1]+b*(x-target[0][0])+a*(y-target[0][1]);
    out.set(sample(data,width,height,u,v),(y*size+x)*4);
  }
  return out;
}
await mkdir(path.join(dir,'assets/letter-poses'),{recursive:true});
const sheet=await sharp(path.join(dir,'assets/inputs/letter-poses.png')).metadata();
const width=Math.floor(sheet.width/3),height=Math.floor(sheet.height/2),tiles=[],landmarks=[];
for(let i=0;i<6;i++){
  const data=await sharp(path.join(dir,'assets/inputs/letter-poses.png')).extract({left:(i%3)*width,top:Math.floor(i/3)*height,width,height}).ensureAlpha().raw().toBuffer();
  const source=[eye(data,width,[width*.28,height*.24,width*.48,height*.57]),eye(data,width,[width*.57,height*.24,width*.75,height*.57])];
  const pixels=align(data,width,height,source);landmarks.push({source,target});
  await sharp(pixels,{raw:{width:size,height:size,channels:4}}).png().toFile(path.join(dir,`assets/letter-poses/pose-${i}.png`));
  tiles.push({input:await sharp(pixels,{raw:{width:size,height:size,channels:4}}).resize(320).png().toBuffer(),left:(i%3)*320,top:Math.floor(i/3)*320});
}
await writeFile(path.join(dir,'assets/letter-poses/landmarks.json'),JSON.stringify(landmarks,null,2));
await sharp({create:{width:960,height:640,channels:4,background:'#faf7f2'}}).composite(tiles).png().toFile(path.join(dir,'evidence/letter-aligned.png'));
console.log(JSON.stringify({sheet:[sheet.width,sheet.height],target}));

const originalWave=JSON.parse(await readFile(path.join(dir,'assets/geometry.json'),'utf8'));
const left=[
  {center:[208,401],points:originalWave.poses[0].points},
  {center:[210,381],points:[[210,347],[224,351],[238,365],[242,380],[237,395],[225,408],[209,414],[195,413],[182,406],[175,394],[175,379],[181,363],[194,352]]},
  {center:[200,387],points:[[201,351],[216,354],[229,366],[233,382],[228,401],[217,416],[202,423],[187,421],[176,413],[168,398],[168,382],[175,366],[187,355]]},
  {center:[203,384],points:[[199,351],[217,354],[231,365],[239,381],[237,397],[227,410],[211,416],[194,414],[179,406],[168,393],[166,377],[172,363],[183,354]]},
  {center:[207,402],points:[[186,359],[202,365],[218,375],[237,386],[247,400],[246,413],[237,425],[221,433],[205,434],[189,429],[176,419],[168,405],[169,387],[176,371]]},
  {center:[209,405],points:[[190,355],[207,362],[222,381],[236,402],[239,416],[233,432],[220,440],[203,442],[187,437],[176,426],[171,408],[173,389],[181,369]]}
];
const right=[
  {center:[380,430],points:[[400,382],[415,398],[423,416],[423,435],[415,450],[399,462],[378,465],[358,458],[344,448],[336,433],[340,420],[352,409],[369,401],[385,397]]},
  {center:[374,396],points:[[372,362],[388,365],[402,377],[409,393],[407,410],[398,423],[383,430],[366,430],[351,423],[342,411],[337,396],[338,381],[345,370],[356,364]]},
  {center:[380,402],points:[[378,366],[395,369],[408,381],[414,398],[411,416],[402,430],[386,436],[369,434],[356,425],[348,411],[345,396],[349,383],[359,372]]},
  {center:[378,397],points:[[381,363],[398,368],[410,380],[416,396],[412,412],[402,424],[386,430],[370,429],[354,422],[344,411],[340,396],[344,381],[355,371],[367,366]]},
  {center:[372,417],points:[[403,374],[409,392],[414,412],[408,430],[395,443],[377,451],[358,449],[339,441],[327,429],[324,415],[329,404],[344,396],[366,391],[387,384]]},
  {center:[375,415],points:[[400,357],[410,377],[416,401],[414,419],[404,434],[389,443],[371,446],[353,442],[341,435],[337,423],[340,408],[351,394],[368,383],[389,371]]}
];
function denseOutline(points) {
  const dense=[];
  for(let i=0;i<points.length;i++)for(let k=0;k<20;k++){
    const p0=points[(i-1+points.length)%points.length],p1=points[i],p2=points[(i+1)%points.length],p3=points[(i+2)%points.length],t=k/20;
    dense.push([0,1].map(c=>.5*(2*p1[c]+(-p0[c]+p2[c])*t+(2*p0[c]-5*p1[c]+4*p2[c]-p3[c])*t*t+(-p0[c]+3*p1[c]-3*p2[c]+p3[c])*t*t*t)));
  }
  return dense;
}
function radialContour(shape) {
  const dense=denseOutline(shape.points),result=[];
  for(let j=0;j<80;j++){
    const angle=j/80*Math.PI*2,dx=Math.cos(angle),dy=Math.sin(angle);let radius=Infinity;
    for(let i=0;i<dense.length;i++){
      const a=dense[i],b=dense[(i+1)%dense.length],ex=b[0]-a[0],ey=b[1]-a[1],den=dx*ey-dy*ex;
      if(Math.abs(den)<1e-8)continue;
      const ax=a[0]-shape.center[0],ay=a[1]-shape.center[1];
      const r=(ax*ey-ay*ex)/den,u=(ax*dy-ay*dx)/den;
      if(r>0&&u>=0&&u<=1)radius=Math.min(radius,r);
    }
    if(!Number.isFinite(radius))throw Error('Paw contour is not radial');
    result.push([shape.center[0]+dx*radius,shape.center[1]+dy*radius].map(v=>Math.round(v*100)/100));
  }
  return {center:shape.center,points:result};
}
const shapePath=points=>'M'+points.map(p=>p.join(' ')).join('L')+'Z';
const maskFor=async(points,blur=.65)=>sharp(Buffer.from(`<svg width="640" height="640" xmlns="http://www.w3.org/2000/svg"><defs><filter id="b"><feGaussianBlur stdDeviation="${blur}"/></filter></defs><path d="${shapePath(points)}" fill="white" filter="url(#b)"/></svg>`)).ensureAlpha().raw().toBuffer();
const pawMasks=[],geometry={segments:80,left:[],right:[]};
for(let i=0;i<6;i++)for(const [side,shapes] of [['left',left],['right',right]]){
  const shape=radialContour(shapes[i]);geometry[side].push(shape);
  const mask=await maskFor(shape.points),data=i===0?original:(await rgba(path.join(dir,`assets/letter-poses/pose-${i}.png`))).data;
  const pixels=Buffer.from(data);
  for(let n=0;n<pixels.length;n+=4)pixels[n+3]*=mask[n+3]/255;
  await sharp(pixels,{raw:{width:size,height:size,channels:4}}).webp({quality:96}).toFile(path.join(dir,`assets/letter-${side}-${i}.webp`));
  if(i===0)pawMasks.push(await maskFor(shape.points.map(p=>p.map((v,c)=>shape.center[c]+(v-shape.center[c])*1.4)),3));
}
await writeFile(path.join(dir,'assets/letter-geometry.json'),JSON.stringify(geometry));

const torsoRaw=await sharp(path.join(dir,'assets/inputs/clean-torso.png')).resize(size,size).ensureAlpha().raw().toBuffer();
const clean=align(torsoRaw,size,size,bounds.map(b=>eye(torsoRaw,size,b)));
const body=Buffer.from(original);
const envelopeCorners=[[233,356],[362,378],[345,467],[221,445]];
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const t=smooth((y-329)/25)*(1-smooth((y-505)/45));
  if(!t)continue;
  const n=(y*size+x)*4,a=original[n+3]/255*(1-t),b=clean[n+3]/255*t,total=a+b;
  for(let c=0;c<3;c++)body[n+c]=total?(original[n+c]*a+clean[n+c]*b)/total:0;
  body[n+3]=total*255;
}
await sharp(body,{raw:{width:size,height:size,channels:4}}).webp({quality:96}).toFile(path.join(dir,'assets/letter-body.webp'));

const letterMask=await maskFor(envelopeCorners,.35);
const {data:paper,info:paperInfo}=await rgba(path.join(dir,'assets/inputs/envelope.png'));
const envelope=Buffer.alloc(original.length),ax=129,ay=22,bx=-12,by=89,den=ax*by-ay*bx;
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const n=(y*size+x)*4;if(letterMask[n+3]===0)continue;
  const dx=x-233,dy=y-356,u=(dx*by-dy*bx)/den,v=(ax*dy-ay*dx)/den;
  const p=sample(paper,paperInfo.width,paperInfo.height,330+896*u-81*v,213+146*u+540*v);
  const originalWeight=1-Math.max(pawMasks[0][n+3],pawMasks[1][n+3])/255;
  for(let c=0;c<3;c++)envelope[n+c]=p[c]*(1-originalWeight)+original[n+c]*originalWeight;
  envelope[n+3]=letterMask[n+3];
}
await sharp(envelope,{raw:{width:size,height:size,channels:4}}).webp({quality:96}).toFile(path.join(dir,'assets/envelope.webp'));
const composition=await sharp(path.join(dir,'assets/letter-body.webp')).composite([
  {input:path.join(dir,'assets/envelope.webp')},
  {input:path.join(dir,'assets/letter-left-0.webp')},
  {input:path.join(dir,'assets/letter-right-0.webp')}
]).png().toBuffer();
await writeFile(path.join(dir,'evidence/letter-reconstructed-rest.png'),composition);
await sharp(composition).webp({quality:98}).toFile(path.join(dir,'assets/held-rest.webp'));
await sharp(path.join(dir,'assets/body.webp')).composite([{input:path.join(dir,'assets/paw-0.webp')}]).webp({quality:98}).toFile(path.join(dir,'assets/approved-rest.webp'));
