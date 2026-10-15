import { clamp, ease, gestures, activities, sampleGesture, sampleActivity, blendPose, neutralPose, idleBlink, HANDOFF_TIME } from './motion.js';
import { createRenderer } from './renderer.js';

export async function createHintMascot(canvas, options) {
  const renderer=await createRenderer(canvas,options.assets);
  const letterTarget={x:.49,y:.89,scale:1.18,angle:-.169,...options.letterTarget};
  renderer.setLetterTarget(letterTarget);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const state={gesture:'idle',activity:'idle',mode:'activity',time:0,activityTime:0,clock:0,active:false,paused:reduced.matches,letter:'held',speed:1,accentsVisible:true};
  const look={x:0,y:0,targetX:0,targetY:0};
  let raf=0,previous=0,visible=true,destroyed=false,transition=null,queuedActivity=null,handedOff=false;
  let currentPose=neutralPose(),currentBase=neutralPose(),lastPhase='';
  const duration=()=>gestures[state.gesture]?.duration||8;
  const isHandoff=()=>state.mode==='gesture'&&(state.gesture==='offer-letter'&&(state.active||state.letter==='offered')||state.gesture==='deliver-letter'&&state.active);
  function snapshot(){
    const phase=transition?transition.kind:state.mode==='activity'?'holding':state.letter==='offered'&&!state.active?'offered':state.active?'gesture':'settled';
    return {...state,duration:duration(),phase,transitioning:Boolean(transition),queuedActivity,reducedMotion:reduced.matches,visible:visible&&!document.hidden,letterOwner:state.letter==='delivered'?'reader':'mascot',letterTarget:{...letterTarget},handoffFired:handedOff};
  }
  function render(){
    let p=state.mode==='activity'?sampleActivity(state.activity,state.activityTime):sampleGesture(state.gesture,state.time);
    if(transition)p=blendPose(transition.from,p,ease(transition.elapsed/transition.duration));
    currentBase={...p};
    const idle=1-p.engage*.75;
    const blink=reduced.matches?0:idleBlink(state.clock)*(state.mode==='activity'||state.letter==='offered'?1:1-p.engage);
    p.eyeLeft=Math.max(p.eyeLeft,blink);p.eyeRight=Math.max(p.eyeRight,blink);
    p.x+=look.x*.003*(1-p.engage);p.y+=.008*Math.sin(state.clock*1.3)*idle;p.roll+=.007*Math.sin(state.clock*.9)*idle;
    const follow=clamp(1-p.engage*.96+p.attention*.38);
    const gaze={x:p.gazeX+look.x*follow,y:p.gazeY+look.y*follow};
    if(!state.accentsVisible){p.question=0;p.sparkles=0;}
    renderer.render(p,state.clock,gaze,state.letter,state.gesture,state.time);
    currentPose=p;canvas.dataset.time=state.time.toFixed(4);canvas.dataset.clip=state.gesture;canvas.dataset.letter=state.letter;
    const snap=snapshot();canvas.dataset.activity=state.activity;canvas.dataset.phase=snap.phase;options.onUpdate?.(snap,p);
    const phaseKey=snap.activity+':'+snap.phase;
    if(lastPhase!==phaseKey){lastPhase=phaseKey;options.onActivityChange?.({activity:snap.activity,phase:snap.phase});}
  }
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;previous=0;}
  function start(){if(!destroyed&&!raf&&!state.paused&&visible&&!document.hidden&&(state.active||transition||!reduced.matches))raf=requestAnimationFrame(tick);}
  function beginTransition(seconds,kind='entering'){transition={from:{...currentBase},elapsed:0,duration:seconds,kind};}
  function enterActivity(id){
    beginTransition(state.mode==='activity'&&state.activity==='idle'?(id==='thinking'?1.3:id==='listening'?1.1:.75):.6,id==='idle'?'exiting':'entering');
    state.activity=id;state.gesture=id;state.mode='activity';state.time=0;state.activityTime=0;state.active=false;
    if(reduced.matches){transition=null;state.paused=true;}
  }
  function tick(now){
    raf=0;
    if(destroyed||state.paused||!visible||document.hidden||!canvas.isConnected){previous=0;return;}
    const dt=previous?Math.min((now-previous)/1000,.04)*state.speed:0;previous=now;
    if(!reduced.matches)state.clock+=dt;
    if(transition){transition.elapsed+=dt;if(transition.elapsed>=transition.duration)transition=null;}
    if(state.mode==='activity'){state.activityTime+=dt;state.time=state.activityTime;}
    let completed=null,handoff=false;
    if(state.mode==='gesture'&&state.active){
      state.time=Math.min(duration(),state.time+dt);
      if(state.gesture==='deliver-letter'&&state.time>=HANDOFF_TIME&&!handedOff){handedOff=true;state.letter='delivered';handoff=true;}
      if(state.time>=duration()){
        state.active=false;transition=null;
        if(state.gesture==='offer-letter')state.letter='offered';
        completed={gesture:state.gesture,letter:state.letter};
        if(state.gesture!=='offer-letter'){
          if(queuedActivity){const next=queuedActivity;queuedActivity=null;enterActivity(next);}
          else if(state.activity!=='idle')enterActivity(state.activity);
        }
        if(reduced.matches)state.paused=true;
      }
    }
    const weight=1-Math.exp(-dt*7);look.x+=(look.targetX-look.x)*weight;look.y+=(look.targetY-look.y)*weight;
    render();
    if(handoff)options.onLetterHandoff?.({letter:'delivered',target:{...letterTarget}});
    if(completed)options.onComplete?.(completed);
    start();
  }
  const onVisibility=()=>{stop();start();};
  const onReduced=()=>{state.paused=reduced.matches;stop();render();start();};
  const onPointer=event=>{
    if(event.pointerType==='touch')return;
    const b=canvas.getBoundingClientRect();look.targetX=clamp((event.clientX-b.left-b.width*.5)/(b.width*.6),-1,1);look.targetY=clamp((event.clientY-b.top-b.height*.45)/(b.height*.6),-1,1);
  };
  const onLeave=()=>{look.targetX=look.targetY=0;};
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;stop();start();});observer.observe(canvas);
  document.addEventListener('visibilitychange',onVisibility);reduced.addEventListener('change',onReduced);
  canvas.addEventListener('pointermove',onPointer);canvas.addEventListener('pointerleave',onLeave);
  const api={
    playGesture(id){
      if(!gestures[id]||id==='deliver-letter'||state.active||state.letter==='offered'||state.mode==='gesture'&&state.time>0&&state.time<duration())return false;
      if(id==='offer-letter'&&state.letter!=='held')return false;
      beginTransition(.3);state.gesture=id;state.mode='gesture';state.time=0;state.active=true;state.paused=false;
      stop();render();start();return true;
    },
    setActivity(id){
      if(!activities.includes(id)||state.mode==='activity'&&state.activity===id)return false;
      if(isHandoff()){queuedActivity=id;render();return true;}
      enterActivity(id);stop();render();start();return true;
    },
    acceptLetter(){
      if(state.letter!=='offered'||state.active||state.gesture!=='offer-letter'||state.time<duration())return false;
      state.gesture='deliver-letter';state.mode='gesture';state.time=0;state.active=true;state.paused=false;transition=null;handedOff=false;
      stop();render();start();return true;
    },
    resetScene(){
      Object.assign(state,{gesture:'idle',activity:'idle',mode:'activity',time:0,activityTime:0,clock:0,active:false,letter:'held',paused:reduced.matches});
      transition=null;queuedActivity=null;handedOff=false;look.x=look.y=look.targetX=look.targetY=0;stop();render();start();
    },
    pause(){state.paused=true;stop();render();},
    resume(){state.paused=reduced.matches&&state.mode==='activity';if(state.mode==='gesture'&&state.time<duration())state.active=true;stop();render();start();},
    seek(seconds){
      state.time=clamp(seconds,0,state.mode==='activity'?60:duration());state.active=false;state.paused=true;transition=null;
      if(state.mode==='activity')state.activityTime=state.time;
      if(state.gesture==='offer-letter')state.letter=state.time>=duration()?'offered':'held';
      if(state.gesture==='deliver-letter'){state.letter=state.time>=HANDOFF_TIME?'delivered':'offered';handedOff=state.time>=HANDOFF_TIME;}
      stop();render();
    },
    setSpeed(speed){if(Number.isFinite(speed)){state.speed=clamp(speed,.25,1.25);render();}},
    setAccentsVisible(value){state.accentsVisible=Boolean(value);render();},
    getState:snapshot,getPose(){return {...currentPose};},
    destroy(){destroyed=true;stop();observer.disconnect();renderer.destroy();document.removeEventListener('visibilitychange',onVisibility);reduced.removeEventListener('change',onReduced);canvas.removeEventListener('pointermove',onPointer);canvas.removeEventListener('pointerleave',onLeave);}
  };
  canvas.dataset.ready='true';render();start();return api;
}
