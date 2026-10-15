import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sampleLetterScene,createLetterAnchor,transportedPaperPoint,letterSceneTiming} from '../src/letter-scene-motion.js';
const geometry=JSON.parse(await readFile(new URL('../assets/letter-geometry.json',import.meta.url),'utf8'));
const anchor=createLetterAnchor(geometry,2.88);
const sample=t=>sampleLetterScene('delivery',t,2.4+t,anchor,geometry);
const points=[[0,0],[1,0],[1,1],[0,1],[.5,.5]];
test('the letter keeps its position and incoming velocity when the paws release',()=>{
  const e=1e-5,t=letterSceneTiming.handoff;
  for(const [u,v] of points){
    const a=sample(t-e).point(u,v),b=sample(t).point(u,v),c=sample(t+e).point(u,v);
    assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-5);
    for(let k=0;k<2;k++)assert.ok(Math.abs((b[k]-a[k])/e-(c[k]-b[k])/e)<.001,'incoming velocity follows the same physical letter');
  }
});
test('the released letter follows its captured handoff rather than the moving body',()=>{
  const a=sampleLetterScene('delivery',1.1,3.5,anchor,geometry),b=sampleLetterScene('delivery',1.1,90,anchor,geometry);
  for(const [u,v] of points)assert.deepEqual(a.point(u,v),b.point(u,v));
});
test('the letter approaches continuously without changing opacity or reversing its plane',()=>{
  let previous=0;
  for(let t=.48;t<=1.62;t+=1/120){
    const s=sample(t),p=points.slice(0,4).map(([u,v])=>s.point(u,v));
    const width=Math.hypot(p[1][0]-p[0][0],p[1][1]-p[0][1]);
    assert.ok(width>=previous-1e-5);previous=width;
    for(let i=0;i<4;i++){const a=p[i],b=p[(i+1)%4],c=p[(i+2)%4];assert.ok((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])>0);}
  }
  const center=sample(1.62).point(.5,.5);assert.deepEqual(center,[.5,.515]);
});
test('envelope opening and card extraction have clear ordered phases',()=>{
  assert.equal(sample(1.62).opening,0);assert.equal(sample(1.62).extraction,0);
  assert.equal(sample(2.24).opening,1);assert.equal(sample(3.18).extraction,1);
  assert.equal(sample(3.18).phase,'card-ready');
  for(const [u,v] of points)assert.ok(sample(3.6).point(u,v)[1]>1,'the emptied envelope leaves through the bottom edge');
});
test('reader ownership survives indefinitely with empty paws and an attached companion shadow',()=>{
  const s=sampleLetterScene('reading',60,90,anchor,geometry);
  assert.equal(s.phase,'card-ready');assert.equal(s.extraction,1);assert.equal(s.actor.width,.27);
  assert.ok(Object.values(s.pose).every(Number.isFinite));assert.equal(s.gesture,'reading');
  const end=transportedPaperPoint(.5,.5,anchor,1);assert.deepEqual(end,[.5,.515]);
});
