import { clamp, gestures, sampleGesture, idleBlink } from './motion.js';
import { createRenderer } from './renderer.js';

export async function createHintMascot(canvas, options) {
  const renderer = await createRenderer(canvas, options.assets);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const state = { gesture: 'wink-left', time: 0, clock: 0, active: false, paused: reduced.matches, letter: 'held', speed: 1, accentsVisible: true };
  const look = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let raf = 0, previous = 0, visible = true, destroyed = false, waitingStart = 0;
  let currentPose;
  function snapshot() { return { ...state, duration: gestures[state.gesture].duration, reducedMotion: reduced.matches, visible: visible && !document.hidden }; }
  function render() {
    const p = sampleGesture(state.gesture, state.time);
    const idle = 1 - p.engage * .75;
    const waiting=state.gesture==='offer-letter'&&state.letter==='offered'&&state.time>=gestures['offer-letter'].duration;
    const automaticBlink = reduced.matches ? 0 : waiting ? idleBlink(state.clock-waitingStart) : idleBlink(state.clock) * (1 - p.engage);
    p.eyeLeft = Math.max(p.eyeLeft, automaticBlink);p.eyeRight = Math.max(p.eyeRight, automaticBlink);
    p.x += look.x * .003 * (1 - p.engage);
    p.y += .010 * Math.sin(state.clock * 1.3) * idle;
    p.roll += .009 * Math.sin(state.clock * .9) * idle;
    const attention = state.gesture === 'listening' ? .75 : 1 - p.engage * .9;
    const gaze = { x: p.gazeX + look.x * attention, y: p.gazeY + look.y * attention };
    if(!state.accentsVisible){p.question=0;p.sparkles=0;}
    renderer.render(p, state.clock, gaze, state.letter, state.gesture, state.time);
    currentPose = p;
    canvas.dataset.time = state.time.toFixed(4);canvas.dataset.clip = state.gesture;canvas.dataset.letter = state.letter;
    options.onUpdate?.(snapshot(), p);
  }
  function stop() { if (raf) cancelAnimationFrame(raf);raf = 0;previous = 0; }
  function start() { if (!destroyed && !raf && !state.paused && visible && !document.hidden && (state.active || !reduced.matches)) raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    if (destroyed || state.paused || !visible || document.hidden || !canvas.isConnected) { previous = 0;return; }
    const dt = previous ? Math.min((now - previous)/1000, .04) : 0;previous = now;
    if (!reduced.matches) state.clock += dt;
    if (state.active) {
      state.time = Math.min(gestures[state.gesture].duration, state.time + dt*state.speed);
      if (state.time >= gestures[state.gesture].duration) {
        state.active = false;
        if (state.gesture === 'offer-letter') { state.letter = 'offered';waitingStart=state.clock; }
        if (state.gesture === 'deliver-letter') state.letter = 'delivered';
        if (reduced.matches) state.paused = true;
        options.onComplete?.({ gesture: state.gesture, letter: state.letter });
      }
    }
    const follow = 1 - Math.exp(-dt*7);
    look.x += (look.targetX-look.x)*follow;look.y += (look.targetY-look.y)*follow;
    render();start();
  }
  const onVisibility = () => { stop();start(); };
  const onReduced = () => { state.paused = reduced.matches;stop();render();start(); };
  const onPointer = event => {
    if (event.pointerType === 'touch') return;
    const b = canvas.getBoundingClientRect();
    look.targetX = clamp((event.clientX-b.left-b.width*.5)/(b.width*.6), -1, 1);
    look.targetY = clamp((event.clientY-b.top-b.height*.45)/(b.height*.6), -1, 1);
  };
  const onLeave = () => { look.targetX = 0;look.targetY = 0; };
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting;stop();start(); });observer.observe(canvas);
  document.addEventListener('visibilitychange', onVisibility);reduced.addEventListener('change', onReduced);
  canvas.addEventListener('pointermove', onPointer);canvas.addEventListener('pointerleave', onLeave);
  const api = {
    playGesture(id) {
      if (!gestures[id] || id === 'deliver-letter' || state.active || state.letter === 'offered' || (state.time > 0 && state.time < gestures[state.gesture].duration)) return false;
      if (id === 'offer-letter' && state.letter !== 'held') return false;
      state.gesture = id;state.time = 0;state.active = true;state.paused = false;stop();render();start();return true;
    },
    acceptLetter() {
      if (state.letter !== 'offered' || state.active || state.gesture !== 'offer-letter' || state.time < gestures['offer-letter'].duration) return false;
      state.gesture = 'deliver-letter';state.time = 0;state.active = true;state.paused = false;stop();render();start();return true;
    },
    resetScene() {
      state.time = 0;state.active = false;state.gesture = 'wink-left';state.letter = 'held';state.paused = reduced.matches;
      look.x = look.y = look.targetX = look.targetY = 0;stop();render();start();
    },
    pause() { state.paused = true;stop();render(); },
    resume() {
      state.paused = false;
      if (state.time > 0 && state.time < gestures[state.gesture].duration) state.active = true;
      stop();render();start();
    },
    seek(time) {
      state.time = clamp(time, 0, gestures[state.gesture].duration);state.active = false;state.paused = true;
      if (state.gesture === 'offer-letter') { state.letter = state.time >= gestures[state.gesture].duration ? 'offered' : 'held';waitingStart=state.clock; }
      if (state.gesture === 'deliver-letter') state.letter = state.time >= gestures[state.gesture].duration ? 'delivered' : 'offered';
      stop();render();
    },
    setSpeed(speed) { state.speed = clamp(speed, .25, 1.25);render(); },
    setAccentsVisible(visible) { state.accentsVisible=Boolean(visible);render(); },
    getState: snapshot,
    getPose() { return { ...currentPose }; },
    destroy() {
      destroyed = true;stop();observer.disconnect();renderer.destroy();
      document.removeEventListener('visibilitychange', onVisibility);reduced.removeEventListener('change', onReduced);
      canvas.removeEventListener('pointermove', onPointer);canvas.removeEventListener('pointerleave', onLeave);
    }
  };
  canvas.dataset.ready = 'true';render();start();return api;
}
