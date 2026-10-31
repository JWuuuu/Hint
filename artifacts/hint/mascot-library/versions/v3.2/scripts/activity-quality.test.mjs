import test from 'node:test';
import assert from 'node:assert/strict';
import {gestures,sampleActivity} from '../src/motion.js';
import {createHintSceneDirector} from '../src/scene-director.js';

const advance=(director,seconds)=>{for(let i=0,n=Math.ceil(seconds*120);i<n;i++)director.advance(seconds/n);};
const unitChannels=['eyeLeft','eyeRight','pawWave','engage','pawThink','pawOpen','pawCelebrate','pawReach','pawFold','pawRest',
  'thought','joy','attention','assurance','playful','expectant','question','sparkles','wide','soft','round','speech','reading','shy','sad','grumpy','tired','yawn'];

test('gesture interruptions preserve bounded expression and paw blend weights',()=>{
  for(const [id,clip] of Object.entries(gestures).filter(([id])=>!id.includes('letter')))for(let time=.1;time<clip.duration;time+=.15){
    const director=createHintSceneDirector({context:{room:'home',phase:'idle'}});advance(director,2);
    director.playGesture(id);advance(director,time);const source=director.sample();
    director.playGesture('nod',{interrupt:true});
    for(const key of unitChannels)assert.equal(director.sample().pose[key],source.pose[key],`${id}: ${key} continuous at interruption`);
    for(let i=0;i<35;i++){
      director.advance(1/120);const pose=director.sample().pose;
      for(const key of unitChannels)assert.ok(pose[key]>=-1e-12&&pose[key]<=1+1e-12,`${id} at ${time}: ${key}=${pose[key]}`);
    }
  }
});

test('sustained speech uses slow hand phrases with rests while the mouth keeps its syllables',()=>{
  let previous=sampleActivity('speaking',0),peakArmSpeed=0,armPeaks=0,mouthPeaks=0,lastArmDelta=0,lastMouthDelta=0,restFrames=0;
  for(let i=1;i<=2304;i++){
    const pose=sampleActivity('speaking',i/240),armDelta=pose.pawReach-previous.pawReach,mouthDelta=pose.speech-previous.speech;
    peakArmSpeed=Math.max(peakArmSpeed,Math.abs(armDelta)*240);
    if(lastArmDelta>1e-9&&armDelta<-1e-9)armPeaks++;
    if(lastMouthDelta>1e-9&&mouthDelta<-1e-9)mouthPeaks++;
    if(Math.abs(armDelta)>1e-9)lastArmDelta=armDelta;
    if(Math.abs(mouthDelta)>1e-9)lastMouthDelta=mouthDelta;
    if(pose.pawReach<.261)restFrames++;
    assert.ok(pose.pawReach>=.25&&pose.pawReach<=.55);
    previous=pose;
  }
  assert.ok(peakArmSpeed<.5,'hands do not snap on syllable beats');
  assert.equal(armPeaks,2,'two distinct emphases over the phrase cycle');
  assert.ok(mouthPeaks>=14,'mouth retains independent syllable articulation');
  assert.ok(restFrames/240>2,'hands visibly rest between phrases');
  const epsilon=1e-5,edge=9.6;
  assert.ok(Math.abs(sampleActivity('speaking',edge-epsilon).pawReach-sampleActivity('speaking',edge+epsilon).pawReach)<1e-9,'phrase loop is continuous');
});

test('sustained reading scans with its eyes while the head stays quietly lowered',()=>{
  let previous=sampleActivity('reading',0),headSpeed=0,eyeSpeed=0,minEye=Infinity,maxEye=-Infinity;
  for(let i=1;i<=3456;i++){
    const pose=sampleActivity('reading',i/240);
    headSpeed=Math.max(headSpeed,Math.abs(pose.headYaw-previous.headYaw)*240);
    eyeSpeed=Math.max(eyeSpeed,Math.abs(pose.gazeX-previous.gazeX)*240);
    minEye=Math.min(minEye,pose.gazeX);maxEye=Math.max(maxEye,pose.gazeX);
    assert.ok(pose.headPitch>=.37&&pose.headPitch<=.43,'reading remains visibly downward');
    assert.ok(Math.abs(pose.headYaw)<.06,'head does not follow each eye return');
    previous=pose;
  }
  assert.ok(headSpeed<.02,'head stays settled while eyes change lines');
  assert.ok(eyeSpeed<3,'restrained line returns');
  assert.ok(minEye<-.5&&maxEye>.5,'eye motion still reads distinct lines');
  for(const time of [7.2,14.4])assert.ok(Math.abs(sampleActivity('reading',time-1e-5).gazeX-sampleActivity('reading',time+1e-5).gazeX)<1e-8,'reading loop is continuous');
});
