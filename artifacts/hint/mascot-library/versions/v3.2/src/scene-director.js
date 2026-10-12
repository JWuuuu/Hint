import {clamp,ease,gestures,sampleActivity,sampleGesture,neutralPose,idleBlink,blendPose} from './motion.js';
import {applyJourneyReaction,sampleEntrance,WAVE_START,ENTRANCE_END} from './entrance-motion.js';

export function describeHintContext(context) {
  const voice=context.room==='voice';
  let activity='idle';
  if(voice){
    if(context.phase==='listening')activity='listening';
    else if(context.phase==='thinking')activity='thinking';
    else if(context.phase==='speaking'&&context.audioPlaying)activity='speaking';
    else if(['starting','preparing','speaking'].includes(context.phase))activity='waiting';
  }else if(context.phase==='thinking')activity='thinking';
  else if(context.phase==='reading')activity='reading';
  else if(context.hasMessages||context.typing)activity='waiting';
  const placement=context.room==='away'?'away':voice?'voice':context.room==='profile'||context.hasMessages||context.keyboardOpen?'avatar':'welcome';
  return {activity,placement,frozen:voice&&context.phase==='paused',speaking:voice&&context.phase==='speaking'&&Boolean(context.audioPlaying)};
}

const sceneTargets={
  welcome:{x:.5,y:.415,width:.82},avatar:{x:.16,y:.142,width:.26},
  voice:{x:.5,y:.4,width:.86},away:{x:1.3,y:.23,width:.58}
};
const drift=(seconds,duration=.22)=>{
  const u=clamp(seconds/duration);
  return duration*(u-2.5*u**4+3*u**5-u**6);
};
const numericMix=(a,b,t)=>a+(b-a)*t;

