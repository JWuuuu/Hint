import { gestures, activities, ease, HANDOFF_TIME, reviewTimes } from './motion.js';
import { createHintMascot } from './controller.js';

const root = document.getElementById('hint-gestures-v3');
const canvas = root.querySelector('canvas');
const choice = root.querySelector('[data-gesture]'), play = root.querySelector('[data-play]');
const pause = root.querySelector('[data-pause]'), timeline = root.querySelector('[data-timeline]');
const timeOutput = root.querySelector('[data-time]'), title = root.querySelector('[data-title]');
const status = root.querySelector('[data-status]'), character = root.querySelector('.hint-character');
const sceneChoice=root.querySelector('[data-scene]'),next=root.querySelector('[data-scene-next]'),interrupt=root.querySelector('[data-interrupt]');
const saved = window.openai?.widgetState?.privateContent;
const query=new URLSearchParams(location.search),requested=query.get('gesture');
const initialGesture=gestures[requested]&&requested!=='deliver-letter'?requested:saved?.version==='gesture-library-v3.1'&&gestures[saved.gesture]&&saved.gesture!=='deliver-letter'?saved.gesture:'idle';
let selected=initialGesture;
let api, lastStatus = '',scene='library',scenePhase='library',phaseStart=0;
const order=['idle','welcome','offer-letter','listening','thinking','reading','speaking','waiting','wink-left','wink-right','nod','shake-head','celebration','curious','surprised','shy','comfort','disappointed','frustrated','sleepy'];
choice.replaceChildren(...order.map(id=>new Option(gestures[id].label,id)));choice.value=selected;
const persist=()=>window.openai?.setWidgetState?.({modelContent:{mascot:'Hint',gesture:gestures[selected].label,letter:api.getState().letter},privateContent:{version:'gesture-library-v3.1',gesture:selected,paused:api.getState().paused}})?.catch(()=>{});
const sceneTitles={welcome:'Hey, welcome to Hint.',offer:'This is for you.',offered:'A letter for you.',handoff:'This one is yours.',reading:'Take your time.',waiting:'I’m right here.',listening:'I’m listening.',thinking:'Let me think.',preparing:'One moment.',speaking:'Here’s what I’m thinking.'};
const sceneCopy={welcome:'A small hello, before today’s letter.',offer:'Hint takes a breath and offers you a letter.',offered:'Take it whenever you’re ready.',handoff:'Your letter is on its way.',reading:'Hint quietly reads alongside you.',waiting:'A quiet moment before the conversation.',listening:'Imagine telling Hint what’s on your mind.',thinking:'Hint pauses to think about what you said.',preparing:'The reply is ready. Playback is getting ready.',speaking:'The reply is playing. You can interrupt at any time.'};
function markPhase(phase){scenePhase=phase;phaseStart=api?.getState().clock||0;root.dataset.sceneMode=scene;root.dataset.scenePhase=phase;}
function enterPhase(phase){
  markPhase(phase);
  const activity=phase==='preparing'?'waiting':phase;
  if(activities.includes(activity))api.setActivity(activity);
  else if(phase==='welcome'||phase==='offer')api.playGesture(phase==='offer'?'offer-letter':'welcome');
}
function startScene(value){
  scene=value;sceneChoice.value=scene;
  root.querySelector('[data-library-controls]').hidden=scene!=='library';
  root.querySelector('[data-scene-panel]').hidden=scene==='library';
  root.querySelector('[data-simulation]').hidden=scene!=='voice';
  if(scene==='library'){markPhase('library');update(api.getState(),api.getPose());return;}
  const state=api.getState();
  const handoff=state.letter==='offered'||state.active&&['offer-letter','deliver-letter'].includes(state.gesture);
  if(handoff){markPhase('handoff');api.setActivity(scene==='letter'?'reading':'waiting');}
  else if(scene==='letter'){
    if(state.letter==='delivered')enterPhase('reading');
    else{api.setActivity('idle');enterPhase('welcome');}
  }else enterPhase('waiting');
  if(!api.getState().reducedMotion)api.resume();
  update(api.getState(),api.getPose());
}
function advanceScene(state){
  if(!api||scene!=='voice'||state.paused||state.reducedMotion||state.active||scenePhase==='handoff')return;
  const elapsed=state.clock-phaseStart;
  if(scenePhase==='waiting'&&elapsed>=1.2)enterPhase('listening');
  else if(scenePhase==='thinking'&&elapsed>=3.2)enterPhase('preparing');
  else if(scenePhase==='preparing'&&elapsed>=1.2)enterPhase('speaking');
  else if(scenePhase==='speaking'&&elapsed>=4.8)enterPhase('listening');
}
function update(state,pose){
  if(state.gesture!=='deliver-letter'&&(state.active||state.time>0||state.mode==='activity'&&state.activity!=='idle')&&selected!==state.gesture){selected=state.gesture;choice.value=selected;}
  const running=(state.active||state.mode==='activity')&&!state.paused;
  const waiting=state.letter==='offered'&&state.gesture==='offer-letter'&&state.time>=state.duration&&!state.active;
  const delivering=state.gesture==='deliver-letter';
  const received=delivering?ease(state.time/.32):state.letter==='delivered'?1:0;
  const receiverLift=delivering?ease(state.time/.42)*(1-ease((state.time-HANDOFF_TIME)/.84)):0;
  root.querySelector('[data-receiver]').style.opacity=received;
  root.querySelector('[data-receiver]').style.transform=`translateY(calc(${8*(1-received)}px - ${receiverLift*115.2}%))`;
  root.querySelector('[data-reading-card]').hidden=!(scene==='letter'&&scenePhase==='reading'&&state.letter==='delivered');
  const reset=selected==='offer-letter'&&state.letter==='delivered';
  title.textContent=scene!=='library'?(waiting?'A letter for you.':sceneTitles[scenePhase]||'This one is yours.'):(waiting?'A letter for you.':state.gesture==='deliver-letter'?'This one is yours.':gestures[selected].title);
  play.hidden=scene!=='library'&&!waiting;
  play.textContent=waiting?'Take the letter':reset?'Reset letter':running?'Playing…':selected===state.gesture&&state.paused&&(state.mode==='activity'||state.active||state.time>0&&state.time<state.duration)?'Continue':'Play again';
  play.disabled=running;
  choice.disabled=state.active||waiting||(state.gesture.includes('letter')&&state.time>0&&state.time<state.duration);
  character.setAttribute('aria-label',waiting?'Take Hint’s letter':scene==='library'?'Play Hint’s gesture':'Hint');
  pause.textContent=state.reducedMotion&&!state.active?'Still pose':state.paused?'Resume':'Pause';
  pause.disabled=state.reducedMotion&&!state.active;
  timeline.max=state.mode==='activity'?60000:Math.round(state.duration*1000);
  timeline.value=Math.round((state.mode==='activity'?state.time%60:state.time)*1000);timeOutput.textContent=state.time.toFixed(2)+' s';
  root.querySelector('.hint-shadow').style.transform=`translateX(${pose.x*150}px) scaleX(${1+pose.y*5})`;
  root.querySelector('[data-scene-copy]').textContent=waiting?sceneCopy.offered:sceneCopy[scenePhase]||'';
  next.hidden=scene!=='voice'||!(['listening'].includes(scenePhase)||state.reducedMotion&&['waiting','thinking','preparing'].includes(scenePhase));
  next.textContent=scenePhase==='listening'?'Finish speaking':scenePhase==='preparing'?'Play the reply':'Continue';
  next.disabled=state.paused&&!state.reducedMotion;
  interrupt.hidden=scene!=='voice'||!['thinking','preparing','speaking'].includes(scenePhase);
  const finished=state.mode==='gesture'&&!state.active&&state.time>=state.duration;
  root.querySelector('[data-main-pose]').disabled=scene!=='library'||state.gesture==='deliver-letter';
  const message=waiting?'Tap to take your letter.':state.reducedMotion&&!state.active?'Still poses are shown. You can play individual gestures.':reset?'Delivered.':finished?'Gesture complete. Play again or hold the expression.':'';
  if(message!==lastStatus){status.textContent=message;lastStatus=message;}
  advanceScene(state);
}
function complete(detail){
  root.dispatchEvent(new CustomEvent('hint:gesture-complete',{detail}));
  if(scene==='letter'&&detail.gesture==='welcome'&&scenePhase==='welcome')enterPhase('offer');
  else if(scene==='letter'&&detail.gesture==='offer-letter')markPhase('offered');
  else if(detail.gesture==='deliver-letter'&&scene!=='library')enterPhase(scene==='letter'?'reading':'waiting');
  update(api.getState(),api.getPose());persist();
}
createHintMascot(canvas,{assets:assetBundle,onUpdate:update,onLetterHandoff:detail=>root.dispatchEvent(new CustomEvent('hint:letter-handoff',{detail})),onComplete:complete}).then(controller=>{
  api=controller;root.mascot=api;root.scenePreview={start:startScene,getState:()=>({scene,phase:scenePhase,phaseStart})};
  // Restore the user's selection after the controller's initial idle render.
  selected=initialGesture;choice.value=selected;
  if(query.get('pose')==='1'){api.playGesture(selected);api.seek(reviewTimes[selected]||0);}
  else if(!api.getState().reducedMotion&&!saved?.paused){if(selected!=='idle')api.playGesture(selected);}
  else api.pause();
  const activate=()=>{
    const state=api.getState();
    if(state.letter==='offered'&&state.gesture==='offer-letter'&&state.time>=state.duration){if(scene!=='library')markPhase('handoff');api.acceptLetter();}
    else if(scene!=='library')return;
    else if(selected==='offer-letter'&&state.letter==='delivered'){api.resetScene();selected='offer-letter';choice.value=selected;api.playGesture(selected);}
    else if(selected===state.gesture&&state.paused&&(state.mode==='activity'||state.active||state.time>0&&state.time<state.duration))api.resume();
    else if(activities.includes(selected)&&root.querySelector('[data-hold]').checked)api.setActivity(selected);
    else api.playGesture(selected);
    persist();
  };
  play.addEventListener('click',activate);character.addEventListener('click',activate);
  choice.addEventListener('change',()=>{
    const value=choice.value,state=api.getState();
    if(state.paused&&state.mode==='gesture'&&!state.gesture.includes('letter')&&state.time<state.duration)api.setActivity('idle');
    selected=value;if(activities.includes(value)&&root.querySelector('[data-hold]').checked){api.setActivity(value);api.resume();}else api.playGesture(value);persist();
  });
  root.querySelector('[data-hold]').addEventListener('change',event=>{const id=choice.value;if(activities.includes(id)){if(event.target.checked)api.setActivity(id);else api.playGesture(id);}});
  sceneChoice.addEventListener('change',()=>startScene(sceneChoice.value));
  next.addEventListener('click',()=>{const nextPhase={waiting:'listening',listening:'thinking',thinking:'preparing',preparing:'speaking'}[scenePhase];if(nextPhase)enterPhase(nextPhase);update(api.getState(),api.getPose());});
  interrupt.addEventListener('click',()=>{enterPhase('listening');update(api.getState(),api.getPose());});
  pause.addEventListener('click',()=>{api.getState().paused?api.resume():api.pause();persist();});
  root.querySelector('[data-main-pose]').addEventListener('click',()=>{api.seek(reviewTimes[selected]||0);persist();});
  timeline.addEventListener('input',()=>api.seek(Number(timeline.value)/1000));timeline.addEventListener('change',persist);
  root.querySelector('[data-speed]').addEventListener('change',event=>api.setSpeed(Number(event.target.value)));
  root.querySelector('[data-reset]').addEventListener('click',()=>{api.resetScene();selected='idle';choice.value=selected;if(scene!=='library')startScene(scene);else update(api.getState(),api.getPose());persist();});
  root.querySelector('[data-accents]').addEventListener('change',event=>api.setAccentsVisible(event.target.checked));
  root.querySelector('[data-hide-labels]').addEventListener('change',event=>{root.dataset.labelsHidden=String(event.target.checked);Array.from(choice.options).forEach((option,i)=>{option.textContent=event.target.checked?'Gesture '+String.fromCharCode(65+i):gestures[option.value].label;});});
  root.querySelector('[data-size]').addEventListener('change',event=>root.style.setProperty('--hint-character-size',event.target.value+'px'));
  window.addEventListener('openai:set_globals',event=>{const data=event.detail?.globals?.widgetState?.privateContent;if(!data||data.version!=='gesture-library-v3.1'||api.getState().active)return;if(order.includes(data.gesture)){selected=data.gesture;choice.value=selected;}if(data.paused)api.pause();update(api.getState(),api.getPose());});
}).catch(error=>{canvas.style.backgroundImage=`url(${assetBundle.images['approved-rest']})`;canvas.style.backgroundSize='contain';status.textContent='The animation could not load.';console.error(error);});

