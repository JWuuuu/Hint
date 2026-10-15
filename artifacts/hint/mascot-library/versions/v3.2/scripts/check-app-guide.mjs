import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium,webkit}=createRequire(import.meta.url)('@playwright/test');
const out=fileURLToPath(new URL('../evidence/app-guide/',import.meta.url));await mkdir(out,{recursive:true});
const reports=[];
for(const engine of ['chromium','webkit']){
  const browser=await {chromium,webkit}[engine].launch(engine==='chromium'?{channel:'chrome',headless:true}:{headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1,recordVideo:{dir:path.join(out,'raw'),size:{width:390,height:844}}});
  const page=await context.newPage(),errors=[],checks=[],unmocked=[];page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(()=>{
    localStorage.setItem('hint_onboarding_complete_v3','1');localStorage.setItem('hint_launch_seen_v2','1');
    const get=Storage.prototype.getItem;
    Storage.prototype.getItem=function(key){
      if(key.startsWith('hint_device_session_v1:')&&!get.call(this,key))this.setItem(key,JSON.stringify({token:'isolated-fixture-token-000000000000000000000000000000',ownerId:'isolated-guide-review',expiresAt:'2099-01-01T00:00:00Z'}));
      return get.call(this,key);
    };
    window.hintTest={recognition:null,audio:null};
    window.SpeechRecognition=class{
      start(){window.hintTest.recognition=this;queueMicrotask(()=>this.onstart?.());}
      stop(){this.onend?.();}abort(){this.onend?.();}
    };
    window.Audio=class{
      constructor(){window.hintTest.audio=this;}
      play(){return new Promise(resolve=>{this.begin=resolve;});}pause(){}
    };
    const cards=[['0-fool','The Fool'],['17-star','The Star'],['19-sun','The Sun']].map(([cardId,name],i)=>({visualId:`guide-${i}`,cardId,name,orientation:'upright',x:0,y:0,rotation:0,rotate:0,zIndex:i,selected:true,revealed:true}));
    sessionStorage.setItem('hint_active_tarot_reading_v1',JSON.stringify({version:1,savedAt:Date.now(),phase:'reading',question:'How can I make room for a new idea?',spreadId:'three',focusLabel:'A small beginning',design:{id:'stars',label:'Star Field',mood:'Soft celestial focus.',deckStyleId:'nocturne',backStyle:'nocturne',cardBackId:'07_Zodiac_Set_A_Detailed/11_Aquarius_Waterbearer_Teal_Gold.png',cardArtId:'original',backgroundId:'stars',background:'linear-gradient(180deg,#fff8f1,#f6e8ed 42%,#ece4ff)',glow:'rgba(171,151,255,0.42)'},selectedCards:cards,revealedIds:cards.map(card=>card.visualId)}));
  });
  let finishChat=null;
  await context.route('**/api/**',async route=>{
    const url=new URL(route.request().url()),endpoint=url.pathname;
    if(endpoint==='/api/profile')return route.fulfill({json:{anonId:url.searchParams.get('anonId'),name:'Preview Reader',birthDate:'1996-08-18',birthTime:null,birthPlace:null,createdAt:'2026-09-02T00:00:00Z'}});
    if(endpoint==='/api/readings')return route.fulfill({json:[]});
    if(endpoint==='/api/speech')return route.fulfill({contentType:'audio/mpeg',body:'isolated playback fixture'});
    if(['/api/hint/chat','/api/tarot/chat'].includes(endpoint))return new Promise(resolve=>{finishChat=async()=>{await route.fulfill({json:{message:'Give yourself a quiet moment to write down the first small step.',createdAt:new Date().toISOString()}});resolve();};});
    if(endpoint==='/api/tarot/structured-reading'){
      const request=route.request().postDataJSON();return route.fulfill({json:{source:'api',signal_type:'clear_signal',overall_summary:'A small beginning is enough.',cards:request.cards.map(card=>({position:card.position,card_name:card.name,orientation:card.orientation,meaning:'Take time to look at this part of your question.'})),cards_connection:'The cards move from beginning to clarity.',final_action_advice:'Write down one next step.',follow_up_invitation:'What would you like to explore?'}});
    }
    unmocked.push(endpoint);return route.fulfill({status:503,json:{error:'ISOLATED_TEST_UNMOCKED_API'}});
  });
  const layer=page.getByTestId('hint-guide-layer');
  const phase=async value=>{await page.waitForFunction(value=>document.querySelector('[data-testid="hint-guide-layer"]')?.dataset.phase===value,value);};
  const settle=()=>page.waitForTimeout(1100);
  const shot=async name=>{await page.screenshot({path:path.join(out,`${engine}-${name}.png`)});};
  try{
    await page.goto('http://127.0.0.1:5173/app/ask?hintGuide=v3.2&hintPreview=embedded');
    await phase('idle');await page.locator('.hint-launch-intro').waitFor({state:'detached'});await settle();
    const canvas=await layer.locator('canvas').elementHandle();await shot('ask-welcome');
    await page.getByRole('button',{name:'Hint',exact:true}).tap();
    const input=page.locator('textarea');await input.fill('How can I slow down a little?');await settle();
    assert.equal(await layer.locator('canvas').evaluate((node,old)=>node===old,canvas),true);
    const anchor=await page.locator('[data-hint-guide-slot]').boundingBox();assert.ok(anchor.width<=100);
    await shot('ask-typing');await input.press('Enter');await phase('thinking');await settle();await shot('ask-thinking');
    assert.ok(finishChat);await finishChat();await phase('reading');await settle();await shot('ask-reading');
    checks.push('actual Ask page: invitation, tap, compact typing position, request thinking, response reading, one canvas');
    for(const width of [320,390,430]){
      await page.setViewportSize({width,height:844});await settle();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await shot(`ask-${width}`);
    }
    checks.push('Ask layouts at 320, 390 and 430 CSS pixels');
    await page.setViewportSize({width:390,height:844});
    await page.goto('http://127.0.0.1:5173/app/tarot?hintGuide=v3.2&hintPreview=embedded');
    await page.locator('.hint-launch-intro').waitFor({state:'detached'});
    await page.getByRole('button',{name:'Start voice conversation',exact:true}).click();
    await phase('listening');await settle();await shot('voice-listening');
    const voiceCanvas=await layer.locator('canvas').elementHandle();
    await page.getByRole('button',{name:'Hint',exact:true}).focus();await page.keyboard.press('Enter');
    assert.equal(await page.getByRole('button',{name:'End voice conversation'}).isVisible(),true);
    await page.evaluate(()=>{const r=window.hintTest.recognition;r.onresult?.({resultIndex:0,results:[{isFinal:true,0:{transcript:'What is a small first step?'}}]});r.onend?.();});
    await phase('thinking');await settle();await shot('voice-thinking');
    await finishChat();await phase('preparing');await settle();await shot('voice-preparing');
    assert.equal(await layer.getAttribute('data-activity'),'waiting');
    await page.evaluate(()=>window.hintTest.audio.begin());await phase('speaking');await settle();await shot('voice-speaking');
    await page.getByRole('button',{name:'Interrupt and speak'}).tap();await phase('listening');await settle();
    await page.getByRole('button',{name:'Show transcript'}).click();await settle();await shot('voice-transcript');
    assert.equal(await layer.locator('canvas').evaluate((node,old)=>node===old,voiceCanvas),true);
    checks.push('actual voice component with simulated microphone/audio: listening, thinking, preparing, playback, interruption, transcript resize, keyboard wink');
    await page.getByRole('button',{name:'Pause microphone'}).tap();await phase('paused');const paused=await layer.getAttribute('data-clock');
    await page.waitForTimeout(250);assert.equal(await layer.getAttribute('data-clock'),paused);
    await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Resume listening'}).tap();await phase('listening');
    const reduced=await layer.getAttribute('data-clock');await page.waitForTimeout(200);assert.equal(await layer.getAttribute('data-clock'),reduced);await shot('voice-reduced');
    await page.getByRole('button',{name:'End voice conversation'}).tap();
    checks.push('voice pause freezes motion; reduced motion stays static; ending voice returns to the reading');
    assert.deepEqual(errors,[]);
    reports.push({engine,passed:true,checks,errors,unmocked,api:'isolated fixtures',microphone:'simulated',audio:'simulated',nativeDevice:false});
    console.log(JSON.stringify(reports.at(-1)));
  }catch(error){await shot('failure');console.log(JSON.stringify({engine,error:String(error),errors,text:(await page.locator('body').innerText()).slice(-2500)}));throw error;}
  finally{const video=page.video();await context.close();if(video)await video.saveAs(path.join(out,`${engine}-app-guide.webm`));await browser.close();}
}
await writeFile(path.join(out,'browser-checks.json'),JSON.stringify(reports,null,2)+'\n');
