import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { gzipSync } from 'node:zlib';
import { library, approved, verifyApproved, assertWorkingOutput } from './verify-approved.mjs';

await verifyApproved();
const output = path.join(library, 'preview/hint-gestures.html');
assertWorkingOutput(output);
const images = {};
for (const name of ['expression-body','expression-eyes','connected-thinking','connected-listening','paw-2','envelope','approved-rest',...['left','right'].flatMap(side=>Array.from({length:6},(_,i)=>`letter-${side}-${i}`))]) {
  images[name] = 'data:image/webp;base64,' + (await readFile(path.join(library, 'assets', name + '.webp'))).toString('base64');
}
const assets = { images, geometry: JSON.parse(await readFile(path.join(library, 'assets/geometry.json'), 'utf8')) };
assets.letterGeometry=JSON.parse(await readFile(path.join(library,'assets/letter-geometry.json'),'utf8'));
assets.expressionGeometry=JSON.parse(await readFile(path.join(library,'assets/expression-geometry.json'),'utf8'));
assets.expressionGeometry.connected=JSON.parse(await readFile(path.join(library,'assets/connected-geometry.json'),'utf8'));
await writeFile(path.join(library,'preview/hint-assets.js'),'export const assets = '+JSON.stringify(assets)+';\n');
const original = await readFile(path.join(approved, 'hint-drawn-paw.html'), 'utf8');
const comparison = gzipSync(await readFile(path.join(library,'baseline/v1.html')),{level:9}).toString('base64');
const modules = [];
for (const file of ['motion.js', 'face.js','renderer.js', 'controller.js', 'preview.js']) {
  const source = await readFile(path.join(library, 'src', file), 'utf8');
  modules.push(source.replace(/^import .+ from '\.\/.+';\n/gm, '').replace(/^export /gm, ''));
}
const script = '(() => {\nconst assetBundle = ' + JSON.stringify(assets) + ';\nconst collectionV1Gzip = '+JSON.stringify(comparison)+';\nconst approvedGreeting = ' + JSON.stringify(original).replace(/</g, '\\u003c') + ';\n' + modules.join('\n') + '\n})();';
new vm.Script(script);
const template = await readFile(path.join(library, 'src/preview.template.html'), 'utf8');
const html = template.replace('__LIBRARY_SCRIPT__', () => script);
if (Buffer.byteLength(html) > 1000000) throw new Error('Preview exceeds the inline size budget.');
await writeFile(output, html);
await writeFile(path.join(library, 'preview/index.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hint gestures v2</title><style>body{margin:0;padding:0 12px;background:#f3eef1}</style></head><body>' + html + '</body></html>');
await verifyApproved();
console.log(JSON.stringify({ output, bytes: Buffer.byteLength(html) }));
