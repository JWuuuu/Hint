import test from 'node:test';
import assert from 'node:assert/strict';
import {createHintSceneDirector,describeHintContext,gestureForContext} from '../src/scene-director.js';
const advance=(director,seconds)=>{for(let i=0;i<Math.ceil(seconds*120);i++)director.advance(seconds/Math.ceil(seconds*120));};

test('explicit save feedback can interrupt card presentation and a tap reaction without snapping',()=>{
  for(const tap of [false,true]){
    const director=createHintSceneDirector({context:{room:'home',phase:'reading'}});advance(director,2);
    director.playGesture('present-card');advance(director,.7);
    if(tap){director.react();advance(director,.4);}
    const previous=director.sample();director.advance(.0001);const before=director.sample();
    assert.equal(director.playGesture('celebration'),false,'ordinary gestures still wait');
    assert.equal(director.playGesture('celebration',{interrupt:true}),true,'user action takes priority');
    const current=director.sample();director.advance(.0001);const next=director.sample();
    for(const key of Object.keys(before.pose)){
      assert.ok(Math.abs(before.pose[key]-current.pose[key])<1e-9,key+' position');
      assert.ok(Math.abs((before.pose[key]-previous.pose[key])/.0001-(next.pose[key]-current.pose[key])/.0001)<.04,key+' velocity');
    }
    assert.equal(current.state.reaction,null);assert.equal(current.state.gesture,'celebration');
    advance(director,4);assert.equal(director.getState().activity,'reading');assert.equal(director.getState().gesture,null);
  }
});

test('manual feedback replaces a pending automatic cue and respects reduced motion and visibility',()=>{
  const d=createHintSceneDirector({context:{room:'home',phase:'waiting',revealing:true}});advance(d,2);
  d.setContext({phase:'reading',revealing:false});assert.equal(d.playGesture('celebration',{interrupt:true}),true);
  advance(d,4);assert.equal(d.getState().gesture,null);
  d.setMotionPolicy({reduced:true});assert.equal(d.playGesture('nod',{interrupt:true}),false);
  d.setMotionPolicy({reduced:false,visible:false});assert.equal(d.playGesture('nod',{interrupt:true}),false);
});

test('hidden scenes reject taps and discard stale cues without losing a running pose',()=>{
  const director=createHintSceneDirector({context:{room:'ask',phase:'thinking'}});advance(director,2);
  director.setContext({phase:'reading'});director.setMotionPolicy({visible:false});
  assert.equal(director.react(),false);assert.equal(director.playGesture('present-card'),false);
  director.setMotionPolicy({visible:true});advance(director,2);assert.equal(director.getState().gesture,null);
  director.playGesture('present-card');advance(director,1);director.setMotionPolicy({visible:false});
  const pose=director.sample().pose;advance(director,20);assert.deepEqual(director.sample().pose,pose);
  director.setMotionPolicy({visible:true});assert.deepEqual(director.sample().pose,pose);
  advance(director,3);assert.equal(director.getState().gesture,null);
});

test('the onboarding letter never leaks into Home or conversation gestures',()=>{
  const director=createHintSceneDirector({context:{room:'welcome'}});
  director.setContext({room:'profile'});assert.equal(director.sample().letter,'held');
  director.setContext({room:'home'});assert.equal(director.sample().letter,'delivered');
  advance(director,3);director.setContext({room:'ask',phase:'thinking'});
  assert.equal(director.sample().letter,'delivered');
});

test('speech follows playback while connection and preparation remain waiting',()=>{
  for(const phase of ['starting','listening','thinking','preparing','speaking','paused','error'])for(const audioPlaying of [false,true]){
    const state=describeHintContext({room:'voice',phase,audioPlaying});
    assert.equal(state.speaking,phase==='speaking'&&audioPlaying);
    assert.equal(state.activity==='speaking',phase==='speaking'&&audioPlaying);
  }
  assert.equal(describeHintContext({room:'home',phase:'speaking',audioPlaying:true}).speaking,false);
  const director=createHintSceneDirector({context:{room:'voice',phase:'speaking',audioPlaying:true}});
  advance(director,1.2);assert.ok(director.sample().pose.speech>.3);
  director.setContext({audioPlaying:false});assert.equal(director.sample().pose.speech,0);
  advance(director,2);assert.equal(director.getState().activity,'waiting');
});

