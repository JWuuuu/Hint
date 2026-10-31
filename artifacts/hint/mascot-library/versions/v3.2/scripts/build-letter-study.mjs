import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {library,verifyApproved,assertWorkingOutput} from './verify-approved.mjs';
await verifyApproved();
const assets=await readFile(path.join(library,'preview/hint-assets.js'),'utf8'),modules=[];
for(const file of ['motion.js','letter-scene-motion.js','face.js','renderer.js','letter-study.js']){
  const source=await readFile(path.join(library,'src',file),'utf8');modules.push(source.replace(/^import .+;\n/gm,'').replace(/^export /gm,''));
}
const script='(()=>{\n'+assets.replace('export const assets','const assetBundle')+'\n'+modules.join('\n')+'\ncreateLetterStudy(document.getElementById("hint-letter"),{assets:assetBundle}).then(api=>{window.hintLetter=api;const p=new URLSearchParams(location.search);if(p.has("t"))api.seek(p.get("phase")||"offer",Number(p.get("t")));});\n})();';
new vm.Script(script);
const output=path.join(library,'preview/letter.html');assertWorkingOutput(output);
await writeFile(output,(await readFile(path.join(library,'src/letter-study.template.html'),'utf8')).replace('__LETTER_SCRIPT__',()=>script));
console.log(JSON.stringify({output,bytes:Buffer.byteLength(script)}));
