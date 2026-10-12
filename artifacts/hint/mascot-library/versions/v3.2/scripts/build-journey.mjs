import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { library, verifyApproved, assertWorkingOutput } from './verify-approved.mjs';

await verifyApproved();
const assets=await readFile(path.join(library,'preview/hint-assets.js'),'utf8');
const modules=[];
for(const file of ['motion.js','letter-scene-motion.js','face.js','renderer.js','zodiac-patterns.js','sky.js','entrance-motion.js','journey.js']){
  const source=await readFile(path.join(library,'src',file),'utf8');
  modules.push(source.replace(/^import .+;\n/gm,'').replace(/^export /gm,''));
}
const script='(()=>{\n'+assets.replace('export const assets','const assetBundle')+'\n'+modules.join('\n')+'\ncreateHintJourney(document.getElementById("hint-journey"),{assets:assetBundle}).then(api=>{window.hintJourney=api;const t=new URLSearchParams(location.search).get("t");if(t!==null)api.seek(Number(t));});\n})();';
new vm.Script(script);
const template=await readFile(path.join(library,'src/journey.template.html'),'utf8');
const output=path.join(library,'preview/journey.html');assertWorkingOutput(output);
await writeFile(output,template.replace('__JOURNEY_SCRIPT__',()=>script));
console.log(JSON.stringify({output,bytes:Buffer.byteLength(script)}));
