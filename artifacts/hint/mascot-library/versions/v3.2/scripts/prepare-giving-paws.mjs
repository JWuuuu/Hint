import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {library,verifyApproved,assertWorkingOutput} from './verify-approved.mjs';

// Technical extraction from the saved imagegen candidate. Existing drawings and
// poses 0–6 stay unchanged; the new drawing is appended as pose 7.
const sharp=createRequire(process.env.HINT_TOOLS_PACKAGE||import.meta.url)('sharp');
await verifyApproved();
const size=640,inputPath=path.join(library,'assets/inputs/offer-giving-v2.png');
const input=await sharp(inputPath).resize(size,size).ensureAlpha().raw().toBuffer();
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
const toAligned=([u,v])=>[target[0][0]+(a*(u-source[0][0])+b*(v-source[0][1]))/(a*a+b*b),target[0][1]+(-b*(u-source[0][0])+a*(v-source[0][1]))/(a*a+b*b)];
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
const evidence=path.join(library,'evidence/giving-paws-v2');
await mkdir(evidence,{recursive:true});
await sharp(pixels,{raw:{width:size,height:size,channels:4}}).png().toFile(path.join(evidence,'aligned-key.png'));
const alignment={source,target,inverseScale:Math.hypot(a,b),inverseRotation:Math.atan2(b,a),sourceSha256:createHash('sha256').update(await readFile(inputPath)).digest('hex')};
await writeFile(path.join(evidence,'alignment.json'),JSON.stringify(alignment,null,2)+'\n');
if(process.argv.includes('--align-only')){console.log(JSON.stringify(alignment));process.exit(0);}

const shapes={
  left:{center:[202,384],palmCenter:[192,405],grip:[219,393],root:[209,354],rootRegion:[[190,359],[202,354],[213,354],[225,358]],
    points:[[183,366],[190,359],[202,354],[213,354],[225,358],[237,365],[244,375],[246,383],[245,389],[239,394],[232,396],[226,395],[219,393],[216,403],[212,416],[206,427],[199,432],[190,434],[181,431],[173,426],[167,417],[165,407],[166,395],[171,382],[178,372]]},
  right:{center:[395,390],palmCenter:[403,417],grip:[372,402],root:[398,362],rootRegion:[[384,364],[397,362],[410,365],[421,373]],
    points:[[365,372],[375,367],[384,364],[397,362],[410,365],[421,373],[429,384],[433,397],[433,412],[429,424],[423,435],[413,442],[402,445],[392,443],[385,437],[380,429],[377,419],[374,408],[372,402],[365,404],[357,403],[352,400],[350,394],[352,386],[357,379]]}
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
    if(!Number.isFinite(radius))throw Error('Non-radial giving paw');points.push([shape.center[0]+dx*radius,shape.center[1]+dy*radius]);
  }
  return {center:shape.center,points};
}
const geometryPath=path.join(library,'assets/letter-geometry.json');
const geometry=JSON.parse(await readFile(geometryPath,'utf8'));
const retainedGeometry=JSON.stringify({left:geometry.left.slice(0,7),right:geometry.right.slice(0,7)});
const retainedTextureHashes={};
for(const side of ['left','right'])for(let i=0;i<=6;i++){
  const name=`letter-${side}-${i}.webp`;
  retainedTextureHashes[name]=createHash('sha256').update(await readFile(path.join(library,'assets',name))).digest('hex');
}
const landmarks={coordinateSpace:'aligned 640 x 640 source pixels',pose:7,sourceImage:'assets/inputs/offer-giving-v2.png',alignment,
  envelope:{corners:[[218,374],[382,384],[377,492],[202,477]],upperCorners:'Fitted continuation of the visible top and side edges beneath the occluding hands; lower corners are directly visible.'},paws:{}};
