import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleEntrance, sampleProfileTransition, applyJourneyReaction, WAVE_START, ENTRANCE_END } from '../src/entrance-motion.js';
import { gestures } from '../src/motion.js';

test('the body clears the mark before changing foreground layers',()=>{
  const before=sampleEntrance(3.83999),after=sampleEntrance(3.84001);
  assert.equal(before.actor.front,false);assert.equal(after.actor.front,true);
  const lowerBound=after.actor.y*780+after.actor.width*390*.42;
  const markTop=.48*780-70+34/220*140;
  assert.ok(lowerBound<markTop,`${lowerBound} must clear ${markTop}`);
});
test('entry and landing preserve position and velocity',()=>{
  const h=.0001;
  for(const t of [2.82,3.32,3.44,3.56,4.12,WAVE_START]){
    const a=sampleEntrance(t-h),b=sampleEntrance(t),c=sampleEntrance(t+h);
    for(const key of ['x','y','width']){
      const left=(b.actor[key]-a.actor[key])/h,right=(c.actor[key]-b.actor[key])/h;
      assert.ok(Math.abs(left-right)<.015,`${t} ${key}: ${left} → ${right}`);
    }
  }
});
test('navigation carries the current movement into the form transition',()=>{
  const h=.0001;
  for(const time of [1,3.25,3.75,4.17,5.2,6.1,ENTRANCE_END]){
    const from=sampleEntrance(time),start=sampleProfileTransition(from,0),next=sampleProfileTransition(from,h),prior=sampleEntrance(time-h);
    for(const key of ['x','y','width']){
      assert.ok(Math.abs(start.actor[key]-from.actor[key])<1e-9);
      const previousVelocity=(from.actor[key]-prior.actor[key])/h,nextVelocity=(next.actor[key]-start.actor[key])/h;
      assert.ok(Math.abs(previousVelocity-nextVelocity)<.02,`navigation ${time} ${key}`);
    }
    for(const key of ['pawWave','waveTime','headYaw','headRoll'])assert.ok(Math.abs(start.pose[key]-from.pose[key])<1e-9,`${time} ${key}`);
    const end=sampleProfileTransition(from,.9);
    assert.equal(end.phase,'profile');assert.ok(Math.abs(end.actor.x-.82)<1e-9);assert.ok(Math.abs(end.actor.width-.31)<1e-9);
  }
});
test('the greeting starts after settling and the bubble follows the greeting',()=>{
  assert.equal(sampleEntrance(WAVE_START-.001).phase,'settle');
  assert.equal(sampleEntrance(WAVE_START).phase,'welcome');
  assert.equal(sampleEntrance(WAVE_START+.17).bubble,0);
  assert.equal(sampleEntrance(WAVE_START+.47).bubble,1);
  assert.equal(sampleEntrance(ENTRANCE_END+.01).phase,'ready');
});

test('either tap wink keeps the greeting paw sequence and restores the underlying pose',()=>{
  for(const id of ['wink-left','wink-right']){
    const duration=gestures[id].duration;
    for(const start of [WAVE_START,WAVE_START+1.1,ENTRANCE_END-.6]){
      for(let time=0;time<=duration+.05;time+=1/120){
        const base=sampleEntrance(start+time).pose;
        const result=applyJourneyReaction(base,{id,time,duration});
        for(const key of Object.keys(base).filter(key=>key.startsWith('paw')||key==='waveTime'))assert.equal(result[key],base[key],`${id} ${time} ${key}`);
        for(const [key,value] of Object.entries(result))assert.ok(Number.isFinite(value),`${id} ${time} ${key}`);
      }
      for(const time of [0,duration,duration+1]){
        const base=sampleEntrance(start+time).pose;
        assert.deepEqual(applyJourneyReaction(base,{id,time,duration}),base);
      }
    }
    const base=sampleEntrance(WAVE_START+1.7).pose;
    base.eyeLeft=base.eyeRight=1;
    const peak=applyJourneyReaction(base,{id,time:id==='wink-left'?.65:.75,duration});
    assert.equal(peak.eyeLeft,id==='wink-left'?0:1);
    assert.equal(peak.eyeRight,id==='wink-left'?1:0);
    assert.ok(peak.playful>.85);
  }
});

test('navigation during a wink carries its expression and ongoing wave into the form',()=>{
  const h=.0001;
  for(const id of ['wink-left','wink-right'])for(const time of [.2,.65,1.5]){
    const from=sampleEntrance(WAVE_START+1.1+time),reaction={id,time,duration:gestures[id].duration};
    from.pose=applyJourneyReaction(from.pose,reaction);from.reaction=reaction;
    const start=sampleProfileTransition(from,0),next=sampleProfileTransition(from,h);
    const before=applyJourneyReaction(sampleEntrance(from.time-h).pose,{...reaction,time:time-h});
    for(const key of Object.keys(from.pose)){
      assert.ok(Math.abs(start.pose[key]-from.pose[key])<1e-9,`${id} ${time} ${key} start`);
      const left=(from.pose[key]-before[key])/h,right=(next.pose[key]-start.pose[key])/h;
      assert.ok(Math.abs(left-right)<.03,`${id} ${time} ${key} velocity ${left} / ${right}`);
    }
    assert.equal(sampleProfileTransition(from,.9).phase,'profile');
  }
});
