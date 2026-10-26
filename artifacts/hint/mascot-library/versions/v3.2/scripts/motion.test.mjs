import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gestures, activities, blendPose, sampleGesture, samplePaws, sampleEnvelope, projectEnvelopePoint, letterKeys, sampleActivity, HANDOFF_TIME } from '../src/motion.js';
import {paperSourcePoint} from '../src/letter-scene-motion.js';
import { approved, assertWorkingOutput, verifyApproved } from './verify-approved.mjs';

const geometry = JSON.parse(await readFile(new URL('../assets/letter-geometry.json', import.meta.url), 'utf8'));
const givingLandmarks=JSON.parse(await readFile(new URL('../evidence/giving-paws-v2/landmarks.json',import.meta.url),'utf8'));
const greetingGeometry=JSON.parse(await readFile(new URL('../assets/geometry.json',import.meta.url),'utf8'));
const expressionGeometry=JSON.parse(await readFile(new URL('../assets/expression-geometry.json',import.meta.url),'utf8'));
expressionGeometry.connected=JSON.parse(await readFile(new URL('../assets/connected-geometry.json',import.meta.url),'utf8'));
const givingScale=1.22,givingContactTolerance=.25*givingScale;
function givingProjection(paws){
 const from=['left','right'].map(side=>givingLandmarks.paws[side].meshCenter),to=paws.map(paw=>paw.center);
 const a=from[1].map((v,k)=>v-from[0][k]),b=to[1].map((v,k)=>v-to[0][k]);
 const length=a[0]**2+a[1]**2,c=(a[0]*b[0]+a[1]*b[1])/length,s=(a[0]*b[1]-a[1]*b[0])/length;
 return {scale:Math.hypot(c,s),point(point){
  const dx=point[0]-from[0][0],dy=point[1]-from[0][1];
  return [to[0][0]+dx*c-dy*s,to[0][1]+dx*s+dy*c];
 }};
}
test('approved greeting and its assets remain read-only and unchanged', async () => {
  assert.equal((await verifyApproved()).files, 35);
  assert.throws(() => assertWorkingOutput(approved + '/hint-drawn-paw.html'));
});
test('each expression starts and ends at the same neutral pose', () => {
  for (const [id, clip] of Object.entries(gestures)) {
    if (id.includes('letter')) continue;
    assert.deepEqual(sampleGesture(id,0), sampleGesture(id,clip.duration), id);
    for(let t=0;t<=clip.duration;t+=1/60){
      const p=sampleGesture(id,t);
      assert.ok(Object.values(p).every(Number.isFinite),id);
      assert.ok(p.eyeLeft>=0&&p.eyeLeft<=1&&p.eyeRight>=0&&p.eyeRight<=1,id);
      assert.ok(Math.abs(p.roll)<.12&&Math.abs(p.y)<.08,id);
    }
  }
});
test('thinking, listening, nod, and celebration have distinct acting without accents',()=>{
  const thought=sampleGesture('thinking',1.8),listen=sampleGesture('listening',1.8),nod=sampleGesture('nod',.85),joy=sampleGesture('celebration',1.1);
  assert.equal(thought.thought,1);assert.equal(thought.pawThink,1);assert.ok(thought.gazeY<-.85);
  assert.equal(listen.attention,1);assert.ok(listen.pawOpen>.9);assert.equal(listen.thought,0);
  assert.ok(nod.headPitch>.4);assert.equal(nod.eyeLeft,1);assert.ok(nod.pawHug>.95);
  assert.equal(joy.joy,1);assert.equal(joy.pawCelebrate,1);assert.ok(joy.y<-.065);
});
test('expressive paws retain valid geometry with and without a held letter',()=>{
  for(const letter of ['held','delivered'])for(const [id,clip] of Object.entries(gestures))for(let t=0;t<=clip.duration;t+=1/60){
    for(const p of samplePaws(geometry,id,t,letter,expressionGeometry,sampleGesture(id,t),greetingGeometry)){
      assert.ok(p.center.every(Number.isFinite));
      for(let i=0;i<p.points.length;i++){
        const a=p.points[i],b=p.points[(i+1)%p.points.length],c=p.center;
        const cross=(a[0]-c[0])*(b[1]-c[1])-(a[1]-c[1])*(b[0]-c[0]);
        assert.ok(cross>1,id+' '+letter+' '+t+' triangle '+i);
      }
    }
  }
});
test('winks close only the named eye; left and right belong to Hint', () => {
  const left=sampleGesture('wink-left',.65),right=sampleGesture('wink-right',.75);
  assert.equal(left.eyeLeft,0);assert.equal(left.eyeRight,1);
  assert.equal(right.eyeLeft,1);assert.equal(right.eyeRight,0);
});
test('the waiting offer and start of delivery match exactly', () => {
  assert.deepEqual(sampleGesture('offer-letter',2.4),sampleGesture('deliver-letter',0));
  const a=samplePaws(geometry,'offer-letter',2.4,'offered'),b=samplePaws(geometry,'deliver-letter',0,'offered');
  for(let i=0;i<2;i++){assert.deepEqual(a[i].center,b[i].center);assert.deepEqual(a[i].points,b[i].points);}
  assert.deepEqual(sampleEnvelope('offer-letter',2.4,'offered'),sampleEnvelope('deliver-letter',0,'offered'));
});
test('both paws remain finite and have no inverted fan triangles throughout delivery', () => {
  for(const id of Object.keys(letterKeys))for(let t=0;t<=gestures[id].duration;t+=1/60){
    for(const p of samplePaws(geometry,id,t,'held')){
      assert.ok(p.center.every(Number.isFinite));
      for(let i=0;i<p.points.length;i++){
        const a=p.points[i],b=p.points[(i+1)%p.points.length],c=p.center;
        const cross=(a[0]-c[0])*(b[1]-c[1])-(a[1]-c[1])*(b[0]-c[0]);
        assert.ok(cross>1,`${id} ${t} ${p.side} triangle ${i}`);
      }
    }
  }
});
test('the receiver retains an opaque letter and Hint keeps empty paws', () => {
  assert.equal(sampleEnvelope('deliver-letter',1.8,'delivered',geometry).opacity,1);
  assert.equal(sampleEnvelope('deliver-letter',1.8,'delivered',geometry).received,true);
  assert.equal(sampleEnvelope('wink-left',.6,'delivered',geometry).received,true);
  assert.equal(sampleEnvelope('wink-left',.6,'delivered',geometry).release,1);
  const a=samplePaws(geometry,'deliver-letter',1.8,'delivered'),b=samplePaws(geometry,'wink-left',0,'delivered');
  for(let i=0;i<2;i++){assert.deepEqual(a[i].center,b[i].center);assert.deepEqual(a[i].points,b[i].points);}
});
test('motion has continuous velocity through internal keyframes and zero velocity at rest', () => {
  const epsilon=1e-5;
  for(const [id,clip] of Object.entries(gestures)){
    for(const [channel,points] of Object.entries(clip.tracks))for(const [time] of points){
      const center=sampleGesture(id,time)[channel];
      const before=(center-sampleGesture(id,Math.max(0,time-epsilon))[channel])/epsilon;
      const after=(sampleGesture(id,Math.min(clip.duration,time+epsilon))[channel]-center)/epsilon;
      assert.ok(Math.abs(before-after)<.025,`${id} ${channel} ${time}`);
    }
  }
});