test('Ask response playback speaks only while audio is audible and keeps its avatar placement',()=>{
  for(const phase of ['reading','thinking','preparing','speaking','error'])for(const audioPlaying of [false,true]){
    const state=describeHintContext({room:'ask',phase,audioPlaying,hasMessages:true});
    assert.equal(state.speaking,phase==='speaking'&&audioPlaying);
    assert.equal(state.activity==='speaking',phase==='speaking'&&audioPlaying);
    assert.equal(state.placement,'avatar');
  }
  const director=createHintSceneDirector({context:{room:'ask',phase:'reading',hasMessages:true}});
  advance(director,2);director.setContext({phase:'preparing'});advance(director,1);
  assert.equal(director.getState().activity,'waiting');assert.equal(director.sample().pose.speech,0);
  director.setContext({phase:'speaking',audioPlaying:true});advance(director,1.2);
  assert.ok(director.sample().pose.speech>.3);
  director.setContext({phase:'reading',audioPlaying:false});assert.equal(director.sample().pose.speech,0);
  advance(director,1);assert.equal(director.getState().activity,'reading');
});

test('activity and actor transitions retain position and incoming velocity',()=>{
  const director=createHintSceneDirector();advance(director,1.8);
  const changes=[{phase:'thinking',hasMessages:true},{room:'voice',phase:'listening'},{phase:'thinking'},{phase:'preparing'},{phase:'speaking',audioPlaying:true},{phase:'listening',audioPlaying:false},{room:'away'},{room:'ask',phase:'reading'}];
  for(const context of changes){
    advance(director,.32);const previous=director.sample();director.advance(.0001);const before=director.sample();
    director.setContext(context);const current=director.sample();director.advance(.0001);const next=director.sample();
    for(const key of ['x','y','width','height']){
      assert.ok(Math.abs(before.actor[key]-current.actor[key])<1e-9,`${key} position`);
      const left=(before.actor[key]-previous.actor[key])/.0001,right=(next.actor[key]-current.actor[key])/.0001;
      assert.ok(Math.abs(left-right)<.03,`${key} velocity ${left} -> ${right}`);
    }
    for(const key of ['headYaw','headRoll','headPitch','pawThink','pawOpen','roll']){
      assert.ok(Math.abs(before.pose[key]-current.pose[key])<1e-8,`${key} pose`);
      const left=(before.pose[key]-previous.pose[key])/.0001,right=(next.pose[key]-current.pose[key])/.0001;
      assert.ok(Math.abs(left-right)<.08,`${key} pose velocity ${left} -> ${right}`);
    }
  }
});

test('repeated context updates do not replay the entry or restart a held activity',()=>{
  const director=createHintSceneDirector({context:{room:'voice',phase:'listening'}});
  for(let i=0;i<120;i++){advance(director,.5);assert.equal(director.setContext({room:'voice',phase:'listening'}),false);}
  assert.equal(director.getState().phase,'holding');assert.ok(director.getState().activityTime>59.9);
  assert.ok(director.sample().pose.pawOpen>.99);assert.ok(director.sample().pose.attention>.99);
  director.setContext({phase:'thinking'});advance(director,60);
  assert.equal(director.getState().phase,'holding');assert.ok(director.sample().pose.pawThink>.99);
});

test('pause, hidden policy, reduced motion and destroy stop time independently',()=>{
  const director=createHintSceneDirector();advance(director,2);director.pause();const paused=director.sample();
  director.setMotionPolicy({visible:false});advance(director,10);director.setMotionPolicy({visible:true});advance(director,10);assert.deepEqual(director.sample(),paused);
  director.resume();advance(director,.5);assert.ok(director.getState().clock>paused.state.clock);
  director.setContext({room:'voice',phase:'paused'});const voiceClock=director.getState().clock;advance(director,10);assert.equal(director.getState().clock,voiceClock);
  director.setContext({phase:'listening'});advance(director,1);director.setMotionPolicy({reduced:true});const reduced=director.sample();advance(director,10);assert.deepEqual(director.sample(),reduced);
  director.destroy();const destroyed=director.sample();advance(director,10);assert.deepEqual(director.sample(),destroyed);assert.equal(director.setContext({phase:'thinking'}),false);
});

