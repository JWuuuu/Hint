import test from 'node:test';
import assert from 'node:assert/strict';
import {createHintSceneDirector} from '../src/scene-director.js';
import {WAVE_START} from '../src/entrance-motion.js';
import {projectBodyPoint} from '../src/letter-scene-motion.js';
import {pawLayers} from '../src/motion.js';
import {assets} from '../preview/hint-assets.js';

const advance=(director,seconds)=>{
  for(let i=0,n=Math.ceil(seconds*120);i<n;i++)director.advance(seconds/n);
};
const viewports=[[375,667],[440,956]];

function setup(room,width,height){
  const director=createHintSceneDirector({context:{room,phase:'idle'},pawGeometry:assets});
  director.setViewport(width,height);
  director.setAnchor({x:.5,y:.48,width:.8});
  return director;
}

function screenPoints(frame,width,height){
  return frame.paws.flatMap(paw=>[paw.center,...paw.points]).map(point=>
    projectBodyPoint(point,frame.pose,frame.state.clock,frame.look,frame.actor)
      .map((value,index)=>value*(index?height:width)));
}

function drawingWeights(paw){
  const result=new Map();
  for(const layer of pawLayers(paw)){
    const key=JSON.stringify([layer.texture,layer.uv]);
    result.set(key,(result.get(key)??0)+layer.weight);
  }
  return result;
}

function assertContinuous(director,change,width,height){
  const epsilon=1e-5,previous=screenPoints(director.sample(),width,height);
  director.advance(epsilon);
  const before=director.sample();
  change();
  const after=director.sample();
  const first=screenPoints(before,width,height),second=screenPoints(after,width,height);
  const distance=Math.max(...first.map((point,index)=>Math.hypot(
    point[0]-second[index][0],point[1]-second[index][1])));
  assert.ok(distance<1e-7,`paw silhouette moved ${distance} px at the interruption`);
  for(const channel of ['pawWave','engage','eyeLeft','eyeRight']){
    assert.ok(Math.abs(before.pose[channel]-after.pose[channel])<1e-10,`${channel} jumped`);
  }
  for(let i=0;i<before.paws.length;i++){
    // The same drawing may occupy both texture slots. Compare its combined weight.
    const first=drawingWeights(before.paws[i]),second=drawingWeights(after.paws[i]);
    assert.deepEqual([...first.keys()].sort(),[...second.keys()].sort(),'paw drawing changed at the interruption');
    for(const [drawing,weight] of first){
      assert.ok(Math.abs(weight-second.get(drawing))<1e-10,'paw drawing weight jumped');
    }
  }
  director.advance(epsilon);
  const next=screenPoints(director.sample(),width,height);
  const velocityError=Math.max(...first.map((point,index)=>Math.hypot(
    (point[0]-previous[index][0])-(next[index][0]-second[index][0]),
    (point[1]-previous[index][1])-(next[index][1]-second[index][1]))/epsilon));
  assert.ok(velocityError<2,`incoming paw velocity changed by ${velocityError} px/s`);
}

function assertBounded(frame,label){
  const unit=(value,name)=>assert.ok(Number.isFinite(value)&&value>=-1e-12&&value<=1+1e-12,
    `${label}: ${name} must stay in [0, 1], got ${value}`);
  for(const channel of ['pawWave','engage','eyeLeft','eyeRight'])unit(frame.pose[channel],channel);
  for(const paw of frame.paws){
    unit(paw.mix??0,`${paw.side} drawing mix`);
    unit(paw.baseMix??0,`${paw.side} base drawing mix`);
    const layers=pawLayers(paw);
    for(const layer of layers){
      unit(layer.weight,`${paw.side} ${layer.texture} drawing weight`);
      assert.ok(assets.images[layer.texture],`${label}: drawing texture exists`);
    }
    const sum=layers.reduce((total,layer)=>total+layer.weight,0);
    assert.ok(Math.abs(sum-1)<1e-10,`${label}: ${paw.side} drawing weights sum to ${sum}`);
  }
}

test('continuing from the rising or falling welcome wave keeps its drawings bounded',()=>{
  for(const [width,height] of viewports)for(const waveTime of [.1,.15,.18,4.4]){
    const director=setup('welcome',width,height);
    advance(director,WAVE_START+waveTime);
    const label=`${width}x${height}, wave ${waveTime}s`;
    assertContinuous(director,()=>{
      director.setContext({room:'profile'});
      director.setAnchor({x:.86,y:.08,width:72/width});
    },width,height);
    for(let i=0;i<120;i++){
      director.advance(1/120);
      assertBounded(director.sample(),`${label}, exit frame ${i}`);
    }
    const settled=director.sample();
    assert.equal(settled.intro,null);
    assert.equal(settled.pose.pawWave,0);
    assert.equal(settled.letter,'held');
    assert.ok(Math.abs(settled.actor.width*width-72)<1e-7);
    director.destroy();
  }
});

test('interrupting or replaying a rising welcome wave keeps valid drawing mixtures',()=>{
  for(const [width,height] of viewports)for(const waveTime of [.15,.18,.2,1.3,2,3,4])for(const target of ['nod','welcome']){
    const director=setup('home',width,height);advance(director,2);
    assert.equal(director.playGesture('welcome'),true);advance(director,waveTime);
    const label=`${width}x${height}, welcome ${waveTime}s to ${target}`;
    assertContinuous(director,()=>{
      assert.equal(director.playGesture(target,{interrupt:true}),true);
    },width,height);
    for(let i=0;i<120;i++){
      director.advance(1/120);
      assertBounded(director.sample(),`${label}, interruption frame ${i}`);
    }
    director.destroy();
  }
});

test('replaying a late wave blends its current paw instead of rewinding through earlier poses',()=>{
  for(const [width,height] of viewports)for(const waveTime of [1.3,2,3,4]){
    const director=setup('home',width,height);advance(director,2);
    director.playGesture('welcome');advance(director,waveTime);
    director.playGesture('welcome',{interrupt:true});
    let previous=screenPoints(director.sample(),width,height),peakSpeed=0;
    for(let i=0;i<90;i++){
      director.advance(1/120);const frame=director.sample(),current=screenPoints(frame,width,height);
      peakSpeed=Math.max(peakSpeed,...current.map((point,index)=>Math.hypot(point[0]-previous[index][0],point[1]-previous[index][1])*120));
      previous=current;
      for(const paw of frame.paws)for(let j=0;j<paw.points.length;j++){
        const a=paw.points[j],b=paw.points[(j+1)%paw.points.length],c=paw.center;
        assert.ok((a[0]-c[0])*(b[1]-c[1])-(a[1]-c[1])*(b[0]-c[0])>1,'blended paw stays convex around its fan center');
      }
    }
    assert.ok(peakSpeed<350,`${width}px replay at ${waveTime}s reached ${peakSpeed}px/s`);
    assert.ok(director.sample().paws.every(paw=>!paw.layers),'temporary drawing blend is released');
  }
});