test('the giving envelope stays attached to the visible paw notches until handoff',()=>{
 // These segments and UVs were annotated on the new artwork, independently of
 // runtime grip coordinates. The extraction tolerance grows with the same
 // uniform foreground projection as the hands and paper.
 for(const side of ['left','right']){
  const landmark=givingLandmarks.paws[side];
  assert.ok(landmark.gripSegment.distance<.25,'visible notch has a precise contour annotation');
  assert.ok(landmark.gripUV[1]>=0&&landmark.gripUV[1]<.25,'grip is at the top of the paper');
  assert.ok(side==='left'?landmark.gripUV[0]<.1:landmark.gripUV[0]>.9,'grip is near its upper corner');
 }
 for(const [id,start,end] of [['offer-letter',1.65,2.4],['deliver-letter',0,HANDOFF_TIME]]){
  const count=Math.ceil((end-start)*120);
  for(let step=0;step<=count;step++){
   const t=start+(end-start)*step/count,paws=samplePaws(geometry,id,t,'held'),envelope=sampleEnvelope(id,t,'held',geometry);
   for(const [index,side] of ['left','right'].entries()){
    const landmark=givingLandmarks.paws[side],{indices,mix}=landmark.gripSegment,paw=paws[index];
    const notch=paw.points[indices[0]].map((v,k)=>v+(paw.points[indices[1]][k]-v)*mix);
    const paperContact=projectEnvelopePoint(paperSourcePoint(...landmark.gripUV),envelope);
    assert.ok(Math.hypot(...notch.map((v,k)=>v-paperContact[k]))<givingContactTolerance,`${id} ${t} ${side}: paper meets the visible contour notch`);
   }
   assert.equal(envelope.opacity,1);
  }
 }
});

