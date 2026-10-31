import {createRenderer} from '../../../mascot-library/versions/v3.2/src/renderer.js';
import {createHintSceneDirector} from '../../../mascot-library/versions/v3.2/src/scene-director.js';
import {createHintScenePlayer} from '../../../mascot-library/versions/v3.2/src/scene-player.js';
import {activities,gestures,reviewTimes} from '../../../mascot-library/versions/v3.2/src/motion.js';
import {assets} from '../../../mascot-library/versions/v3.2/preview/hint-assets.js';

const placement={
  welcome:'First welcome', 'welcome-back':'Return to Home or an empty Ask conversation',
  acknowledge:'A response arrives after thinking',reassure:'Request or save error',
  'present-card':'A fresh card finishes revealing',nod:'Profile details saved',
  celebration:'Save a card to the collection','wink-left':'Tap Hint','wink-right':'Tap Hint again',
  idle:'Quiet Home or empty conversation',waiting:'Preparing or waiting for input',
  thinking:'A request is in progress',reading:'A response or reading is ready',
  listening:'Microphone is listening',speaking:'Voice playback is audible',
};
const featured=['welcome-back','acknowledge','reassure','present-card','welcome','celebration'];
const ids=[...featured,...Object.keys(gestures).filter(id=>!id.includes('letter')&&!featured.includes(id))];
const byId=id=>document.getElementById(id);
const contextFor=(id,mode='gesture')=>{
  const context={room:'home',phase:'idle',audioPlaying:false,hasMessages:false,typing:false,keyboardOpen:false,revealing:false};
  if(id==='speaking')return {...context,room:'voice',phase:'speaking',audioPlaying:true};
  if(mode==='activity'){
    if(id==='listening')return {...context,room:'voice',phase:id};
    if(id==='thinking'||id==='reading')return {...context,room:'ask',phase:id,hasMessages:true};
    return {...context,phase:id};
  }
  return context;
};
const advance=(director,seconds)=>{const count=Math.ceil(seconds*120);for(let i=0;i<count;i++)director.advance(seconds/count);};
const canvas=document.createElement('canvas');canvas.width=320;canvas.height=320;
const renderer=await createRenderer(canvas,assets);
function still(id,time){
  const director=createHintSceneDirector({context:contextFor(id),pawGeometry:assets});
  director.setViewport(320,320);director.setAnchor({x:.5,y:.5,width:1});advance(director,2);
  director.playGesture(id);advance(director,time);
  const frame=director.sample();
  renderer.render(frame.pose,frame.state.clock,frame.look,frame.letter,frame.gesture,frame.gestureTime,{actorFrame:frame.actor,showEnvelope:false,paws:frame.paws});
  const url=canvas.toDataURL();director.destroy();return url;
}
for(const id of ids){
  const card=document.createElement('article');card.dataset.gesture=id;
  const title=document.createElement('h2');title.textContent=gestures[id].label;
  const use=document.createElement('div');use.className='use';use.textContent=placement[id]??'Library expression · no automatic app trigger';
  const peak=document.createElement('img');peak.className='peak';peak.alt=gestures[id].label+' gesture peak';peak.src=still(id,reviewTimes[id]??1);
  const strip=document.createElement('div');strip.className='strip';
  for(const fraction of [0,.25,.5,.75,1]){const image=document.createElement('img');image.alt=`${gestures[id].label} gesture at ${Math.round(fraction*100)}%`;image.src=still(id,gestures[id].duration*fraction);strip.append(image);}
  const play=document.createElement('button');play.textContent='Play '+gestures[id].label;play.onclick=()=>open(id,play);
  card.append(title,use,peak,strip,play);
  if(activities.includes(id)){
    const watch=document.createElement('button');watch.textContent='Watch '+gestures[id].label+' state';watch.onclick=()=>open(id,watch,'activity');card.append(watch);
  }
  byId('catalogue').append(card);
}
renderer.destroy();byId('status').textContent=`${ids.length} gestures · ${activities.length} continuous app states`;
let player=null,playerPromise=null,current=null,mode='gesture',returnFocus=null,held=false,holdAt=null,generation=0,disposed=false;
const performanceLabel=document.createElement('p');performanceLabel.id='performance';performanceLabel.style.fontSize='11px';byId('frame').after(performanceLabel);
let previousFrame=0,frameGaps=[],renderCosts=[];
function syncControls(){
  byId('title').textContent=gestures[current].label;
  byId('placement').textContent=(placement[current]??'Library expression · no automatic app trigger')+(mode==='activity'?' · Continues until you pause or change state.':' · One-shot gesture.');
  byId('mode').value=mode;byId('mode').options[1].disabled=!activities.includes(current);
  byId('position').textContent=`${ids.indexOf(current)+1} / ${ids.length}`;
  byId('replay').textContent=mode==='activity'?'Restart state':'Replay';
  byId('inspect').textContent=mode==='activity'?'Inspect at 12 s':'Inspect peak';
  byId('pause').textContent='Pause';byId('live').dataset.mode=mode;
}
async function ensurePlayer(){
  if(!playerPromise)playerPromise=createHintScenePlayer(document.querySelector('#live canvas'),{assets,context:contextFor('idle'),onPerformance(timing){renderCosts.push(timing.sampleMs+timing.renderMs);if(renderCosts.length>120)renderCosts.shift();},onFrame(frame){
    const now=performance.now();
    if(!frame.state.paused&&!frame.state.reducedMotion&&frame.state.visible){
      if(previousFrame){frameGaps.push(now-previousFrame);if(frameGaps.length>120)frameGaps.shift();}
      previousFrame=now;
      if(frameGaps.length>4)performanceLabel.textContent=`Preview ${Math.round(1000/(frameGaps.reduce((a,b)=>a+b,0)/frameGaps.length))} fps · draw ${(renderCosts.reduce((a,b)=>a+b,0)/renderCosts.length).toFixed(1)} ms`;
    }else previousFrame=0;
    const seconds=mode==='activity'?frame.state.activityTime:frame.gestureTime;
    byId('frame').textContent=mode==='activity'
      ? `App state · ${frame.state.activity} · ${seconds.toFixed(2)} s`
      : frame.state.gesture?`Gesture · ${frame.gesture} · ${seconds.toFixed(2)} s`:`Gesture finished · ${frame.state.activity}`;
    byId('live').dataset.gesture=frame.gesture;
    if(holdAt!==null&&(mode==='activity'||frame.gesture===current)&&seconds>=holdAt){
      holdAt=null;held=true;byId('pause').textContent='Resume';queueMicrotask(()=>player?.pause());
    }
  }}).then(instance=>{
    if(disposed){instance.destroy();return null;}
    player=instance;player.setAnchor({x:.5,y:.5,width:1});
    player.setMotionPolicy({visible:!byId('live').hidden});return instance;
  });
  return playerPromise;
}
function start(inspect=false){
  if(!player)return;
  held=false;holdAt=null;byId('pause').textContent='Pause';
  // Clear one-shot cues for isolated review. Sustained motion uses the director's
  // real context and clock, never repeated gesture playback.
  player.setMotionPolicy({reduced:true,visible:true});
  player.setContext(contextFor(current==='idle'?'waiting':'idle','activity'));
  player.setContext(contextFor(current,mode));
  // Keep the inspection camera fixed after context picks its real app placement.
  player.setAnchor({x:.5,y:.5,width:1});
  player.setMotionPolicy({reduced:false});player.resume();player.setSpeed(Number(byId('speed').value));
  if(mode==='activity'){if(inspect)holdAt=12;}
  else if(player.playGesture(current,{interrupt:true})&&inspect)holdAt=reviewTimes[current]??1;
}
async function open(id,opener,requestedMode='gesture'){
  current=id;mode=requestedMode==='activity'&&activities.includes(id)?'activity':'gesture';
  if(opener)returnFocus=opener;held=false;holdAt=null;syncControls();
  byId('live').hidden=false;document.querySelector('main').inert=true;document.body.style.overflow='hidden';
  if(opener)byId('close').focus();
  const request=++generation;await ensurePlayer();
  if(request===generation&&!disposed)start();
}
function close(){generation++;holdAt=null;byId('live').hidden=true;document.querySelector('main').inert=false;document.body.style.overflow='';player?.setMotionPolicy({visible:false});returnFocus?.focus();}
byId('close').onclick=close;
byId('replay').onclick=()=>start();
byId('inspect').onclick=()=>start(true);
byId('pause').onclick=()=>{held=!held;held?player?.pause():player?.resume();byId('pause').textContent=held?'Resume':'Pause';};
byId('speed').onchange=()=>player?.setSpeed(Number(byId('speed').value));
byId('mode').onchange=()=>{mode=byId('mode').value;syncControls();start();};
for(const [button,step] of [['previous',-1],['next',1]])byId(button).onclick=()=>open(ids[(ids.indexOf(current)+step+ids.length)%ids.length],null,mode);
byId('live').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();close();}
  if(event.key==='Tab'){
    const items=[...byId('live').querySelectorAll('button:not([disabled]),select:not([disabled])')],first=items[0],last=items.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
const dispose=()=>{disposed=true;generation++;player?.destroy();};
window.addEventListener('pagehide',dispose,{once:true});
if(import.meta.hot)import.meta.hot.dispose(dispose);
