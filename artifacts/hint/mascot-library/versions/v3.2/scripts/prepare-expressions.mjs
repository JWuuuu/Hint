import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const sharp = createRequire(process.env.HINT_TOOLS_PACKAGE || import.meta.url)('sharp');
const root = fileURLToPath(new URL('../', import.meta.url));
const asset = name => path.join(root, 'assets', name);
const size = 640;
const raw = name => sharp(asset(name)).resize(size,size).ensureAlpha().raw().toBuffer();
const original = await raw('reference.png');
const body = await raw('letter-body.webp');
const clean = await raw('inputs/clean-face.png');
const smooth = value => { const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t); };
// Local patches retain the original silhouette, cheek blush, scarf and torso.
const patches = [[250.64,273.72,19,26],[360.23,291.89,20,27],[300,300,20,14]];
for (const [cx,cy,rx,ry] of patches) {
  const correction=[0,0,0];let count=0;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const r=Math.hypot((x-cx)/rx,(y-cy)/ry);if(r<1.06||r>1.26)continue;
    const n=(y*size+x)*4;
    for(let c=0;c<3;c++)correction[c]+=body[n+c]-clean[n+c];count++;
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const r=Math.hypot((x-cx)/rx,(y-cy)/ry),w=1-smooth((r-.70)/.43);if(!w)continue;
    const n=(y*size+x)*4;
    for(let c=0;c<3;c++)body[n+c]=body[n+c]*(1-w)+(clean[n+c]+correction[c]/count)*w;
  }
}
await sharp(body,{raw:{width:size,height:size,channels:4}}).webp({quality:98}).toFile(asset('expression-body.webp'));

// Extract the original eyes, including their highlights and warm rim.
const eyes=Buffer.alloc(original.length);
for(const [cx,cy,rx,ry] of [[250.64,273.72,11.0,15.5],[360.23,291.89,11.1,16.2]]){
  for(let y=Math.floor(cy-25);y<cy+25;y++)for(let x=Math.floor(cx-22);x<cx+22;x++){
    const dx=x-cx,dy=y-cy,a=-.24,u=dx*Math.cos(a)-dy*Math.sin(a),v=dx*Math.sin(a)+dy*Math.cos(a);
    const alpha=1-smooth((Math.hypot(u/rx,v/ry)-.87)/.17),n=(y*size+x)*4;
    for(let c=0;c<3;c++)eyes[n+c]=original[n+c];eyes[n+3]=alpha*255;
  }
}
await sharp(eyes,{raw:{width:size,height:size,channels:4}}).webp({quality:99,lossless:true}).toFile(asset('expression-eyes.webp'));

const wave=JSON.parse(await readFile(asset('geometry.json'),'utf8'));
function radial(shape) {
  const points=[];
  for(let j=0;j<80;j++){
    const angle=j*Math.PI*2/80,dx=Math.cos(angle),dy=Math.sin(angle);let best=Infinity;
    for(let i=0;i<shape.points.length;i++){
      const a=shape.points[i],b=shape.points[(i+1)%shape.points.length],ex=b[0]-a[0],ey=b[1]-a[1],den=dx*ey-dy*ex;
      if(Math.abs(den)<1e-8)continue;
      const ax=a[0]-shape.center[0],ay=a[1]-shape.center[1],r=(ax*ey-ay*ex)/den,u=(ax*dy-ay*dx)/den;
      if(r>0&&u>=0&&u<=1)best=Math.min(best,r);
    }
    if(!Number.isFinite(best))throw Error('Invalid approved paw outline');
    points.push([shape.center[0]+dx*best,shape.center[1]+dy*best]);
  }
  return {center:shape.center,points};
}
await writeFile(asset('expression-geometry.json'),JSON.stringify({wave:wave.poses.map(radial)}));
console.log('Prepared facial plate, original eyes, and approved paw contours.');