test('rapid room changes keep a finite short-paw pose and a positive square actor',()=>{
  const director=createHintSceneDirector();director.setViewport(430,810);
  const contexts=[{room:'ask',phase:'idle',hasMessages:false},{room:'ask',phase:'thinking',hasMessages:true},{room:'voice',phase:'listening'},{room:'voice',phase:'speaking',audioPlaying:true},{room:'away',phase:'idle',audioPlaying:false}];
  for(let i=0;i<400;i++){
    if(i%3===0)director.setContext(contexts[i/3%contexts.length|0]);
    director.advance(1/60);const frame=director.sample();
    assert.ok(frame.actor.width>.1&&frame.actor.width<1.1,`width ${frame.actor.width}`);
    assert.ok(Math.abs(frame.actor.height/frame.actor.width-430/810)<1e-9);
    for(const value of Object.values(frame.pose))assert.ok(Number.isFinite(value));
    for(const key of ['pawThink','pawOpen','pawCelebrate','pawReach'])assert.ok(frame.pose[key]>-.06&&frame.pose[key]<1.06,`${key}: ${frame.pose[key]}`);
  }
});

test('a tap reacts once and leaves the sustained activity running',()=>{
  const director=createHintSceneDirector({context:{room:'voice',phase:'thinking'}});advance(director,2);
  assert.equal(director.react(),true);assert.equal(director.react(),false);advance(director,.65);
  assert.equal(director.sample().pose.eyeRight,1);assert.equal(director.sample().pose.eyeLeft,0);assert.ok(director.sample().pose.pawThink>.99);
  advance(director,1.3);assert.equal(director.getState().reaction,null);assert.ok(director.getState().activityTime>3.9);
  assert.equal(director.react(),true);assert.equal(director.getState().reaction,'wink-right');
});

test('page anchors preserve motion while scrolling stays attached to the content',()=>{
  const director=createHintSceneDirector();advance(director,2);
  const before=director.sample();director.setAnchor({x:.3,y:.2,width:.3});
  assert.deepEqual(director.sample().actor,before.actor);
  advance(director,.3);const moving=director.sample();
  director.setAnchor({x:.3,y:.1,width:.3},{followLayout:true});
  const scrolled=director.sample();
  assert.ok(Math.abs(scrolled.actor.y-moving.actor.y+.1)<1e-9);
  assert.equal(scrolled.actor.width,moving.actor.width);
  advance(director,1);assert.ok(Math.abs(director.sample().actor.x-.15)<1e-9);
  assert.equal(director.setAnchor({x:.3,y:.1,width:.3}),false);
  assert.equal(director.setAnchor({x:NaN,y:.1,width:.3}),false);
  director.setMotionPolicy({reduced:true});director.setAnchor({x:.2,y:.2,width:.2});
  assert.equal(director.getState().transitioning,false);
  assert.ok(Math.abs(director.sample().actor.x-.1)<1e-9);
});

test('the first introduction reaches the wave, reacts, then returns to a held letter',()=>{
  const director=createHintSceneDirector({context:{room:'welcome',introduction:true}});
  director.setAnchor({x:.5,y:.48,width:.8});director.setViewport(390,844);
  assert.equal(director.sample().intro.phase,'flight');assert.equal(director.sample().intro.actor.opacity,0);
  advance(director,3);assert.equal(director.sample().intro.phase,'peek');assert.equal(director.react(),false);
  advance(director,1.55);assert.equal(director.sample().intro.phase,'welcome');assert.equal(director.react(),true);
  advance(director,.5);assert.ok(director.sample().pose.pawWave>0);
  advance(director,5);assert.equal(director.getState().phase,'holding');assert.equal(director.getState().letter,'held');
  director.setContext({room:'profile'});advance(director,1);director.setContext({room:'welcome'});
  assert.equal(director.sample().intro,null);
});

test('continuing during the introduction carries position and velocity into the form',()=>{
  for(const seconds of [0,.2,2.9,3.7,4.6,6]){
    const director=createHintSceneDirector({context:{room:'welcome'}});director.setViewport(390,844);director.setAnchor({x:.5,y:.48,width:.8});
    advance(director,seconds);const previous=director.sample();director.advance(.0001);const before=director.sample();
    director.setContext({room:'profile'});director.setAnchor({x:.86,y:.08,width:.2});
    const current=director.sample();director.advance(.0001);const after=director.sample();
    for(const key of ['x','y','width']){
      assert.ok(Math.abs(current.actor[key]-before.actor[key])<1e-9,`${seconds} ${key} position`);
      const left=(before.actor[key]-previous.actor[key])/.0001,right=(after.actor[key]-current.actor[key])/.0001;
      assert.ok(Math.abs(left-right)<.05,`${seconds} ${key} velocity ${left} ${right}`);
    }
    assert.equal(current.letter,'held');advance(director,1.2);assert.equal(director.sample().intro,null);
    assert.ok(Math.abs(director.sample().actor.width-.2)<1e-9);
  }
});

