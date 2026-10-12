import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const sharp = createRequire(process.env.HINT_TOOLS_PACKAGE || import.meta.url)('sharp');
const root = fileURLToPath(new URL('../', import.meta.url));
const size = 640;
const asset = name => path.join(root, 'assets', name);
const boxes = [[215,220,268,302],[325,250,380,322]];
function eye(data, box) {
  let x=0,y=0,weight=0;
  for(let j=box[1];j<box[3];j++)for(let i=box[0];i<box[2];i++){
    const n=(j*size+i)*4,[r,g,b,a]=data.subarray(n,n+4);
    if(a<180||r-g<18||b-g<10||g>95||r>165)continue;
    const w=(180-r)*a/255;x+=i*w;y+=j*w;weight+=w;
  }
  if(!weight)throw Error('Missing eye landmark');
  return [x/weight,y/weight];
}
const original=await sharp(asset('reference.png')).ensureAlpha().raw().toBuffer();
const target=boxes.map(box=>eye(original,box));
async function align(name) {
  const data=await sharp(asset('inputs/'+name+'.png')).resize(size,size).ensureAlpha().raw().toBuffer();
  const source=boxes.map(box=>eye(data,box));
  const sx=source[1][0]-source[0][0],sy=source[1][1]-source[0][1];
  const tx=target[1][0]-target[0][0],ty=target[1][1]-target[0][1],den=tx*tx+ty*ty;
  const a=(sx*tx+sy*ty)/den,b=(sy*tx-sx*ty)/den,out=Buffer.alloc(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=source[0][0]+a*(x-target[0][0])-b*(y-target[0][1]);
    const v=source[0][1]+b*(x-target[0][0])+a*(y-target[0][1]);
    const ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy,n=(y*size+x)*4;
    const rgba=[0,0,0,0];
    for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++){
      if(ix+xx<0||ix+xx>=size||iy+yy<0||iy+yy>=size)continue;
      const m=((iy+yy)*size+ix+xx)*4,w=(xx?fx:1-fx)*(yy?fy:1-fy)*data[m+3]/255;
      rgba[3]+=w;for(let c=0;c<3;c++)rgba[c]+=data[m+c]*w;
    }
    for(let c=0;c<3;c++)out[n+c]=rgba[3]?rgba[c]/rgba[3]:0;
    out[n+3]=rgba[3]*255;
  }
  await sharp(out,{raw:{width:size,height:size,channels:4}}).png().toFile(asset('connected-poses/'+name+'.png'));
  return out;
}
function contour(shape) {
  const dense=[];
  for(let i=0;i<shape.points.length;i++)for(let k=0;k<20;k++){
    const points=shape.points,n=points.length,p0=points[(i-1+n)%n],p1=points[i],p2=points[(i+1)%n],p3=points[(i+2)%n],t=k/20;
    dense.push([0,1].map(c=>.5*(2*p1[c]+(-p0[c]+p2[c])*t+(2*p0[c]-5*p1[c]+4*p2[c]-p3[c])*t*t+(-p0[c]+3*p1[c]-3*p2[c]+p3[c])*t*t*t)));
  }
  const points=[];
  for(let j=0;j<80;j++){
    const angle=j*Math.PI*2/80,dx=Math.cos(angle),dy=Math.sin(angle);let radius=Infinity;
    for(let i=0;i<dense.length;i++){
      const a=dense[i],b=dense[(i+1)%dense.length],ex=b[0]-a[0],ey=b[1]-a[1],den=dx*ey-dy*ex;
      if(Math.abs(den)<1e-8)continue;
      const ax=a[0]-shape.center[0],ay=a[1]-shape.center[1],r=(ax*ey-ay*ex)/den,u=(ax*dy-ay*dx)/den;
      if(r>0&&u>=0&&u<=1)radius=Math.min(radius,r);
    }
    if(!Number.isFinite(radius))throw Error('Invalid rounded paw contour');
    points.push([shape.center[0]+dx*radius,shape.center[1]+dy*radius].map(v=>Math.round(v*100)/100));
  }
  return {center:shape.center,points};
}
await mkdir(asset('connected-poses'),{recursive:true});
const drawings={
  thinking: {
    input:'thinking-compact',center:[201,352],
    points:[[201,308],[217,309],[229,320],[234,336],[233,354],[228,373],[216,391],[203,398],[189,392],[176,382],[167,367],[165,351],[171,334],[183,317]],
    transform:([x,y])=>[x+7,390+(y-390)*.82]
  },
  listening: {
    input:'listening-rounded',side:'right',center:[431,356],
    points:[[449,301],[465,307],[475,321],[480,339],[477,358],[469,377],[456,391],[439,401],[422,407],[404,410],[389,405],[383,395],[394,383],[403,366],[410,347],[419,326],[433,309]],
    transform:([x,y])=>[x-9,398+(y-398)*.95]
  }
};
const geometry={};
for(const [name,drawing] of Object.entries(drawings)){
  const pixels=await align(drawing.input),uv=contour(drawing);
  const d='M'+uv.points.map(p=>p.join(' ')).join('L')+'Z';
  const mask=await sharp(Buffer.from('<svg width="640" height="640" xmlns="http://www.w3.org/2000/svg"><defs><filter id="soft"><feGaussianBlur stdDeviation=".65"/></filter></defs><path d="'+d+'" fill="white" filter="url(#soft)"/></svg>')).ensureAlpha().raw().toBuffer();
  for(let n=0;n<pixels.length;n+=4){
    pixels[n+3]*=mask[n+3]/255;
    if(name==='listening'){
      const x=n/4%size,y=Math.floor(n/4/size);
      const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
      pixels[n+3]*=1-smooth((y-386)/25)*(1-smooth((x-410)/18));
    }
  }
  await sharp(pixels,{raw:{width:size,height:size,channels:4}}).webp({quality:98}).toFile(asset('connected-'+name+'.webp'));
  geometry[name]={side:drawing.side||'left',uv,center:drawing.transform(uv.center),points:uv.points.map(drawing.transform),texture:'connected-'+name};
}
await writeFile(asset('connected-geometry.json'),JSON.stringify(geometry));
console.log('Prepared connected rounded paw drawings.');
