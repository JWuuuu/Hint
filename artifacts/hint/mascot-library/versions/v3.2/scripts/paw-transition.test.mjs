import test from 'node:test';
import assert from 'node:assert/strict';
import {createHintSceneDirector} from '../src/scene-director.js';
import {projectBodyPoint} from '../src/letter-scene-motion.js';
import {pawLayers} from '../src/motion.js';
import {assets} from '../preview/hint-assets.js';

const advance=(d,t)=>{for(let i=0,n=Math.ceil(t*120);i<n;i++)d.advance(t/n);};
const card={x:.3,y:.11,width:.4,height:.36},value={key:'today',ready:true,card};
const epsilon=1e-5;
function setup(width=375,height=667){
  const d=createHintSceneDirector({context:{room:'home',phase:'idle'},letterGeometry:assets.letterGeometry,pawGeometry:assets});
  d.setViewport(width,height);d.setAnchor({x:.5,y:.08,width:72/width});advance(d,2);
  return d;
}
function points(frame,width=375,height=667){
  return frame.paws.flatMap(p=>[p.center,...p.points]).map(p=>projectBodyPoint(p,frame.pose,frame.state.clock,frame.look,frame.actor).map((v,k)=>v*(k?height:width)));
}
function distance(a,b){return Math.max(...a.map((p,i)=>Math.hypot(p[0]-b[i][0],p[1]-b[i][1])));}
function continuity(d,action,width,height){
  const previous=points(d.sample(),width,height);d.advance(epsilon);
  const before=d.sample();action();const after=d.sample();
  assert.ok(distance(points(before,width,height),points(after,width,height))<1e-7,'no silhouette position jump');
  for(let i=0;i<2;i++)assert.deepEqual(pawLayers(before.paws[i]),pawLayers(after.paws[i]),'no drawing switch');
  d.advance(epsilon);const next=points(d.sample(),width,height),center=points(before,width,height),current=points(after,width,height);
  const error=Math.max(...center.map((p,i)=>Math.hypot((p[0]-previous[i][0])-(next[i][0]-current[i][0]),(p[1]-previous[i][1])-(next[i][1]-current[i][1]))/epsilon));
  assert.ok(error<.12,'incoming velocity error '+error+' px/s');
}
function valid(frame){
  for(const paw of frame.paws){
    const layers=pawLayers(paw);assert.ok(Math.abs(layers.reduce((sum,p)=>sum+p.weight,0)-1)<1e-10);
    for(const layer of layers){assert.ok(layer.weight>=0);assert.ok(assets.images[layer.texture]);}
    for(let i=0;i<paw.points.length;i++){
      const a=paw.points[i],b=paw.points[(i+1)%paw.points.length],c=paw.center;
      assert.ok([...a,...c].every(Number.isFinite));
      assert.ok((a[0]-c[0])*(b[1]-c[1])-(a[1]-c[1])*(b[0]-c[0])>0,'paw contour stays upright');
    }
  }
}
test('letter entry carries the current paw drawing and velocity from active app gestures',()=>{
  for(const id of ['welcome','welcome-back','celebration','listening','thinking','reading']){
    const d=setup();d.playGesture(id);advance(d,.9);
    continuity(d,()=>d.setDelivery(value));
    for(let i=0;i<90;i++){d.advance(1/120);valid(d.sample());}
    assert.ok(d.sample().paws.every(p=>!p.layers),'entry blend releases its drawing layers');
  }
});
test('skip, close, and navigation preserve every paw point through all handoff phases',()=>{
  for(const [w,h] of [[375,667],[440,956]])for(const t of [0,.2,.65,1,2.4,2.9,3.3,3.8,4.3,5.3,5.99])for(const action of ['skip','close','navigate']){
    const d=setup(w,h);d.setDelivery(value);advance(d,t);
    continuity(d,()=>action==='skip'?d.setDelivery({...value,done:true}):action==='close'?d.setDelivery(null):d.setContext({room:'ask',phase:'thinking'}),w,h);
    for(let i=0;i<90;i++){d.advance(1/120);valid(d.sample());}
    assert.ok(d.sample().paws.every(p=>!p.layers),'exit blend releases its drawing layers');
  }
});
test('repeated interruptions keep the current mixture, pause exactly, and settle cleanly',()=>{
  const d=setup();
  for(let i=0;i<12;i++){
    continuity(d,()=>d.setDelivery({...value,key:String(i)}));advance(d,.08);
    continuity(d,()=>d.setDelivery(null));advance(d,.08);valid(d.sample());
  }
  d.setMotionPolicy({visible:false});const hidden=d.sample();advance(d,3);assert.deepEqual(d.sample(),hidden);
  d.setMotionPolicy({visible:true});advance(d,1);assert.ok(d.sample().paws.every(p=>!p.layers));
  d.setDelivery({...value,key:'new'});advance(d,.25);d.setMotionPolicy({reduced:true});
  assert.ok(d.sample().paws.every(p=>!p.layers));assert.equal(d.sample().letter,'delivered');
});

test('interrupting any part of an idle blink keeps eyelids in range without a sudden position change',()=>{
  for(const time of [2.2,2.22,2.24,2.26,2.29,2.31,2.34,2.36,2.4])for(const action of ['gesture','delivery','close']){
    const d=setup();advance(d,time-2);
    if(action==='close'){d.setDelivery(value);advance(d,4.9);}
    const source=d.sample();
    if(action==='gesture')d.playGesture('celebration');
    if(action==='delivery')d.setDelivery(value);
    if(action==='close')d.setDelivery(null);
    for(const key of ['eyeLeft','eyeRight'])assert.ok(Math.abs(d.sample().pose[key]-source.pose[key])<1e-10);
    for(let i=0;i<120;i++){
      d.advance(1/120);
      for(const key of ['eyeLeft','eyeRight'])assert.ok(d.sample().pose[key]>=0&&d.sample().pose[key]<=1,'bounded '+key);
    }
  }
});
