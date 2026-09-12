// Isolated video production only. Never connects to a live API or edits app source.
import { webkit, expect } from '/Users/jwu/Documents/Hint-main/artifacts/hint/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const out = '/Users/jwu/Documents/Hint-main/artifacts/hint/docs/demo-2026-09-11';
await mkdir(`${out}/raw`, { recursive: true });
const browser = await webkit.launch();
const owner = 'hint-demo-film-fictional-amelia';
const profile = { id: owner, anonId: owner, name: 'Amelia Rose', birthDate: '1995-05-15', birthTime: '10:20', birthPlace: 'Chicago, Illinois, United States', latitude: 41.87, longitude: -87.62, timezone: 'America/Chicago', timezoneOffset: -5, createdAt: '2026-09-11T12:00:00Z', updatedAt: '2026-09-11T12:00:00Z' };
const context = await browser.newContext({ viewport: { width: 720, height: 1280 }, hasTouch: true, reducedMotion: 'no-preference', recordVideo: { dir: `${out}/raw`, size: { width: 720, height: 1280 } } });
await context.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'ISOLATED_DEMO_NO_LIVE_SERVICE' } }));
await context.addInitScript(({ owner, profile }) => {
  const originalGet = Storage.prototype.getItem;
  Storage.prototype.getItem = function(key) {
    if (key.startsWith('hint_device_session_v1:') && originalGet.call(this,key) === null) this.setItem(key, JSON.stringify({token:'isolated-demo-token-00000000000000000000000000000000', ownerId:owner, expiresAt:'2099-01-01T00:00:00Z'}));
    return originalGet.call(this,key);
  };
  if (!localStorage.getItem('hint_anon_id')) {
    localStorage.setItem('hint_anon_id',owner);
    localStorage.setItem('hint_onboarding_complete_v3','1');
    localStorage.setItem('hint_launch_seen_v2','1');
    localStorage.setItem('hint-language','en');
    localStorage.setItem('hint-theme','bright');
    localStorage.setItem('hint.preferences.v1',JSON.stringify({reduceMotion:false,soundAndHaptics:false}));
    localStorage.setItem(`hint_profile_v2_${owner}`,JSON.stringify(profile));
    localStorage.setItem(`hint_birth_profile_v3:${owner}`,JSON.stringify(profile));
  }
}, { owner, profile });
await context.route('**/api/profile**', route => route.fulfill({ json: profile }));
await context.route('**/api/readings**', route => route.fulfill({ json: [] }));
await context.route('**/api/tarot/spread-recommendation', route => route.fulfill({ json: { spreadType:'three', reason:'A little space to notice where you are, what is unfolding, and one gentle next step.', focusLabel:'Room for a new beginning', confidence:'high',source:'api' } }));
await context.route('**/api/tarot/structured-reading', route => {
  const request = route.request().postDataJSON();
  return route.fulfill({ json: { source:'api', signal_type:'clear_signal', overall_summary:'You do not need the whole path today. Make a little room for the next honest step.', cards:request.cards.map(card=>({position:card.position,card_name:card.name,orientation:card.orientation,meaning:'Notice what feels steady, what asks for care, and what you can begin gently.'})),final_action_advice:'Choose one small thing that feels true to you.',follow_up_invitation:'What would you like to understand more clearly?' } });
});
const placements = [['sun','taurus',24.5],['moon','cancer',1.2],['rising','libra',17.2],['mercury','gemini',4],['venus','taurus',10],['mars','leo',18],['jupiter','sagittarius',14],['saturn','pisces',23],['uranus','capricorn',26],['neptune','capricorn',23],['pluto','scorpio',28]].map(([body,sign,degree])=>({body,sign,degree}));
await context.route('**/api/astro/natal', route => route.fulfill({json:{source:'astrologyapi',mode:'live',cached:false,fetchedAt:'2026-09-11T12:00:00Z',profileHash:'explicit-illustrative-demo-chart',calculation:{zodiacSystem:'tropical',houseSystem:null,returned:{placements:placements.length,houses:0,aspects:2}},chart:{placements,houses:[],aspects:[{from:'sun',to:'saturn',type:'sextile',orb:1.5},{from:'mercury',to:'jupiter',type:'opposition',orb:10}],elementBalance:{},modalityBalance:{}}} }));

