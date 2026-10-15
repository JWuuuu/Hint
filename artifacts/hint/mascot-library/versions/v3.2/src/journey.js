import { createRenderer } from './renderer.js';
import { createJourneySky } from './sky.js';
import { sampleEntrance, sampleProfileTransition, applyJourneyReaction, ENTRANCE_END } from './entrance-motion.js';
import { ease, clamp, blendPose, sampleGesture, idleBlink, gestures } from './motion.js';
import { sampleLetterScene, createLetterAnchor, heldPaperPoint, letterSceneTiming } from './letter-scene-motion.js';
import { sampleEnvelope, HANDOFF_TIME } from './motion.js';

export async function createHintJourney(root,options) {
  const find=selector=>root.querySelector(selector);
  const stage=find('[data-stage]'),canvas=find('[data-actor-canvas]'),actor=find('[data-actor]');
  find('[data-fallback]').src=options.assets.images['approved-rest'];
  const logo=find('[data-logo]'),bubble=find('[data-bubble]'),welcome=find('[data-welcome]'),profile=find('[data-profile]');
  const shadow=find('[data-shadow]'),sky=createJourneySky(find('[data-sky]')),media=matchMedia('(prefers-reduced-motion: reduce)');
  const state={mode:'entrance',time:0,elapsed:0,clock:0,speed:1,paused:false,ready:false,reduced:media.matches,visible:!document.hidden,letter:'held',letterPhase:'offer',letterTime:0,accepted:false,handoff:false,flipped:false,flipTime:0};
  let renderer=null,raf=0,last=0,disposed=false,intersecting=true,from=null,scene=sampleEntrance(0),reaction=null;
  let width=390,height=780,lastPhase='',completed=false;
  let dailyFrom=null,letterAnchor=null,dailyCompleted=false,nextWink='wink-left';
  const pointer={x:0,y:0,targetX:0,targetY:0};
  const listeners=[];
  const on=(node,type,fn)=>{node.addEventListener(type,fn);listeners.push(()=>node.removeEventListener(type,fn));};
  const snapshot=()=>({...state,phase:scene.phase,actor:{...scene.actor},pose:{...scene.pose},reaction:reaction?.id??null});
  const toFrame=a=>({x:a.x-a.width/2,y:a.y-a.width*width/height/2,width:a.width,height:a.width*width/height});
  function sample(){
    let result;
    if(state.mode==='daily'){
      const letter=sampleLetterScene(state.letterPhase,state.letterTime,state.clock,letterAnchor,options.assets.letterGeometry),u=ease(state.elapsed/1.2);
      const source=sampleProfileTransition(dailyFrom.profileFrom,dailyFrom.profileElapsed+state.elapsed);
      if(dailyFrom.profileElapsed+state.elapsed>=.9){source.pose.eyeLeft=source.pose.eyeRight=state.reduced?0:idleBlink(state.clock);source.pose.y+=Math.sin(state.clock*1.3)*.0035;}
      source.pose=applyJourneyReaction(source.pose,dailyFrom.reaction,state.elapsed);
      const begin=toFrame(source.actor),target=letter.actor;
      const frame=Object.fromEntries(Object.keys(target).map(key=>[key,begin[key]+(target[key]-begin[key])*u]));
      frame.y-=.035*Math.sin(Math.PI*u);
      const nod=sampleGesture('nod',Math.min(state.elapsed,2.1));
      letter.pose=blendPose(blendPose(source.pose,nod,ease(state.elapsed/.22)),letter.pose,ease((state.elapsed-.65)/.55));
      letter.look={x:letter.pose.gazeX,y:letter.pose.gazeY};letter.actor=frame;
      if(state.elapsed<1.2){const envelope=sampleEnvelope('offer-letter',0,'held',options.assets.letterGeometry);letter.point=(x,y)=>heldPaperPoint(x,y,envelope,letter.pose,state.clock,letter.look,frame);}
      letter.flip=state.flipped?ease(state.flipTime/letterSceneTiming.flip):0;
      result={phase:state.elapsed<1.2?'moving-to-daily':letter.phase,pose:letter.pose,gesture:letter.gesture,gestureTime:letter.gestureTime,
        actor:{x:frame.x+frame.width/2,y:frame.y+frame.height/2,width:frame.width,opacity:1,front:true},letterScene:letter,
        skyFade:1,logoOpacity:0,brand:1,content:1-ease(state.elapsed/.22),welcomeContent:0,
        shadow:{opacity:.1*u,scale:letter.shadow,x:frame.x+frame.width*.5,y:frame.y+frame.height*.88},
        bubble:state.letterPhase==='offer'?ease((state.letterTime-1.7)/.5):1-ease(state.letterTime/.28)};
    }else result=state.mode==='entrance'?sampleEntrance(state.time):sampleProfileTransition(from,state.elapsed);
    if(state.mode==='profile'&&state.elapsed>=.9){
      result.pose.eyeLeft=result.pose.eyeRight=state.reduced?0:idleBlink(state.clock);
      result.pose.y+=Math.sin(state.clock*1.3)*.0035;
    }
    result.pose=applyJourneyReaction(result.pose,reaction);
    return result;
  }
  function render(){
    scene=sample();
    const a=scene.actor,size=a.width*width,top=a.y*height-size/2;
    stage.dataset.phase=scene.phase;stage.dataset.mode=state.mode;
    actor.style.width=size+'px';actor.style.height=size+'px';
    actor.style.transform=`translate3d(${a.x*width-size/2}px,${top}px,0)`;
    actor.style.opacity=String(a.opacity);actor.style.zIndex=a.front?'4':'2';
    actor.style.clipPath=a.front?'none':`inset(0 0 ${Math.max(0,top+size-scene.maskY*height)}px 0)`;
    canvas.style.opacity=String(a.opacity);canvas.style.zIndex=a.front?'4':'2';
    canvas.style.clipPath=a.front?'none':`inset(0 0 ${(1-scene.maskY)*height}px 0)`;
    logo.style.opacity=String(scene.logoOpacity);logo.style.visibility=scene.logoOpacity>0?'visible':'hidden';
    logo.style.transform=`translate(-50%,-50%) scale(${.94+.06*ease((state.time-1.48)/.64)})`;
    sky.draw(state.time,scene.skyFade);
    shadow.style.opacity=String(scene.shadow.opacity);
    shadow.style.transform=`translate(-50%,-50%) scale(${scene.shadow.scale})`;
    shadow.style.left=(scene.shadow.x??.5)*100+'%';shadow.style.top=(scene.shadow.y??.657)*100+'%';
    bubble.style.opacity=String(scene.bubble);
    bubble.style.transform=`translate(-50%,${(1-scene.bubble)*8}px)`;
    welcome.style.opacity=String(scene.welcomeContent??scene.content);
    bubble.textContent=state.mode==='daily'?'This is for you.':'Hi, I’m Hint.';
    bubble.style.top=state.mode==='daily'?'17%':'22%';
    welcome.hidden=state.mode!=='entrance'&&state.elapsed>=.18;profile.hidden=state.mode==='entrance'||state.mode==='daily'&&state.elapsed>=.22;
    profile.style.opacity=String(scene.content);
    profile.style.transform=`translateY(${(1-scene.content)*12}px)`;
    find('[data-welcome-label]').style.opacity=String(scene.brand??scene.content);
    const daily=state.mode==='daily',cardReady=daily&&scene.phase==='card-ready';
    find('[data-daily-copy]').hidden=!daily;
    find('[data-daily-copy]').style.opacity=String(daily?ease((state.elapsed-.4)/.5)*(state.letterPhase==='offer'?1:1-ease(state.letterTime/.3)):0);
    find('[data-accept]').hidden=!daily||scene.phase!=='offered';find('[data-flip]').hidden=!cardReady||state.flipped;
    const reading=state.flipped?ease((state.flipTime-.43)/.35):0;
    find('[data-reading]').hidden=!daily||reading===0;find('[data-reading]').style.opacity=String(reading);
    if(state.fallback){
      find('[data-fallback]').src=options.assets.images[state.letter==='delivered'?'empty-rest':'approved-rest'];
      find('[data-fallback]').alt=state.letter==='delivered'?'Hint, your reading companion':'Hint holding a letter';
      find('[data-fallback-card]').hidden=!cardReady;
      find('[data-fallback-card]').src=options.assets.images[state.flipped?'daily-card-front':'daily-card-back'];
    }
    if(renderer&&a.opacity>0){
      const p=scene.pose,follow=(1-p.engage)*.25;
      renderer.render(p,state.reduced?0:state.clock,{x:p.gazeX+pointer.x*follow,y:p.gazeY+pointer.y*follow},state.letter,scene.gesture,scene.gestureTime,{actorFrame:toFrame(a),letterScene:scene.letterScene});
    }
    const reviewTime=daily?(state.letterPhase==='reading'?3.6:state.letterTime):state.time;
    find('[data-timeline]').max=daily?(state.letterPhase==='offer'?'2.4':'3.6'):String(ENTRANCE_END+1);
    find('[data-timeline]').value=String(reviewTime);find('[data-time]').textContent=reviewTime.toFixed(2)+' s';
    find('[data-timeline-label]').textContent=daily?'Inspect the letter':'Inspect the entrance';
    find('[data-pause]').textContent=state.paused?'Resume':'Pause';
    if(lastPhase!==scene.phase){lastPhase=scene.phase;find('[data-status]').textContent=scene.phase.replaceAll('-',' ');options.onPhaseChange?.(scene.phase);}
    if(!completed&&scene.phase==='ready'){completed=true;options.onComplete?.({scene:'welcome'});}
    if(!dailyCompleted&&daily&&scene.phase==='card-ready'&&reviewTime>=3.6){dailyCompleted=true;options.onComplete?.({scene:'letter',letter:'delivered'});}
    options.onUpdate?.(snapshot());
  }
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;last=0;}
  function start(){if(!disposed&&!raf&&state.ready&&!state.paused&&!state.reduced&&state.visible&&intersecting)raf=requestAnimationFrame(tick);}
  function tick(now){
    raf=0;if(disposed||!root.isConnected||state.paused||!state.visible||!intersecting){last=0;return;}
    const dt=last?Math.min((now-last)/1000,.06)*state.speed:0;last=now;state.clock+=dt;
    if(state.mode==='entrance')state.time+=dt;else state.elapsed+=dt;
    if(state.mode==='daily'){
      if(state.letterPhase==='offer'){state.letterTime=Math.min(2.4,Math.max(0,state.elapsed-1.2));if(state.letterTime>=2.4)state.letter='offered';}
      else {
        state.letterTime+=dt;
        if(!state.handoff&&state.letterTime>=HANDOFF_TIME){state.handoff=true;state.letter='delivered';options.onLetterHandoff?.({letter:'delivered'});}
        if(state.letterPhase==='delivery'&&state.letterTime>=3.6){state.letterPhase='reading';state.letterTime-=1.8;}
      }
      if(state.flipped)state.flipTime=Math.min(1,state.flipTime+dt);
    }
    if(reaction){reaction.time+=dt;if(reaction.time>=reaction.duration)reaction=null;}
    const weight=1-Math.exp(-dt*7);pointer.x+=(pointer.targetX-pointer.x)*weight;pointer.y+=(pointer.targetY-pointer.y)*weight;
    render();start();
  }
  function resize(){
    const rect=stage.getBoundingClientRect();width=rect.width;height=rect.height;
    sky.resize(width,height);const ratio=Math.min(devicePixelRatio||1,2);
    if(canvas.width!==Math.ceil(width*ratio)||canvas.height!==Math.ceil(height*ratio)){canvas.width=Math.ceil(width*ratio);canvas.height=Math.ceil(height*ratio);}
    render();
  }
  const api={
    continue(){
      if(state.mode!=='entrance')return false;
      from={...sample(),reaction:reaction?{...reaction}:null};
      state.mode='profile';state.elapsed=state.reduced||state.paused ? .9 : 0;reaction=null;
      find('[data-continue]').hidden=true;find('[data-skip]').hidden=true;render();options.onContinue?.();start();return true;
    },
    react(){
      if(state.mode==='daily'&&scene.phase==='offered')return api.acceptLetter();
      if(reaction||!['welcome','ready','profile','card-ready'].includes(scene.phase)||state.paused||state.reduced)return false;
      const id=state.mode==='profile'?'nod':nextWink;
      reaction={id,time:0,duration:gestures[id].duration};
      if(id!=='nod')nextWink=id==='wink-left'?'wink-right':'wink-left';
      start();return true;
    },
    completeProfile(){
      if(state.mode!=='profile')return false;
      dailyFrom={...sample(),profileFrom:from,profileElapsed:state.elapsed,reaction:reaction?{...reaction}:null};state.mode='daily';state.elapsed=state.reduced||state.paused?3.6:0;state.letterTime=state.elapsed?2.4:0;state.letter=state.elapsed?'offered':'held';reaction=null;
      render();options.onProfileComplete?.();start();return true;
    },
    acceptLetter(){
      if(state.mode!=='daily'||state.letter!=='offered'||state.accepted)return false;
      state.accepted=true;state.letterPhase='delivery';state.letterTime=0;letterAnchor=createLetterAnchor(options.assets.letterGeometry,state.clock+HANDOFF_TIME);reaction=null;
      options.onLetterAccepted?.();
      if(state.reduced){state.letterTime=3.6;state.letter='delivered';state.handoff=true;options.onLetterHandoff?.({letter:'delivered'});}
      render();start();return true;
    },
    flipCard(){if(state.mode!=='daily'||scene.phase!=='card-ready'||state.flipped)return false;state.flipped=true;state.flipTime=state.reduced?1:0;render();start();return true;},
    replay(){state.mode='entrance';state.time=state.reduced?ENTRANCE_END:0;state.elapsed=0;state.clock=state.time;state.paused=false;Object.assign(state,{letter:'held',letterPhase:'offer',letterTime:0,accepted:false,handoff:false,flipped:false,flipTime:0});from=null;reaction=null;nextWink='wink-left';completed=false;dailyCompleted=false;letterAnchor=null;find('[data-continue]').hidden=false;find('[data-skip]').hidden=false;stop();render();start();},
    seek(seconds){state.mode='entrance';state.letter='held';state.letterPhase='offer';state.accepted=false;state.handoff=false;state.flipped=false;state.time=clamp(Number(seconds)||0,0,ENTRANCE_END+1);state.clock=state.time;state.paused=true;reaction=null;completed=true;find('[data-continue]').hidden=false;find('[data-skip]').hidden=false;stop();render();},
    seekLetter(seconds){
      if(state.mode!=='daily')return false;
      state.letterTime=clamp(Number(seconds)||0,0,state.letterPhase==='offer'?2.4:3.6);state.elapsed=state.letterPhase==='offer'?1.2+state.letterTime:4;state.paused=true;state.flipped=false;state.flipTime=0;
      if(state.letterPhase!=='offer'){state.letterPhase='delivery';state.clock=2.4+state.letterTime;letterAnchor=createLetterAnchor(options.assets.letterGeometry,2.88);state.handoff=state.letterTime>=HANDOFF_TIME;state.letter=state.handoff?'delivered':'offered';}
      else state.letter=state.letterTime>=2.4?'offered':'held';
      stop();render();return true;
    },
    pause(){state.paused=true;stop();render();},
    resume(){state.paused=false;stop();render();start();},
    setSpeed(value){state.speed=clamp(Number(value)||1,.25,1);},
    setMotionPolicy({reduced=media.matches,visible=!document.hidden}={}){
      state.visible=Boolean(visible);state.reduced=Boolean(reduced)||Boolean(state.fallback);
      if(state.reduced){
        if(state.mode==='entrance')state.time=ENTRANCE_END;
        else if(state.mode==='profile')state.elapsed=.9;
        else {state.elapsed=4;if(state.letterPhase==='offer'){state.letterTime=2.4;state.letter='offered';}else{state.letterTime=3.6;state.letterPhase='delivery';state.letter='delivered';if(!state.handoff){state.handoff=true;options.onLetterHandoff?.({letter:'delivered'});}}if(state.flipped)state.flipTime=1;}
        reaction=null;
      }
      stop();render();start();
    },
    getState:snapshot,
    destroy(){disposed=true;stop();observer.disconnect();resizeObserver.disconnect();listeners.forEach(remove=>remove());renderer?.destroy();}
  };
  on(find('[data-continue]'),'click',api.continue);on(find('[data-skip]'),'click',api.continue);
  on(find('[data-replay]'),'click',api.replay);on(actor,'click',api.react);
  on(find('[data-pause]'),'click',()=>state.paused?api.resume():api.pause());
  on(find('[data-speed]'),'change',event=>api.setSpeed(event.target.value));
  on(find('[data-timeline]'),'input',event=>state.mode==='daily'?api.seekLetter(event.target.value):api.seek(event.target.value));
  on(find('[data-profile-form]'),'submit',event=>{event.preventDefault();api.completeProfile();});
  on(find('[data-accept]'),'click',api.acceptLetter);on(find('[data-flip]'),'click',api.flipCard);
  on(stage,'pointermove',event=>{if(event.pointerType==='touch')return;const rect=stage.getBoundingClientRect();pointer.targetX=clamp((event.clientX-rect.left-width/2)/(width/2),-1,1);pointer.targetY=clamp((event.clientY-rect.top-height/2)/(height/2),-1,1);});
  on(stage,'pointerleave',()=>{pointer.targetX=pointer.targetY=0;});
  on(document,'visibilitychange',()=>{state.visible=!document.hidden;stop();start();});
  on(media,'change',()=>api.setMotionPolicy());
  const observer=new IntersectionObserver(entries=>{intersecting=entries[0].isIntersecting;stop();start();});observer.observe(stage);
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);
  if(state.reduced)state.time=ENTRANCE_END;
  find('[data-timeline]').max=String(ENTRANCE_END+1);
  resize();
  try{renderer=await createRenderer(canvas,options.assets);}
  catch(error){
    find('[data-fallback]').hidden=false;canvas.hidden=true;root.dataset.fallback='true';state.fallback=true;api.setMotionPolicy({reduced:true});
    options.onError?.(error);find('[data-status]').textContent='Static preview';
  }
  if(disposed){renderer?.destroy();return api;}
  state.ready=true;root.dataset.ready='true';render();start();root.journey=api;return api;
}