test('the paper reaches the fitted giving plane without reversing and waits steadily',()=>{
 const corners=[[233,356],[362,378],[345,467],[221,445]];
 let previous=0;
 for(let t=0;t<=2.4;t+=1/120){
  const e=sampleEnvelope('offer-letter',t,'held',geometry);
  assert.ok(e.reach>=previous-1e-10&&e.reach<=1);previous=e.reach;
  const points=corners.map(p=>projectEnvelopePoint(p,e));
  assert.ok(points.every(p=>p.every(Number.isFinite)));
  for(let i=0;i<4;i++){
   const a=points[i],b=points[(i+1)%4],c=points[(i+2)%4];
   assert.ok((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])>0);
  }
 }
 const e=sampleEnvelope('offer-letter',2.4,'offered',geometry);
 const projection=givingProjection(samplePaws(geometry,'offer-letter',2.4,'offered'));
 corners.forEach((point,index)=>{
  const actual=projectEnvelopePoint(point,e),fitted=projection.point(givingLandmarks.envelope.corners[index]);
  assert.ok(Math.hypot(...actual.map((v,k)=>v-fitted[k]))<givingContactTolerance,'paper and hands share one projection of the independently fitted giving quad');
 });
 assert.deepEqual(e,sampleEnvelope('offer-letter',60,'offered',geometry));
 assert.deepEqual(e,sampleEnvelope('deliver-letter',0,'offered',geometry));
 const released=sampleEnvelope('deliver-letter',HANDOFF_TIME,'delivered',geometry).corners;
 for(let t=HANDOFF_TIME;t<=1.8;t+=1/60)assert.deepEqual(sampleEnvelope('deliver-letter',t,'delivered',geometry).corners,released,'released plane stays independent of the retreating paws');
});

test('the paper and wrist motion have no position or velocity jumps',()=>{
 const epsilon=1e-5;
 for(const id of ['offer-letter','deliver-letter']){
  const keys=new Set([0,.26,.42,.48,.82,.98,1.12,1.18,1.4,1.65,1.8,2.1,2.12,2.4].filter(t=>t<=gestures[id].duration));
  const points=t=>{
   const e=sampleEnvelope(id,t,'held',geometry),paws=samplePaws(geometry,id,t,'held');
   return [...[[233,356],[362,378],[345,467],[221,445]].map(p=>projectEnvelopePoint(p,e)),...paws.flatMap(p=>[p.center,...p.points])];
  };
  for(const t of keys){
   const center=points(t),before=points(Math.max(0,t-epsilon)),after=points(Math.min(gestures[id].duration,t+epsilon));
   center.forEach((p,i)=>p.forEach((v,j)=>assert.ok(Math.abs((v-before[i][j])-(after[i][j]-v))/epsilon<.1,`${id} ${t} point ${i}`)));
  }
 }
});

