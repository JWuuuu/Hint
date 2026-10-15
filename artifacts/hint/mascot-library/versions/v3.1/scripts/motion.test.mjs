import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gestures, activities, blendPose, sampleGesture, samplePaws, sampleEnvelope, projectEnvelopePoint, letterKeys, sampleActivity, HANDOFF_TIME } from '../src/motion.js';
import { approved, assertWorkingOutput, verifyApproved } from './verify-approved.mjs';

const geometry = JSON.parse(await readFile(new URL('../assets/letter-geometry.json', import.meta.url), 'utf8'));
const greetingGeometry=JSON.parse(await readFile(new URL('../assets/geometry.json',import.meta.url),'utf8'));
const expressionGeometry=JSON.parse(await readFile(new URL('../assets/expression-geometry.json',import.meta.url),'utf8'));
expressionGeometry.connected=JSON.parse(await readFile(new URL('../assets/connected-geometry.json',import.meta.url),'utf8'));
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

test('the held envelope follows the two paw contact anchors until handoff',()=>{
 const base=[[geometry.left[0].center[0]+28,geometry.left[0].center[1]-3],[geometry.right[0].center[0]-28,geometry.right[0].center[1]-14]];
 for(const id of ['offer-letter','deliver-letter'])for(let t=0;t<=(id==='offer-letter'?2.4:HANDOFF_TIME);t+=1/120){
  const paws=samplePaws(geometry,id,t,'held'),e=sampleEnvelope(id,t,'held',geometry);
  const desired=paws.map((p,i)=>{
   const [x,y]=i===0?[28,-3]:[-28,-14],angle=e.tilt*(i===0?.14:-.18),c=Math.cos(angle),s=Math.sin(angle);
   return [p.center[0]+x*c-y*s,p.center[1]+x*s+y*c];
  });
  base.forEach((point,i)=>{const [a,b]=projectEnvelopePoint(point,e);
   assert.ok(Math.hypot(a-desired[i][0],b-desired[i][1])<1e-6);});
  assert.equal(e.opacity,1);
 }
});

test('the paper gradually foreshortens into a perspective plane, with a stable waiting pose',()=>{
 const corners=[[233,356],[362,378],[345,467],[221,445]];
 const area=points=>Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-p[1]*q[0];},0)/2);
 let previous=0;
 for(let t=0;t<=2.4;t+=1/120){
  const e=sampleEnvelope('offer-letter',t,'held',geometry);
  assert.ok(e.tilt>=previous-1e-10&&e.tilt<=1);previous=e.tilt;
  const points=corners.map(p=>projectEnvelopePoint(p,e));
  assert.ok(points.every(p=>p.every(Number.isFinite)));
  for(let i=0;i<4;i++){
   const a=points[i],b=points[(i+1)%4],c=points[(i+2)%4];
   assert.ok((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])>0);
  }
 }
 const e=sampleEnvelope('offer-letter',2.4,'offered',geometry);
 const tilted=corners.map(p=>projectEnvelopePoint(p,e));
 const flat=corners.map(p=>projectEnvelopePoint(p,{...e,tilt:0}));
 assert.ok(area(tilted)/area(flat)>.5&&area(tilted)/area(flat)<.65,'readable 3D tilt without collapsing the paper');
 assert.deepEqual(e,sampleEnvelope('offer-letter',60,'offered',geometry));
 assert.deepEqual(e,sampleEnvelope('deliver-letter',0,'offered',geometry));
 for(let t=HANDOFF_TIME;t<=1.8;t+=1/60)assert.equal(sampleEnvelope('deliver-letter',t,'delivered',geometry).tilt,1);
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

test('tilting the envelope rotates each paw without stretching its volume',()=>{
 for(const [i,side] of ['left','right'].entries()){
  const base=geometry[side][2],paw=samplePaws(geometry,'offer-letter',2.4,'offered')[i];
  base.points.forEach((p,j)=>assert.ok(Math.abs(Math.hypot(p[0]-base.center[0],p[1]-base.center[1])-Math.hypot(paw.points[j][0]-paw.center[0],paw.points[j][1]-paw.center[1]))<1e-8));
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
