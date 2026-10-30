import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleActivity} from '../src/motion.js';
import {createHintSceneDirector,describeHintContext} from '../src/scene-director.js';
const advance=(director,seconds)=>{for(let i=0;i<seconds*100;i++)director.advance(.01);};
test('a resting home companion sits while composing, listening and replies take precedence',()=>{
  assert.equal(describeHintContext({room:'home',phase:'reading',resting:true}).activity,'sitting');
  assert.equal(describeHintContext({room:'ask',phase:'waiting',typing:true}).activity,'typing');
  assert.equal(describeHintContext({room:'ask',phase:'reading',resting:true}).activity,'reading');
  assert.equal(describeHintContext({room:'tarot',phase:'thinking',typing:true}).activity,'thinking');
  assert.equal(describeHintContext({room:'tarot',phase:'listening'}).activity,'listening');
  assert.equal(describeHintContext({room:'tarot',phase:'speaking',audioPlaying:true}).activity,'speaking');
});
test('typing alternates short paw taps and sitting stays grounded through its loop',()=>{
  const a=sampleActivity('typing',.125),b=sampleActivity('typing',.375);
  assert.ok(a.pawDip>0&&b.pawDip<0);
  for(const id of ['typing','sitting'])for(let t=0;t<30;t+=.017){
    const pose=sampleActivity(id,t);
    assert.ok(Object.values(pose).every(Number.isFinite));
    assert.ok(pose.crouch>0&&pose.pawDip>=-1&&pose.pawDip<=1);
  }
});
test('moving from typing to thinking retains pose continuity and reduced motion stops time',()=>{
  const director=createHintSceneDirector({context:{room:'tarot',phase:'waiting',typing:true,hasMessages:true}});
  advance(director,2); const before=director.sample().pose;
  director.setContext({phase:'thinking',typing:false});
  assert.deepEqual(director.sample().pose,before);
  advance(director,2); assert.equal(director.getState().activity,'thinking');
  director.setMotionPolicy({reduced:true}); const frozen=director.sample();
  advance(director,10); assert.deepEqual(director.sample(),frozen);
});

test('seated stretches and listening nods stay gentle and return without a loop seam',()=>{
  const resting=sampleActivity('sitting',11),stretch=sampleActivity('sitting',13.8);
  assert.ok(stretch.crouch<resting.crouch&&stretch.crouch>0);
  assert.ok(stretch.pawOpen>resting.pawOpen);
  assert.ok(sampleActivity('listening',4.9).headPitch>sampleActivity('listening',4.5).headPitch+.07);
  for(const [id,period] of [['sitting',24],['typing',6],['listening',9],['thinking',12]]){
    const before=sampleActivity(id,period-.0001),after=sampleActivity(id,period+.0001);
    for(const key of Object.keys(before))assert.ok(Math.abs(before[key]-after[key])<.005,`${id} ${key} loop seam`);
  }
});

test('keyboard and activity changes keep a measured page anchor without a phantom glide',()=>{
  const d=createHintSceneDirector({context:{room:'ask',phase:'idle'}});
  const anchor={x:.8,y:.12,width:.2};d.setAnchor(anchor);advance(d,2);
  const before=d.sample().actor;
  d.setContext({keyboardOpen:true,typing:true});
  assert.equal(d.setAnchor(anchor),false);
  advance(d,1);assert.deepEqual(d.sample().actor,before);
  d.setContext({keyboardOpen:false,typing:false});advance(d,1);
  assert.deepEqual(d.sample().actor,before);
});

test('compact handoffs carry position and velocity then settle within a short bounded transition',()=>{
  const d=createHintSceneDirector();d.setViewport(390,844);
  d.setAnchor({x:.5,y:.4,width:.6});advance(d,2);
  d.setAnchor({x:.85,y:.1,width:.2});advance(d,.16);
  const previous=d.sample();d.advance(.0001);const before=d.sample();
  d.setAnchor({x:.82,y:.14,width:.22});const current=d.sample();d.advance(.0001);const after=d.sample();
  for(const key of ['x','y','width']){
    assert.ok(Math.abs(current.actor[key]-before.actor[key])<1e-9,`${key} position`);
    const left=(before.actor[key]-previous.actor[key])/.0001,right=(after.actor[key]-current.actor[key])/.0001;
    assert.ok(Math.abs(left-right)<.05,`${key} velocity`);
  }
  advance(d,.73);assert.equal(d.getState().transitioning,false);
  assert.ok(Math.abs(d.sample().actor.width-.22)<1e-9);
});

test('a room greeting yields smoothly when the reader begins composing',()=>{
  for(const delay of [.2,1.5]){
    const d=createHintSceneDirector({context:{room:'home',phase:'idle'}});advance(d,2);
    d.setContext({room:'ask'});advance(d,delay);const before=d.sample().pose;
    d.setContext({typing:true});assert.deepEqual(d.sample().pose,before);
    advance(d,1);assert.equal(d.getState().activity,'typing');assert.equal(d.getState().gesture,null);
  }
});
