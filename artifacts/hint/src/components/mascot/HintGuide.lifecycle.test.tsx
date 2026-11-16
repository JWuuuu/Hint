// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HintGuideProvider, HintGuideSlot, useHintGuideGesture } from './HintGuide';
import { MotionPolicyProvider } from '../../lib/motionPolicy';
import { coverDecorations, useCoverDecorations } from '../../lib/decorationCover';

const native=vi.hoisted(()=>({listener:(_:boolean)=>{},remove:vi.fn()}));
vi.mock('../../lib/mobile/appLifecycle',()=>({addNativeAppStateListener:vi.fn(async(listener:(active:boolean)=>void)=>{native.listener=listener;return native.remove;})}));
// Keep the actual provider, scene player, director, coordinator, assets and policy.
// Only replace GPU drawing, which jsdom cannot provide.
vi.mock('../../../mascot-library/versions/v3.2/src/renderer.js',()=>({createRenderer:vi.fn(async()=>({render:vi.fn(),setCardBack:vi.fn(),destroy:vi.fn()}))}));
let now=1,media:EventTarget & {matches:boolean},raf:Map<number,FrameRequestCallback>,sequence=0;
beforeEach(()=>{
  now=1;raf=new Map();sequence=0;native.remove.mockClear();localStorage.clear();
  media=Object.assign(new EventTarget(),{matches:false});
  vi.stubGlobal('matchMedia',()=>media);
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{raf.set(++sequence,callback);return sequence;});
  vi.stubGlobal('cancelAnimationFrame',(id:number)=>raf.delete(id));
  vi.stubGlobal('ResizeObserver',class {observe(){} unobserve(){} disconnect(){}});
  vi.stubGlobal('IntersectionObserver',class {observe(){} disconnect(){}});
  vi.spyOn(performance,'now').mockImplementation(()=>now);
  vi.spyOn(document,'hidden','get').mockReturnValue(false);
  vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
  vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({x:10,y:10,left:10,top:10,right:210,bottom:210,width:200,height:200,toJSON(){}});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
function Buttons(){const play=useHintGuideGesture();return <><button onClick={()=>play('reassure')}>Failure</button><button onClick={()=>play('celebration')}>Saved</button></>;}
function Scene(){return <MotionPolicyProvider><HintGuideProvider enabled><HintGuideSlot context={{room:'settings',phase:'idle',hasMessages:false,keyboardOpen:false,typing:false,audioPlaying:false}}/><Buttons/></HintGuideProvider></MotionPolicyProvider>;}
function advance(ms:number){act(()=>{for(let t=0;t<ms;t+=16){now+=16;const pending=[...raf.values()];raf.clear();pending.forEach(fn=>fn(now));}});}

it('covering surfaces hide the paused guide and restore the same player after the last surface closes',async()=>{
  function CoveringSurface(){useCoverDecorations();return <div role="dialog"/>;}
  const content=(covers:number)=><><Scene/>{covers>0&&<CoveringSurface key="receipt"/>}{covers>1&&<CoveringSurface key="second"/>}</>;
  const view=render(content(0)),layer=await view.findByTestId('hint-guide-layer');
  await waitFor(()=>expect(layer.dataset.gesture).toBeDefined());advance(1600);
  const canvas=layer.querySelector('canvas');
  expect(getComputedStyle(layer).visibility).toBe('visible');

  view.rerender(content(2));
  expect(getComputedStyle(layer).visibility).toBe('hidden');
  const clock=layer.dataset.clock;advance(5000);expect(layer.dataset.clock).toBe(clock);
  fireEvent.click(view.getByRole('button',{name:'Saved'}));
  view.rerender(content(1));
  expect(getComputedStyle(layer).visibility).toBe('hidden');
  advance(1000);expect(layer.dataset.clock).toBe(clock);

  view.rerender(content(0));
  expect(view.getByTestId('hint-guide-layer')).toBe(layer);
  expect(layer.querySelector('canvas')).toBe(canvas);
  expect(getComputedStyle(layer).visibility).toBe('visible');
  advance(1000);expect(layer.dataset.clock).not.toBe(clock);
  expect(layer.dataset.gesture).toBe('idle');
});

it.each(['browser','native','covered'] as const)('actual player drops ordinary feedback during %s suspension',async mode=>{
  const view=render(<Scene/>),layer=await view.findByTestId('hint-guide-layer');
  await waitFor(()=>expect(layer.dataset.gesture).toBeDefined());advance(1600);
  fireEvent.click(view.getByRole('button',{name:'Failure'}));advance(800);
  expect(layer.dataset.gesture).toBe('reassure');
  let release=()=>{};
  act(()=>{
    if(mode==='native')native.listener(false);
    if(mode==='covered')release=coverDecorations();
    if(mode==='browser'){
      vi.spyOn(document,'hidden','get').mockReturnValue(true);vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    }
  });
  const clock=layer.dataset.clock;advance(5000);expect(layer.dataset.clock).toBe(clock);
  fireEvent.click(view.getByRole('button',{name:'Saved'}));
  act(()=>{
    if(mode==='native')native.listener(true);
    if(mode==='covered')release();
    if(mode==='browser'){
      vi.spyOn(document,'hidden','get').mockReturnValue(false);vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
      document.dispatchEvent(new Event('visibilitychange'));
    }
  });
  advance(1000);expect(layer.dataset.gesture).toBe('idle');
  view.unmount();expect(raf.size).toBe(0);expect(native.remove).toHaveBeenCalledTimes(1);
});

it('system reduced motion switches mid-clip without replay and a later confirmed action still works',async()=>{
  const view=render(<Scene/>),layer=await view.findByTestId('hint-guide-layer');
  await waitFor(()=>expect(layer.dataset.gesture).toBeDefined());advance(1600);
  fireEvent.click(view.getByRole('button',{name:'Saved'}));advance(800);expect(layer.dataset.gesture).toBe('celebration');
  act(()=>{media.matches=true;media.dispatchEvent(new Event('change'));});
  const clock=layer.dataset.clock;advance(7000);expect(layer.dataset.clock).toBe(clock);expect(layer.dataset.gesture).toBe('idle');
  fireEvent.click(view.getByRole('button',{name:'Failure'}));
  act(()=>{media.matches=false;media.dispatchEvent(new Event('change'));});advance(1000);
  expect(layer.dataset.gesture).toBe('idle');
  fireEvent.click(view.getByRole('button',{name:'Saved'}));advance(300);expect(layer.dataset.gesture).toBe('celebration');
});
