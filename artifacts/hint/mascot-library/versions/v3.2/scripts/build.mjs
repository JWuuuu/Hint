import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { gzipSync } from 'node:zlib';
import { library, approved, verifyApproved, assertWorkingOutput } from './verify-approved.mjs';

await verifyApproved();
const output = path.join(library, 'preview/hint-gestures.html');
assertWorkingOutput(output);
const images = {};
for (const name of ['expression-body','expression-eyes','connected-thinking','connected-listening',...Array.from({length:6},(_,i)=>`paw-${i}`),'envelope','letter-detail','daily-card-back','daily-card-front','approved-rest',...['left','right'].flatMap(side=>Array.from({length:7},(_,i)=>`letter-${side}-${i}`))]) {
  images[name] = 'data:image/webp;base64,' + (await readFile(path.join(library, 'assets', name + '.webp'))).toString('base64');
}
const assets = { images, geometry: JSON.parse(await readFile(path.join(library, 'assets/geometry.json'), 'utf8')) };
images['empty-rest']='data:image/png;base64,'+(await readFile(path.join(library,'assets/empty-rest.png'))).toString('base64');
assets.letterGeometry=JSON.parse(await readFile(path.join(library,'assets/letter-geometry.json'),'utf8'));
assets.expressionGeometry=JSON.parse(await readFile(path.join(library,'assets/expression-geometry.json'),'utf8'));
assets.expressionGeometry.connected=JSON.parse(await readFile(path.join(library,'assets/connected-geometry.json'),'utf8'));
await writeFile(path.join(library,'preview/hint-assets.js'),'export const assets = '+JSON.stringify(assets)+';\n');
const original = await readFile(path.join(approved, 'hint-drawn-paw.html'), 'utf8');
const comparisonV3 = gzipSync(await readFile(path.join(library,'baseline/v3.html')),{level:9}).toString('base64');
const comparisonV2 = gzipSync(await readFile(path.join(library,'baseline/v2.html')),{level:9}).toString('base64');
const comparison = gzipSync(await readFile(path.join(library,'baseline/v1.html')),{level:9}).toString('base64');
const modules = [];
for (const file of ['motion.js','letter-scene-motion.js', 'face.js','renderer.js', 'controller.js', 'preview.js']) {
  const source = await readFile(path.join(library, 'src', file), 'utf8');
  modules.push(source.replace(/^import .+ from '\.\/.+';\n/gm, '').replace(/^export /gm, ''));
}
const script = '(() => {\nconst assetBundle = ' + JSON.stringify(assets) + ';\nconst collectionV3Gzip = '+JSON.stringify(comparisonV3)+';\nconst collectionV1Gzip = '+JSON.stringify(comparison)+';\nconst collectionV2Gzip = '+JSON.stringify(comparisonV2)+';\nconst approvedGreeting = ' + JSON.stringify(original).replace(/</g, '\\u003c') + ';\n' + modules.join('\n') + '\n})();';
new vm.Script(script);
const template = await readFile(path.join(library, 'src/preview.template.html'), 'utf8');
const html = template.replace('__LIBRARY_SCRIPT__', () => script);

await writeFile(output, html);
await writeFile(path.join(library, 'preview/index.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hint gestures v3.2</title><style>body{margin:0;padding:0 12px;background:#f3eef1}</style></head><body>' + html + '</body></html>');
await verifyApproved();
console.log(JSON.stringify({ output, bytes: Buffer.byteLength(html) }));
