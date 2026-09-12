import { webkit } from '/Users/jwu/Documents/Hint-main/artifacts/hint/node_modules/@playwright/test/index.mjs';
import { writeFile } from 'node:fs/promises';

const browser = await webkit.launch();
const samples = [];
for (const viewport of [{ width:375,height:667 }, { width:440,height:956 }]) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    for (const candidate of [{ name:'before',port:5205 }, {name:'after',port:5219}]) {
      const context = await browser.newContext({ viewport, hasTouch:true, isMobile:true, reducedMotion:'no-preference' });
      await context.route('**/api/**', route => route.fulfill({status:503,json:{error:'ISOLATED_PERFORMANCE_PREVIEW'}}));
      await context.addInitScript(() => {
        let randomState = 173;
        Math.random = () => { randomState=(randomState*1664525+1013904223)>>>0;return randomState/0x1_0000_0000; };
        const originalGet = Storage.prototype.getItem;
        Storage.prototype.getItem = function(key) {
          if (key.startsWith('hint_device_session_v1:') && originalGet.call(this,key)===null) {
            this.setItem(key,JSON.stringify({token:'isolated-fixture-token-000000000000000000000000000000',ownerId:'isolated-server-owner',expiresAt:'2099-01-01T00:00:00Z'}));
          }
          return originalGet.call(this,key);
        };
        localStorage.setItem('hint_onboarding_complete_v3','1');
        localStorage.setItem('hint_local_auth_v1',JSON.stringify({identifier:'wash-preview@hint.local',provider:'email',email:'wash-preview@hint.local',name:'Fictional Reader',verifiedAt:'2026-09-10T00:00:00.000Z',createdAt:'2026-09-10T00:00:00.000Z',lastSignedInAt:'2026-09-10T00:00:00.000Z'}));
      });
      const page = await context.newPage();
      await page.route('**/api/profile**', route=>route.fulfill({status:200,json:{anonId:'isolated-wash-reader',name:'Fictional Reader',birthDate:null,birthTime:null,birthPlace:null,createdAt:'2026-09-10T00:00:00.000Z'}}));
      await page.route('**/api/tarot/spread-recommendation',route=>route.fulfill({status:200,json:{spreadType:'three',reason:'Three moments for a quiet reflection.',focusLabel:'A quiet letter',confidence:'high',source:'api'}}));
      await page.goto(`http://127.0.0.1:${candidate.port}/app/tarot?hintPreview=embedded`);
      await page.getByPlaceholder('Type your question...').fill('What would help me make space today?');
      await page.getByRole('button',{name:'Next',exact:true}).click();
      await page.getByRole('button',{name:/Use this spread/i}).click();
      await page.getByRole('button',{name:/^Customize/i}).click();
      await page.getByTestId('tarot-room-background-sea').click();
      await page.getByRole('button',{name:/Begin the ritual/i}).click();
      await page.getByRole('button',{name:'Auto Wash',exact:true}).waitFor();
      await page.waitForTimeout(600);
      const table = page.getByTestId('tarot-wash-table');
      const box = await table.boundingBox();
      await page.evaluate(() => {
        window.washPerf={frames:[],active:true,last:performance.now()};
        const frame = now=>{const perf=window.washPerf;if(!perf.active)return;perf.frames.push(now-perf.last);perf.last=now;requestAnimationFrame(frame);};
        requestAnimationFrame(frame);
      });
      await page.mouse.move(box.x+box.width*.77,box.y+box.height*.52);
      await page.mouse.down();
      for(let point=1;point<=48;point+=1){
        const angle=point/48*Math.PI*4;
        await page.mouse.move(box.x+box.width*(.5+Math.cos(angle)*.27),box.y+box.height*(.52+Math.sin(angle)*.25));
        await page.waitForTimeout(24);
      }
      const manual = await page.evaluate(() => {window.washPerf.active=false;return window.washPerf.frames.slice(1);});
      const released = Date.now();
      await page.mouse.up();
      await page.getByRole('heading',{name:'Cutting the deck.',exact:true}).waitFor({timeout:6000});
      const ordered=[...manual].sort((a,b)=>a-b);
      const percentile = p=>ordered[Math.ceil(ordered.length*p)-1];
      const result={candidate:candidate.name,viewport,attempt,frames:manual.length,p50:percentile(.5),p95:percentile(.95),max:ordered.at(-1),over100:manual.filter(v=>v>=100).length,releaseToCutMs:Date.now()-released};
      samples.push(result);
      console.log(JSON.stringify(result));
      await context.close();
    }
  }
}
await browser.close();
await writeFile('/tmp/hint-wash-refinement-20260910/performance.json',JSON.stringify({environment:'Desktop WebKit, mobile viewport, no native device. Sequential old/new comparisons, same fictional inputs, 3 repetitions each. No video recording during measurement.',samples},null,2));