test('one uniform foreground projection preserves the giving palms and shoulder attachment',()=>{
 assert.equal(givingLandmarks.pose,7);
 for(const [id,time] of [['offer-letter',2.4],['deliver-letter',0],['deliver-letter',HANDOFF_TIME]]){
  const paws=samplePaws(geometry,id,time,'offered'),projection=givingProjection(paws);
  assert.ok(Math.abs(projection.scale-givingScale)<1e-10,'hands move toward the reader at the intended uniform scale');
  for(const [index,side] of ['left','right'].entries()){
   const base=geometry[side][givingLandmarks.pose],landmark=givingLandmarks.paws[side],paw=paws[index];
   for(let vertex=0;vertex<base.points.length;vertex++){
    const expected=projection.point(base.points[vertex]);
    assert.ok(Math.hypot(...paw.points[vertex].map((v,k)=>v-expected[k]))<1e-8,'all contour vertices share one similarity transform, with no anisotropic warp');
   }
   assert.deepEqual(paw.uvA.points,base.points,'foreground projection does not distort drawing UVs');
   assert.deepEqual(paw.uvB.points,base.points,'both drawing samples retain the native pose');
   const root=paw.points[landmark.rootIndex];
   for(let axis=0;axis<2;axis++){
    const values=landmark.rootRegion.map(point=>point[axis]);
    assert.ok(root[axis]>=Math.min(...values)-8&&root[axis]<=Math.max(...values)+8,'projected root stays within the annotated shoulder area');
   }
   for(let i=0;i<landmark.palmIndices.length;i++)for(let j=i+1;j<landmark.palmIndices.length;j++){
    const a=landmark.palmIndices[i],b=landmark.palmIndices[j];
    const original=Math.hypot(...base.points[a].map((v,k)=>v-base.points[b][k]));
    const actual=Math.hypot(...paw.points[a].map((v,k)=>v-paw.points[b][k]));
    assert.ok(Math.abs(actual-original*projection.scale)<1e-8,'rounded palm grows uniformly without stretching or flattening');
   }
  }
 }
});

test('the reactions retain distinct head, body, and paw actions',()=>{
 const noLeft=sampleGesture('shake-head',.78),noRight=sampleGesture('shake-head',1.35),yes=sampleGesture('nod',.83);
 assert.ok(noLeft.headYaw<-.4&&noRight.headYaw>.4);assert.equal(noLeft.x,0);assert.equal(noRight.x,0);
 assert.ok(yes.headPitch>.4);assert.equal(yes.headYaw,0);
 const sad=sampleGesture('disappointed',1.8),shy=sampleGesture('shy',1.75),grumpy=sampleGesture('frustrated',1.5);
 assert.ok(sad.crouch>.9&&sad.headPitch>.4&&sad.pawRest>.9&&sad.sad===1);
 assert.ok(shy.crouch>.7&&shy.pawFold>.9&&shy.shy>.99);
 assert.ok(grumpy.grumpy===1&&grumpy.headYaw<-.35&&grumpy.pawFold>.9);
 assert.equal(grumpy.joy,0);assert.equal(grumpy.playful,0);
 const lineLeft=sampleGesture('reading',1),lineRight=sampleGesture('reading',1.7);
 assert.ok(lineLeft.gazeX<-1&&lineRight.gazeX>.9&&lineRight.headPitch>.35);
});
test('sustained listening and thinking keep their main pose beyond one minute',()=>{
 for(const id of ['listening','thinking'])for(let t=2;t<120;t+=.13){
  const p=sampleActivity(id,t);assert.ok(Object.values(p).every(Number.isFinite));
  assert.ok(id==='listening'?p.pawOpen>.99:p.pawThink>.99);
 }
});
test('activity transitions and interrupted waves keep valid connected paw contours',()=>{
  const poses=[...activities.map(id=>sampleActivity(id,2)),sampleGesture('welcome',2.1)];
  for(const letter of ['held','delivered'])for(const from of poses)for(const to of poses.slice(0,-1))for(let i=0;i<=30;i++){
    const pose=blendPose(from,to,i/30);
    for(const p of samplePaws(geometry,'idle',0,letter,expressionGeometry,pose,greetingGeometry))for(let j=0;j<p.points.length;j++){
      const a=p.points[j],b=p.points[(j+1)%p.points.length],c=p.center;
      assert.ok((a[0]-c[0])*(b[1]-c[1])-(a[1]-c[1])*(b[0]-c[0])>0,'transition paw contour');
    }
  }
});
