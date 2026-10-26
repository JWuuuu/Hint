import {clamp,ease,gestures,sampleActivity,sampleGesture,neutralPose,idleBlink,blendPose,samplePaws,blendPaws,pawVelocity,carryMotion} from './motion.js';
import {applyJourneyReaction,sampleEntrance,WAVE_START,ENTRANCE_END} from './entrance-motion.js';
import {sampleDailyDelivery,dailyDeliveryDuration} from './daily-delivery-motion.js';

export function describeHintContext(context) {
  const voice=context.room==='voice';
  const speaking=['voice','ask'].includes(context.room)&&context.phase==='speaking'&&Boolean(context.audioPlaying);
  let activity='idle';
  if(voice){
    if(context.phase==='listening')activity='listening';
    else if(context.phase==='thinking')activity='thinking';
    else if(context.phase==='speaking'&&context.audioPlaying)activity='speaking';
    else if(['starting','preparing','speaking'].includes(context.phase))activity='waiting';
  }else if(speaking)activity='speaking';
  else if(context.phase==='thinking')activity='thinking';
  else if(context.phase==='reading')activity='reading';
  else if(['waiting','starting','preparing','speaking'].includes(context.phase)||context.hasMessages||context.typing)activity='waiting';
  const placement=context.room==='away'?'away':voice?'voice':context.room==='profile'||context.hasMessages||context.keyboardOpen?'avatar':'welcome';
  return {activity,placement,frozen:voice&&context.phase==='paused',speaking};
}

