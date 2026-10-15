import { gestures } from './motion.js';
import { createHintMascot } from './controller.js';

const root = document.getElementById('hint-expressive-gestures');
const canvas = root.querySelector('canvas');
const choice = root.querySelector('[data-gesture]'), play = root.querySelector('[data-play]');
const pause = root.querySelector('[data-pause]'), timeline = root.querySelector('[data-timeline]');
const timeOutput = root.querySelector('[data-time]'), title = root.querySelector('[data-title]');
const status = root.querySelector('[data-status]'), character = root.querySelector('.hint-character');
const saved = window.openai?.widgetState?.privateContent;
let selected = saved?.version === 'gesture-library-v2' && gestures[saved.gesture] && saved.gesture !== 'deliver-letter' ? saved.gesture : 'thinking';
let api, lastStatus = '';
choice.value = selected;
const persist = () => window.openai?.setWidgetState?.({
  modelContent: { mascot: 'Hint', gesture: gestures[selected].label, letter: api.getState().letter },
  privateContent: { version: 'gesture-library-v2', gesture: selected, paused: api.getState().paused }
})?.catch(() => {});

function update(state, pose) {
  if(state.gesture!=='deliver-letter'&&(state.active||state.time>0)&&selected!==state.gesture){selected=state.gesture;choice.value=selected;}
  const running = state.active && !state.paused;
  const waiting = state.letter === 'offered' && state.gesture === 'offer-letter' && state.time >= state.duration && !state.active;
  const reset = selected === 'offer-letter' && state.letter === 'delivered';
  title.textContent = waiting ? 'A letter for you.' : state.gesture === 'deliver-letter' ? 'This one is yours.' : gestures[selected].title;
  play.textContent = waiting ? 'Take the letter' : reset ? 'Reset letter' : running ? 'Playing…' : state.paused && (state.active || state.time > 0 && state.time < state.duration) ? 'Continue' : 'Play again';
  play.disabled = running;choice.disabled = state.active || waiting || (state.time > 0 && state.time < state.duration);
  character.setAttribute('aria-label', waiting ? 'Take Hint’s letter' : 'Play Hint’s gesture');
  pause.textContent = state.paused ? 'Resume' : 'Pause';
  timeline.max = Math.round(state.duration * 1000);timeline.value = Math.round(state.time * 1000);
  timeOutput.textContent = state.time.toFixed(2) + ' s';
  root.querySelector('.hint-shadow').style.transform = `translateX(${pose.x*150}px) scaleX(${1+pose.y*5})`;
  const message = waiting ? 'Tap to take your letter.' : reset ? 'Delivered.' : state.reducedMotion && !state.active ? 'Motion is paused. Play a gesture when you like.' : '';
  if (message !== lastStatus) { status.textContent = message;lastStatus = message; }
}

createHintMascot(canvas, { assets: assetBundle, onUpdate: update, onComplete: detail => {
  root.dispatchEvent(new CustomEvent('hint:gesture-complete',{detail}));persist();
} }).then(controller => {
  api = controller;
  root.mascot = api;
  if (!api.getState().reducedMotion && !saved?.paused) api.playGesture(selected);
  else api.pause();
  const activate = () => {
    const state = api.getState();
    if (state.letter === 'offered' && state.gesture === 'offer-letter' && state.time >= state.duration) api.acceptLetter();
    else if (selected === 'offer-letter' && state.letter === 'delivered') { api.resetScene();selected = 'offer-letter';choice.value = selected;api.playGesture(selected); }
    else if (state.paused && (state.active || state.time > 0 && state.time < state.duration)) api.resume();
    else api.playGesture(selected);
    persist();
  };
  play.addEventListener('click', activate);character.addEventListener('click', activate);
  choice.addEventListener('change', () => { selected = choice.value;api.playGesture(selected);persist(); });
  pause.addEventListener('click', () => { api.getState().paused ? api.resume() : api.pause();persist(); });
  timeline.addEventListener('input', () => api.seek(Number(timeline.value)/1000));
  timeline.addEventListener('change', persist);
  root.querySelector('[data-speed]').addEventListener('change', event => api.setSpeed(Number(event.target.value)));
  root.querySelector('[data-reset]').addEventListener('click', () => { api.resetScene();selected = 'thinking';choice.value = selected;update(api.getState(), api.getPose());persist(); });
  root.querySelector('[data-accents]').addEventListener('change',event=>api.setAccentsVisible(event.target.checked));
  root.querySelector('[data-hide-labels]').addEventListener('change',event=>{
    root.dataset.labelsHidden=String(event.target.checked);
    Array.from(choice.options).forEach((option,i)=>{option.textContent=event.target.checked?'Gesture '+String.fromCharCode(65+i):gestures[option.value].label;});
  });
  root.querySelector('[data-size]').addEventListener('change',event=>root.style.setProperty('--hint-character-size',event.target.value+'px'));
  window.addEventListener('openai:set_globals', event => {
    const data = event.detail?.globals?.widgetState?.privateContent;
    if (!data || data.version !== 'gesture-library-v2' || api.getState().active) return;
    if (gestures[data.gesture] && data.gesture !== 'deliver-letter') { selected = data.gesture;choice.value = selected; }
    if (data.paused) api.pause();update(api.getState(), api.getPose());
  });
}).catch(error => {
  canvas.style.backgroundImage = `url(${assetBundle.images['approved-rest']})`;
  canvas.style.backgroundSize = 'contain';
  status.textContent = 'The animation could not load.';console.error(error);
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
