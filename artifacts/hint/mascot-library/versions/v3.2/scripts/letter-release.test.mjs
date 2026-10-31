import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {samplePaws,sampleEnvelope,HANDOFF_TIME} from '../src/motion.js';
const geometry=JSON.parse(await readFile(new URL('../assets/letter-geometry.json',import.meta.url),'utf8'));

test('the fingers unhook as the paper leaves, before the arms retract',()=>{
  const held=samplePaws(geometry,'deliver-letter',HANDOFF_TIME,'offered');
  const opening=samplePaws(geometry,'deliver-letter',.60,'delivered');
  for(let side=0;side<2;side++){
    const before=held[side],after=opening[side];
    const from=before.points[0].map((v,k)=>v-before.center[k]);
    const to=after.points[0].map((v,k)=>v-after.center[k]);
    const turn=Math.atan2(from[0]*to[1]-from[1]*to[0],from[0]*to[0]+from[1]*to[1]);
    assert.ok(side===0?turn>.1:turn<-.1,'both hands turn outward during the first release frames');
    for(let i=0;i<before.points.length;i++){
      const a=Math.hypot(...before.points[i].map((v,k)=>v-before.center[k]));
      const b=Math.hypot(...after.points[i].map((v,k)=>v-after.center[k]));
      assert.ok(Math.abs(a-b)<1e-8,'release turns a rigid palm rather than changing its silhouette');
    }
  }
  assert.deepEqual(sampleEnvelope('deliver-letter',HANDOFF_TIME,'delivered',geometry).corners,
    sampleEnvelope('deliver-letter',.60,'delivered',geometry).corners,'released envelope no longer follows the turning palms');
});

test('unhook and retraction boundaries preserve velocity',()=>{
  const e=1e-5;
  for(const t of [HANDOFF_TIME,.72,1.28]){
    const samples=[t-e,t,t+e].map(time=>samplePaws(geometry,'deliver-letter',time,'delivered'));
    for(let side=0;side<2;side++)for(let point=0;point<80;point++)for(let axis=0;axis<2;axis++){
      const [a,b,c]=samples.map(p=>p[side].points[point][axis]);
      assert.ok(Math.abs((b-a)-(c-b))/e<.1);
    }
  }
});