test('reduced motion and a return visit omit the full star flight',()=>{
  const reduced=createHintSceneDirector({context:{room:'welcome'}});reduced.setMotionPolicy({reduced:true});
  assert.equal(reduced.sample().intro,null);assert.equal(reduced.getState().letter,'held');assert.equal(reduced.getState().transitioning,false);
  const returning=createHintSceneDirector({context:{room:'welcome',introduction:false}});
  assert.equal(returning.sample().intro.phase,'welcome');assert.equal(returning.sample().intro.skyFade,1);
});

test('app reactions follow actual request and daily reveal transitions',()=>{
  assert.equal(gestureForContext({room:'ask',phase:'thinking'},{room:'ask',phase:'reading'}),'acknowledge');
  assert.equal(gestureForContext({room:'ask',phase:'reading'},{room:'ask',phase:'reading'}),null);
  assert.equal(gestureForContext({room:'ask',phase:'thinking'},{room:'ask',phase:'error'}),'reassure');
  assert.equal(gestureForContext({room:'ask',phase:'error'},{room:'ask',phase:'error'}),null);
  assert.equal(gestureForContext({room:'away',phase:'idle'},{room:'home',phase:'reading'}),null,'reloading a saved card is not a new reveal');
  assert.equal(gestureForContext({room:'home',phase:'waiting',revealing:true},{room:'home',phase:'reading',revealing:false}),'present-card');
  assert.equal(gestureForContext({room:'home',phase:'waiting',revealing:false},{room:'home',phase:'reading',revealing:false}),null,'loading a cached receipt does not replay a reveal');
});

test('routine typing and layout context changes preserve an active gesture',()=>{
  const director=createHintSceneDirector({context:{room:'ask',phase:'reading',hasMessages:true}});
  advance(director,2);assert.equal(director.playGesture('acknowledge'),true);advance(director,.8);
  const before=director.sample();director.setContext({keyboardOpen:true,typing:true});const after=director.sample();
  assert.equal(after.state.gesture,'acknowledge');assert.equal(after.gestureTime,before.gestureTime);
  assert.deepEqual(after.pose,before.pose);
});

test('automatic gestures play once and obsolete requests never surface in another room',()=>{
  const completed=[];
  const director=createHintSceneDirector({context:{room:'ask',phase:'thinking',hasMessages:true},onComplete:e=>completed.push(e.gesture)});
  advance(director,2);director.setContext({phase:'reading'});advance(director,4);
  assert.deepEqual(completed,['acknowledge']);
  director.setContext({typing:true});advance(director,5);assert.deepEqual(completed,['acknowledge']);
  director.setContext({phase:'error'});director.setContext({room:'voice',phase:'listening'});advance(director,5);
  assert.deepEqual(completed,['acknowledge']);
});

test('reduced motion discards queued reactions without replaying them on resume',()=>{
  const director=createHintSceneDirector({context:{room:'ask',phase:'thinking'}});advance(director,2);
  director.setContext({phase:'reading'});director.setMotionPolicy({reduced:true});advance(director,10);
  director.setMotionPolicy({reduced:false});advance(director,2);assert.equal(director.getState().gesture,null);
});

test('new reactions enter and leave sustained poses without visible position jumps',()=>{
  for(const phase of ['idle','listening','thinking','reading'])for(const id of ['welcome-back','acknowledge','reassure','present-card']){
    const director=createHintSceneDirector({context:{room:phase==='reading'?'ask':'voice',phase}});advance(director,2);
    const before=director.sample();assert.equal(director.playGesture(id),true);const after=director.sample();
    for(const channel of ['headPitch','headYaw','headRoll','pawReach','pawThink','pawOpen','y','roll'])assert.ok(Math.abs(before.pose[channel]-after.pose[channel])<1e-9,`${id} ${channel}`);
    for(let i=0;i<600;i++){director.advance(1/120);const frame=director.sample();assert.ok(Object.values(frame.pose).every(Number.isFinite));}
    assert.equal(director.getState().gesture,null);assert.equal(director.getState().activity,phase);
  }
});