root.querySelector('[data-v3-reference]').addEventListener('toggle',async event=>{
 const frame=root.querySelector('[data-v3]');if(!event.target.open||frame.srcdoc)return;
 const stream=new Blob([Uint8Array.from(atob(collectionV3Gzip),c=>c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('gzip'));
 frame.srcdoc=await new Response(stream).text();
});

root.querySelector('[data-v2-reference]').addEventListener('toggle',async event=>{
 const frame=root.querySelector('[data-v2]');if(!event.target.open||frame.srcdoc)return;
 const stream=new Blob([Uint8Array.from(atob(collectionV2Gzip),c=>c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('gzip'));
 frame.srcdoc=await new Response(stream).text();
});

root.querySelector('[data-v1-reference]').addEventListener('toggle',async event=>{
  const frame=root.querySelector('[data-v1]');
  if(!event.target.open||frame.srcdoc||frame.dataset.loading)return;
  frame.dataset.loading='true';
  try{
    const bytes=Uint8Array.from(atob(collectionV1Gzip),c=>c.charCodeAt(0));
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    frame.srcdoc=await new Response(stream).text();
    frame.addEventListener('load',()=>{
      const resize=()=>{frame.style.height=frame.contentDocument.documentElement.scrollHeight+'px';};
      resize();frame.contentDocument.fonts?.ready.then(resize);
    },{once:true});
  }catch(error){root.querySelector('[data-comparison-status]').textContent='The saved comparison could not load.';console.error(error);delete frame.dataset.loading;}
});

root.querySelector('[data-reference]').addEventListener('toggle', event => {
  const frame = root.querySelector('[data-approved]');
  if (event.target.open && !frame.srcdoc) {
    frame.srcdoc = '<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:transparent}</style>' + approvedGreeting;
    frame.addEventListener('load', () => {
      const resize = () => { frame.style.height = frame.contentDocument.documentElement.scrollHeight + 'px'; };
      resize();frame.contentDocument.fonts?.ready.then(resize);
    }, { once: true });
  }
});
