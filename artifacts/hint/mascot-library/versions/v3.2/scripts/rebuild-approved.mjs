import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { approved, library, verifyApproved, assertWorkingOutput } from './verify-approved.mjs';

const { greetingSha256 } = await verifyApproved();
const template = await readFile(path.join(approved,'hint-drawn-paw.template.html'),'utf8');
let engine = await readFile(path.join(approved,'drawn-paw-engine.js'),'utf8');
const assets=[];
for(const name of ['body',...Array.from({length:6},(_,i)=>'paw-'+i)])assets.push('data:image/webp;base64,'+(await readFile(path.join(approved,'paw-poses',name+'.webp'))).toString('base64'));
engine=engine.replace('__GEOMETRY__',await readFile(path.join(approved,'paw-poses/geometry.json'),'utf8')).replace('__ASSETS__',JSON.stringify(assets));
const html=template.replace('__ENGINE__',engine);
const hash=createHash('sha256').update(html).digest('hex');
if(hash!==greetingSha256)throw new Error('Rebuilt greeting differs from the approved snapshot.');
const output=path.join(library,'releases/hint-approved-rebuilt.html');
assertWorkingOutput(output);
try{await writeFile(output,html,{flag:'wx',mode:0o444});}
catch(error){if(error.code!=='EEXIST'||!Buffer.from(html).equals(await readFile(output)))throw error;}
console.log(JSON.stringify({output,sha256:hash,exactMatch:true}));
