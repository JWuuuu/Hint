import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium,webkit}=createRequire(import.meta.url)('@playwright/test');
const root=fileURLToPath(new URL('../',import.meta.url)),archive=path.resolve(process.argv[2]||'');
assert.ok(archive.startsWith(path.join(root,'iterations')+path.sep)&&archive.endsWith('.zip'));
const extracted=JSON.parse(execFileSync('python3',['-c',`
from pathlib import Path
from hashlib import sha256
import json, os, sys, tempfile, zipfile
archive = Path(sys.argv[1])
expected = (archive.parent / 'archive.sha256').read_text().split()[0]
assert sha256(archive.read_bytes()).hexdigest() == expected
target = Path(tempfile.mkdtemp(prefix='hint-study-check-'))
with zipfile.ZipFile(archive) as saved:
    assert saved.testzip() is None
    saved.extractall(target)
    for entry in saved.infolist():
        mode = entry.external_attr >> 16
        if mode:
            os.chmod(target / entry.filename, mode & 0o777)
folder = next(target.iterdir())
manifest = json.loads((folder / 'MANIFEST.json').read_text())
for name, checksum in manifest['files'].items():
    assert sha256((folder / name).read_bytes()).hexdigest() == checksum, name
print(json.dumps({'folder': str(folder), 'files': len(manifest['files']), 'sha256': expected}))
`,archive],{encoding:'utf8'}));
const checks=[];
for(const engine of ['chromium','webkit']){
  const browser=await ({chromium,webkit}[engine]).launch(engine==='chromium'?{channel:'chrome',headless:true}:{headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),errors=[],network=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))network.push(request.url());});
  await page.goto(pathToFileURL(path.join(extracted.folder,'preview/journey.html')).href);await page.waitForFunction(()=>window.hintJourney);
  await page.evaluate(()=>{window.hintJourney.seek(5.3);window.hintJourney.resume();});
  await page.locator('[data-actor]').tap();await page.waitForFunction(()=>window.hintJourney.getState().pose.eyeRight>.98);
  const wink=await page.evaluate(()=>window.hintJourney.getState());assert.ok(wink.pose.pawWave>.99);assert.ok(wink.pose.eyeLeft<.05);
  await page.locator('[data-continue]').tap();await page.waitForFunction(()=>window.hintJourney.getState().phase==='profile');
  await page.locator('#first-name').fill('Jamie');await page.locator('#birth-date').fill('2000-03-21');await page.locator('[data-profile-form] button').tap();
  await page.waitForFunction(()=>window.hintJourney.getState().letter==='offered');await page.locator('[data-accept]').tap();
  await page.waitForFunction(()=>window.hintJourney.getState().letterPhase==='reading');await page.locator('[data-flip]').tap();
  await page.waitForFunction(()=>window.hintJourney.getState().flipTime>=1);
  assert.equal(await page.evaluate(()=>window.hintJourney.getState().letter),'delivered');
  await page.locator('[data-stage]').screenshot({path:path.join(root,'evidence/welcome-letter',`${engine}-extracted-study.png`)});
  await page.goto(pathToFileURL(path.join(extracted.folder,'preview/letter.html')).href);await page.waitForFunction(()=>window.hintLetter);
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  checks.push({engine,passed:true,checks:['checksummed extracted files','standalone welcome and wink','profile, handoff and reading','isolated letter loads','no HTTP requests'],errors,network});await browser.close();
}
const report={...extracted,archive,checks};
await writeFile(path.join(root,'evidence/welcome-letter/extracted-study.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
