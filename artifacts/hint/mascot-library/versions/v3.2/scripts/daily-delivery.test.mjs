import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sampleDailyDelivery,dailyDeliveryDuration} from '../src/daily-delivery-motion.js';
import {createHintSceneDirector} from '../src/scene-director.js';
import {neutralPose} from '../src/motion.js';
import {letterSceneTiming as timing} from '../src/letter-scene-motion.js';
const geometry=JSON.parse(await readFile(new URL('../assets/letter-geometry.json',import.meta.url),'utf8'));
const advance=(d,seconds)=>{const n=Math.ceil(seconds*120);for(let i=0;i<n;i++)d.advance(seconds/n);};
const points=[[0,0],[1,0],[1,1],[0,1],[.5,.5]];
const sizes=[[375,667,142,228],[440,956,202,325],[1024,768,162,261]];
function setup([w,h,cw,ch]){
  const aspect=w/h,card={x:(1-cw/w)/2,y:74/h,width:cw/w,height:ch/h};
  const home={x:.5-36/w,y:0,width:72/w,height:72/h};
  const source={actor:home,pose:neutralPose(),look:{x:0,y:0}};
  return {aspect,card,home,source,geometry};
}
test('daily handoff is continuous and finishes exactly at the real card and avatar on every viewport',()=>{
  for(const size of sizes){
    const args=setup(size),sample=time=>sampleDailyDelivery({...args,time,clock:10+time});
    assert.deepEqual(sample(0).actor,args.source.actor);
    const e=1e-5,t=2.88;
    for(const [u,v] of points){
      const a=sample(t-e).letterScene.point(u,v),b=sample(t).letterScene.point(u,v),c=sample(t+e).letterScene.point(u,v);
      for(let k=0;k<2;k++){
        assert.ok(Math.abs(a[k]-b[k])<1e-5);
        assert.ok(Math.abs((b[k]-a[k])/e-(c[k]-b[k])/e)<.002);
      }
      const final=sample(dailyDeliveryDuration);
      assert.deepEqual(final.letterScene.cardPoint(u,v),[args.card.x+args.card.width*u,args.card.y+args.card.height*v]);
      assert.equal(final.letterScene.envelopeOpacity,0,'the emptied envelope has faded away');
    }
    const final=sample(dailyDeliveryDuration);
    for(const k of Object.keys(args.home))assert.ok(Math.abs(final.actor[k]-args.home[k])<1e-10);
    assert.equal(final.letter,'delivered');
    for(let t=0;t<=dailyDeliveryDuration;t+=1/60){
      const s=sample(t);
      assert.ok(Object.values(s.pose).every(Number.isFinite));
      assert.ok(Math.abs(s.actor.height-s.actor.width*args.aspect)<1e-10);
      const p=points.slice(0,4).map(([u,v])=>s.letterScene.cardPoint(u,v));
      for(let i=0;i<4;i++){const a=p[i],b=p[(i+1)%4],c=p[(i+2)%4];assert.ok((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])>0);}
    }
  }
});
test('delivery waits for its artwork, pauses when hidden, and ends once without changing identity',()=>{
  const d=createHintSceneDirector({context:{room:'home',phase:'waiting'},letterGeometry:geometry});
  d.setViewport(375,667);advance(d,2);
  const value={key:'2026-10-20:moon',card:setup(sizes[0]).card,ready:false};
  d.setDelivery(value);advance(d,2);assert.equal(d.sample().delivery.time,0);
  const before=d.sample();d.setDelivery({...value,ready:true});assert.deepEqual(d.sample().actor,before.actor);
  advance(d,3);
  const handingOff=d.sample();
  assert.equal(d.playGesture('celebration',{interrupt:true}),false,'explicit feedback cannot interrupt paper handoff');
  assert.deepEqual(d.sample().delivery,handingOff.delivery);
  d.setMotionPolicy({visible:false});const paused=d.sample();advance(d,20);
  assert.deepEqual(d.sample().actor,paused.actor);assert.deepEqual(d.sample().delivery,paused.delivery);
  d.setMotionPolicy({visible:true});advance(d,dailyDeliveryDuration-3+.01);assert.equal(d.sample().delivery.phase,'ready');
  d.setDelivery({...value,ready:true,done:true});d.setDelivery({...value,ready:true});advance(d,3);
  assert.equal(d.sample().delivery.phase,'ready');assert.equal(d.sample().delivery.key,value.key);
  assert.equal(d.sample().letterScene,undefined);
});
test('one rigid card slides through the open envelope before it grows toward the reader',()=>{
  for(const size of sizes){
    const args=setup(size),sample=t=>sampleDailyDelivery({...args,time:timing.offer+t,clock:10+timing.offer+t}).letterScene;
    const tucked=sample(timing.extractStart),tuckedTL=tucked.cardPoint(0,0),tuckedBR=tucked.cardPoint(1,1);
    const envelope=points.map(([u,v])=>tucked.point(u,v));
    const tuckedWidth=tuckedBR[0]-tuckedTL[0],tuckedHeight=tuckedBR[1]-tuckedTL[1];
    let previousY=Infinity,previousWidth=tuckedWidth;
    for(let t=timing.openStart;t<=timing.extractEnd;t+=1/120){
      const s=sample(t),tl=s.cardPoint(0,0),br=s.cardPoint(1,1),center=s.cardPoint(.5,.5);
      assert.ok(Math.abs((br[0]-tl[0])/(br[1]-tl[1])-args.card.width/args.card.height)<1e-10,'no stretching');
      assert.ok(Math.abs(br[0]-tl[0]-tuckedWidth)<1e-10,'width stays fixed inside the pocket');
      assert.ok(Math.abs(br[1]-tl[1]-tuckedHeight)<1e-10,'height stays fixed inside the pocket');
      assert.ok(Math.abs(center[0]-s.point(.5,.5)[0])<1e-10,'vertical centerline');
      assert.ok(center[1]<=previousY+1e-10,'card rises without reversing');previousY=center[1];
      assert.equal(s.envelopeOpacity,1,'pocket remains until card clears');
      for(let i=0;i<points.length;i++)assert.deepEqual(s.point(...points[i]),envelope[i],'envelope stays still during extraction');
      assert.equal(s.presentation,0,'forward presentation waits for clearance');
      if(s.extraction>0)assert.equal(s.opening,1,'flap opens before extraction');
    }
    const clear=sample(timing.extractEnd);
    assert.ok(clear.cardPoint(.5,1)[1]<clear.point(.5,0)[1],'the whole bottom clears the actual top opening');
    for(let t=timing.extractEnd;t<=timing.presentEnd;t+=1/120){
      const s=sample(t),tl=s.cardPoint(0,0),br=s.cardPoint(1,1),center=s.cardPoint(.5,.5),width=br[0]-tl[0];
      assert.equal(s.extraction,1,'presentation follows completed extraction');
      assert.ok(width>=previousWidth-1e-10,'card moves forward without shrinking');previousWidth=width;
      assert.ok(Math.abs(width/(br[1]-tl[1])-args.card.width/args.card.height)<1e-10,'uniform scale preserves artwork proportions');
      assert.ok(Math.abs(center[0]-s.point(.5,.5)[0])<1e-10,'presentation stays on the opening centerline');
      assert.ok(br[1]<s.point(.5,0)[1],'card does not reenter the envelope as it grows');
      assert.equal(s.handoff,0,'DOM transfer waits until the card reaches its exact frame');
    }
    const presented=sample(timing.presentEnd);
    for(const [u,v] of points)assert.deepEqual(presented.cardPoint(u,v),[args.card.x+args.card.width*u,args.card.y+args.card.height*v]);
    const envelopeDrop=presented.point(.5,.5)[1]-clear.point(.5,.5)[1];
    assert.ok(envelopeDrop>0&&envelopeDrop<(clear.point(.5,1)[1]-clear.point(.5,0)[1])*.3,'the empty pocket lowers gently');
    assert.equal(presented.envelopeOpacity,0);
  }
});
test('the fully presented card transfers to its identical DOM frame while stationary',()=>{
  for(const size of sizes){
    const args=setup(size),sample=t=>sampleDailyDelivery({...args,time:timing.offer+t,clock:10+timing.offer+t});
    let previousHandoff=0;
    assert.ok(timing.handoffEnd-timing.handoffStart>=.2,'transfer remains perceptible');
    for(let t=timing.handoffStart;t<timing.handoffEnd;t+=1/120){
      const frame=sample(t),s=frame.letterScene;
      assert.deepEqual(s.cardFrame,args.card,'renderer and DOM use the original measured frame');
      for(const [u,v] of points)assert.deepEqual(s.cardPoint(u,v),[args.card.x+args.card.width*u,args.card.y+args.card.height*v]);
      assert.ok(s.handoff>=previousHandoff&&s.handoff<=1);previousHandoff=s.handoff;
      assert.equal(s.cardOpacity+s.handoff,1,'crossfade has complementary ownership');
      assert.equal(frame.phase,'taking-card','ready waits until transfer finishes');
    }
    const final=sample(timing.handoffEnd);
    assert.equal(final.letterScene.cardOpacity,0);assert.equal(final.letterScene.handoff,1);
    assert.equal(final.phase,'ready');assert.equal(dailyDeliveryDuration,timing.offer+timing.handoffEnd);
  }
});
test('card extraction, forward presentation and transfer keep continuous position and velocity',()=>{
  for(const size of sizes){
    const args=setup(size),sample=t=>sampleDailyDelivery({...args,time:timing.offer+t,clock:10+timing.offer+t}).letterScene;
    const channels=s=>[...points.flatMap(([u,v])=>[...s.cardPoint(u,v).map((value,k)=>value*size[k]),...s.point(u,v).map((value,k)=>value*size[k])]),s.envelopeOpacity,s.cardOpacity,s.handoff];
    const e=1e-5;
    for(const t of [timing.extractStart,timing.extractEnd,timing.presentEnd,timing.handoffStart,timing.handoffEnd]){
      const a=channels(sample(t-e)),b=channels(sample(t)),c=channels(sample(t+e));
      for(let i=0;i<b.length;i++){
        assert.ok(Math.abs(a[i]-b[i])<1e-6,`channel ${i} position at ${t}`);
        assert.ok(Math.abs((b[i]-a[i])/e-(c[i]-b[i])/e)<.002,`channel ${i} velocity at ${t}`);
      }
    }
  }
});
test('starting delivery preserves the moving companion position and incoming velocity',()=>{
  const d=createHintSceneDirector({context:{room:'home'},letterGeometry:geometry});d.setViewport(375,667);
  advance(d,2);d.setAnchor({x:.5,y:.05,width:72/375});advance(d,.3);
  const before=d.sample();d.advance(.0001);const source=d.sample();
  d.setDelivery({key:'today',card:setup(sizes[0]).card,ready:true});
  assert.deepEqual(d.sample().actor,source.actor);d.advance(.0001);const after=d.sample();
  for(const key of ['x','y','width','height'])assert.ok(Math.abs((source.actor[key]-before.actor[key])/.0001-(after.actor[key]-source.actor[key])/.0001)<.008,key);
});
test('skip, reduced motion, navigation and new receipts cannot replay an obsolete letter',()=>{
  for(const action of ['skip','reduce','navigate']){
    const d=createHintSceneDirector({context:{room:'home'},letterGeometry:geometry});advance(d,2);
    const value={key:'today',card:setup(sizes[0]).card,ready:true};d.setDelivery(value);advance(d,1.4);
    const frame=d.sample();
    if(action==='skip')d.setDelivery({...value,done:true});
    if(action==='reduce')d.setMotionPolicy({reduced:true});
    if(action==='navigate')d.setContext({room:'ask',phase:'thinking'});
    assert.equal(d.sample().letterScene,undefined);
    if(action==='skip')assert.deepEqual(d.sample().actor,frame.actor);
    if(action==='navigate')assert.equal(d.sample().delivery,null);
    d.setMotionPolicy({reduced:false});advance(d,10);assert.equal(d.sample().letter,'delivered');
    d.setDelivery(null);d.setContext({room:'home'});d.setDelivery({...value,key:'tomorrow'});
    assert.equal(d.sample().delivery.time,0);assert.equal(d.sample().delivery.key,'tomorrow');
  }
});
