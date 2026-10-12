import {createHintSceneDirector} from './scene-director.js';
import {createRenderer} from './renderer.js';

export async function createHintScenePlayer(canvas,options){
  const director=createHintSceneDirector({context:options.context,onComplete:options.onComplete});
  const media=matchMedia('(prefers-reduced-motion: reduce)'),pointerTarget=options.pointerTarget||canvas;
  let renderer=null,raf=0,previous=0,destroyed=false,intersecting=true,contextLost=false,fallback=false;
  let appReduced=Boolean(options.motionPolicy?.reduced),appVisible=options.motionPolicy?.visible!==false,ready=false,restoreGeneration=0;
  const listeners=[],on=(node,event,fn)=>{node.addEventListener(event,fn);listeners.push(()=>node.removeEventListener(event,fn));};
  function motionPolicy(){
    director.setMotionPolicy({reduced:appReduced||media.matches||fallback,visible:appVisible&&!document.hidden&&intersecting&&!contextLost});
  }
  function draw(){
    if(destroyed)return;
    const frame=director.sample();
    if(renderer&&!contextLost)renderer.render(frame.pose,frame.state.clock,frame.look,frame.letter,frame.gesture,frame.gestureTime,{actorFrame:frame.actor,showEnvelope:frame.letter!=='delivered'});
    options.onFrame?.({...frame,fallback});
    canvas.dataset.activity=frame.state.activity;canvas.dataset.phase=frame.state.phase;canvas.dataset.ready=String(ready);
  }
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;previous=0;}
  function start(){
    const state=director.getState();
    if(!destroyed&&ready&&!raf&&!state.paused&&!state.reducedMotion&&state.visible&&(state.placement!=='away'||state.transitioning))raf=requestAnimationFrame(tick);
  }
  function tick(now){
    raf=0;if(destroyed||!canvas.isConnected){previous=0;return;}
    director.advance(previous?(now-previous)/1000:0);previous=now;draw();start();
  }
  function resize(){
    const b=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);
    if(b.width<=0||b.height<=0)return;
    director.setViewport(b.width,b.height);
    const width=Math.ceil(b.width*ratio),height=Math.ceil(b.height*ratio);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    draw();
  }
  const refreshPolicy=()=>{stop();motionPolicy();draw();start();};
  on(document,'visibilitychange',refreshPolicy);on(media,'change',refreshPolicy);
  on(pointerTarget,'pointermove',event=>{
    if(event.pointerType==='touch')return;
    const b=canvas.getBoundingClientRect();director.setPointer((event.clientX-b.left-b.width/2)/(b.width/2),(event.clientY-b.top-b.height/2)/(b.height/2));
  });
  on(pointerTarget,'pointerleave',()=>director.setPointer(0,0));
  on(canvas,'webglcontextlost',event=>{event.preventDefault();contextLost=true;fallback=true;restoreGeneration++;refreshPolicy();options.onRendererState?.('unavailable');});
  on(canvas,'webglcontextrestored',async()=>{
    const generation=++restoreGeneration;
    try{
      renderer?.destroy();const restored=await createRenderer(canvas,options.assets);
      if(destroyed||generation!==restoreGeneration){restored.destroy();return;}
      renderer=restored;contextLost=false;fallback=false;refreshPolicy();options.onRendererState?.('ready');
    }catch(error){fallback=true;contextLost=false;refreshPolicy();options.onError?.(error);}
  });
  const observer=new IntersectionObserver(entries=>{intersecting=entries[0].isIntersecting;refreshPolicy();});observer.observe(canvas);
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);
  const invoke=(method,...args)=>{const result=director[method](...args);draw();start();return result;};
  const api={
    setContext:context=>invoke('setContext',context),react:()=>invoke('react'),playGesture:id=>invoke('playGesture',id),
    setAnchor:(anchor,settings)=>invoke('setAnchor',anchor,settings),
    pause(){director.pause();stop();draw();},resume(){director.resume();stop();draw();start();},
    setMotionPolicy(policy){if('reduced'in policy)appReduced=Boolean(policy.reduced);if('visible'in policy)appVisible=Boolean(policy.visible);refreshPolicy();},
    setSpeed:value=>invoke('setSpeed',value),setAccentsVisible:value=>invoke('setAccentsVisible',value),
    getState:director.getState,getFrame:director.sample,
    destroy(){if(destroyed)return;destroyed=true;restoreGeneration++;stop();observer.disconnect();resizeObserver.disconnect();listeners.forEach(remove=>remove());renderer?.destroy();director.destroy();}
  };
  motionPolicy();resize();
  try{renderer=await createRenderer(canvas,options.assets);options.onRendererState?.('ready');}
  catch(error){fallback=true;motionPolicy();options.onRendererState?.('unavailable');options.onError?.(error);}
  if(destroyed){renderer?.destroy();return api;}
  ready=true;draw();start();return api;
}
