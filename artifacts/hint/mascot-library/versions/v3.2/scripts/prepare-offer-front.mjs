import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {library,verifyApproved,assertWorkingOutput} from './verify-approved.mjs';
const sharp=createRequire(process.env.HINT_TOOLS_PACKAGE||import.meta.url)('sharp');
await verifyApproved();
const size=640;
const input=await sharp(path.join(library,'assets/inputs/offer-front-v1.png')).resize(size,size).ensureAlpha().raw().toBuffer();
const original=await sharp(path.join(library,'assets/reference.png')).ensureAlpha().raw().toBuffer();
function eye(pixels,box){
  let x=0,y=0,weight=0;
  for(let j=box[1];j<box[3];j++)for(let i=box[0];i<box[2];i++){
    const n=(j*size+i)*4,[r,g,b,a]=pixels.subarray(n,n+4);
    if(a<180||r-g<18||b-g<10||g>95||r>165)continue;
    const w=(180-r)*a/255;x+=i*w;y+=j*w;weight+=w;
  }
  if(!weight)throw Error('Missing eye landmark');return [x/weight,y/weight];
}
const boxes=[[215,220,268,302],[325,250,380,322]],source=boxes.map(b=>eye(input,b)),target=boxes.map(b=>eye(original,b));
const sx=source[1][0]-source[0][0],sy=source[1][1]-source[0][1],tx=target[1][0]-target[0][0],ty=target[1][1]-target[0][1];
const den=tx*tx+ty*ty,a=(sx*tx+sy*ty)/den,b=(sy*tx-sx*ty)/den,pixels=Buffer.alloc(size*size*4);
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=source[0][0]+a*(x-target[0][0])-b*(y-target[0][1]),v=source[0][1]+b*(x-target[0][0])+a*(y-target[0][1]);
  const ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy,p=[0,0,0,0];
  for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++){
    if(ix+xx<0||ix+xx>=size||iy+yy<0||iy+yy>=size)continue;
    const n=((iy+yy)*size+ix+xx)*4,w=(xx?fx:1-fx)*(yy?fy:1-fy)*input[n+3]/255;
    p[3]+=w;for(let c=0;c<3;c++)p[c]+=input[n+c]*w;
  }
  for(let c=0;c<3;c++)pixels[(y*size+x)*4+c]=p[3]?p[c]/p[3]:0;
  pixels[(y*size+x)*4+3]=p[3]*255;
}
const shapes={
  left:{center:[197,407],points:[[188,352],[207,358],[221,375],[227,393],[232,406],[228,422],[219,434],[200,442],[180,437],[168,426],[164,409],[167,391],[174,375],[180,362]]},
  right:{center:[390,432],points:[[393,367],[409,380],[418,397],[426,415],[430,431],[423,448],[409,458],[391,463],[374,462],[356,452],[350,438],[352,424],[364,412],[381,402],[390,387]]}
};
function radial(shape){
  const dense=[];
  for(let i=0;i<shape.points.length;i++)for(let k=0;k<20;k++){
    const n=shape.points.length,p0=shape.points[(i-1+n)%n],p1=shape.points[i],p2=shape.points[(i+1)%n],p3=shape.points[(i+2)%n],t=k/20;
    dense.push([0,1].map(c=>.5*(2*p1[c]+(-p0[c]+p2[c])*t+(2*p0[c]-5*p1[c]+4*p2[c]-p3[c])*t*t+(-p0[c]+3*p1[c]-3*p2[c]+p3[c])*t*t*t)));
  }
  const points=[];
  for(let j=0;j<80;j++){
    const angle=j/80*Math.PI*2,dx=Math.cos(angle),dy=Math.sin(angle);let radius=Infinity;
    for(let i=0;i<dense.length;i++){
      const p=dense[i],q=dense[(i+1)%dense.length],ex=q[0]-p[0],ey=q[1]-p[1],den=dx*ey-dy*ex;
      if(Math.abs(den)<1e-8)continue;
      const ax=p[0]-shape.center[0],ay=p[1]-shape.center[1],r=(ax*ey-ay*ex)/den,u=(ax*dy-ay*dx)/den;
      if(r>0&&u>=0&&u<=1)radius=Math.min(radius,r);
    }
    if(!Number.isFinite(radius))throw Error('Non-radial paw');points.push([shape.center[0]+dx*radius,shape.center[1]+dy*radius]);
  }
  return {center:shape.center,points};
}
const geometry=JSON.parse(await readFile(path.join(library,'assets/letter-geometry.json'),'utf8'));
for(const side of ['left','right']){
  const shape=radial(shapes[side]),d='M'+shape.points.map(p=>p.join(' ')).join('L')+'Z';
  const mask=await sharp(Buffer.from(`<svg width="640" height="640" xmlns="http://www.w3.org/2000/svg"><defs><filter id="soft"><feGaussianBlur stdDeviation=".65"/></filter></defs><path d="${d}" fill="white" filter="url(#soft)"/></svg>`)).ensureAlpha().raw().toBuffer();
  const cutout=Buffer.from(pixels);for(let n=0;n<cutout.length;n+=4)cutout[n+3]*=mask[n+3]/255;
  const output=path.join(library,`assets/letter-${side}-6.webp`);assertWorkingOutput(output);
  await sharp(cutout,{raw:{width:size,height:size,channels:4}}).webp({quality:97}).toFile(output);geometry[side][6]=shape;
}
await writeFile(path.join(library,'assets/letter-geometry.json'),JSON.stringify(geometry));
await mkdir(path.join(library,'evidence/letter-front'),{recursive:true});
await sharp(pixels,{raw:{width:size,height:size,channels:4}}).png().toFile(path.join(library,'evidence/letter-front/aligned-key.png'));
await writeFile(path.join(library,'evidence/letter-front/alignment.json'),JSON.stringify({source,target,scale:Math.hypot(a,b),rotation:Math.atan2(b,a)},null,2)+'\n');
console.log(JSON.stringify({source,target,addedPose:6}));
await verifyApproved();