export function createHintSceneDirector(options={}) {
  let context={room:'ask',phase:'idle',hasMessages:false,keyboardOpen:false,typing:false,audioPlaying:false,...options.context};
  let description=describeHintContext(context),clock=0,manualPaused=false,reduced=false,visible=true,speed=1,destroyed=false;
  let activity={id:description.activity,start:0},gesture=null,reaction=null,nextWink='wink-left',poseTransition=null;
  let placement=description.placement,actorFrom={x:1.24,y:.22,width:.58},actorVelocity={x:0,y:0,width:0},actorAt=0,actorDuration=.95;
  let actorTarget={...sceneTargets[placement]},aspect=.5,look={x:0,y:0,targetX:0,targetY:0};
  let accentsVisible=true,entry=true;
  let introduction=null,introExit=null,introduced=false,letter='delivered';

  function beginIntroduction(){
    if(introduced)return;
    introduced=true;entry=false;letter='held';gesture=null;poseTransition=null;
    introduction={at:clock,offset:context.introduction===false?WAVE_START:0};
    if(reduced)introduction=null;
  }
  function introAt(time){return introduction?sampleEntrance(Math.max(0,time-introduction.at)+introduction.offset):null;}
  function introActor(time){
    const scene=introAt(time),a=scene.actor,scale=actorTarget.width/.8;
    return {x:actorTarget.x+(a.x-.5)*scale,y:actorTarget.y+(a.y-.505)*scale*aspect*2,width:a.width*scale};
  }

  function poseAt(time){
    if(introduction){
      const scene=introAt(time),pose=scene.pose;
      pose.y-=Math.sin(scene.time*1.3)*.0035*(1-pose.engage*.8);
      return pose;
    }
    const elapsed=Math.max(0,time-activity.start);
    let pose=gesture?sampleGesture(gesture.id,Math.max(0,time-gesture.start)):sampleActivity(activity.id,elapsed);
    if(poseTransition){
      const t=Math.max(0,time-poseTransition.at),u=ease(t/poseTransition.duration),from={...poseTransition.pose};
      for(const key of Object.keys(from))from[key]+=poseTransition.velocity[key]*drift(t);
      if(from.pawWave>0)from.waveTime=Math.min(4.5,poseTransition.pose.waveTime+t);
      pose=blendPose(from,pose,u);
    }
    if(!description.speaking)pose.speech=0;
    return pose;
  }
  function actorAtTime(time){
    if(introduction)return introActor(time);
    const t=Math.max(0,time-actorAt),u=ease(t/actorDuration),out={};
    for(const key of ['x','y','width'])out[key]=numericMix(actorFrom[key]+actorVelocity[key]*drift(t),actorTarget[key],u);
    const distance=Math.hypot(actorTarget.x-actorFrom.x,actorTarget.y-actorFrom.y);
    out.y-=Math.min(.05,distance*.09)*Math.sin(Math.PI*u);
    return out;
  }
  function capturePose(){
    const pose=poseAt(clock),previous=poseAt(Math.max(0,clock-.001)),velocity={};
    for(const key of Object.keys(pose))velocity[key]=poseTransition&&Math.abs(clock-poseTransition.at)<1e-8?poseTransition.velocity[key]:clock>0?(pose[key]-previous[key])/.001:0;
    return {pose,velocity};
  }
  function changeActivity(id,duration=.65){
    if(activity.id===id&&!gesture)return false;
    const source=capturePose();
    activity={id,start:clock};gesture=null;
    poseTransition=reduced?null:{...source,at:clock,duration};
    return true;
  }
  function changePlacement(next){
    if(placement===next)return;
    const current=actorAtTime(clock),previous=actorAtTime(Math.max(0,clock-.001));
    if(introduction||Math.abs(clock-actorAt)>1e-8)actorVelocity=Object.fromEntries(Object.keys(current).map(key=>[key,clock>0?(current[key]-previous[key])/.001:0]));
    actorFrom=current;actorTarget={...sceneTargets[next]};actorAt=clock;actorDuration=next==='away'?.55:.85;placement=next;
    if(reduced){actorFrom={...actorTarget};actorVelocity={x:0,y:0,width:0};actorAt=clock-actorDuration;}
  }
  function leaveIntroduction(){
    if(!introduction)return;
    const source=capturePose(),current=actorAtTime(clock),previous=actorAtTime(Math.max(0,clock-.001)),scene=introAt(clock);
    introExit={scene,at:clock,maskY:actorTarget.y+(scene.maskY-.505)*actorTarget.width/.8*aspect*2,
      logo:{x:actorTarget.x,y:actorTarget.y-.025*actorTarget.width/.8*aspect*2,width:actorTarget.width*140/312}};
    actorVelocity=Object.fromEntries(Object.keys(current).map(key=>[key,clock>0?(current[key]-previous[key])/.001:0]));
    introduction=null;actorFrom=current;actorTarget={...current};actorAt=clock;actorDuration=.85;
    poseTransition={...source,at:clock,duration:.85};
  }
  function snapshot(){
    return {context:{...context},activity:activity.id,activityTime:Math.max(0,clock-activity.start),clock,
      phase:introduction?'introduction':gesture?'gesture':poseTransition?'entering':entry?'arriving':'holding',placement,letter,
      gesture:gesture?.id??null,reaction:reaction?.id??null,paused:manualPaused||description.frozen,
      reducedMotion:reduced,visible,speed,transitioning:!reduced&&(Boolean(introduction)||Boolean(poseTransition)||clock-actorAt<actorDuration-1e-8),
      speaking:description.speaking,accentsVisible,destroyed};
  }
  function sample(){
    const state=snapshot(),pose=poseAt(clock),actor=actorAtTime(clock),intro=introAt(clock);
    const blink=reduced?0:idleBlink(clock)*(gesture?1-pose.engage:1);
    pose.eyeLeft=Math.max(pose.eyeLeft,blink);pose.eyeRight=Math.max(pose.eyeRight,blink);
    if(!reduced){const quiet=1-pose.engage*.8;pose.y+=Math.sin(clock*1.3)*.0035*quiet;pose.roll+=Math.sin(clock*.9)*.004*quiet;}
    let result=applyJourneyReaction(pose,reaction?{...reaction,time:clock-reaction.start}:null);
    if(entry&&!reduced){
      const landing=ease((clock-.65)/.3)*(1-ease((clock-.95)/.25));
      result={...result,squash:result.squash+.011*landing,scarfLag:-.12*Math.sin(Math.PI*ease(clock/.95))};
    }
    if(!accentsVisible){result.question=0;result.sparkles=0;}
    const follow=clamp(1-result.engage)*.28;
    const frame={x:actor.x-actor.width/2,y:actor.y-actor.width*aspect/2,width:actor.width,height:actor.width*aspect};
    let introductionFrame=intro?{...intro,maskY:actorTarget.y+(intro.maskY-.505)*actorTarget.width/.8*aspect*2,
      logo:{x:actorTarget.x,y:actorTarget.y-.025*actorTarget.width/.8*aspect*2,width:actorTarget.width*140/312}}:null;
    if(!intro&&introExit){
      const elapsed=clock-introExit.at,source=introExit.scene;
      introductionFrame={...source,phase:'moving-to-profile',time:source.time+elapsed,
        skyFade:numericMix(source.skyFade,1,ease(elapsed/.3)),logoOpacity:source.logoOpacity*(1-ease(elapsed/.22)),bubble:source.bubble*(1-ease(elapsed/.16)),
        actor:{opacity:numericMix(source.actor.opacity,1,ease(elapsed/.3)),front:source.actor.front||frame.y+frame.height*.62<introExit.maskY},
        maskY:introExit.maskY,logo:introExit.logo};
    }
    return {state,pose:result,actor:frame,letter,intro:introductionFrame,
      look:{x:result.gazeX+look.x*follow,y:result.gazeY+look.y*follow},
      gesture:intro?.gesture??gesture?.id??activity.id,gestureTime:intro?.gestureTime??(gesture?clock-gesture.start:clock-activity.start),
      shadow:{x:actor.x,y:frame.y+frame.height*.89,width:actor.width*.29,opacity:placement==='away'?1-ease((clock-actorAt)/actorDuration):ease(clock/.8)}};
  }
  const api={
    setAnchor(anchor,{followLayout=false}={}){
      if(destroyed||!anchor||!['x','y','width'].every(key=>Number.isFinite(anchor[key]))||anchor.width<=0)return false;
      if(['x','y','width'].every(key=>Math.abs(anchor[key]-actorTarget[key])<1e-7))return false;
      if(followLayout){
        for(const key of ['x','y','width']){actorFrom[key]+=anchor[key]-actorTarget[key];actorTarget[key]=anchor[key];}
      }else{
        const current=actorAtTime(clock),previous=actorAtTime(Math.max(0,clock-.001));
        if(introduction||Math.abs(clock-actorAt)>1e-8)actorVelocity=Object.fromEntries(Object.keys(current).map(key=>[key,clock>0?(current[key]-previous[key])/.001:0]));
        actorFrom=current;actorTarget={...anchor};actorAt=clock;actorDuration=.85;
      }
      if(reduced){actorFrom={...actorTarget};actorVelocity={x:0,y:0,width:0};actorAt=clock-actorDuration;}
      return true;
    },
    setContext(next){
      if(destroyed)return false;
      const merged={...context,...next};
      if(Object.keys(merged).every(key=>merged[key]===context[key]))return false;
      const target=describeHintContext(merged);
      if(introduction&&merged.room!=='welcome')leaveIntroduction();
      changeActivity(target.activity,target.activity==='thinking'?.9:target.activity==='listening'?.8:.6);
      context=merged;description=target;changePlacement(target.placement);
      if(context.room==='welcome')beginIntroduction();
      return true;
    },
    playGesture(id){
      if(destroyed||introduction||!gestures[id]||['offer-letter','deliver-letter'].includes(id)||gesture||reaction||manualPaused||description.frozen||reduced)return false;
      const source=capturePose();gesture={id,start:clock};poseTransition={...source,at:clock,duration:.26};return true;
    },
    react(){
      if(destroyed||reaction||manualPaused||description.frozen||reduced||entry||placement==='away'||introduction&&introAt(clock).time<WAVE_START)return false;
      const id=nextWink;reaction={id,start:clock,duration:gestures[id].duration};nextWink=id==='wink-left'?'wink-right':'wink-left';return true;
    },
    advance(seconds){
      if(destroyed||manualPaused||description.frozen||reduced||!visible||!Number.isFinite(seconds)||seconds<=0)return;
      const dt=Math.min(seconds,.1)*speed;clock+=dt;
      if(introExit&&clock-introExit.at>=.9)introExit=null;
      if(introduction&&introAt(clock).time>=ENTRANCE_END){
        leaveIntroduction();introExit=null;actorFrom={...actorTarget};actorVelocity={x:0,y:0,width:0};actorAt=clock-actorDuration;
      }
      if(entry&&clock>=1.2)entry=false;
      if(poseTransition&&clock-poseTransition.at>=poseTransition.duration)poseTransition=null;
      if(reaction&&clock-reaction.start>=reaction.duration)reaction=null;
      if(gesture&&clock-gesture.start>=gestures[gesture.id].duration){
        const id=gesture.id;const source=capturePose();gesture=null;
        poseTransition={...source,at:clock,duration:.5};options.onComplete?.({gesture:id});
      }
      const follow=1-Math.exp(-dt*7);look.x+=(look.targetX-look.x)*follow;look.y+=(look.targetY-look.y)*follow;
    },
    setMotionPolicy(policy){
      if('visible'in policy)visible=Boolean(policy.visible);
      if('reduced'in policy){
        reduced=Boolean(policy.reduced);
        if(reduced){introduction=null;introExit=null;gesture=null;reaction=null;poseTransition=null;entry=false;actorFrom={...actorTarget};actorVelocity={x:0,y:0,width:0};actorAt=clock-actorDuration;look={x:0,y:0,targetX:0,targetY:0};}
      }
    },
    setViewport(width,height){if(width>0&&height>0)aspect=width/height;},
    setPointer(x,y){look.targetX=clamp(x,-1,1);look.targetY=clamp(y,-1,1);},
    setAccentsVisible(value){accentsVisible=Boolean(value);},
    pause(){manualPaused=true;},resume(){manualPaused=false;},
    setSpeed(value){if(Number.isFinite(value))speed=clamp(value,.25,1);},
    getState:snapshot,sample,destroy(){destroyed=true;}
  };
  if(context.room==='welcome')beginIntroduction();
  return api;
}
