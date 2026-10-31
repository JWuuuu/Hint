import test from 'node:test';
import assert from 'node:assert/strict';
import {blendPaws,pawLayers} from '../src/motion.js';
import {createHintSceneDirector} from '../src/scene-director.js';
import {assets} from '../preview/hint-assets.js';

const outline=Array.from({length:80},(_,i)=>[20*Math.cos(i*Math.PI/40),20*Math.sin(i*Math.PI/40)]);
const uv={center:[30,40],points:outline.map(([x,y])=>[30+x,40+y])};
const cloneUV=(offset=0)=>({center:uv.center.map(v=>v+offset),points:uv.points.map(p=>p.map(v=>v+offset))});
const paw=layers=>({center:[0,0],points:outline.map(p=>[...p]),layers});
const advance=(d,t)=>{for(let i=0,n=Math.ceil(t*120);i<n;i++)d.advance(t/n);};

test('equivalent UV values merge without losing drawing weight or combining different artwork',()=>{
  const from=paw([
    {texture:'same',uv,weight:.2},{texture:'same',uv:cloneUV(5e-7),weight:.3},
    {texture:'different-artwork',uv:cloneUV(),weight:.25},{texture:'same',uv:cloneUV(1),weight:.25}
  ]),to=paw([{texture:'same',uv:cloneUV(),weight:1}]);
  const result=blendPaws([from],[to],.4)[0];
  assert.equal(result.layers.length,3);
  assert.ok(Math.abs(result.layers.find(layer=>layer.texture==='same'&&layer.uv.center[0]===30).weight-.7)<1e-12);
  assert.ok(Math.abs(result.layers.find(layer=>layer.texture==='different-artwork').weight-.15)<1e-12);
  assert.ok(Math.abs(result.layers.find(layer=>layer.uv.center[0]===31).weight-.15)<1e-12);
  assert.deepEqual(result.center,from.center);
  for(let i=0;i<result.points.length;i++)for(let k=0;k<2;k++)assert.ok(Math.abs(result.points[i][k]-from.points[i][k])<1e-12);
});

test('discarded drawing history obeys one cumulative opacity budget, including dense distinct histories',()=>{
  const layers=[{texture:'main',uv,weight:.94},...Array.from({length:400},(_,i)=>({texture:`detail-${i}`,uv,weight:.00015}))];
  const result=blendPaws([paw(layers)],[paw([{texture:'main',uv,weight:1}])],.2)[0].layers;
  const actual=new Map(result.map(layer=>[layer.texture,layer.weight]));
  const expected=new Map(layers.map(layer=>[layer.texture,layer.weight*.8+(layer.texture==='main'?.2:0)]));
  const discarded=[...expected].filter(([key])=>!actual.has(key)).reduce((sum,[,weight])=>sum+weight,0);
  const variation=[...expected].reduce((sum,[key,weight])=>sum+Math.abs(weight-(actual.get(key)||0)),0)/2;
  assert.ok(discarded>0&&discarded<=1/1024,'all retired layers share the same budget');
  assert.ok(variation<=1/1024+1e-12,'worst possible normalized pixel change stays below a quarter alpha step');
  assert.ok(result.length>300,'distinct meaningful history is not truncated to an arbitrary layer count');
  assert.ok(Math.abs(result.reduce((sum,layer)=>sum+layer.weight,0)-1)<1e-12);
  assert.ok(result.every(layer=>layer.weight>0&&layer.weight<=1));
});

test('rapid fixed and varied gesture replacements retire redundant material history and settle',()=>{
  for(const varied of [false,true])for(const waveOnly of [false,true]){
    const d=createHintSceneDirector({context:{room:'voice',phase:'idle'},pawGeometry:assets});advance(d,2);
    let peak=0;
    for(let i=0;i<100;i++){
      d.playGesture(waveOnly?'welcome':['welcome','nod','celebration','listening','welcome','thinking'][i%6],{interrupt:true});
      const duration=varied?.05+(i*37%150)/1000:.1;
      for(let j=0,n=Math.ceil(duration*120);j<n;j++){
        d.advance(duration/n);
        for(const paw of d.sample().paws){
          const layers=pawLayers(paw);peak=Math.max(peak,layers.length);
          assert.ok(Math.abs(layers.reduce((sum,layer)=>sum+layer.weight,0)-1)<1e-10);
          assert.ok(layers.every(layer=>layer.weight>0&&assets.images[layer.texture]));
        }
      }
    }
    assert.ok(peak<=16,`${varied?'varied':'fixed'} ${waveOnly?'waves':'mixed'} reached ${peak} layers`);
    advance(d,8);assert.ok(d.sample().paws.every(p=>!p.layers),'history is fully released after settling');
  }
});
