import {createHintSceneDirector} from './scene-director.js';
import {createRenderer} from './renderer.js';

export async function createHintScenePlayer(canvas,options){
  const director=createHintSceneDirector({context:options.context,onComplete:options.onComplete,letterGeometry:options.assets.letterGeometry,pawGeometry:options.assets});
  const media=matchMedia('(prefers-reduced-motion: reduce)'),pointerTarget=options.pointerTarget||canvas;
  let renderer=null,raf=0,previous=0,destroyed=false,intersecting=true,contextLost=false,fallback=false;
  let appReduced=Boolean(options.motionPolicy?.reduced),appVisible=options.motionPolicy?.visible!==false,ready=false,restoreGeneration=0;
  const listeners=[],on=(node,event,fn)=>{node.addEventListener(event,fn);listeners.push(()=>node.removeEventListener(event,fn));};
  let delivery=null,cardImage=null,cardSource='',imageGeneration=0,imageTimer=0;
  function syncDelivery(){
    director.setDelivery(delivery?{...delivery,ready:Boolean(cardImage),done:delivery.done||fallback}:null);
    draw();start();
  }
  function loadCard(source){
    const generation=++imageGeneration;
    clearTimeout(imageTimer);cardSource=source;cardImage=null;
    const image=new Image();
    const fail=()=>{
      if(destroyed||generation!==imageGeneration)return;
      clearTimeout(imageTimer);imageGeneration++;cardSource='';
      if(delivery)delivery={...delivery,done:true};
      syncDelivery();
    };
    image.onload=()=>{
      if(destroyed||generation!==imageGeneration)return;
      clearTimeout(imageTimer);
      try{renderer?.setCardBack(image);cardImage=image;syncDelivery();}catch{fail();}
    };
    image.onerror=fail;imageTimer=setTimeout(fail,4000);image.src=source;
  }
  function motionPolicy(){
    director.setMotionPolicy({reduced:appReduced||media.matches||fallback,visible:appVisible&&!document.hidden&&intersecting&&!contextLost});
  }
  function draw(){
    if(destroyed)return;
    const measured=Boolean(options.onPerformance),began=measured?performance.now():0;
    const frame=director.sample();
    const sampled=measured?performance.now():0;
    if(renderer&&!contextLost)renderer.render(frame.pose,frame.state.clock,frame.look,frame.letter,frame.gesture,frame.gestureTime,{actorFrame:frame.actor,showEnvelope:frame.letter!=='delivered',letterScene:frame.letterScene,paws:frame.paws});
    if(measured)options.onPerformance({sampleMs:sampled-began,renderMs:performance.now()-sampled});
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
      renderer=restored;if(cardImage)renderer.setCardBack(cardImage);contextLost=false;fallback=false;refreshPolicy();options.onRendererState?.('ready');
    }catch(error){fallback=true;contextLost=false;refreshPolicy();options.onError?.(error);}
  });
  const observer=new IntersectionObserver(entries=>{intersecting=entries[0].isIntersecting;refreshPolicy();});observer.observe(canvas);
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);
  const invoke=(method,...args)=>{const result=director[method](...args);draw();start();return result;};
  const api={
    setDelivery(value){
      delivery=value;
      if(value&&!value.done&&value.cardBack!==cardSource)loadCard(value.cardBack);
      if(!value){imageGeneration++;clearTimeout(imageTimer);if(!cardImage)cardSource='';}
      syncDelivery();
    },
    setContext:context=>invoke('setContext',context),react:()=>invoke('react'),playGesture:(id,settings)=>invoke('playGesture',id,settings),
    setAnchor:(anchor,settings)=>invoke('setAnchor',anchor,settings),
    pause(){director.pause();stop();draw();},resume(){director.resume();stop();draw();start();},
    setMotionPolicy(policy){
      const reduced='reduced'in policy?Boolean(policy.reduced):appReduced;
      const visible='visible'in policy?Boolean(policy.visible):appVisible;
      if(reduced===appReduced&&visible===appVisible)return;
      appReduced=reduced;appVisible=visible;refreshPolicy();
    },
    setSpeed:value=>invoke('setSpeed',value),setAccentsVisible:value=>invoke('setAccentsVisible',value),
    getState:director.getState,getFrame:director.sample,
    destroy(){if(destroyed)return;destroyed=true;restoreGeneration++;imageGeneration++;clearTimeout(imageTimer);stop();observer.disconnect();resizeObserver.disconnect();listeners.forEach(remove=>remove());renderer?.destroy();director.destroy();}
  };
  motionPolicy();resize();
  try{renderer=await createRenderer(canvas,options.assets);options.onRendererState?.('ready');}
  catch(error){fallback=true;motionPolicy();options.onRendererState?.('unavailable');options.onError?.(error);}
  if(destroyed){renderer?.destroy();return api;}
  ready=true;draw();start();return api;
}
