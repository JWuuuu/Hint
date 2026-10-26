import {createHintScenePlayer,gestures} from '../../../mascot-library/versions/v3.2/src/index.js';
import {reviewTimes} from '../../../mascot-library/versions/v3.2/src/motion.js';
import {assets} from '../../../mascot-library/versions/v3.2/preview/hint-assets.js';

const byId=id=>document.getElementById(id),canvas=document.querySelector('canvas');
let paused=false,holdAt=null,reviewMode='activity';
const choices=['welcome-back','acknowledge','reassure','present-card',...Object.keys(gestures).filter(id=>!id.includes('letter')&&!['welcome-back','acknowledge','reassure','present-card'].includes(id))];
for(const id of choices){const option=document.createElement('option');option.value=id;option.textContent=gestures[id].label;byId('gesture').append(option);}
const player=await createHintScenePlayer(canvas,{assets,context:{room:'home',phase:'idle'},onFrame(frame){
  byId('status').textContent=reviewMode==='activity'
    ? `App state · ${frame.state.activity} · ${frame.state.activityTime.toFixed(2)} s`
    : frame.state.gesture?`Gesture · ${frame.gesture} · ${frame.gestureTime.toFixed(2)} s`:`Gesture finished · ${frame.state.activity}`;
  document.querySelector('.stage').dataset.gesture=frame.gesture;
  document.querySelector('.stage').dataset.mode=reviewMode;
  if(holdAt!==null&&frame.gesture===holdAt.id&&frame.gestureTime>=holdAt.time){holdAt=null;paused=true;byId('pause').textContent='Resume';queueMicrotask(()=>player.pause());}
}});
player.setAnchor({x:.5,y:.6,width:.6});
function resume(){holdAt=null;player.resume();paused=false;byId('pause').textContent='Pause';}
function sceneContext(){
  const [room,phase]=byId('scene').value.split(':');
  return {room,phase,revealing:room==='home'&&phase==='waiting',hasMessages:phase==='reading'||phase==='thinking',audioPlaying:room==='voice'&&phase==='speaking',typing:false,keyboardOpen:false};
}
function watchState(restart=false){
  reviewMode='activity';resume();
  const context=sceneContext(),reduced=byId('reduced').checked;
  if(restart){
    player.setMotionPolicy({reduced:true});
    player.setContext({room:'home',phase:context.phase==='idle'?'waiting':'idle',revealing:false,hasMessages:false,audioPlaying:false});
  }
  player.setContext(context);player.setMotionPolicy({reduced});
  byId('caption').textContent=gestures[context.phase]?.title??'Here with you.';
  byId('result').textContent=context.phase==='paused'?'Voice is paused. Choose another state to continue.':'Continuous app state. Watch the held motion without replaying a gesture.';
}
function playGesture(inspect=false){
  reviewMode='gesture';resume();const id=byId('gesture').value;
  if(id==='speaking'){
    byId('scene').value='voice:speaking';player.setContext(sceneContext());
  }
  byId('caption').textContent=gestures[id].title;
  if(player.playGesture(id,{interrupt:true})){
    if(inspect)holdAt={id,time:reviewTimes[id]??1};
    byId('result').textContent=inspect?'Will pause at the key pose.':'Playing one gesture, then returning to the app state.';
  }else byId('result').textContent='Choose an active app state and turn off reduced motion to play a gesture.';
}
byId('scene').onchange=()=>watchState();
byId('watch').onclick=()=>watchState(true);
byId('play').onclick=()=>playGesture();
byId('inspect').onclick=()=>playGesture(true);
byId('react').onclick=()=>player.react();
byId('speed').onchange=()=>player.setSpeed(Number(byId('speed').value));
byId('reduced').onchange=()=>player.setMotionPolicy({reduced:byId('reduced').checked});
byId('pause').onclick=()=>{paused=!paused;paused?player.pause():player.resume();byId('pause').textContent=paused?'Resume':'Pause';};
byId('settle').onclick=()=>{byId('scene').value='home:idle';watchState();};
const dispose=()=>player.destroy();
window.addEventListener('pagehide',dispose,{once:true});
if(import.meta.hot)import.meta.hot.dispose(dispose);
