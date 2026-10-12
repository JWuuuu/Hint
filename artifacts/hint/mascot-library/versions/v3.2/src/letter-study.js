import {createRenderer} from './renderer.js';
import {ease,clamp,HANDOFF_TIME} from './motion.js';
import {sampleLetterScene,createLetterAnchor,letterSceneTiming} from './letter-scene-motion.js';

export async function createLetterStudy(root,options){
  const find=selector=>root.querySelector(selector),stage=find('[data-stage]'),canvas=find('canvas');
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const state={phase:'offer',time:0,clock:0,speed:1,paused:false,reduced:media.matches,visible:!document.hidden,ready:false,letter:'held',accepted:false,handoff:false,flipped:false,flipTime:0};
  let renderer,anchor=null,raf=0,previous=0,disposed=false,intersecting=true,lastPhase='',finished=false;
  const listeners=[],on=(node,type,fn)=>{node.addEventListener(type,fn);listeners.push(()=>node.removeEventListener(type,fn));};
  const snapshot=()=>({...state,actingPhase:sample().phase});
  const sample=()=>sampleLetterScene(state.phase,state.time,state.clock,anchor,options.assets.letterGeometry);
  function render(){
    const scene=sample();scene.flip=state.flipped?ease(state.flipTime/letterSceneTiming.flip):0;
    stage.dataset.phase=scene.phase;stage.dataset.letter=state.letter;
    if(renderer)renderer.render(scene.pose,state.reduced?0:state.clock,scene.look,state.letter,scene.gesture,scene.gestureTime,{actorFrame:scene.actor,letterScene:scene});
    const offered=scene.phase==='offered',cardReady=scene.phase==='card-ready';
    if(state.fallback){
      const picture=find('[data-fallback]');picture.src=options.assets.images[state.letter==='delivered'?'empty-rest':'approved-rest'];
      picture.style.left=scene.actor.x*100+'%';picture.style.top=scene.actor.y*100+'%';picture.style.width=scene.actor.width*100+'%';picture.style.height=scene.actor.height*100+'%';
      picture.alt=state.letter==='delivered'?'Hint, your reading companion':'Hint holding a letter';
      find('[data-fallback-card]').hidden=!cardReady;find('[data-fallback-card]').src=options.assets.images[state.flipped?'daily-card-front':'daily-card-back'];
    }
    find('[data-accept]').hidden=!offered;find('[data-flip]').hidden=!cardReady||state.flipped;
    find('[data-bubble]').style.opacity=String(state.phase==='offer'?ease((state.time-1.7)/.5):1-ease(state.time/.28));
    const reading=state.flipped?ease((state.flipTime-.43)/.35):0;
    find('[data-reading]').style.opacity=String(reading);find('[data-reading]').hidden=reading===0;
    find('[data-copy]').style.opacity=String(state.phase==='offer'?1:1-ease(state.time/.3));
    find('[data-shadow]').style.opacity=String(scene.shadow*.1);
    find('[data-shadow]').style.transform=`translate(-50%,-50%) scale(${scene.shadow})`;
    find('[data-shadow]').style.left=(scene.actor.x+scene.actor.width*.5)*100+'%';
    find('[data-shadow]').style.top=(scene.actor.y+scene.actor.height*.88)*100+'%';
    const sceneTime=state.phase==='reading'?3.6:state.time;
    find('[data-timeline]').max=state.phase==='offer'?'2.4':'3.6';find('[data-timeline]').value=String(sceneTime);
    find('[data-time]').textContent=sceneTime.toFixed(2)+' s';find('[data-pause]').textContent=state.paused?'Resume':'Pause';
    if(scene.phase!==lastPhase){lastPhase=scene.phase;find('[data-status]').textContent=scene.phase.replaceAll('-',' ');options.onPhaseChange?.(scene.phase);}
    if(!finished&&scene.phase==='card-ready'&&sceneTime>=3.6){finished=true;options.onComplete?.({scene:'letter',letter:'delivered'});}
    options.onUpdate?.(snapshot());
  }
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;previous=0;}
  function start(){if(!disposed&&!raf&&state.ready&&!state.paused&&!state.reduced&&state.visible&&intersecting)raf=requestAnimationFrame(tick);}
  function tick(now){
    raf=0;if(disposed||state.paused||!state.visible||!intersecting||!root.isConnected){previous=0;return;}
    const dt=previous?Math.min((now-previous)/1000,.06)*state.speed:0;previous=now;state.clock+=dt;
    state.time=state.phase==='offer'?Math.min(2.4,state.time+dt):state.time+dt;
    if(state.phase==='offer'&&state.time===2.4)state.letter='offered';
    if(state.phase==='delivery'&&state.time>=HANDOFF_TIME&&!state.handoff){state.handoff=true;state.letter='delivered';options.onLetterHandoff?.({letter:'delivered'});}
    if(state.phase==='delivery'&&state.time>=3.6){state.phase='reading';state.time=state.time-1.8;}
    if(state.flipped)state.flipTime=Math.min(1,state.flipTime+dt);
    render();start();
  }
  function resize(){const b=stage.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.ceil(b.width*dpr);canvas.height=Math.ceil(b.height*dpr);render();}
  const api={
    acceptLetter(){
      if(state.letter!=='offered'||state.accepted)return false;
      state.accepted=true;state.phase='delivery';state.time=0;
      anchor=createLetterAnchor(options.assets.letterGeometry,state.clock+HANDOFF_TIME);
      options.onLetterAccepted?.();
      if(state.reduced){state.time=3.6;state.letter='delivered';state.handoff=true;options.onLetterHandoff?.({letter:'delivered'});}
      stop();render();start();return true;
    },
    flipCard(){if(sample().phase!=='card-ready'||state.flipped)return false;state.flipped=true;state.flipTime=state.reduced?1:0;render();start();return true;},
    replay(){Object.assign(state,{phase:'offer',time:state.reduced?2.4:0,clock:0,paused:false,letter:state.reduced?'offered':'held',accepted:false,handoff:false,flipped:false,flipTime:0});anchor=null;finished=false;stop();render();start();},
    pause(){state.paused=true;stop();render();},
    resume(){state.paused=false;stop();render();start();},
    setSpeed(value){state.speed=clamp(Number(value)||1,.25,1);},
    seek(phase,seconds){
      if(!['offer','delivery'].includes(phase))return false;
      state.phase=phase;state.time=clamp(Number(seconds)||0,0,phase==='offer'?2.4:3.6);state.paused=true;state.flipped=false;state.flipTime=0;
      state.accepted=phase==='delivery';state.handoff=phase==='delivery'&&state.time>=HANDOFF_TIME;
      state.letter=state.handoff?'delivered':phase==='offer'&&state.time<2.4?'held':'offered';
      state.clock=(phase==='delivery'?2.4:0)+state.time;
      anchor=phase==='delivery'?createLetterAnchor(options.assets.letterGeometry,2.4+HANDOFF_TIME):null;
      finished=phase==='delivery'&&state.time>=3.18;stop();render();return true;
    },
    setMotionPolicy({reduced=media.matches,visible=!document.hidden}={}){
      state.reduced=Boolean(reduced)||Boolean(state.fallback);state.visible=Boolean(visible);
      if(state.reduced){
        if(state.phase==='offer'){state.time=2.4;state.letter='offered';}
        else {state.time=3.6;state.letter='delivered';if(!state.handoff){state.handoff=true;options.onLetterHandoff?.({letter:'delivered'});}}
        if(state.flipped)state.flipTime=1;
      }
      stop();render();start();
    },
    getState:snapshot,
    destroy(){disposed=true;stop();observer.disconnect();resizeObserver.disconnect();listeners.forEach(remove=>remove());renderer?.destroy();}
  };
  on(find('[data-accept]'),'click',api.acceptLetter);on(find('[data-flip]'),'click',api.flipCard);
  on(find('[data-replay]'),'click',api.replay);on(find('[data-pause]'),'click',()=>state.paused?api.resume():api.pause());
  on(find('[data-speed]'),'change',event=>api.setSpeed(event.target.value));
  on(find('[data-timeline]'),'input',event=>api.seek(state.phase==='offer'?'offer':'delivery',event.target.value));
  on(find('[data-offer-frame]'),'click',()=>api.seek('offer',2.4));on(find('[data-delivery-frame]'),'click',()=>api.seek('delivery',0));
  on(document,'visibilitychange',()=>{state.visible=!document.hidden;stop();start();});on(media,'change',()=>api.setMotionPolicy());
  const observer=new IntersectionObserver(entries=>{intersecting=entries[0].isIntersecting;stop();start();});observer.observe(stage);
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);
  if(state.reduced){state.time=2.4;state.letter='offered';}
  resize();
  try{renderer=await createRenderer(canvas,options.assets);}
  catch(error){state.fallback=true;root.dataset.fallback='true';canvas.hidden=true;find('[data-fallback]').hidden=false;api.setMotionPolicy({reduced:true});options.onError?.(error);}
  if(disposed){renderer.destroy();return api;}
  state.ready=true;root.dataset.ready='true';render();start();return api;
}
