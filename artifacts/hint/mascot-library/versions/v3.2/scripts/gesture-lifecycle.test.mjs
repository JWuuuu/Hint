import test from 'node:test';
import assert from 'node:assert/strict';
import {assets} from '../preview/hint-assets.js';
const {createHintSceneDirector}=await import(process.env.H15_SCENE_SOURCE||'../src/scene-director.js');
const advance=(d,t)=>{for(let i=0,n=Math.ceil(t*120);i<n;i++)d.advance(t/n);};
const create=(context={room:'home',phase:'reading'},extra={})=>{
  const d=createHintSceneDirector({context,...extra});advance(d,2);return d;
};
test('duplicate feedback never restarts its clip and lower-priority success is not replayed',()=>{
  const d=create();assert.equal(d.playGesture('reassure'),true);advance(d,.8);
  const before=d.sample();assert.equal(d.playGesture('reassure'),false);
  assert.equal(d.sample().gestureTime,before.gestureTime);
  assert.equal(d.playGesture('celebration'),false);advance(d,6);
  assert.equal(d.getState().gesture,null);
});
test('reassurance preempts presentation continuously; a tap cannot add a competing owner',()=>{
  const d=create();assert.equal(d.playGesture('present-card'),true);advance(d,.7);
  const before=d.sample();assert.equal(d.playGesture('reassure'),true);
  assert.deepEqual(d.sample().pose,before.pose);assert.equal(d.react(),false);
  assert.equal(d.getState().gesture,'reassure');assert.equal(d.getState().reaction,null);
});
test('ordinary feedback is discarded after browser/native/covered/offscreen suspension',()=>{
  for(const id of ['reassure','celebration','present-card','welcome-back']){
    const d=create();d.playGesture(id);advance(d,.8);d.setMotionPolicy({visible:false});
    const clock=d.getState().clock;advance(d,20);assert.equal(d.getState().clock,clock);
    assert.equal(d.getState().gesture,null);
    assert.equal(d.playGesture('nod'),false);d.setMotionPolicy({visible:true});advance(d,1);
    assert.equal(d.getState().gesture,null);
  }
});
test('a repeated failure phase has one cue and rapid recovery/retry respects 8s cooldown',()=>{
  let now=0;const d=create({room:'ask',phase:'thinking'},{now:()=>now});
  d.setContext({phase:'error'});advance(d,.8);const started=d.sample().gestureTime;
  d.setContext({phase:'error',keyboardOpen:true});assert.equal(d.sample().gestureTime,started);
  d.setContext({phase:'thinking'});now=7999;d.setContext({phase:'error'});advance(d,1);
  assert.equal(d.getState().gesture,null);
  d.setContext({phase:'thinking'});now=8000;d.setContext({phase:'error'});
  assert.equal(d.getState().gesture,'reassure');
});
test('ready idle pages do not celebrate; request success acknowledges once with a 6s cooldown',()=>{
  let now=0;const d=create({room:'daily',phase:'waiting'},{now:()=>now});
  d.setContext({phase:'idle'});advance(d,3);assert.equal(d.getState().gesture,null);
  d.setContext({room:'ask',phase:'thinking'});d.setContext({phase:'reading'});
  assert.equal(d.getState().gesture,'acknowledge');advance(d,4);
  d.setContext({phase:'thinking'});now=5999;d.setContext({phase:'reading'});
  assert.equal(d.getState().gesture,null);
  d.setContext({phase:'thinking'});now=6000;d.setContext({phase:'reading'});
  assert.equal(d.getState().gesture,'acknowledge');
});
test('arrival waits 700ms, cancels fast navigation, and never queues behind feedback',()=>{
  const d=create();d.setContext({room:'daily',phase:'idle'});advance(d,.5);
  assert.equal(d.getState().gesture,null);d.setContext({room:'history'});advance(d,.69);
  assert.equal(d.getState().gesture,null);advance(d,.02);assert.equal(d.getState().gesture,'welcome-back');
  advance(d,4);d.setContext({room:'settings'});advance(d,4);assert.equal(d.getState().gesture,null,'greet only once per visit');
  const busy=create();busy.setContext({room:'daily',phase:'idle'});busy.playGesture('reassure');advance(busy,5);
  assert.equal(busy.getState().gesture,null,'arrival never plays after feedback');
});
test('navigation cancellation cannot replay a stale arrival after a slow loader',()=>{
  const d=create();d.setContext({room:'daily',phase:'idle'});advance(d,.2);d.cancelGestures();
  advance(d,9);assert.equal(d.getState().gesture,null);
  d.setContext({room:'history',phase:'idle'});advance(d,.71);assert.equal(d.getState().gesture,'welcome-back');
});
test('visible navigation cancels feedback without snapping pose or paw drawings',()=>{
  const d=create(undefined,{pawGeometry:assets});d.playGesture('welcome');advance(d,1.6);
  const before=d.sample();d.cancelGestures();const after=d.sample();
  assert.deepEqual(after.pose,before.pose);assert.deepEqual(after.paws,before.paws);
  assert.equal(after.state.gesture,null);advance(d,1);assert.equal(d.getState().gesture,null);
});
test('wall-clock stale arrival drops even if animation time was stalled',()=>{
  let now=0;const d=create(undefined,{now:()=>now});d.setContext({room:'daily',phase:'idle'});
  now=1101;advance(d,.71);assert.equal(d.getState().gesture,null);
});
test('reduced motion mid-clip and teardown drop feedback with no completion or resume',()=>{
  const completed=[];const d=create(undefined,{onComplete:e=>completed.push(e)});
  d.playGesture('reassure');advance(d,.8);d.setMotionPolicy({reduced:true});
  assert.equal(d.getState().gesture,null);assert.equal(d.playGesture('nod'),false);
  d.setMotionPolicy({reduced:false});advance(d,4);assert.deepEqual(completed,[]);
  d.playGesture('present-card');d.destroy();const before=d.sample();advance(d,10);
  assert.deepEqual(d.sample(),before);assert.equal(d.playGesture('nod'),false);
});
test('letter delivery retains exact identity, time, pose and resumed progress through cancellation',()=>{
  const d=create({room:'home',phase:'waiting'},{letterGeometry:assets.letterGeometry,pawGeometry:assets});
  d.setDelivery({key:'today:approved',ready:true,card:{x:.3,y:.2,width:.4,height:.4}});advance(d,1);
  const before=d.sample();d.cancelGestures();assert.deepEqual(JSON.parse(JSON.stringify(d.sample())),JSON.parse(JSON.stringify(before)));
  for(const [u,v] of [[0,0],[1,0],[0,1],[1,1],[.5,.5]])assert.deepEqual(d.sample().letterScene.point(u,v),before.letterScene.point(u,v));
  for(const id of ['reassure','present-card','acknowledge','welcome-back'])assert.equal(d.playGesture(id),false);
  d.setMotionPolicy({visible:false});advance(d,10);const paused=d.sample();
  assert.deepEqual(paused.delivery,before.delivery);assert.deepEqual(paused.pose,before.pose);
  d.setMotionPolicy({visible:true});assert.deepEqual(d.sample().delivery,before.delivery);
  advance(d,.2);assert.ok(d.sample().delivery.time>before.delivery.time);
  assert.equal(d.sample().delivery.key,'today:approved');
});