function envelopeUV(point){
  const [a,b,c,d]=landmarks.envelope.corners;let u=.5,v=.2;
  for(let i=0;i<8;i++){
    const p=[0,1].map(k=>(1-v)*(a[k]+(b[k]-a[k])*u)+v*(d[k]+(c[k]-d[k])*u));
    const du=[0,1].map(k=>(1-v)*(b[k]-a[k])+v*(c[k]-d[k]));
    const dv=[0,1].map(k=>(1-u)*(d[k]-a[k])+u*(c[k]-b[k]));
    const error=p.map((n,k)=>n-point[k]),det=du[0]*dv[1]-du[1]*dv[0];
    u-=(error[0]*dv[1]-error[1]*dv[0])/det;v-=(du[0]*error[1]-du[1]*error[0])/det;
  }
  return [u,v];
}
const overlays=[];
for(const side of ['left','right']){
  const shape=radial(shapes[side]),d='M'+shape.points.map(p=>p.join(' ')).join('L')+'Z';
  const areas=shape.points.map((p,j)=>{const q=shape.points[(j+1)%shape.points.length],c=shape.center;return ((p[0]-c[0])*(q[1]-c[1])-(p[1]-c[1])*(q[0]-c[0]))/2;});
  if(!shape.points.flat().every(Number.isFinite)||Math.min(...areas)<=0)throw Error('Invalid giving paw triangles: '+side);
  const mask=await sharp(Buffer.from(`<svg width="640" height="640" xmlns="http://www.w3.org/2000/svg"><defs><filter id="soft"><feGaussianBlur stdDeviation=".35"/></filter></defs><path d="${d}" fill="white" filter="url(#soft)"/></svg>`)).ensureAlpha().raw().toBuffer();
  const cutout=Buffer.from(pixels);for(let n=0;n<cutout.length;n+=4)cutout[n+3]*=mask[n+3]/255;
  const output=path.join(library,`assets/letter-${side}-7.webp`);assertWorkingOutput(output);
  await sharp(cutout,{raw:{width:size,height:size,channels:4}}).webp({lossless:true}).toFile(output);
  geometry[side][7]={...shape,grip:shapes[side].grip};
  const rootIndex=shape.points.reduce((best,p,j)=>Math.hypot(p[0]-shapes[side].root[0],p[1]-shapes[side].root[1])<Math.hypot(shape.points[best][0]-shapes[side].root[0],shape.points[best][1]-shapes[side].root[1])?j:best,0);
  const gripSegments=shape.points.map((p,j)=>{
    const next=(j+1)%shape.points.length,q=shape.points[next],v=q.map((n,k)=>n-p[k]),grip=shapes[side].grip;
    const mix=Math.max(0,Math.min(1,((grip[0]-p[0])*v[0]+(grip[1]-p[1])*v[1])/(v[0]*v[0]+v[1]*v[1])));
    const point=p.map((n,k)=>n+v[k]*mix);
    return {indices:[j,next],mix,point,distance:Math.hypot(point[0]-grip[0],point[1]-grip[1])};
  });
  const gripSegment=gripSegments.reduce((best,s)=>s.distance<best.distance?s:best);
  landmarks.paws[side]={...shapes[side],meshCenter:shape.center,rootIndex,
    gripSegment,gripUV:envelopeUV(shapes[side].grip),
    rootIndices:shape.points.flatMap((p,j)=>p[1]<shapes[side].root[1]+13?[j]:[]),
    palmIndices:shape.points.flatMap((p,j)=>p[1]>shapes[side].grip[1]-3?[j]:[]),
    minimumTriangleArea:Math.min(...areas),texture:`assets/letter-${side}-7.webp`,segments:shape.points.length};
  overlays.push(`<path d="${d}" fill="none" stroke="${side==='left'?'#ff3070':'#008cff'}" stroke-width=".7"/><circle cx="${shape.center[0]}" cy="${shape.center[1]}" r="1.5" fill="#ff3070"/><circle cx="${shapes[side].grip[0]}" cy="${shapes[side].grip[1]}" r="1.5" fill="#00ff90"/>`);
}
if(JSON.stringify({left:geometry.left.slice(0,7),right:geometry.right.slice(0,7)})!==retainedGeometry)throw Error('Existing paw geometry changed');
geometry.giving={pose:7,corners:landmarks.envelope.corners,gripUV:{left:landmarks.paws.left.gripUV,right:landmarks.paws.right.gripUV}};
assertWorkingOutput(geometryPath);await writeFile(geometryPath,JSON.stringify(geometry));
const toRaw=([x,y])=>[source[0][0]+a*(x-target[0][0])-b*(y-target[0][1]),source[0][1]+b*(x-target[0][0])+a*(y-target[0][1])];
landmarks.raw640EnvelopeCorners=landmarks.envelope.corners.map(toRaw);
landmarks.raw640Grips=Object.fromEntries(Object.entries(shapes).map(([side,shape])=>[side,toRaw(shape.grip)]));
landmarks.rawImageDimensions=await sharp(inputPath).metadata().then(({width,height})=>({width,height}));
landmarks.rawImageEnvelopeCorners=landmarks.raw640EnvelopeCorners.map(p=>p.map(v=>v*landmarks.rawImageDimensions.width/size));
landmarks.retainedPose0Through6Sha256=createHash('sha256').update(retainedGeometry).digest('hex');
landmarks.retainedTextureHashes=retainedTextureHashes;
await writeFile(path.join(evidence,'landmarks.json'),JSON.stringify(landmarks,null,2)+'\n');
await sharp(pixels,{raw:{width:size,height:size,channels:4}}).composite([{input:Buffer.from(`<svg width="640" height="640" xmlns="http://www.w3.org/2000/svg">${overlays.join('')}</svg>`)}]).png().toFile(path.join(evidence,'contour-review.png'));
for(const side of ['left','right'])await sharp(path.join(library,`assets/letter-${side}-7.webp`)).extract({left:side==='left'?150:340,top:340,width:110,height:120}).resize(440,480).png().toFile(path.join(evidence,`${side}-cutout-4x.png`));
for(const [name,expected] of Object.entries(retainedTextureHashes))if(createHash('sha256').update(await readFile(path.join(library,'assets',name))).digest('hex')!==expected)throw Error('Existing texture changed: '+name);
await verifyApproved();
console.log(JSON.stringify({addedPose:7,envelope:landmarks.envelope,paws:landmarks.paws,raw640EnvelopeCorners:landmarks.raw640EnvelopeCorners,raw640Grips:landmarks.raw640Grips,rawImageDimensions:landmarks.rawImageDimensions,preservedPriorPoses:true}));
