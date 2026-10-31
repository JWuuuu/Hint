import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const library = fileURLToPath(new URL('../', import.meta.url));
export const approved = path.join(library, 'approved/v1');
export async function verifyApproved() {
  const sourceRoot=path.resolve(library,'../..');
  const protectedV1=JSON.parse(await readFile(path.join(library,'baseline/protected-v1.json'),'utf8'));
  const savedV1=createHash('sha256').update(await readFile(path.join(library,'baseline/v1.html'))).digest('hex');
  if(savedV1!==protectedV1['preview/index.html'])throw Error('The saved v1 comparison changed.');
  let protectedFiles=0;
  if(path.basename(sourceRoot)==='mascot-library'){
    for(const [name,expected] of Object.entries(protectedV1)){
      const actual=createHash('sha256').update(await readFile(path.join(sourceRoot,name))).digest('hex');
      if(actual!==expected)throw Error('Protected v1 file changed: '+name);
      protectedFiles++;
    }
  }
  const protectedV2=JSON.parse(await readFile(path.join(library,'baseline/protected-v2.json'),'utf8'));
  let protectedV2Files=0;
  if(path.basename(sourceRoot)==='mascot-library')for(const [name,expected] of Object.entries(protectedV2)){
    const actual=createHash('sha256').update(await readFile(path.join(sourceRoot,name))).digest('hex');
    if(actual!==expected)throw Error('Protected v2 file changed: '+name);
    protectedV2Files++;
  }
  const savedV2=createHash('sha256').update(await readFile(path.join(library,'baseline/v2.html'))).digest('hex');
  if(savedV2!==protectedV2['versions/v2/preview/index.html'])throw Error('The saved v2 comparison changed.');
  const protectedV3=JSON.parse(await readFile(path.join(library,'baseline/protected-v3.json'),'utf8'));
  const savedV3=createHash('sha256').update(await readFile(path.join(library,'baseline/v3.html'))).digest('hex');
  if(savedV3!==protectedV3['versions/v3/preview/index.html'])throw Error('The saved v3 comparison changed.');
  let protectedV3Files=0;
  if(path.basename(sourceRoot)==='mascot-library')for(const [name,expected] of Object.entries(protectedV3)){
    const actual=createHash('sha256').update(await readFile(path.join(sourceRoot,name))).digest('hex');
    if(actual!==expected)throw Error('Protected v3 file changed: '+name);
    protectedV3Files++;
  }
  const manifest = JSON.parse(await readFile(path.join(approved, 'checksums.json'), 'utf8'));
  for (const [name, expected] of Object.entries(manifest.files)) {
    const file = path.join(approved, name);
    const actual = createHash('sha256').update(await readFile(file)).digest('hex');
    if (actual !== expected) throw new Error(`Approved file changed: ${name}`);
    if ((await stat(file)).mode & 0o222) throw new Error(`Approved file is writable: ${name}`);
  }
  if (manifest.greetingSha256 !== 'fbda0c5e0722a0a9f706b1323336f3d4a704d2cb91252e28e5eca42725200191') {
    throw new Error('The approved greeting does not match the saved reference.');
  }
  return { files: Object.keys(manifest.files).length, protectedV1Files:protectedFiles, protectedV2Files, protectedV3Files, greetingSha256: manifest.greetingSha256, collectionV1Sha256:savedV1, collectionV2Sha256:savedV2, collectionV3Sha256:savedV3 };
}

export function assertWorkingOutput(target) {
  const relative = path.relative(library, path.resolve(target));
  const first = relative.split(path.sep)[0];
  if (!['preview', 'evidence', 'releases', 'assets'].includes(first)) {
    throw new Error('Output must stay in the working library; approved snapshots cannot be rebuilt.');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await verifyApproved()));
}