// Reactions follow observable UI events, never guesses about the reader's mood.
export function gestureForContext(previous, next) {
  if (next.room === 'away' || next.room === 'welcome' || next.room === 'profile') return null;
  if (next.phase === 'error' && (previous.room !== next.room || previous.phase !== 'error')) return 'reassure';
  if (previous.room === next.room && previous.phase === 'thinking' && next.phase === 'reading') return 'acknowledge';
  if (next.room === 'home' && previous.room === 'home' && previous.revealing && !next.revealing && next.phase === 'reading') return 'present-card';
  if (['home', 'ask'].includes(next.room) && previous.room !== next.room && next.phase === 'idle' && !next.hasMessages) return 'welcome-back';
  return null;
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
  let activity={id:description.activity,start:0},gesture=null,reaction=null,nextWink='wink-left',poseTransition=null,queuedGesture=null;
  let placement=description.placement,actorFrom={x:1.24,y:.22,width:.58},actorVelocity={x:0,y:0,width:0},actorAt=0,actorDuration=.95;
  let actorTarget={...sceneTargets[placement]},aspect=.5,look={x:0,y:0,targetX:0,targetY:0};
  let accentsVisible=true,entry=true;
  let introduction=null,introExit=null,introduced=false,letter='delivered';
  let delivery=null,pawTransition=null;

  function captureDeliverySource(){
    const source=sample(),now=clock,elapsed=delivery?.time,epsilon=1e-5;
    clock=Math.max(0,now-epsilon);
    if(delivery?.ready&&!delivery.done)delivery.time=Math.max(0,elapsed-epsilon);
    const previous=sample();clock=now;if(delivery)delivery.time=elapsed;
    source.velocity=Object.fromEntries(['actor','pose','look'].map(part=>[part,
      Object.fromEntries(Object.keys(source[part]).map(key=>[key,now>0?(source[part][key]-previous[part][key])/epsilon:0]))]));
    if(source.paws)source.pawVelocity=pawVelocity(source.paws,previous.paws,epsilon);
    return source;
  }

  function deliveryFrame(){
    if(!delivery||!delivery.ready||delivery.done||!options.letterGeometry)return null;
    const home={x:actorTarget.x-actorTarget.width/2,y:actorTarget.y-actorTarget.width*aspect/2,width:actorTarget.width,height:actorTarget.width*aspect};
    return sampleDailyDelivery({time:delivery.time,clock,source:delivery.source,card:delivery.card,home,aspect,geometry:options.letterGeometry});
  }
  function finishDelivery(){
    const frame=deliveryFrame()?captureDeliverySource():null;
    if(frame){
      actorFrom={x:frame.actor.x+frame.actor.width/2,y:frame.actor.y+frame.actor.height/2,width:frame.actor.width};
      actorVelocity={x:frame.velocity.actor.x+frame.velocity.actor.width/2,y:frame.velocity.actor.y+frame.velocity.actor.height/2,width:frame.velocity.actor.width};actorAt=clock;actorDuration=.65;
      poseTransition={pose:frame.pose,velocity:frame.velocity.pose,at:clock,duration:.65};
      if(frame.paws)pawTransition={paws:frame.paws,velocity:frame.pawVelocity,at:clock,duration:.65};
    }
    if(delivery)delivery.done=true;
    letter='delivered';
  }

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
      return ambientPose(pose,time);
    }
    const elapsed=Math.max(0,time-activity.start);
    let pose=ambientPose(gesture?sampleGesture(gesture.id,Math.max(0,time-gesture.start)):sampleActivity(activity.id,elapsed),time);
    if(poseTransition){
      const t=Math.max(0,time-poseTransition.at),u=ease(t/poseTransition.duration),from=carryMotion(poseTransition.pose,poseTransition.velocity,drift(t));
      if(from.pawWave>0)from.waveTime=Math.min(4.5,poseTransition.pose.waveTime+t);
      pose=blendPose(from,pose,u);
      // Clip clocks are not pose coordinates. Replaying a wave must not sweep
      // backward through its drawings; its captured silhouette blends separately.
      if(pawTransition&&gesture?.id==='welcome')pose.waveTime=Math.max(0,time-gesture.start);
    }
    if(!description.speaking)pose.speech=0;
    return pose;
  }
  function ambientPose(pose,time){
    const blink=reduced?0:idleBlink(time)*(gesture?1-pose.engage:1);
    pose.eyeLeft=Math.max(pose.eyeLeft,blink);pose.eyeRight=Math.max(pose.eyeRight,blink);
    if(!reduced){const quiet=1-pose.engage*.8;pose.y+=Math.sin(time*1.3)*.0035*quiet;pose.roll+=Math.sin(time*.9)*.004*quiet;}
    return pose;
  }
  function withPaws(frame,transition=pawTransition,elapsed=transition?clock-transition.at:0){
    const bundle=options.pawGeometry;
    if(!bundle)return frame;
    frame.paws=samplePaws(bundle.letterGeometry,frame.gesture,frame.gestureTime,frame.letter,bundle.expressionGeometry,frame.pose,bundle.geometry);
    if(transition&&elapsed<transition.duration)frame.paws=blendPaws(transition.paws,frame.paws,ease(elapsed/transition.duration),transition.velocity,Math.max(0,elapsed));
    return frame;
  }
  function actorAtTime(time){
    if(introduction)return introActor(time);
    const t=Math.max(0,time-actorAt),u=ease(t/actorDuration),out={};
    for(const key of ['x','y','width'])out[key]=numericMix(actorFrom[key]+actorVelocity[key]*drift(t),actorTarget[key],u);
    const distance=Math.hypot(actorTarget.x-actorFrom.x,actorTarget.y-actorFrom.y);
    out.y-=Math.min(.05,distance*.09)*Math.sin(Math.PI*u);
    return out;
  }
  function capturePose(includeReaction=false){
    const at=time=>includeReaction&&reaction?applyJourneyReaction(poseAt(time),{...reaction,time:Math.max(0,time-reaction.start)}):poseAt(time);
    const epsilon=includeReaction?1e-5:.001;
    const pose=at(clock),previous=at(Math.max(0,clock-epsilon)),velocity={};
    for(const key of Object.keys(pose))velocity[key]=poseTransition&&Math.abs(clock-poseTransition.at)<1e-8?poseTransition.velocity[key]:clock>0?(pose[key]-previous[key])/epsilon:0;
    return {pose,velocity};
  }
  function changeActivity(id,duration=.65,force=false){
    if(activity.id===id&&!force)return false;
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
      phase:delivery&&!delivery.done?'delivery':introduction?'introduction':gesture?'gesture':poseTransition?'entering':entry?'arriving':'holding',placement,letter,
      gesture:gesture?.id??null,reaction:reaction?.id??null,paused:manualPaused||description.frozen,
      reducedMotion:reduced,visible,speed,transitioning:!reduced&&(Boolean(introduction)||Boolean(poseTransition)||clock-actorAt<actorDuration-1e-8),
      speaking:description.speaking,accentsVisible,destroyed};
  }
  function sample(){
    const delivering=deliveryFrame();
    const deliveryState=delivery?{key:delivery.key,phase:delivery.done?'ready':delivering?.phase??'loading',time:delivery.time,handoff:delivery.done?1:delivering?.letterScene?.handoff??0}:null;
    if(delivering){
      const {actor,pose,look,letterScene,gesture,gestureTime,letter:held}=delivering;
      const source=delivery.source;
      return withPaws({state:snapshot(),pose,actor,look,letter:held,letterScene,gesture,gestureTime,intro:null,delivery:deliveryState,
        shadow:{x:actor.x+actor.width/2,y:actor.y+actor.height*.89,width:actor.width*.29,opacity:1}},
        source.paws?{paws:source.paws,velocity:source.pawVelocity,duration:.65}:null,delivery.time);
    }
    const state=snapshot(),pose=poseAt(clock),actor=actorAtTime(clock),intro=introAt(clock);
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
    return withPaws({state,pose:result,actor:frame,letter,intro:introductionFrame,delivery:deliveryState,
      look:{x:result.gazeX+look.x*follow,y:result.gazeY+look.y*follow},
      gesture:intro?.gesture??gesture?.id??activity.id,gestureTime:intro?.gestureTime??(gesture?clock-gesture.start:clock-activity.start),
      shadow:{x:actor.x,y:frame.y+frame.height*.89,width:actor.width*.29,opacity:placement==='away'?1-ease((clock-actorAt)/actorDuration):ease(clock/.8)}});
  }
  const api={
    setDelivery(value){
      if(destroyed)return;
      if(!value){finishDelivery();delivery=null;return;}
      if(delivery?.key!==value.key){
        finishDelivery();delivery=null;
        const source=captureDeliverySource();
        gesture=null;reaction=null;queuedGesture=null;entry=false;
        delivery={...value,source,time:0,done:false};
      }else {
        if(!delivery.ready&&value.ready)delivery.source=captureDeliverySource();
        Object.assign(delivery,{card:value.card,ready:value.ready});
      }
      if(value.done||reduced||!options.letterGeometry)finishDelivery();
    },
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
      if(delivery&&merged.room!=='home'){finishDelivery();delivery=null;}
      const roomChanged=context.room!==merged.room,phaseChanged=context.phase!==merged.phase;
      const cue=gestureForContext(context,merged);
      if(roomChanged||phaseChanged)queuedGesture=null;
      if(introduction&&merged.room!=='welcome')leaveIntroduction();
      changeActivity(target.activity,target.activity==='thinking'?.9:target.activity==='listening'?.8:.6,roomChanged);
      context=merged;description=target;changePlacement(target.placement);
      if(context.room==='welcome')beginIntroduction();
      if(!['welcome','profile'].includes(context.room))letter='delivered';
      if(cue&&!reduced&&visible)queuedGesture={id:cue,after:clock+(roomChanged?.9:.2),expires:clock+4};
      return true;
    },
    playGesture(id,{interrupt=false}={}){
      if(destroyed||delivery&&!delivery.done||!visible||placement==='away'||introduction||!gestures[id]||['offer-letter','deliver-letter'].includes(id)||gesture&&!interrupt||reaction&&!interrupt||manualPaused||description.frozen||reduced)return false;
      const source=capturePose(interrupt);
      const pawSource=options.pawGeometry&&(source.pose.pawWave>0||id==='welcome'||pawTransition)?captureDeliverySource():null;
      if(interrupt)reaction=null;
      queuedGesture=null;gesture={id,start:clock};poseTransition={...source,at:clock,duration:.26};
      if(pawSource)pawTransition={paws:pawSource.paws,velocity:pawSource.pawVelocity,at:clock,duration:.38};
      return true;
    },
    react(){
      if(destroyed||delivery&&!delivery.done||!visible||reaction||manualPaused||description.frozen||reduced||entry||placement==='away'||introduction&&introAt(clock).time<WAVE_START)return false;
      const id=nextWink;reaction={id,start:clock,duration:gestures[id].duration};nextWink=id==='wink-left'?'wink-right':'wink-left';return true;
    },
    advance(seconds){
      if(destroyed||manualPaused||description.frozen||reduced||!visible||!Number.isFinite(seconds)||seconds<=0)return;
      const dt=Math.min(seconds,.1)*speed;clock+=dt;
      if(delivery?.ready&&!delivery.done)delivery.time=Math.min(dailyDeliveryDuration,delivery.time+dt);
      if(introExit&&clock-introExit.at>=.9)introExit=null;
      if(introduction&&introAt(clock).time>=ENTRANCE_END){
        leaveIntroduction();introExit=null;actorFrom={...actorTarget};actorVelocity={x:0,y:0,width:0};actorAt=clock-actorDuration;
      }
      if(entry&&clock>=1.2)entry=false;
      if(poseTransition&&clock-poseTransition.at>=poseTransition.duration)poseTransition=null;
      if(pawTransition&&clock-pawTransition.at>=pawTransition.duration)pawTransition=null;
      if(reaction&&clock-reaction.start>=reaction.duration)reaction=null;
      if(gesture&&clock-gesture.start>=gestures[gesture.id].duration){
        const id=gesture.id;const source=capturePose();gesture=null;
        poseTransition={...source,at:clock,duration:.5};options.onComplete?.({gesture:id});
      }
      if(queuedGesture&&clock>=queuedGesture.expires)queuedGesture=null;
      if(queuedGesture&&clock>=queuedGesture.after&&!entry&&!introduction&&!gesture&&!reaction&&!poseTransition){
        const cue=queuedGesture;queuedGesture=null;api.playGesture(cue.id);
      }
      const follow=1-Math.exp(-dt*7);look.x+=(look.targetX-look.x)*follow;look.y+=(look.targetY-look.y)*follow;
    },
    setMotionPolicy(policy){
      if('visible'in policy){visible=Boolean(policy.visible);if(!visible)queuedGesture=null;}
      if('reduced'in policy){
        reduced=Boolean(policy.reduced);
        if(reduced&&delivery)finishDelivery();
        if(reduced){introduction=null;introExit=null;gesture=null;reaction=null;poseTransition=null;pawTransition=null;queuedGesture=null;entry=false;actorFrom={...actorTarget};actorVelocity={x:0,y:0,width:0};actorAt=clock-actorDuration;look={x:0,y:0,targetX:0,targetY:0};}
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