const start = performance.now();
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const shots = [];
let shot;
const time = () => (performance.now()-start)/1000;
const pause = ms => page.waitForTimeout(ms);
async function caption(title,detail='') { await page.evaluate(({title,detail})=>{document.querySelector('#film-title').textContent=title;document.querySelector('#film-detail').textContent=detail;},{title,detail}); }
function begin(name){shot={name,start:time()};console.log('SHOT',name,shot.start.toFixed(2));}
function end(){shot.end=time();shots.push(shot);shot=null;}
async function snap(name){await page.screenshot({path:`${out}/${name}.png`});}
const phone = page.frameLocator('iframe.hint-preview-screen');
async function appScroll(delta,duration=1000){await phone.locator('.reference-home-crisp, .hint-app-scroll').last().evaluate((el,{delta,duration})=>new Promise(resolve=>{const from=el.scrollTop,start=performance.now();function tick(now){const t=Math.min(1,(now-start)/duration);el.scrollTop=from+delta*(1-Math.pow(1-t,3));if(t<1)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);}),{delta,duration});}
async function home(){
  const candidate=phone.locator('a[href="/app"],button[data-room-target="/app"]').first();
  if(await candidate.count()) await candidate.click();else await phone.getByRole('button',{name:/Home|Return home/i}).first().click();
  const leave=phone.getByRole('button',{name:'Leave and start fresh',exact:true});
  if(await leave.isVisible({timeout:800}).catch(()=>false))await leave.click();
  await expect(phone.locator('.reference-home-crisp')).toBeVisible();
}
try {
  await page.goto('http://127.0.0.1:5234/app?hintPreview=frame');
  await expect(phone.locator('.reference-home-crisp')).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  await page.addStyleTag({content:`
    .hint-preview-workspace{background:radial-gradient(ellipse at 10% 25%,#eee2ec,transparent 55%),radial-gradient(ellipse at 95% 85%,#e6e5f0,transparent 55%),#f7f3ee!important;padding-top:105px!important;gap:0!important}
    .hint-preview-toolbar{display:none!important}.hint-preview-phone{box-shadow:0 20px 55px #44334229,0 0 0 1px #6c50632a!important}
    #film-brand{position:fixed;top:33px;left:0;right:0;text-align:center;z-index:10000;color:#625166;font:25px Georgia,serif;letter-spacing:13px;padding-left:13px}
    #film-caption{position:fixed;bottom:46px;left:32px;right:32px;text-align:center;z-index:10000;color:#514058;pointer-events:none}#film-title{font:34px/1.2 Georgia,serif}#film-detail{font:15px/1.6 system-ui,sans-serif;color:#817081;margin-top:11px;letter-spacing:.3px}
    #film-note{position:fixed;bottom:17px;left:0;right:0;z-index:10000;text-align:center;color:#918291;font:9px system-ui,sans-serif;letter-spacing:2px}
    #film-slate{position:fixed;inset:0;z-index:11000;display:grid;place-items:center;background:radial-gradient(ellipse at 20% 30%,#e8dce7,transparent 65%),radial-gradient(ellipse at 85% 75%,#e4e4ef,transparent 55%),#f8f4ee;color:#514058;text-align:center}
    #film-slate .mark{font:84px Georgia,serif;letter-spacing:15px;margin-bottom:35px;padding-left:15px}#film-slate .line{width:50px;height:1px;background:#b79caf;margin:0 auto 30px}#film-slate h1{font:37px/1.3 Georgia,serif;font-weight:normal;max-width:550px;margin:0 auto}#film-slate p{font:15px/1.6 system-ui,sans-serif;letter-spacing:1px;color:#877687;margin-top:28px}
  `});
  await page.evaluate(()=>{
    const holder=document.createElement('div');holder.innerHTML='<div id="film-brand">HINT</div><div id="film-caption"><div id="film-title"></div><div id="film-detail"></div></div><div id="film-note">LOCAL BETA · DEMONSTRATION DATA</div><div id="film-slate"><div><div class="mark">Hint</div><div class="line"></div><h1>The universe leaves you<br>a letter every day.</h1><p>A little space to listen.</p></div></div>';document.body.append(holder);
  });
  await pause(500);begin('intro');await pause(3000);end();
  await page.evaluate(()=>document.querySelector('#film-slate').style.display='none');
  await caption('A letter, every day.','A moment that belongs to you.');begin('home');await pause(2600);await snap('home');await appScroll(420,1400);await pause(1200);end();
  await caption('Make room for a question.','Step into your Tarot Room.');
  const tarot=phone.locator('.reference-home-crisp a[href$="/app/tarot"]').last();await tarot.scrollIntoViewIfNeeded();await pause(300);begin('tarot-arrival');await tarot.click();await expect(phone.getByPlaceholder('Type your question...')).toBeVisible();await pause(1700);await phone.getByPlaceholder('Type your question...').pressSequentially('What can I make room for today?',{delay:37});await pause(500);end();
  await caption('A spread for this moment.','Find the shape of your reading.');begin('spread');await phone.getByRole('button',{name:'Next',exact:true}).click();await expect(phone.getByRole('button',{name:'Use this spread',exact:true})).toBeVisible();await pause(2000);await snap('spread');end();
  await phone.getByRole('button',{name:'Use this spread',exact:true}).click();
  await phone.getByRole('button',{name:/^Customize/i}).click();
  await expect(phone.getByRole('button',{name:/Begin the ritual/i})).toBeVisible();
  await phone.getByTestId('tarot-room-background-sea').click();
  await phone.getByRole('button',{name:/Begin the ritual/i}).click();await expect(phone.getByRole('button',{name:'Auto Wash',exact:true})).toBeVisible();
  await caption('Slow down. Set an intention.','Let the ritual unfold.');begin('wash');await pause(650);await phone.getByRole('button',{name:'Auto Wash',exact:true}).click();await pause(3900);await snap('wash');end();
  await expect(phone.getByRole('heading',{name:'Pick Cards',exact:true})).toBeVisible({timeout:35000});
  await caption('Follow what draws you.','Three cards. A new perspective.');begin('pick');await pause(850);
  for(let i=0;i<3;i++){await phone.getByRole('button',{name:/Lift card/}).nth(18).press('Enter');await pause(450);await phone.getByRole('button',{name:/Confirm card/}).first().press('Enter');await pause(600);}
  await snap('pick');end();
  await caption('A little clarity to carry with you.','An invitation to reflect.');begin('reveal');await phone.getByRole('button',{name:/Reveal Reading/i}).click();await expect(phone.getByText('The cards are open.',{exact:true})).toBeVisible();await pause(2200);await snap('reveal');end();
  await home();
  const astro=phone.locator('.reference-home-crisp a[href$="/app/astrology"]').last();await astro.scrollIntoViewIfNeeded();
  await caption('Your sign is a beginning.','Explore the language of the sky.');begin('astrology-arrival');await astro.click();await expect(phone.getByTestId('astrology-screen')).toBeVisible();await pause(1800);await appScroll(390,1100);await pause(800);await snap('astrology');end();
  const sign=phone.locator('.astro-sign-choice').filter({has:phone.getByText('Libra',{exact:true})});await sign.scrollIntoViewIfNeeded();await sign.click();await expect(phone.getByRole('heading',{name:'Libra',exact:true})).toBeVisible();await pause(300);
  await caption('There is more to your story.','Signs, patterns, and gentle reflection.');begin('zodiac');await pause(1800);await appScroll(230,900);await pause(800);end();
  await phone.getByRole('navigation',{name:'Astrology sections'}).getByRole('button',{name:'My chart',exact:true}).click();
  await expect(phone.getByTestId('astro-wheel')).toBeVisible({timeout:20000});
  await caption('A sky that invites a closer look.','Interactive birth chart · illustrative sample');
  const wheel=phone.getByTestId('astro-wheel');await wheel.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await pause(700);begin('chart');await pause(2600);await snap('chart');end();
  await home();
  const me=phone.locator('a[href="/app/profile"]').last();await me.scrollIntoViewIfNeeded();
  await caption('Your own quiet corner.','Your profile, preferences, and saved moments.');begin('me');await me.click();await expect(phone.getByTestId('button-edit-profile')).toBeVisible();await pause(1600);await appScroll(270,1300);await pause(1100);await snap('me');end();
  await page.evaluate(()=>{const slate=document.querySelector('#film-slate');slate.querySelector('h1').innerHTML='A little closer<br>to yourself.';slate.querySelector('p').textContent='Tarot · Astrology · A moment for you';slate.style.display='grid';});begin('outro');await pause(3000);await snap('poster');end();
} catch(error){console.error(error);await snap('capture-error');await writeFile(`${out}/capture-error.txt`,String(error)+'\n'+await phone.locator('body').innerText());throw error;}
finally{
  if(shot)end();
  await context.close();
  const raw=await page.video().path();
  await writeFile(`${out}/timeline.json`,JSON.stringify({source:'http://127.0.0.1:5234',device:'iPhone 17 Pro Max,440x956',canvas:{width:720,height:1280},fictionalData:true,liveAPIs:false,appSourceModified:false,raw,rawElapsed:time(),shots,errors},null,2));
  await browser.close();
}
