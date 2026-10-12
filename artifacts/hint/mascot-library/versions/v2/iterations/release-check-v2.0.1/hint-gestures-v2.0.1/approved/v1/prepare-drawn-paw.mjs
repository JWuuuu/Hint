import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
const sharp=createRequire('/Users/jwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const dir=new URL('./',import.meta.url).pathname;
const shapes=[
  {center:[208,401],outline:[[188,362],[178,376],[169,392],[168,409],[175,423],[191,433],[207,434],[225,428],[241,415],[247,400],[242,390],[229,382],[213,378],[200,369]]},
  {center:[173,386],outline:[[208,367],[198,358],[181,354],[159,357],[143,367],[134,382],[135,398],[146,410],[162,414],[181,413],[198,405],[208,392],[210,380]]},
  {center:[159,359],outline:[[207,378],[199,361],[191,345],[177,331],[162,326],[148,327],[136,333],[126,344],[124,359],[130,373],[143,386],[160,393],[178,399],[192,401],[207,392]]},
  {center:[170,339],outline:[[210,371],[203,357],[207,337],[206,320],[200,306],[189,296],[177,294],[162,297],[148,306],[140,319],[137,334],[140,350],[148,365],[160,380],[175,391],[190,397],[210,399],[220,387]]},
  {center:[153,343],outline:[[209,378],[199,367],[196,353],[188,338],[176,321],[161,309],[147,305],[134,309],[123,319],[121,333],[126,351],[137,368],[154,383],[173,392],[193,397],[210,393]]},
  {center:[177,343],outline:[[211,375],[207,361],[208,345],[205,327],[195,312],[181,304],[169,305],[157,313],[147,329],[145,345],[147,361],[156,377],[171,389],[189,396],[209,397],[217,386]]}
];
const root=[205,380],segments=80;
function outline(points){
  const dense=[];
  for(let i=0;i<points.length;i++)for(let step=0;step<20;step++){
    const p0=points[(i-1+points.length)%points.length],p1=points[i],p2=points[(i+1)%points.length],p3=points[(i+2)%points.length],t=step/20,t2=t*t,t3=t2*t;
    dense.push([0,1].map(c=>.5*((2*p1[c])+(-p0[c]+p2[c])*t+(2*p0[c]-5*p1[c]+4*p2[c]-p3[c])*t2+(-p0[c]+3*p1[c]-3*p2[c]+p3[c])*t3)));
  }
  const lengths=[0];for(let i=1;i<=dense.length;i++){const a=dense[i-1],b=dense[i%dense.length];lengths.push(lengths.at(-1)+Math.hypot(b[0]-a[0],b[1]-a[1]));}
  let at=0;const result=[];
  for(let n=0;n<segments;n++){const d=n/segments*lengths.at(-1);while(lengths[at+1]<d)at++;const t=(d-lengths[at])/(lengths[at+1]-lengths[at]),a=dense[at],b=dense[(at+1)%dense.length];result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  return result;
}
const data=[];
for(let i=0;i<shapes.length;i++){
  const shape=shapes[i],points=outline(shape.outline);
  const path='M'+points.map(p=>p.map(n=>n.toFixed(2)).join(' ')).join('L')+'Z';
  const mask=Buffer.from(`<svg width="640" height="640" xmlns="http://www.w3.org/2000/svg"><defs><filter id="soft"><feGaussianBlur stdDeviation="0.6"/></filter></defs><path d="${path}" fill="white" filter="url(#soft)"/></svg>`);
  const source=dir+(i===0?'paw-poses/original.png':`paw-poses/pose-${i}.png`);
  const dx=shape.center[0]-root[0],dy=shape.center[1]-root[1],angle=Math.atan2(dy,dx)+(dy<0?Math.PI*2:0),radius=Math.hypot(dx,dy);
  const pixels=await sharp(source).composite([{input:mask,blend:'dest-in'}]).ensureAlpha().raw().toBuffer();
  for(let y=0;y<640;y++)for(let x=0;x<640;x++){
    const distance=((x-root[0])*dx+(y-root[1])*dy)/radius;
    const t=i===0?1:Math.max(0,Math.min(1,(distance+12)/27));pixels[(y*640+x)*4+3]*=t*t*(3-2*t);
  }
  await sharp(pixels,{raw:{width:640,height:640,channels:4}}).webp({quality:96}).toFile(dir+`paw-poses/paw-${i}.webp`);
  const c=Math.cos(-angle),s=Math.sin(-angle);
  data.push({center:shape.center,angle,radius,points:points.map(p=>p.map(n=>Math.round(n*100)/100)),local:points.map(p=>{const x=p[0]-shape.center[0],y=p[1]-shape.center[1];return [c*x-s*y,s*x+c*y].map(n=>Math.round(n*100)/100);})});
}
await writeFile(dir+'paw-poses/geometry.json',JSON.stringify({root,segments,poses:data}));
const original=await sharp(dir+'paw-poses/original.png').ensureAlpha().raw().toBuffer();
const clean=await sharp('/Users/jwu/.codex/generated_images/01a11972-38ff-7360-8a73-4ebb1d5f6577/exec-484f2767-9bc5-4f22-880c-fef2702cafe6.png').resize(640,640).ensureAlpha().raw().toBuffer();
const patch=Buffer.from('<svg width="640" height="640" xmlns="http://www.w3.org/2000/svg"><defs><filter id="b"><feGaussianBlur stdDeviation="5"/></filter></defs><path d="M145 356 L211 354 Q229 368 249 379 L263 405 L246 447 L146 452 Z" fill="white" filter="url(#b)"/></svg>');
const alpha=await sharp(patch).ensureAlpha().raw().toBuffer();const body=Buffer.alloc(original.length);
for(let n=0;n<body.length;n+=4){const t=alpha[n+3]/255,a=original[n+3]/255*(1-t),b=clean[n+3]/255*t,total=a+b;for(let c=0;c<3;c++)body[n+c]=total?(original[n+c]*a+clean[n+c]*b)/total:0;body[n+3]=total*255;}
const torso=await sharp(dir+'star-body.webp').resize(640,640).ensureAlpha().raw().toBuffer();
function eye(data,box){let x=0,y=0,w=0;for(let j=box[1];j<box[3];j++)for(let i=box[0];i<box[2];i++){const n=(j*640+i)*4,[r,g,b,a]=data.subarray(n,n+4);if(a<180||r-g<18||b-g<10||g>95||r>165)continue;const v=(180-r)*a/255;x+=i*v;y+=j*v;w+=v;}return [x/w,y/w];}
const bounds=[[215,220,268,302],[325,250,380,322]],src=bounds.map(b=>eye(torso,b)),dst=bounds.map(b=>eye(original,b));
const sx=src[1][0]-src[0][0],sy=src[1][1]-src[0][1],tx=dst[1][0]-dst[0][0],ty=dst[1][1]-dst[0][1],den=tx*tx+ty*ty,aa=(sx*tx+sy*ty)/den,bb=(sy*tx-sx*ty)/den;
const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
for(let y=365;y<460;y++)for(let x=0;x<228;x++){
  const t=smooth((y-365)/10)*(1-smooth((y-448)/12))*(1-smooth((x-211)/17));if(!t)continue;
  const u=src[0][0]+aa*(x-dst[0][0])-bb*(y-dst[0][1]),v=src[0][1]+bb*(x-dst[0][0])+aa*(y-dst[0][1]),ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy,p=[0,0,0,0];
  for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++){const n=((iy+yy)*640+ix+xx)*4;if(ix+xx<0||ix+xx>=640||iy+yy<0||iy+yy>=640)continue;const w=(xx?fx:1-fx)*(yy?fy:1-fy)*torso[n+3]/255;p[3]+=w;for(let c=0;c<3;c++)p[c]+=torso[n+c]*w;}
  const n=(y*640+x)*4,a=body[n+3]/255*(1-t),b=p[3]*t,total=a+b;for(let c=0;c<3;c++)body[n+c]=total?(body[n+c]*a+p[c]*t)/total:0;body[n+3]=total*255;
}
await sharp(body,{raw:{width:640,height:640,channels:4}}).webp({quality:96}).toFile(dir+'paw-poses/body.webp');
console.log(JSON.stringify(data.map(p=>({center:p.center,angle:p.angle,radius:p.radius}))));
