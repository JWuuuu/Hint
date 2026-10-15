import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {library,verifyApproved,assertWorkingOutput} from './verify-approved.mjs';
await verifyApproved();
const assets=await readFile(path.join(library,'preview/hint-assets.js'),'utf8'),modules=[];
for(const file of ['motion.js','letter-scene-motion.js','face.js','renderer.js','entrance-motion.js','scene-director.js','scene-player.js','conversation-preview.js']){
  modules.push((await readFile(path.join(library,'src',file),'utf8')).replace(/^import .+;\n/gm,'').replace(/^export /gm,''));
}
const script='(()=>{\n'+assets.replace('export const assets','const assetBundle')+'\n'+modules.join('\n')+'\ncreateConversationPreview(document.getElementById("hint-conversation"),assetBundle).then(api=>{window.hintConversation=api;});\n})();';
new vm.Script(script);
const output=path.join(library,'preview/conversation.html');assertWorkingOutput(output);
await writeFile(output,(await readFile(path.join(library,'src/conversation.template.html'),'utf8')).replace('__CONVERSATION_SCRIPT__',()=>script));
console.log(JSON.stringify({output,bytes:Buffer.byteLength(script)}));
